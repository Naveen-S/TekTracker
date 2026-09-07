/**
 * Persisted failure recorder (observability-and-errors.md pillar 5) — writes an `ErrorLog` row for
 * server-side failures so `/admin` can answer "what broke at 4pm?" without shell access to the
 * container. The logger's stdout lines stay the primary record; this is the readable tail.
 *
 * Three rules make this safe to call from inside an error path:
 *
 * 1. **It never throws.** It is called while ALREADY handling a failure; a second exception would
 *    replace a useful 502 with an unrelated 500.
 * 2. **It survives its own table being missing.** Production applies migrations as a separate
 *    `yarn db:deploy` step (DEPLOY.md §5), so a freshly rolled image can legitimately run before
 *    the `ErrorLog` table exists — exactly when the database is also the likeliest thing to be
 *    broken. It degrades to `console.error` and disables itself for the process instead of turning
 *    every request into two failures.
 * 3. **Only status >= 500 is persisted** (the caller enforces this): incidents, not traffic.
 */
import { prisma } from "@/lib/db";
import { logger, redact, getLogContext } from "@/lib/log";

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

/** Flipped once a write fails in a way that will keep failing (missing table, dead DB). */
let disabled = false;

/** Reset the "stop trying" latch — used by the fixtures; production simply restarts the process. */
export function resetErrorLogState() {
  disabled = false;
}

/**
 * Record one failure. Fire-and-forget from the caller's point of view: the returned promise always
 * resolves, and a rejection is impossible by construction.
 *
 * @param {{
 *   error: Error, code: string, status: number, source: "route" | "render" | "cron",
 *   requestId?: string, route?: string | null, path?: string | null, method?: string | null,
 *   details?: object | null,
 * }} entry
 * @returns {Promise<void>}
 */
export async function recordError(entry) {
  if (disabled) return;

  try {
    const context = getLogContext();
    const { error, code, status, source, details } = entry;

    await prisma.errorLog.create({
      data: {
        requestId: entry.requestId ?? context.requestId ?? "unknown",
        code,
        status,
        source,
        route: entry.route ?? context.route ?? null,
        path: entry.path ?? context.path ?? null,
        method: entry.method ?? context.method ?? null,
        userId: context.userId ?? null,
        teamId: context.teamId ?? null,
        message: String(error?.message ?? "Unknown error").slice(0, MAX_MESSAGE),
        details: details ? redact(details) : null,
        stack: error?.stack ? error.stack.slice(0, MAX_STACK) : null,
      },
    });
  } catch (writeError) {
    // P2021 = table does not exist (migration not deployed); P1001/P1002 = database unreachable.
    // All three will keep failing for the life of this process, so stop trying — a retry storm
    // during a database outage is the last thing an already-degraded app needs.
    const persistent = ["P2021", "P2022", "P1001", "P1002"].includes(writeError?.code);
    if (persistent) disabled = true;

    // Deliberately console, not `logger`: if the DB is the thing that broke, the logger is fine —
    // but this message is about the recorder itself, and it must not recurse back into recordError.
    console.error(
      `[error-log] could not persist error (${writeError?.code ?? writeError?.name}): ${writeError?.message}` +
        (persistent ? " — disabling ErrorLog writes for this process" : ""),
    );
  }
}

/**
 * Delete rows older than `days` — called by the daily cron so the table stays bounded without an
 * ops task. Returns the number deleted; never throws (same reasoning as above).
 * @param {number} [days]
 * @returns {Promise<number>}
 */
export async function pruneErrorLog(days = 14) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { count } = await prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return count;
  } catch (error) {
    logger.warn("error_log.prune_failed", { err: error });
    return 0;
  }
}
