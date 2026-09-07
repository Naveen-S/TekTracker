/**
 * Shared Route Handler plumbing for the domain APIs (domain-apis.md decision 2, extended by
 * observability-and-errors.md).
 *
 * Contract: success returns the resource JSON directly; failures return an envelope whose `error`
 * key means exactly what it always did (so every existing `apiFetch` caller keeps working) plus
 * the fields that make a production failure diagnosable from the response alone:
 *
 *   { error, code, requestId, details?, debug? }
 *
 *   error      human-readable, safe to toast (unchanged).
 *   code       stable machine-readable ERROR_CODES value (lib/errors.js).
 *   requestId  correlates the response with every log line and the `x-request-id` header.
 *   details    safe structured context — which track failed, what Jira actually said, which
 *              env var is missing. Shown to everyone.
 *   debug      error name/stack/cause/Prisma meta. GLOBAL ADMINS ONLY, or anyone when
 *              DEBUG_ERRORS=1 is set for a debugging session.
 *
 * The `{ success, data, error }` envelope stays the Server-Action shape (coding-standards) — not
 * used by Route Handlers.
 *
 * Typical handler shape:
 *   export const POST = withRoute("teams.sprints.sync", async (request, { params }) => { … });
 */
import { Prisma } from "@/generated/prisma/client";
import { validate } from "@/lib/validation";
import {
  AppError,
  ERROR_CODES,
  ValidationError,
  ConflictError,
  toError,
} from "@/lib/errors";
import { logger, newRequestId, runWithContext, getLogContext, serializeError } from "@/lib/log";
import { recordError } from "@/lib/error-log";

// Re-exported so `import { ValidationError } from "@/lib/api/route-helpers"` keeps working
// everywhere it already appears (lib/sync/engine.js and ~15 routes).
export { ValidationError, ConflictError };

/**
 * Read the JSON body and validate it against a zod schema; throws {@link ValidationError} (→ 400)
 * on malformed JSON or schema failure.
 *
 * @template T
 * @param {Request} request
 * @param {import("zod").ZodType<T>} schema
 * @returns {Promise<T>}
 */
export async function parseJsonBody(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = validate(schema, body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }
  return parsed.data;
}

// ─────────────────────────────────────────────────────────────
// Database error classification
// ─────────────────────────────────────────────────────────────

/**
 * Postgres/Prisma failures that are really DEPLOYMENT failures, mapped to codes an operator can
 * act on. Production runs on internal Tekion Postgres where two of these are live risks documented
 * in DEPLOY.md: migrations are a separate `yarn db:deploy` step that can simply not have run
 * (P2021 — table missing), and `sslmode` must match the cluster's TLS config (a mismatch is a
 * connection failure, not a warning).
 *
 * Before this, every one of them arrived as `{ error: "Internal server error" }`.
 */
const PRISMA_CODES = {
  P2002: { status: 409, code: ERROR_CODES.DB_UNIQUE_VIOLATION },
  P2003: { status: 409, code: ERROR_CODES.DB_FK_VIOLATION },
  P2025: { status: 404, code: ERROR_CODES.NOT_FOUND },
  P2021: { status: 503, code: ERROR_CODES.DB_MIGRATION_MISSING },
  P2022: { status: 503, code: ERROR_CODES.DB_MIGRATION_MISSING },
  P2024: { status: 503, code: ERROR_CODES.DB_UNAVAILABLE },
  P2028: { status: 503, code: ERROR_CODES.DB_TIMEOUT },
  P1001: { status: 503, code: ERROR_CODES.DB_UNAVAILABLE },
  P1002: { status: 503, code: ERROR_CODES.DB_UNAVAILABLE },
  P1008: { status: 503, code: ERROR_CODES.DB_TIMEOUT },
  P1017: { status: 503, code: ERROR_CODES.DB_UNAVAILABLE },
};

const MIGRATION_HINT = "Run `yarn db:deploy` against this environment — the schema is behind the app.";
const SSL_HINT =
  "Check DATABASE_URL's `sslmode` against the database's TLS config (DEPLOY.md §4) — `require` against a non-TLS server fails, and vice versa.";
const STALE_CLIENT_HINT =
  "A long-running dev server can hold a stale generated client — run `prisma generate` and restart it.";

/** TLS/SSL negotiation failures surface as prose from `pg`, not as a Prisma code. */
const SSL_MESSAGE = /does not support SSL|SSL connection|no encryption|self[- ]signed certificate|certificate/i;

/**
 * Map a Prisma/Postgres error to the envelope, or null when it isn't one.
 *
 * Exported so the fixtures can assert the whole table directly: going through
 * {@link handleRouteError} would persist an ErrorLog row for every 5xx case, i.e. hit the database
 * to test database-failure handling.
 *
 * @param {Error} error
 * @returns {{ status: number, code: string, message: string, details: object } | null}
 */
