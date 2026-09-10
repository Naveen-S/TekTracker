/**
 * Tiny client-side fetch helper for the domain API routes (ui-port.md decision 1): same-origin,
 * JSON in/out, throws `Error(message)` from the route's `{ error }` body so callers can toast it.
 *
 * The thrown Error now also carries the diagnostic envelope the routes return
 * (observability-and-errors.md): `code`, `requestId`, `status`, `details` and — for admins — `debug`.
 * `error.message` is unchanged, so every existing `catch (error) { … error.message }` still reads
 * the same string; the extra fields are what let the UI show a quotable reference instead of a
 * dead-end sentence.
 */

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 * @throws {Error & { code?: string, requestId?: string, status: number, details?: object,
 *   debug?: object }}
 */
export async function apiFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const error = new Error(data?.error ?? `Request failed (${res.status})`);
    error.status = res.status;
    // The header is set on EVERY response, so it is the reliable source even when the body was
    // not JSON (a proxy error page, a truncated response).
    error.requestId = data?.requestId ?? res.headers.get("x-request-id") ?? null;
    if (data?.code) error.code = data.code;
    if (data?.details) error.details = data.details;
    if (data?.debug) error.debug = data.debug;
    throw error;
  }
  return data;
}

/**
 * One-line reference for an `apiFetch` failure — `JIRA_API · r7k2q9xf`. Shown wherever an error
 * reaches the user, so a screenshot is a complete bug report.
 * @param {Error & { code?: string, requestId?: string }} error
 * @returns {string | null}
 */
export function errorReference(error) {
  const parts = [error?.code, error?.requestId].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The full envelope as pasteable text — the artifact someone drops into Slack when reporting a
 * failure. Includes the safe `details` (which track, what Jira said) and the admin-only `debug`
 * block when the server sent one.
 * @param {Error & { code?: string, requestId?: string, status?: number, details?: object, debug?: object }} error
 * @returns {string}
 */
export function errorDiagnostics(error) {
  const lines = [
    `message:   ${error?.message ?? "(none)"}`,
    `code:      ${error?.code ?? "(none)"}`,
    `requestId: ${error?.requestId ?? "(none)"}`,
    `status:    ${error?.status ?? "(none)"}`,
    `when:      ${new Date().toISOString()}`,
  ];
  if (typeof window !== "undefined") lines.push(`page:      ${window.location.pathname}`);
  if (error?.details) lines.push(`details:   ${JSON.stringify(error.details, null, 2)}`);
  if (error?.debug) lines.push(`debug:     ${JSON.stringify(error.debug, null, 2)}`);
  return lines.join("\n");
}
