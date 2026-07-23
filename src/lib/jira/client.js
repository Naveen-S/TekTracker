/**
 * Jira Cloud REST client — the SINGLE module where Jira specifics live (§17: base URL, REST path,
 * Basic-auth construction, endpoints, pagination). Auth (step 3) added identity validation +
 * cloud-id discovery; Sync (step 5) added per-user credential loading, filter fetch, and the
 * paginated `/search/jql` issue search.
 *
 * Auth is Basic `email:token` against the personal API token (auth-layer.md decision 2/§16). When we
 * later move to OAuth 3LO (§13, deferred), the swap is isolated to this module + JiraCredential.
 */
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { validate } from "@/lib/validation";
import { jiraFilterSchema, jiraSearchPageSchema } from "@/lib/schemas/jira";

/** Thrown when Jira rejects the credentials (401/403). Routes map this to HTTP 401. */
export class JiraAuthError extends Error {
  constructor(message = "Invalid Jira credentials") {
    super(message);
    this.name = "JiraAuthError";
  }
}

/** Thrown when the user has no stored JiraCredential. Routes map this to HTTP 401 (re-login fixes it). */
export class JiraCredentialMissingError extends Error {
  constructor(message = "No Jira credential on file — reconnect your Jira account by logging in again") {
    super(message);
    this.name = "JiraCredentialMissingError";
  }
}

/** Thrown on non-auth Jira API failures (429/5xx/malformed responses). Routes map this to HTTP 502. */
export class JiraApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "JiraApiError";
    this.status = status;
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
 * Load + decrypt the caller's stored Jira credential (sync decision 2: you sync what YOUR token
 * can see). The raw token exists only in memory for the duration of the request.
 * @param {string} userId
 * @returns {Promise<{ baseUrl: string, email: string, token: string }>}
 * @throws {JiraCredentialMissingError} when the user never logged in / credential was removed.
 */
export async function getJiraAuthForUser(userId) {
  const credential = await prisma.jiraCredential.findUnique({ where: { userId } });
  if (!credential) {
    throw new JiraCredentialMissingError();
  }
  return {
    baseUrl: credential.baseUrl.replace(/\/+$/, ""),
    email: credential.jiraEmail,
    token: decryptToken(credential.encryptedToken),
  };
}

function toJiraError(res, doing) {
  if (res.status === 401 || res.status === 403) {
    return new JiraAuthError(`Jira rejected the stored credentials while ${doing}`);
  }
  return new JiraApiError(`Jira request failed while ${doing}: ${res.status} ${res.statusText}`, res.status);
}

/**
 * Fetch a saved Jira filter (GET /rest/api/3/filter/{id}) — sync uses its CURRENT `jql`
 * (sync decision 9).
 * @param {{ auth: { baseUrl: string, email: string, token: string }, filterId: string }} args
 * @returns {Promise<{ id: string, name: string, jql: string }>}
 */
export async function fetchFilter({ auth, filterId }) {
  const res = await fetch(`${auth.baseUrl}/rest/api/3/filter/${encodeURIComponent(filterId)}`, {
    headers: { Authorization: basicAuthHeader(auth.email, auth.token), Accept: "application/json" },
  });
  if (!res.ok) {
    throw toJiraError(res, `fetching filter ${filterId}`);
  }
  const parsed = validate(jiraFilterSchema, await res.json());
  if (!parsed.success) {
    throw new JiraApiError(`Unexpected Jira filter response: ${parsed.error}`);
  }
  return parsed.data;
}

const SEARCH_PAGE_SIZE = 100;
const SEARCH_MAX_ISSUES = 2000; // safety cap — a sprint track is a few hundred issues at most

/**
 * Fetch ALL issues for a JQL via the paginated POST /rest/api/3/search/jql endpoint
 * (`nextPageToken`/`isLast` — the OLD /search endpoint is deprecated; request shape matches the
 * legacy proxy, server.js:288-301).
 * `maxIssues` overrides the sprint-sized safety cap for callers with legitimately larger universes
 * (gm-bug-report.md (d) — a bug backlog is bigger than a sprint track). It NEVER truncates: going
 * over throws, because a silently short result would understate a leadership number.
 *
 * @param {{ auth: { baseUrl: string, email: string, token: string }, jql: string, fields: string[], maxIssues?: number }} args
 * @returns {Promise<Array<{ key: string, fields: Record<string, unknown> }>>}
 */
export async function searchIssues({ auth, jql, fields, maxIssues = SEARCH_MAX_ISSUES }) {
  const issues = [];
  let nextPageToken = null;

  for (;;) {
    const body = { jql, maxResults: SEARCH_PAGE_SIZE, fields };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    const res = await fetch(`${auth.baseUrl}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(auth.email, auth.token),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw toJiraError(res, "searching issues");
    }
    const parsed = validate(jiraSearchPageSchema, await res.json());
    if (!parsed.success) {
      throw new JiraApiError(`Unexpected Jira search response: ${parsed.error}`);
    }
    const page = parsed.data;
    issues.push(...page.issues);

    if (issues.length > maxIssues) {
      throw new JiraApiError(
        `JQL returned more than ${maxIssues} issues — narrow the filter's JQL`,
      );
    }
    if ((page.isLast ?? true) || !page.nextPageToken) {
      return issues;
    }
    nextPageToken = page.nextPageToken;
  }
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
