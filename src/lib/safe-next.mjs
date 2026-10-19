/**
 * Validate a post-login `?next=` target (ask-storyboard.md (f)): same-origin paths only, so the
 * login page can never be turned into an open redirect. `/ask` is the case that needs it — a
 * phone opening the home-screen shortcut while signed out should land back on the mic, not the
 * board. Anything else (absolute URLs, `//host`, `/\host`, non-strings) falls back to "/".
 *
 * @param {unknown} value
 * @returns {string}
 */
export function safeNextPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.length > 512 || [...value].some((ch) => ch.charCodeAt(0) < 32)) return "/";
  return value;
}