export function classifyDatabaseError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_CODES[error.code];
    if (!mapped) return null;

    if (mapped.code === ERROR_CODES.DB_UNIQUE_VIOLATION) {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "unique field";
      return {
        ...mapped,
        message: `A record with the same ${fields} already exists`,
        details: { stage: "database", prismaCode: error.code, fields },
      };
    }
    if (mapped.code === ERROR_CODES.NOT_FOUND) {
      return { ...mapped, message: "Not found", details: { prismaCode: error.code } };
    }
    if (mapped.code === ERROR_CODES.DB_MIGRATION_MISSING) {
      const missing = error.meta?.table ?? error.meta?.column ?? "a table or column";
      return {
        ...mapped,
        message: `The database is missing ${missing} — migrations have not been applied to this environment`,
        details: { stage: "database", prismaCode: error.code, missing, hint: MIGRATION_HINT },
      };
    }
    return {
      ...mapped,
      message:
        mapped.code === ERROR_CODES.DB_TIMEOUT
          ? "The database took too long to respond"
          : "The database is unavailable",
      details: { stage: "database", prismaCode: error.code },
    };
  }

  // Connection-time failures: the adapter/pg driver, wrapped by Prisma. These carry the sslmode
  // and "wrong host/port" cases, i.e. most of what goes wrong on a fresh deployment.
  const isPrismaInit =
    error instanceof Prisma.PrismaClientInitializationError ||
    error?.name === "PrismaClientInitializationError";
  const syscall = findCauseCode(error);
  if (isPrismaInit || (syscall && /^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN)$/.test(syscall))) {
    const ssl = SSL_MESSAGE.test(error?.message ?? "");
    return {
      status: 503,
      code: ERROR_CODES.DB_UNAVAILABLE,
      message: ssl
        ? "Could not connect to the database (TLS negotiation failed)"
        : "Could not connect to the database",
      details: {
        stage: "database",
        ...(error?.errorCode ? { prismaCode: error.errorCode } : {}),
        ...(syscall ? { syscall } : {}),
        hint: ssl ? SSL_HINT : undefined,
      },
    };
  }

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    error?.name === "PrismaClientValidationError"
  ) {
    return {
      status: 500,
      code: ERROR_CODES.DB_VALIDATION,
      message: "The database query was rejected as invalid",
      details: { stage: "database", hint: STALE_CLIENT_HINT },
    };
  }

  return null;
}

/** Walk `.cause` looking for a Node syscall/errno code (`fetch`/`pg` hide the real reason there). */
function findCauseCode(error, depth = 0) {
  if (!error || depth > 4) return null;
  if (typeof error.code === "string" && /^[A-Z_]+$/.test(error.code)) return error.code;
  return findCauseCode(error.cause, depth + 1);
}

// ─────────────────────────────────────────────────────────────
// Error → Response
// ─────────────────────────────────────────────────────────────

/** Admins always; everyone while DEBUG_ERRORS=1 is set for a debugging session. */
function shouldExposeDebug() {
  return getLogContext().isAdmin === true || process.env.DEBUG_ERRORS === "1";
}

/**
 * Map a thrown error to the response envelope, log it, and persist it when it's a 5xx.
 *
 * Kept exported and callable as `handleRouteError(error)` so the routes that predate
 * {@link withRoute} behave identically; it returns a promise, which an async handler's
 * `return handleRouteError(e)` already awaits.
 *
 * @param {unknown} thrown
 * @returns {Promise<Response>}
 */
export async function handleRouteError(thrown) {
  const error = toError(thrown);

  let status;
  let code;
  let message;
  let details = null;

  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else {
    const db = classifyDatabaseError(error);
    if (db) {
      ({ status, code, message } = db);
      details = db.details;
    } else {
      status = 500;
      code = ERROR_CODES.INTERNAL;
      message = "Internal server error";
    }
  }

  const requestId = getLogContext().requestId ?? null;
  const serverFault = status >= 500;

  logger[serverFault ? "error" : "warn"](serverFault ? "route.error" : "route.rejected", {
    status,
    code,
    err: error,
  });

  if (serverFault) {
    await recordError({ error, code, status, source: "route", details });
  }

  return Response.json(
    {
      error: message,
      code,
      ...(requestId ? { requestId } : {}),
      ...(details && Object.keys(details).length > 0 ? { details: stripUndefined(details) } : {}),
      ...(shouldExposeDebug() ? { debug: serializeError(error) } : {}),
    },
    { status },
  );
}

/** `details` is hand-built in several places; drop the keys whose value came out undefined. */
function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

// ─────────────────────────────────────────────────────────────
// withRoute
// ─────────────────────────────────────────────────────────────

/** Next's own control-flow throws (redirect/notFound/dynamic usage) must pass straight through. */
function isFrameworkSignal(error) {
  return typeof error?.digest === "string" && error.digest.startsWith("NEXT_");
}

function attachRequestId(response, requestId) {
  try {
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    // Immutable headers (rare): rebuild rather than lose the correlation id.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers([...response.headers, ["x-request-id", requestId]]),
    });
  }
}

/**
 * Wrap a Route Handler with request correlation, timing, uniform error mapping, and the
 * `x-request-id` response header.
 *
 * The user/team fields in the log line are NOT read here — the guards fill them in
 * (`requireUser` → userId/isAdmin, `requireTeamRole` → teamId/role) once they know who is asking,
 * via `setLogContext`. That keeps the wrapper ignorant of each route's params.
 *
 * @param {string} name logical route name, dot-separated (e.g. "teams.sprints.sync").
 * @param {(request: Request, context: object) => Promise<Response>} handler
 * @returns {(request: Request, context: object) => Promise<Response>}
 */
export function withRoute(name, handler) {
  return async function wrappedRoute(request, context) {
    const requestId = newRequestId(request?.headers?.get?.("x-request-id") ?? null);
    let path = null;
    try {
      path = new URL(request.url).pathname;
    } catch {
      path = null;
    }
    const startedAt = Date.now();

    return runWithContext({ requestId, route: name, path, method: request?.method ?? null }, async () => {
      try {
        const response = await handler(request, context);
        logger[request?.method === "GET" ? "debug" : "info"]("route.ok", {
          status: response?.status ?? 200,
          ms: Date.now() - startedAt,
        });
        return attachRequestId(response, requestId);
      } catch (error) {
        if (isFrameworkSignal(error)) throw error;
        return attachRequestId(await handleRouteError(error), requestId);
      }
    });
  };
}
