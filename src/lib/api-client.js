/**
 * Tiny client-side fetch helper for the domain API routes (ui-port.md decision 1): same-origin,
 * JSON in/out, throws `Error(message)` from the route's `{ error }` body so callers can toast it.
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
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}
