/**
 * Next.js instrumentation (observability-and-errors.md pillar 5).
 *
 * Two hooks, both closing holes that made production silent:
 *
 * `register` — one **boot line** naming this build's environment and which required secrets are
 *   present (names + booleans, NEVER values), plus background reachability probes for the database
 *   and Jira. On internal Tekion infra the first question after a rollout is "did the container get
 *   its config?", and until now nothing answered it: the app started happily and only failed later,
 *   at login, with "Login failed".
 *
 * `onRequestError` — Next 16's official server-error hook. Route Handlers are covered by
 *   `withRoute`, but SERVER COMPONENTS were not: `lib/dashboard-data.js` has no error handling at
 *   all, so a Prisma failure there rendered Next's bare digest screen and logged nothing of ours.
 *   This catches those (and Server Action errors), logs them with the digest the user can quote,
 *   and persists an `ErrorLog` row.
 *
 * Runtime note: this file is loaded in BOTH the Node and Edge runtimes, so everything Node-only is
 * guarded by `process.env.NEXT_RUNTIME` and imported dynamically — a top-level `node:async_hooks`
 * or Prisma import would break the Edge bundle.
 */

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

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("@/lib/log");

  const env = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, Boolean(process.env[name]?.trim())]),
  );

  logger.info("app.boot", {
    // Read off `globalThis` deliberately: this file is bundled for the Edge runtime too, and a bare
    // `process.version` is flagged as a Node-only API by the bundler even inside a runtime guard.
    node: globalThis.process?.version ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    logLevel: process.env.LOG_LEVEL ?? "(default)",
    debugErrors: process.env.DEBUG_ERRORS === "1",
    env,
  });

  // Probes are deliberately NOT awaited: `register` blocks the server from accepting requests, and
  // an unreachable database would otherwise turn a config problem into a slow boot. They report
  // themselves whenever they finish.
  void probeDatabase(logger);
  void probeJira(logger);
}

async function probeDatabase(logger) {
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

async function probeJira(logger) {
  try {
    const { probeJiraReachable } = await import("@/lib/jira/client");
    const result = await probeJiraReachable();
    logger[result.reachable ? "info" : "error"]("app.boot_jira", result);
  } catch (error) {
    logger.error("app.boot_jira", { reachable: false, err: error });
  }
}

/**
 * Server-side error hook (Next 16). `err.digest` is the id Next shows the user on the error page,
 * so logging it is what turns "I saw an error page" into a lookup.
 *
 * @param {Error & { digest?: string }} err
 * @param {{ path: string, method: string, headers: Record<string, string | string[]> }} request
 * @param {{ routerKind: string, routePath: string, routeType: string }} context
 */
export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { logger, runWithContext, newRequestId } = await import("@/lib/log");
    const { recordError } = await import("@/lib/error-log");
    const { ERROR_CODES } = await import("@/lib/errors");

    const requestId = newRequestId(
      typeof request?.headers?.["x-request-id"] === "string" ? request.headers["x-request-id"] : null,
    );

    await runWithContext(
      { requestId, route: context?.routePath ?? null, path: request?.path ?? null, method: request?.method ?? null, source: "render" },
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
  } catch {
    // The error reporter must never itself throw — Next would then log ITS failure instead of the
    // original one, which is strictly worse than the silence we started from.
  }
}
