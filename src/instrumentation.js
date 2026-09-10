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
 * **Runtime note — why this file is a near-empty shell.** Next loads it in BOTH the Node and Edge
 * runtimes. A `process.env.NEXT_RUNTIME` check is a *runtime* guard, but bundling is *static*:
 * Turbopack follows a dynamic `import()` into the Edge graph regardless of the branch that guards
 * it. Importing the Node-only modules here directly therefore emitted four "A Node.js module is
 * loaded ... not supported in the Edge Runtime" warnings on every build (`node:crypto` via
 * `@/lib/log` and `@/lib/crypto`, `node:path`/`node:url` via the generated Prisma client).
 *
 * So this file follows the pattern Next's own instrumentation guide prescribes: the guard imports
 * ONE module (`./instrumentation-node`), and every Node-only dependency lives behind that single
 * boundary, which the bundler keeps out of the Edge graph. Keep it that way — adding a top-level
 * or directly-imported Node dependency here brings the warnings straight back.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const nodeInstrumentation = await import("./instrumentation-node");
  nodeInstrumentation.register();
}

/**
 * @param {Error & { digest?: string }} err
 * @param {{ path: string, method: string, headers: Record<string, string | string[]> }} request
 * @param {{ routerKind: string, routePath: string, routeType: string }} context
 */
export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const nodeInstrumentation = await import("./instrumentation-node");
    await nodeInstrumentation.onRequestError(err, request, context);
  } catch {
    // The error reporter must never itself throw — Next would then log ITS failure instead of the
    // original one, which is strictly worse than the silence we started from.
  }
}
