/**
 * The app's error taxonomy — ONE base class, one place that decides what an error means
 * (observability-and-errors.md decision 3).
 *
 * Before this, each typed error lived beside the module that threw it and `handleRouteError` mapped
 * them with an `instanceof` chain that only it understood. A production failure therefore reached
 * the caller as a bare `{ error: "Internal server error" }` — the same string for a dead database,
 * an unapplied migration and a genuine code bug.
 *
 * Every error here carries:
 *   - `code`    a STABLE machine-readable string. It is part of the API contract: clients branch on
 *               it, the admin error panel groups by it, and it survives message rewording.
 *   - `status`  the HTTP status the route should answer with.
 *   - `details` SAFE structured context, echoed to every caller (never secrets, never stacks —
 *               those live in the logs and the admin-only `debug` block).
 *
 * ⚠️ `status` is always the **HTTP response** status. An upstream's own status (Jira's 400, a
 * provider's 429) goes in `details.jiraStatus` / `details.providerStatus` — mixing the two is how
 * a 429 from Jira turns into a 429 from us, which would tell the browser to retry OUR route.
 *
 * This module imports NOTHING so that any module can import it without a cycle (`lib/auth.js`,
 * `lib/rbac.js`, `lib/jira/client.js` and `lib/api/route-helpers.js` all re-export from here, which
 * keeps every existing `import { NotFoundError } from "@/lib/rbac"` and `instanceof` check working).
 */

/**
 * Every code the API can answer with. Exported so the fixtures, the diagnostics route and the admin
 * panel share one vocabulary instead of re-typing string literals.
 */
export const ERROR_CODES = Object.freeze({
  // client-shaped
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  // deployment / configuration
  CONFIG_MISSING: "CONFIG_MISSING",
  SESSION_WRITE_FAILED: "SESSION_WRITE_FAILED",
  // database
  DB_UNIQUE_VIOLATION: "DB_UNIQUE_VIOLATION",
  DB_FK_VIOLATION: "DB_FK_VIOLATION",
  DB_MIGRATION_MISSING: "DB_MIGRATION_MISSING",
  DB_UNAVAILABLE: "DB_UNAVAILABLE",
  DB_TIMEOUT: "DB_TIMEOUT",
  DB_VALIDATION: "DB_VALIDATION",
  // Jira
  JIRA_CREDENTIAL_MISSING: "JIRA_CREDENTIAL_MISSING",
  JIRA_AUTH: "JIRA_AUTH",
  JIRA_API: "JIRA_API",
  JIRA_UNREACHABLE: "JIRA_UNREACHABLE",
  JIRA_TIMEOUT: "JIRA_TIMEOUT",
  // AI
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_PROVIDER: "AI_PROVIDER",
  // fallback
  INTERNAL: "INTERNAL",
});

/**
 * Base class for every error the app throws on purpose.
 *
 * @param {string} message human-readable, safe to show the caller.
 * @param {{ code?: string, status?: number, details?: object | null, cause?: unknown }} [options]
 */
export class AppError extends Error {
  constructor(message, { code = ERROR_CODES.INTERNAL, status = 500, details = null, cause } = {}) {
    // `cause` must not be passed as `{ cause: undefined }` — that sets an own `cause` property of
    // undefined, which the log serializer would then walk into.
    super(message, cause === undefined ? undefined : { cause });
    // Set explicitly by each subclass below, never from `new.target.name`: a production build
    // MINIFIES class names, so the debug block and the logs would report "u" instead of
    // "NotFoundError" exactly where a human is trying to read them.
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /**
   * Merge more safe context into `details` and return `this`, so a deep thrower can be annotated by
   * the layer that knows the caller's vocabulary without being re-wrapped:
   * `throw enrich(error, { filterName })` reads better than rebuilding the error.
   * @param {object} patch
   * @returns {this}
   */
  withDetails(patch) {
    this.details = { ...(this.details ?? {}), ...patch };
    return this;
  }
}

// ─────────────────────────────────────────────────────────────
// Client-shaped failures (the caller can fix these)
// ─────────────────────────────────────────────────────────────

/** Thrown for request bodies/params that fail validation. Maps to HTTP 400. */
export class ValidationError extends AppError {
  constructor(message = "Invalid request", details = null) {
    super(message, { code: ERROR_CODES.VALIDATION_FAILED, status: 400, details });
    this.name = "ValidationError";
  }
}

/** Thrown by `requireUser` when there is no authenticated user. Maps to HTTP 401. */
export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated", details = null) {
    super(message, { code: ERROR_CODES.UNAUTHENTICATED, status: 401, details });
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the caller is authenticated but lacks the required role. Maps to HTTP 403. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", details = null) {
    super(message, { code: ERROR_CODES.FORBIDDEN, status: 403, details });
    this.name = "ForbiddenError";
  }
}

/** Thrown when a scoped resource does not exist (or belongs to another scope). Maps to HTTP 404. */
export class NotFoundError extends AppError {
  constructor(message = "Not found", details = null) {
    super(message, { code: ERROR_CODES.NOT_FOUND, status: 404, details });
    this.name = "NotFoundError";
  }
}

/**
 * Thrown for a business-rule conflict that isn't a DB unique-constraint violation (e.g. claiming a
 * JiraSubComponent already claimed by a different team, one-click-sprint-start.md). Maps to 409.
 */
export class ConflictError extends AppError {
  constructor(message = "Conflict", details = null) {
    super(message, { code: ERROR_CODES.CONFLICT, status: 409, details });
    this.name = "ConflictError";
  }
}

// ─────────────────────────────────────────────────────────────
// Deployment / configuration failures (an operator fixes these)
// ─────────────────────────────────────────────────────────────

/**
 * A required environment variable is missing or malformed. Maps to HTTP 500 — the request was
 * fine, the deployment is not.
 *
 * `details.variable` NAMES the variable (never its value): on an internal tool, "which env var is
 * missing" is the whole answer, and withholding it is what made a mis-provisioned container
 * indistinguishable from a bad password (observability-and-errors.md, pre-auth exposure rule).
 *
 * @param {string} message
 * @param {{ variable?: string, hint?: string }} [details]
 */
export class ConfigError extends AppError {
  constructor(message, { variable = null, hint = null } = {}) {
    super(message, {
      code: ERROR_CODES.CONFIG_MISSING,
      status: 500,
      details: { stage: "config", ...(variable ? { variable } : {}), ...(hint ? { hint } : {}) },
    });
    this.name = "ConfigError";
  }
}

/**
 * The session cookie could not be sealed or written — Jira and the database were both fine and the
 * login still failed. Distinguishing this from the other four login failures is the point.
 */
export class SessionWriteError extends AppError {
  constructor(message = "Could not start a session", { cause } = {}) {
    super(message, {
      code: ERROR_CODES.SESSION_WRITE_FAILED,
      status: 500,
      details: { stage: "session" },
      cause,
    });
    this.name = "SessionWriteError";
  }
}

/**
 * Narrow `unknown` to an Error without losing a thrown string/object — used everywhere a `catch`
 * needs to log or wrap. Never throws.
 * @param {unknown} value
 * @returns {Error}
 */
export function toError(value) {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : JSON.stringify(value ?? "Unknown error"));
}
