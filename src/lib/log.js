/**
 * Structured logging + per-request context (observability-and-errors.md pillar 2).
 *
 * Before this the whole `src/` tree contained FOUR `console.*` calls, so a production incident
 * started from nothing. This module is the one place that writes them, and it writes them in a
 * shape a log collector can filter: JSON lines to stdout in production (the container's collector
 * reads stdout — see Dockerfile), human-readable single lines in dev.
 *
 * Correlation: an `AsyncLocalStorage` store carries `{ requestId, route, userId, teamId, … }` for
 * the life of a request, so `lib/jira/client.js` or `lib/sync/engine.js` can log without every
 * function growing a context parameter. The same `requestId` goes out on the response body and the
 * `x-request-id` header, which is what makes "here's my error, id r7k2q9xf" a complete bug report.
 *
 * Deliberately dependency-free (no pino): the app ships four runtime deps by choice, and JSON lines
 * on stdout are all the container needs.
 *
 * ⚠️ SERVER ONLY — imports `node:async_hooks`. Never import from a client component; the browser
 * side of the error contract lives in `lib/api-client.js`.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Keys whose STRING values are replaced with `[redacted]` at any depth.
 *
 * `email` is here as **default-deny for PII**: a Jira email is a personal identifier, and this
 * logger writes to stdout for a shared collector. Any future field literally called `email` is
 * therefore redacted without anyone having to remember. The two login call sites that legitimately
 * need to say *who* pass {@link maskEmail} output under a key that deliberately does NOT match this
 * pattern (`actor`) — the value is already masked, so re-redacting it would only destroy triage.
 */
const SECRET_KEY = /token|secret|password|authorization|cookie|api[-_]?key|credential|email/i;

/**
 * Secret shapes that appear inside FREE TEXT, where key-based redaction cannot reach.
 *
 * {@link SECRET_KEY} only inspects object keys, so it is blind to a secret embedded in a *value* —
 * most importantly `error.message` and `error.stack`, which are produced by Node, `pg` and `undici`
 * and are entirely outside this codebase's control. A `pg` connection failure that quotes its DSN
 * would otherwise reach stdout, `ErrorLog.details` and the `debug` response block verbatim.
 *
 * Ordered most-specific first. Each pattern keeps the surrounding shape (so the message still reads
 * as a connection string / header) and replaces only the secret span.
 */
const SECRET_IN_TEXT = [
  // scheme://user:password@host — the pg/undici case the review flagged.
  [/\b([a-z][a-z0-9+.\-]*:\/\/[^\s:/@]+:)[^\s@]+@/gi, "$1[redacted]@"],
  // Authorization header values: `Bearer eyJ…`, `Basic dXNlcjpwYXNz`.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
  // key=value / key: value / "key":"value" for secret-ish keys, in prose or a serialized blob.
  [
    /\b(token|secret|password|passwd|pwd|authorization|cookie|api[-_]?key|apikey|credential|connection[-_]?string)\b(["']?\s*[:=]\s*["']?)([^\s,;&"']{3,})/gi,
    "$1$2[redacted]",
  ],
];

/**
 * Strip secret spans from a free-text string. Applied to every string this module emits — object
 * values via {@link redact}, and `message`/`stack` via {@link serializeError}.
 *
 * @param {string} text
 * @returns {string}
 */
export function scrubSecrets(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const [pattern, replacement] of SECRET_IN_TEXT) out = out.replace(pattern, replacement);
  return out;
}

/**
 * `naveen@tekion.com` → `n***@tekion.com`. Keeps what triage actually needs — is this an internal
 * address, and roughly who — without writing the full identifier to a shared log collector.
 *
 * @param {unknown} email
 * @returns {string | null}
 */
