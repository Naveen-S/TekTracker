/**
 * Persisted failure recorder (observability-and-errors.md pillar 5) — writes an `ErrorLog` row for
 * server-side failures so `/admin` can answer "what broke at 4pm?" without shell access to the
 * container. The logger's stdout lines stay the primary record; this is the readable tail.
 *
 * Three rules make this safe to call from inside an error path:
 *
 * 1. **It never throws.** It is called while ALREADY handling a failure; a second exception would
 *    replace a useful 502 with an unrelated 500.
 * 2. **It survives its own table being missing, and recovers from anything transient.** Production
 *    applies migrations as a separate `yarn db:deploy` step (DEPLOY.md §5), so a freshly rolled
 *    image can legitimately run before the `ErrorLog` table exists — exactly when the database is
 *    also the likeliest thing to be broken. Two tiers, because the two cases are not alike:
 *    a **schema-level** failure (`P2021`/`P2022`) cannot resolve without a deploy, so the writer
 *    latches off; **everything else** — connection errors, pool timeouts, one-off rejections — gets
 *    a bounded cooldown and then tries again. Treating a connection error as permanent (as an
 *    earlier version did) meant a 30-second network partition silently ended error recording for
 *    the container's entire lifetime.
 * 3. **Only status >= 500 is persisted** (the caller enforces this): incidents, not traffic.
 */
import { prisma } from "@/lib/db";
import { logger, redact, getLogContext } from "@/lib/log";

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

/**
 * Write-failure codes that CANNOT resolve without a deployment: the table or column is absent, so
 * every subsequent insert is guaranteed to fail. Stop trying for the life of the process.
 */
const PERMANENT_CODES = ["P2021", "P2022"];

/**
 * How long to stay quiet after a TRANSIENT write failure. Connection errors (P1001/P1002), pool
 * timeouts and one-off rejections all recover on their own, so the writer must recover with them —
 * but retrying on every single 5xx during an outage would add a failed round-trip (and, when the
 * database is black-holed rather than refusing, its full connect timeout) to every already-failing
 * response. A cooldown gets both properties: at most one attempt per window, and automatic
 * resumption once the database is back.
 */
const RETRY_AFTER_MS = 60_000;

/** @typedef {{ disabled: boolean, mutedUntil: number }} WriterState */

/** @type {WriterState} */
let state = { disabled: false, mutedUntil: 0 };

/**
 * Should the writer skip this attempt? Pure, so the state machine is testable without a database.
 * @param {WriterState} current
 * @param {number} now
 * @returns {boolean}
 */
export function isWriterMuted(current, now) {
  return current.disabled || now < current.mutedUntil;
}

/**
 * Next writer state after a failed insert. Pure.
 *
 * Only schema-level failures latch permanently. Everything else — including `P1001`/`P1002`, which
 * an earlier version of this module wrongly treated as permanent — gets a bounded cooldown, so a
 * 30-second network partition can no longer silence the error log for the container's whole
 * lifetime.
 *
 * @param {WriterState} current
 * @param {string | undefined} code Prisma error code, if any.
 * @param {number} now
 * @returns {WriterState}
 */
export function applyWriteFailure(current, code, now) {
  if (PERMANENT_CODES.includes(code)) {
    return { disabled: true, mutedUntil: 0 };
  }
  return { disabled: current.disabled, mutedUntil: now + RETRY_AFTER_MS };
}

/**
 * Current writer state. Used by the fixtures to assert the latch/cooldown transitions without a
 * database. Deliberately NOT yet surfaced by `/api/diagnostics` — a muted writer is worth
 * reporting there, but that is an additive change this feature did not make.
 */
export function errorLogWriterState() {
  return { ...state };
}

/** Reset the latch — used by the fixtures; production simply restarts the process. */
export function resetErrorLogState() {
  state = { disabled: false, mutedUntil: 0 };
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
  if (isWriterMuted(state, Date.now())) return;

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
    state = applyWriteFailure(state, writeError?.code, Date.now());

    // Deliberately console, not `logger`: if the DB is the thing that broke, the logger is fine —
    // but this message is about the recorder itself, and it must not recurse back into recordError.
    console.error(
      `[error-log] could not persist error (${writeError?.code ?? writeError?.name}): ${writeError?.message}` +
        (state.disabled
          ? " — schema is missing, disabling ErrorLog writes until the next deploy"
          : ` — pausing ErrorLog writes for ${RETRY_AFTER_MS / 1000}s`),
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
