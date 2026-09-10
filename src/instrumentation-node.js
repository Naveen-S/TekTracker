/**
 * Node-runtime half of the instrumentation hooks (observability-and-errors.md pillar 5).
 *
 * This module exists purely as a **bundler boundary**. `src/instrumentation.js` is loaded in BOTH
 * the Node and Edge runtimes, and Turbopack follows a dynamic `import()` into the Edge graph
 * statically — a `process.env.NEXT_RUNTIME` check is a *runtime* guard, so it does not stop the
 * bundling. Importing `@/lib/log` (node:crypto), `@/lib/db` (node:path, node:url via the generated
 * Prisma client) or `@/lib/jira/client` directly from those guarded functions therefore emitted
 * four "A Node.js module is loaded ... not supported in the Edge Runtime" build warnings.
 *
 * Next's own instrumentation guide prescribes the fix used here: the guard imports ONE separate
 * module, and everything Node-only lives behind that single boundary — which the bundler can then
 * keep out of the Edge graph entirely. That is why the imports below are static: this file is only
 * ever reached from the `NEXT_RUNTIME === "nodejs"` branch.
 */
import { logger, runWithContext, newRequestId } from "@/lib/log";
import { recordError } from "@/lib/error-log";
import { ERROR_CODES, isFrameworkSignal } from "@/lib/errors";

/** Required at runtime; reported as presence booleans so a missing secret is obvious at a glance. */
const REQUIRED_ENV = [
  "DATABASE_URL",
  "SESSION_PASSWORD",
  "TOKEN_ENCRYPTION_KEY",
  "JIRA_BASE_URL",
  "CRON_SECRET",
  "CRON_SYNC_USER_EMAIL",
  "AI_PROVIDER",
];

export function register() {
  const env = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, Boolean(process.env[name]?.trim())]),
  );

  logger.info("app.boot", {
    node: process.version,
    nodeEnv: process.env.NODE_ENV ?? null,
    logLevel: process.env.LOG_LEVEL ?? "(default)",
    debugErrors: process.env.DEBUG_ERRORS === "1",
    env,
  });

  // Probes are deliberately NOT awaited: `register` blocks the server from accepting requests, and
  // an unreachable database would otherwise turn a config problem into a slow boot. They report
  // themselves whenever they finish.
  void probeDatabase();
  void probeJira();
}

async function probeDatabase() {
  try {
    const startedAt = Date.now();
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    logger.info("app.boot_db", { ok: true, ms: Date.now() - startedAt });
  } catch (error) {
    // The most valuable line in the log when a deployment is broken: it names the failure before
    // any user has tried to log in.
    logger.error("app.boot_db", { ok: false, err: error });
  }
}

async function probeJira() {
  try {
    const { probeJiraReachable } = await import("@/lib/jira/client");
    const result = await probeJiraReachable();
    logger[result.reachable ? "info" : "error"]("app.boot_jira", result);
  } catch (error) {
    logger.error("app.boot_jira", { reachable: false, err: error });
  }
}

/**
 * Server-side error hook body (Next 16). `err.digest` is the id Next shows the user on the error
 * page, so logging it is what turns "I saw an error page" into a lookup.
 *
 * @param {Error & { digest?: string }} err
 * @param {{ path: string, method: string, headers: Record<string, string | string[]> }} request
 * @param {{ routerKind: string, routePath: string, routeType: string }} context
 */
export async function onRequestError(err, request, context) {
  // `redirect()` and `notFound()` in a server component reach this hook as thrown errors whose
  // digest starts with `NEXT_`. They are control flow, not failures: without this guard every
  // signed-out page view (`redirect("/login")` on /, /admin, /bugs, /leaderboard, /rollup) wrote an
  // ErrorLog row at status 500, burying real incidents under routine navigation. `withRoute` has
  // always applied this rule on the route side; this hook is the render side of the same contract.
  if (isFrameworkSignal(err)) return;

  const requestId = newRequestId(
    typeof request?.headers?.["x-request-id"] === "string" ? request.headers["x-request-id"] : null,
  );

  await runWithContext(
    {
      requestId,
      route: context?.routePath ?? null,
      path: request?.path ?? null,
      method: request?.method ?? null,
      source: "render",
    },
    async () => {
      logger.error("render.error", {
        digest: err?.digest ?? null,
        routeType: context?.routeType ?? null,
        routerKind: context?.routerKind ?? null,
        err,
      });

      await recordError({
        error: err,
        code: err?.code ?? ERROR_CODES.INTERNAL,
        status: 500,
        source: "render",
        requestId,
        details: { digest: err?.digest ?? null, routeType: context?.routeType ?? null },
      });
    },
  );
}
