/**
 * Session + current-user helpers (replaces the prototype's express-session file store).
 *
 * Cookie model (auth-layer.md decisions 1 & 8): an iron-session **stateless encrypted cookie** whose
 * payload is `{ userId }` ONLY — the Jira token never enters the cookie (it lives encrypted in
 * `JiraCredential`, see lib/crypto.js). Identity and `isAdmin` are read FRESH from the DB on every
 * request via `getCurrentUser()`, so revoking an admin takes effect immediately rather than waiting
 * for a 30-day cookie to expire.
 *
 * ⚠️ Next 16: `cookies()` from `next/headers` is ASYNC — it must be awaited and passed to
 * `getIronSession(cookieStore, options)` (iron-session v8). `.set`/`.delete` (and therefore
 * `session.save()`/`session.destroy()`) only work in a Route Handler or Server Action.
 *
 * Secrets fail loudly (auth-layer.md decision 9): no `dev-secret` fallback like the legacy server.js.
 */
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ConfigError, SessionWriteError, UnauthorizedError } from "@/lib/errors";
import { setLogContext } from "@/lib/log";

// Defined in lib/errors.js (one taxonomy); re-exported so every existing
// `import { UnauthorizedError } from "@/lib/auth"` and `instanceof` check keeps working.
export { UnauthorizedError };

/** @typedef {{ userId?: string }} SessionData */

const SESSION_COOKIE_NAME = "sprinttracker_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (mirrors the legacy session maxAge)
const MIN_PASSWORD_LENGTH = 32; // iron-session requirement

/** @returns {import("iron-session").SessionOptions} */
function buildSessionOptions() {
  const password = process.env.SESSION_PASSWORD?.trim();
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ConfigError(
      `SESSION_PASSWORD is not set or shorter than ${MIN_PASSWORD_LENGTH} characters`,
      {
        variable: "SESSION_PASSWORD",
        hint: "Generate one with `openssl rand -base64 32` and set it in this environment.",
      },
    );
  }
  return {
    cookieName: SESSION_COOKIE_NAME,
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

/**
 * Validate that SESSION_PASSWORD is present and long enough, without touching cookies.
 *
 * Same reason as `assertTokenKey`: this secret is not otherwise used until the last step of login,
 * so a container missing it used to fail only after Jira and the database had both succeeded.
 * @throws {ConfigError} naming SESSION_PASSWORD.
 */
export function assertSessionPassword() {
  buildSessionOptions();
}

/** Read/seal the session cookie. @returns {Promise<import("iron-session").IronSession<SessionData>>} */
export async function getSession() {
  return getIronSession(await cookies(), buildSessionOptions());
}

/**
 * Set the `{ userId }` payload and write the sealed cookie.
 *
 * A failure here is the LAST of login's five distinct failure modes (Jira was fine, the database
 * was fine, and the cookie still didn't get written) — it gets its own error type so the login
 * route can say exactly that instead of the old catch-all "Login failed".
 * @param {string} userId
 */
export async function createUserSession(userId) {
  try {
    const session = await getSession();
    session.userId = userId;
    await session.save();
  } catch (error) {
    // A missing/short SESSION_PASSWORD is a deployment problem, not a session-write problem —
    // let its ConfigError through so the caller reports the variable by name.
    if (error instanceof ConfigError) throw error;
    throw new SessionWriteError("Signed in, but the session cookie could not be written", {
      cause: error,
    });
  }
}

/**
 * The session cookie's effective options, for diagnostics. `secure: true` (set whenever
 * NODE_ENV=production) means the browser DISCARDS the cookie on a plain-HTTP response — login
 * answers 200 and the user bounces straight back to /login with no error anywhere. Exposed so the
 * login route and /api/diagnostics can detect that mismatch instead of leaving it invisible.
 * @returns {{ cookieName: string, secure: boolean, sameSite: string }}
 */
export function getSessionCookieInfo() {
  return {
    cookieName: SESSION_COOKIE_NAME,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}

/** Clear the session cookie (logout). */
export async function destroySession() {
  const session = await getSession();
  session.destroy();
}

/**
 * Resolve the current request's user from the session, fresh from the DB.
 * @returns {Promise<import("@/generated/prisma/client").User | null>}
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  // Attribute every subsequent log line of this request (and gate the admin-only `debug` block in
  // the error envelope). No-op outside a request context.
  if (user) setLogContext({ userId: user.id, isAdmin: user.isAdmin });
  return user;
}

/**
 * Guard for protected routes/actions (consumed by domain APIs in step 4 and the Jira client in
 * step 5). Throws {@link UnauthorizedError} when unauthenticated.
 * @returns {Promise<import("@/generated/prisma/client").User>}
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