export function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return email ? "[invalid-email]" : null;
  const [local, ...rest] = email.split("@");
  const domain = rest.join("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

const MAX_STRING = 1000;
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_STACK_FRAMES = 6;
const MAX_CAUSE_DEPTH = 4;

const storage = new AsyncLocalStorage();

// ─────────────────────────────────────────────────────────────
// Configuration (read lazily so `yarn build` stays env-free, crypto.js precedent)
// ─────────────────────────────────────────────────────────────

let cache = { key: null, level: LEVELS.info, json: false };

function config() {
  const key = `${process.env.LOG_LEVEL}|${process.env.LOG_FORMAT}|${process.env.NODE_ENV}`;
  if (cache.key !== key) {
    const production = process.env.NODE_ENV === "production";
    const requested = process.env.LOG_LEVEL?.trim().toLowerCase();
    const format = process.env.LOG_FORMAT?.trim().toLowerCase();
    cache = {
      key,
      level: LEVELS[requested] ?? (production ? LEVELS.info : LEVELS.debug),
      json: format ? format === "json" : production,
    };
  }
  return cache;
}

// ─────────────────────────────────────────────────────────────
// Request context
// ─────────────────────────────────────────────────────────────

/**
 * A request id that is short enough to read aloud and paste into Slack. Accepts an inbound value
 * (the ingress/LB may already have one, and reusing it ties our logs to theirs) but SANITIZES it
 * hard — an unfiltered header could carry a newline and forge whole log lines.
 *
 * @param {string | null} [inbound]
 * @returns {string}
 */
export function newRequestId(inbound = null) {
  const cleaned = inbound?.trim().replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  if (cleaned) return cleaned;
  return randomBytes(6).toString("base64url");
}

/**
 * Run `fn` with a fresh log context. Everything logged inside — however deep — carries these
 * fields.
 * @template T
 * @param {object} context
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithContext(context, fn) {
  return storage.run({ ...context }, fn);
}

/**
 * Merge fields into the CURRENT request's context. Called by the auth/RBAC guards once they know
 * who is asking (`requireUser` → userId/isAdmin, `requireTeamRole` → teamId/role), so every line
 * logged after the guard is attributable without the wrapper having to parse params itself.
 * No-op outside a request context.
 * @param {object} patch
 */
export function setLogContext(patch) {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
}

/** @returns {object} the current request's context ({} outside one). */
export function getLogContext() {
  return storage.getStore() ?? {};
}

/** @returns {string | null} the current request id, or null outside a request. */
export function getRequestId() {
  return storage.getStore()?.requestId ?? null;
}

// ─────────────────────────────────────────────────────────────
// Redaction + serialization
// ─────────────────────────────────────────────────────────────

/**
 * Deep-copy a value, dropping secrets and capping size. Applied to EVERY logged field and to
 * anything persisted in `ErrorLog.details` — the one gate that keeps a Jira token out of the logs.
 *
 * A key matching {@link SECRET_KEY} is redacted only when its value is a STRING: that removes real
 * secrets while letting the boot line's env-presence booleans (`{ TOKEN_ENCRYPTION_KEY: true }`)
 * through, which is the whole point of that line.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @param {WeakSet<object>} [seen] guards against circular structures.
 * @returns {unknown}
 */
export function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value ?? null;

  const type = typeof value;
  if (type === "string") {
    // Scrub BEFORE truncating: cutting first could leave half a secret sitting in the log.
    const scrubbed = scrubSecrets(value);
    return scrubbed.length > MAX_STRING
      ? `${scrubbed.slice(0, MAX_STRING)}…[${scrubbed.length} chars]`
      : scrubbed;
  }
  if (type === "number" || type === "boolean") return value;
  if (type === "bigint") return value.toString();
  if (type === "function" || type === "symbol") return undefined;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);

  if (depth >= MAX_DEPTH) return "[depth limit]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1, seen));
    if (value.length > MAX_ARRAY) items.push(`…${value.length - MAX_ARRAY} more`);
    return items;
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key) && typeof item === "string") {
      out[key] = "[redacted]";
      continue;
    }
    const cleaned = redact(item, depth + 1, seen);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/**
 * Error → a loggable object, walking the `cause` chain.
 *
 * The cause chain is the reason this exists: Node's `fetch` throws a useless
 * `TypeError: fetch failed` and hides the real problem (`ENOTFOUND`, `ECONNREFUSED`,
 * `UND_ERR_CONNECT_TIMEOUT`, an expired certificate) one level down in `.cause`. Losing it is what
 * made "cannot reach Jira from this container" indistinguishable from "your token is wrong".
 *
 * @param {unknown} error
 * @param {number} [depth]
 * @returns {object}
 */
export function serializeError(error, depth = 0) {
  if (!(error instanceof Error)) {
    // A thrown string/object is just as capable of carrying a secret as a real Error.
    return { name: "NonError", message: scrubSecrets(String(error)) };
  }
  const out = {
    name: error.name,
    // `message` and `stack` below come from Node, `pg`, `undici` and other code this repo does not
    // own, so they are free text that can embed a DSN or an Authorization header. Key-based
    // redaction cannot see inside a value — hence the scrub.
    message: scrubSecrets(error.message),
    ...(error.code ? { code: error.code } : {}),
    ...(error.status ? { status: error.status } : {}),
    ...(error.details ? { details: redact(error.details, 1) } : {}),
    ...(error.digest ? { digest: error.digest } : {}),
  };
  if (error.stack) {
    out.stack = scrubSecrets(error.stack.split("\n").slice(0, MAX_STACK_FRAMES).join("\n"));
  }
  if (error.cause !== undefined && error.cause !== null && depth < MAX_CAUSE_DEPTH) {
    out.cause = serializeError(error.cause, depth + 1);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Emit
// ─────────────────────────────────────────────────────────────

/**
 * Render one record. Exported so fixtures can assert the shape without capturing stdout.
 * @param {{ level: string, msg: string, ts: string, fields: object }} record
 * @param {boolean} json
 * @returns {string}
 */
export function formatLine({ level, msg, ts, fields }, json) {
  if (json) {
    return JSON.stringify({ ts, level, msg, ...fields });
  }
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (key === "err" && value?.stack) return `\n  ${value.stack}`;
      const rendered = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `${key}=${rendered}`;
    });
  return `${ts.slice(11, 23)} ${level.toUpperCase().padEnd(5)} ${msg}${parts.length ? "  " : ""}${parts.join(" ")}`;
}

function emit(level, msg, fields) {
  try {
    const { level: threshold, json } = config();
    if (LEVELS[level] < threshold) return;

    const context = getLogContext();
    const payload = { ...context, ...redact(fields ?? {}) };
    if (fields?.err) payload.err = serializeError(fields.err);

    const line = formatLine({ level, msg, ts: new Date().toISOString(), fields: payload }, json);
    // `console`, not `process.stdout/stderr`: identical destinations in Node, but this module is
    // reachable from `instrumentation.js`, which Next bundles for the Edge runtime too — a direct
    // `process.stdout` reference makes the Edge build warn even though the guarded code never runs
    // there.
    if (LEVELS[level] >= LEVELS.warn) {
      console.error(line);
    } else {
      console.log(line);
    }
  } catch {
    // A logger must never take the request down with it.
  }
}

/**
 * The app logger. `fields.err` is special-cased through {@link serializeError}; every other field
 * goes through {@link redact}.
 *
 * @example logger.warn("sync.track_emptied", { filterName: "Tech Debt", previous: 34 })
 */
export const logger = {
  debug: (msg, fields) => emit("debug", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
};
