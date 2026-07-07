/**
 * Jira Cloud REST client — the SINGLE module where Jira specifics live (§17: base URL, REST path,
 * Basic-auth construction, endpoints). Auth (step 3) needs only identity validation + cloud-id
 * discovery; step 5 (Sync) expands this with the issue/search/pagination calls and field IDs.
 *
 * Auth is Basic `email:token` against the personal API token (auth-layer.md decision 2/§16). When we
 * later move to OAuth 3LO (§13, deferred), the swap is isolated to this module + JiraCredential.
 */

/** Thrown when Jira rejects the credentials (401/403). Routes map this to HTTP 401. */
export class JiraAuthError extends Error {
  constructor(message = "Invalid Jira credentials") {
    super(message);
    this.name = "JiraAuthError";
  }
}

/**
 * Resolve + normalize the configured Jira site URL (e.g. `https://tekion.atlassian.net`). Throws
 * loudly if unset. The REST base is `{baseUrl}/rest/api/3` (auth-layer.md decision 3).
 * @returns {string}
 */
export function getJiraBaseUrl() {
  const value = process.env.JIRA_BASE_URL?.trim();
  if (!value) {
    throw new Error("JIRA_BASE_URL is not set (e.g. https://tekion.atlassian.net)");
  }
  return value.replace(/\/+$/, "");
}

function basicAuthHeader(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/**
 * Validate credentials against `/myself` and return the identity we persist on `User`.
 * @param {{ baseUrl: string, email: string, token: string }} args
 * @returns {Promise<{ accountId: string, displayName: string, avatarUrl: string | null }>}
 * @throws {JiraAuthError} on 401/403; generic Error on other non-2xx.
 */
export async function fetchMyself({ baseUrl, email, token }) {
  const res = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: basicAuthHeader(email, token), Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new JiraAuthError();
  }
  if (!res.ok) {
    throw new Error(`Jira /myself failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    accountId: data.accountId,
    displayName: data.displayName || email,
    avatarUrl: data.avatarUrls?.["48x48"] ?? null,
  };
}

/**
 * Discover the Atlassian tenant `cloudId` (a UUID, NOT the site URL) from the unauthenticated
 * well-known endpoint. Unused under Basic auth but required (non-null) on `JiraCredential` and
 * needed once we move to OAuth. Tolerant: returns `null` so the caller can fall back to `baseUrl`.
 * @param {{ baseUrl: string }} args
 * @returns {Promise<string | null>}
 */
export async function fetchCloudId({ baseUrl }) {
  try {
    const res = await fetch(`${baseUrl}/_edgeProxy/tenant_info`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.cloudId ?? null;
  } catch {
    return null;
  }
}
