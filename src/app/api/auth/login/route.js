/**
 * POST /api/auth/login — ports server.js login to a Next 16 Route Handler (migration step 3).
 *
 * Flow: zod-validate body → validate against Jira `/myself` → upsert `User` (reconciling the
 * bootstrap-seeded admin's `seed-pending:` placeholder, preserving `isAdmin`) → upsert
 * `JiraCredential` with the AES-256-GCM-encrypted token (never the raw token) → set the `{ userId }`
 * iron-session cookie. Response is a superset of the prototype's `{ email, displayName }`
 * (auth-layer.md decision 4); `isAdmin` is read off the `User` row.
 *
 * ── Why this route is written in stages (observability-and-errors.md pillar 1) ──
 * Login is where a broken deployment shows up first, and it used to answer FIVE structurally
 * different failures with two strings ("Login failed" / "Failed to validate credentials with
 * Jira"): a missing TOKEN_ENCRYPTION_KEY, a short SESSION_PASSWORD, an unreachable database, an
 * unapplied migration, and blocked egress to Atlassian. Each stage below now fails with its own
 * code and a `details.stage`, so the response says which of the five it was:
 *
 *   config → CONFIG_MISSING · jira-network → JIRA_UNREACHABLE/JIRA_TIMEOUT ·
 *   jira-auth → JIRA_AUTH · database → DB_UNAVAILABLE/DB_MIGRATION_MISSING ·
 *   session → SESSION_WRITE_FAILED
 *
 * This is the one PRE-AUTH surface, so the admin-gated `debug` block cannot apply. The deliberate
 * rule (spec, "pre-auth exposure"): expose the stage, the code, the requestId and a remediation
 * message that NAMES a missing env var — never its value, never a stack. On an internal tool the
 * name of an unset variable is not a secret, and withholding it is what made a mis-provisioned
 * container look exactly like a wrong password.
 */
import { prisma } from "@/lib/db";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { loginInputSchema } from "@/lib/schemas/auth";
import { encryptToken, assertTokenKey } from "@/lib/crypto";
import { createUserSession, getSessionCookieInfo, assertSessionPassword } from "@/lib/auth";
import { logger } from "@/lib/log";
import { fetchMyself, fetchCloudId, getJiraBaseUrl, JiraAuthError } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

/**
 * `secure: true` cookies are silently DISCARDED by the browser on a plain-HTTP response: login
 * answers 200 and the user bounces straight back to /login, with no error raised anywhere. If TLS
 * terminates at the load balancer and forwards HTTP, this is the signature. Detect it and say so.
 * @param {Request} request
 * @returns {string | null} a warning to attach to the 200, or null when the context is fine.
 */
function detectInsecureCookieContext(request) {
  const cookie = getSessionCookieInfo();
  if (!cookie.secure) return null;

  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded ?? (() => {
    try {
      return new URL(request.url).protocol.replace(":", "");
    } catch {
      return null;
    }
  })();

  if (proto && proto !== "https") {
    logger.warn("session.insecure_context", { proto, cookieName: cookie.cookieName });
    return `The session cookie is marked Secure but this request arrived over ${proto}. The browser will discard it and you will be sent back to the login page — check TLS termination / x-forwarded-proto.`;
  }
  return null;
}

/**
 * Check EVERY secret this route will need before doing anything else.
 *
 * Ordering matters for debuggability: `TOKEN_ENCRYPTION_KEY` is not used until after Jira has been
 * called and the user upserted, and `SESSION_PASSWORD` not until the very end — so a container
 * missing either one used to answer a slow, misleading "Login failed" AFTER a successful round trip
 * to Atlassian. Failing up front makes the answer instant, deterministic, and independent of
 * whether the caller's credentials happen to be valid.
 *
 * @returns {string} the validated Jira base URL.
 */
function assertLoginConfig() {
  const baseUrl = getJiraBaseUrl(); // throws ConfigError naming JIRA_BASE_URL
  assertTokenKey(); // throws ConfigError naming TOKEN_ENCRYPTION_KEY
  assertSessionPassword(); // throws ConfigError naming SESSION_PASSWORD
  return baseUrl;
}

export const POST = withRoute("auth.login", async (request) => {
  const { email, token } = await parseJsonBody(request, loginInputSchema);

  // Stage: config — all three secrets, before any network call.
  const baseUrl = assertLoginConfig();

  // Stage: jira-network / jira-auth — the client distinguishes "cannot reach Atlassian" from
  // "Atlassian said no", which the old catch-all could not.
  let identity;
  try {
    identity = await fetchMyself({ baseUrl, email, token });
  } catch (error) {
    if (error instanceof JiraAuthError) {
      logger.warn("auth.login_rejected", { email, code: error.code });
      throw new JiraAuthError("Invalid credentials. Check your Jira email and API token.");
    }
    throw error;
  }

  const cloudId = (await fetchCloudId({ baseUrl })) ?? baseUrl;

  // Stage: database — a missing table (migrations not deployed) or an unreachable/TLS-mismatched
  // Postgres is classified by handleRouteError into DB_MIGRATION_MISSING / DB_UNAVAILABLE, each
  // carrying its own remediation hint.
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      jiraAccountId: identity.accountId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    },
    create: {
      email,
      jiraAccountId: identity.accountId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    },
  });

  const credentialFields = {
    jiraEmail: email,
    encryptedToken: encryptToken(token),
    cloudId,
    baseUrl,
    lastValidatedAt: new Date(),
  };
  await prisma.jiraCredential.upsert({
    where: { userId: user.id },
    update: credentialFields,
    create: { userId: user.id, ...credentialFields },
  });

  // Stage: session — SessionWriteError (or ConfigError naming SESSION_PASSWORD).
  await createUserSession(user.id);

  const warning = detectInsecureCookieContext(request);
  logger.info("auth.login_ok", { userId: user.id, email: user.email, isAdmin: user.isAdmin });

  return Response.json({
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    avatarUrl: user.avatarUrl,
    ...(warning ? { warning } : {}),
  });
});
