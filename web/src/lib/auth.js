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

/** @typedef {{ userId?: string }} SessionData */

const SESSION_COOKIE_NAME = "sprinttracker_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days (mirrors the legacy session maxAge)
const MIN_PASSWORD_LENGTH = 32; // iron-session requirement

/** @returns {import("iron-session").SessionOptions} */
function buildSessionOptions() {
  const password = process.env.SESSION_PASSWORD?.trim();
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SESSION_PASSWORD is not set or shorter than ${MIN_PASSWORD_LENGTH} characters (generate one with \`openssl rand -base64 32\`)`,
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

/** Read/seal the session cookie. @returns {Promise<import("iron-session").IronSession<SessionData>>} */
export async function getSession() {
  return getIronSession(await cookies(), buildSessionOptions());
}

/** Set the `{ userId }` payload and write the sealed cookie. @param {string} userId */
export async function createUserSession(userId) {
  const session = await getSession();
  session.userId = userId;
  await session.save();
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
  return prisma.user.findUnique({ where: { id: session.userId } });
}

/** Thrown by {@link requireUser} when there is no authenticated user. Map to HTTP 401 at the route. */
export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
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
