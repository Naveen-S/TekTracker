/**
 * POST /api/auth/login — ports server.js login to a Next 16 Route Handler (migration step 3).
 *
 * Flow: zod-validate body → validate against Jira `/myself` → upsert `User` (reconciling the
 * bootstrap-seeded admin's `seed-pending:` placeholder, preserving `isAdmin`) → upsert
 * `JiraCredential` with the AES-256-GCM-encrypted token (never the raw token) → set the `{ userId }`
 * iron-session cookie. Response is a superset of the prototype's `{ email, displayName }`
 * (auth-layer.md decision 4); `isAdmin` is read off the `User` row.
 */
import { prisma } from "@/lib/db";
import { validate } from "@/lib/validation";
import { loginInputSchema } from "@/lib/schemas/auth";
import { encryptToken } from "@/lib/crypto";
import { createUserSession } from "@/lib/auth";
import { fetchMyself, fetchCloudId, getJiraBaseUrl, JiraAuthError } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = validate(loginInputSchema, body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { email, token } = parsed.data;

  let baseUrl;
  try {
    baseUrl = getJiraBaseUrl();
  } catch (error) {
    console.error("Login: server auth misconfigured:", error);
    return Response.json({ error: "Server auth is misconfigured" }, { status: 500 });
  }

  // 1. Validate the credentials against Jira.
  let identity;
  try {
    identity = await fetchMyself({ baseUrl, email, token });
  } catch (error) {
    if (error instanceof JiraAuthError) {
      return Response.json(
        { error: "Invalid credentials. Check your Jira email and API token." },
        { status: 401 },
      );
    }
    console.error("Login: Jira validation failed:", error);
    return Response.json({ error: "Failed to validate credentials with Jira" }, { status: 500 });
  }

  // 2. Persist identity + encrypted credential, then open the session.
  try {
    const cloudId = (await fetchCloudId({ baseUrl })) ?? baseUrl;

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

    await createUserSession(user.id);

    return Response.json({
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    console.error("Login: persistence/session failed:", error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
