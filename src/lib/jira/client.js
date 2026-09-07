/**
 * Jira Cloud REST client — the SINGLE module where Jira specifics live (§17: base URL, REST path,
 * Basic-auth construction, endpoints, pagination). Auth (step 3) added identity validation +
 * cloud-id discovery; Sync (step 5) added per-user credential loading, filter fetch, and the
 * paginated `/search/jql` issue search.
 *
 * Auth is Basic `email:token` against the personal API token (auth-layer.md decision 2/§16). When we
 * later move to OAuth 3LO (§13, deferred), the swap is isolated to this module + JiraCredential.
 *
 * ── Diagnostics (observability-and-errors.md) ──
 * Every call goes through {@link jiraFetch}, which adds the three things whose absence made
 * production Jira failures unreadable:
 *
 * 1. **A timeout.** Blocked egress from the internal cluster used to HANG until the load balancer
 *    killed the request — "login just spins", nothing logged. Now it fails in seconds, named.
 * 2. **Cause-chain classification.** Node's `fetch` throws a bare `TypeError: fetch failed` and
 *    hides the real reason (`ENOTFOUND`, `ECONNREFUSED`, an expired certificate) in `.cause`. That
 *    is the difference between "this container cannot reach Atlassian" and "your token is wrong",
 *    and it used to be discarded unread.
 * 3. **Jira's own error body.** Jira answers a bad JQL with `errorMessages: ["Field 'x' does not
 *    exist"]` — the literal answer — which we previously threw away in favour of "400 Bad Request".
 *
 * Never logged, never echoed: the Authorization header and the token itself.
 */
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { validate } from "@/lib/validation";
import { AppError, ConfigError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/log";
import { jiraFilterSchema, jiraSearchPageSchema } from "@/lib/schemas/jira";

/** Thrown when Jira rejects the credentials (401/403). Routes map this to HTTP 401. */
export class JiraAuthError extends AppError {
  constructor(message = "Invalid Jira credentials", details = null) {
    super(message, { code: ERROR_CODES.JIRA_AUTH, status: 401, details: { stage: "jira-auth", ...details } });
    this.name = "JiraAuthError";
  }
}

/** Thrown when the user has no stored JiraCredential. Routes map this to HTTP 401 (re-login fixes it). */
export class JiraCredentialMissingError extends AppError {
  constructor(message = "No Jira credential on file — reconnect your Jira account by logging in again") {
    super(message, { code: ERROR_CODES.JIRA_CREDENTIAL_MISSING, status: 401 });
    this.name = "JiraCredentialMissingError";
  }
}

/**
 * Thrown on non-auth Jira API failures (4xx/5xx/malformed responses) — Jira answered, but not with
 * what we asked for. Routes map this to HTTP 502.
 *
 * `details` carries Jira's own diagnosis: `{ jiraStatus, jiraErrors, jiraFieldErrors, endpoint }`.
 * The second positional argument stays tolerant of the old `(message, status)` call shape.
 */
export class JiraApiError extends AppError {
  constructor(message, options = null) {
    const details = typeof options === "number" ? { jiraStatus: options } : (options ?? {});
    super(message, { code: ERROR_CODES.JIRA_API, status: 502, details: { stage: "jira-api", ...details } });
    this.name = "JiraApiError";
  }
}

/**
 * Thrown when Jira could not be REACHED at all — DNS, connection refused, TLS. This is a network or
 * egress problem on our side, not a credential problem, and saying so is the whole point.
 */
export class JiraUnreachableError extends AppError {
  constructor(message, details = null) {
    super(message, {
      code: ERROR_CODES.JIRA_UNREACHABLE,
      status: 502,
      details: { stage: "jira-network", ...details },
    });
    this.name = "JiraUnreachableError";
  }
}

/** Thrown when a Jira call exceeded its timeout — usually a firewall black-holing the connection. */
export class JiraTimeoutError extends AppError {
  constructor(message, details = null) {
    super(message, {
      code: ERROR_CODES.JIRA_TIMEOUT,
      status: 504,
      details: { stage: "jira-network", ...details },
    });
    this.name = "JiraTimeoutError";
  }
}

/** Per-call ceilings. A sprint track's search page is slower than an identity check. */
const DEFAULT_TIMEOUT_MS = 15_000;
const SEARCH_TIMEOUT_MS = 45_000;

/** Cap on how much of a Jira error body we read — it can be an HTML proxy page. */
const ERROR_BODY_MAX = 4000;

/** How much JQL to keep in an error's details: enough to spot the broken clause, not a novel. */
const JQL_DETAIL_MAX = 500;

/**
 * Resolve + normalize the configured Jira site URL (e.g. `https://tekion.atlassian.net`). Throws
 * loudly if unset. The REST base is `{baseUrl}/rest/api/3` (auth-layer.md decision 3).
 * @returns {string}
 */
export function getJiraBaseUrl() {
  const value = process.env.JIRA_BASE_URL?.trim();
  if (!value) {
    throw new ConfigError("JIRA_BASE_URL is not set", {
      variable: "JIRA_BASE_URL",
      hint: "Set it to the Jira site URL, e.g. https://tekion.atlassian.net",
    });
  }
  return value.replace(/\/+$/, "");
}

function basicAuthHeader(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/** Hostname only — safe to log and to show a user; the path can carry a JQL with issue keys. */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Walk `.cause` for the underlying syscall/errno — where `fetch` hides what actually happened. */
function findCauseCode(error, depth = 0) {
  if (!error || depth > 4) return null;
  if (typeof error.code === "string" && error.code) return error.code;
  return findCauseCode(error.cause, depth + 1);
}

/**
 * Turn a thrown `fetch` failure into a typed, explanatory error.
 *
 * Exported for the fixtures: the mapping from an opaque `TypeError: fetch failed` to
 * "DNS lookup failed for tekion.atlassian.net" is the single most valuable translation in this
 * module, so it is tested directly rather than through the network.
 *
 * @param {Error} error the thrown fetch error.
 * @param {{ url: string, doing: string, timeoutMs: number }} context
 * @returns {AppError}
 */
export function classifyFetchFailure(error, { url, doing, timeoutMs }) {
  const host = hostOf(url);
  const causeCode = findCauseCode(error);

  // AbortSignal.timeout() rejects with a TimeoutError DOMException.
  if (error?.name === "TimeoutError" || error?.name === "AbortError" || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
    return new JiraTimeoutError(
      `Jira did not respond within ${Math.round(timeoutMs / 1000)}s while ${doing} (${host}) — the connection may be blocked by a firewall or proxy`,
      { host, timeoutMs, causeCode },
    );
  }

  const explanations = {
    ENOTFOUND: `DNS lookup failed for ${host} — the hostname is wrong or this network cannot resolve it`,
    EAI_AGAIN: `DNS lookup for ${host} failed temporarily — the resolver is unreachable`,
    ECONNREFUSED: `${host} refused the connection`,
    ECONNRESET: `${host} closed the connection unexpectedly`,
    ETIMEDOUT: `The connection to ${host} timed out`,
    CERT_HAS_EXPIRED: `${host} presented an expired TLS certificate`,
    DEPTH_ZERO_SELF_SIGNED_CERT: `${host} presented a self-signed TLS certificate — a TLS-inspecting proxy may be in the path`,
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: `The TLS certificate of ${host} could not be verified — a TLS-inspecting proxy may be in the path`,
    SELF_SIGNED_CERT_IN_CHAIN: `The TLS chain for ${host} is self-signed — a TLS-inspecting proxy may be in the path`,
  };

  const explanation = explanations[causeCode];
  return new JiraUnreachableError(
    explanation
      ? `Cannot reach Jira while ${doing}: ${explanation}`
      : `Cannot reach Jira while ${doing} (${host}): ${error?.message ?? "network error"}`,
    { host, causeCode },
  );
}

/**
 * Build a {@link JiraApiError} from a non-2xx response, INCLUDING Jira's own explanation.
 * @param {Response} res
 * @param {string} doing
 * @param {object} [extra] additional safe details (e.g. the JQL that was rejected).
 * @returns {Promise<AppError>}
 */
async function toJiraError(res, doing, extra = {}) {
  const endpoint = (() => {
    try {
      return new URL(res.url).pathname;
    } catch {
      return null;
    }
  })();

  // Read the body once, defensively: it may be JSON, an HTML proxy error page, or empty.
  let jiraErrors = [];
  let jiraFieldErrors = null;
  try {
    const raw = (await res.text()).slice(0, ERROR_BODY_MAX);
    if (raw) {
      const body = JSON.parse(raw);
      if (Array.isArray(body?.errorMessages)) {
        jiraErrors = body.errorMessages.filter((message) => typeof message === "string");
      }
      if (body?.errors && typeof body.errors === "object" && Object.keys(body.errors).length > 0) {
        jiraFieldErrors = body.errors;
      }
    }
  } catch {
    // Non-JSON body (proxy HTML, empty 502): the status alone still beats what we had before.
  }

  const details = {
    jiraStatus: res.status,
    ...(endpoint ? { endpoint } : {}),
    ...(jiraErrors.length > 0 ? { jiraErrors } : {}),
    ...(jiraFieldErrors ? { jiraFieldErrors } : {}),
    ...extra,
  };

  if (res.status === 401 || res.status === 403) {
    return new JiraAuthError(`Jira rejected the stored credentials while ${doing}`, details);
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    return new JiraApiError(
      `Jira rate-limited us while ${doing}${retryAfter ? ` — retry after ${retryAfter}s` : ""}`,
      { ...details, ...(retryAfter ? { retryAfter } : {}) },
    );
  }

  // Jira's own message is the answer when there is one ("Field 'sub-component' does not exist").
  const explanation = jiraErrors.length > 0 ? ` — ${jiraErrors.join("; ")}` : "";
  return new JiraApiError(
    `Jira request failed while ${doing}: ${res.status} ${res.statusText}${explanation}`,
    details,
  );
}

/**
 * The one place a Jira HTTP call is made: timeout + network classification + a debug log line.
 * @param {{ url: string, doing: string, email: string, token: string, method?: string,
 *   body?: object, timeoutMs?: number }} args
 * @returns {Promise<Response>}
 */
async function jiraFetch({ url, doing, email, token, method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: basicAuthHeader(email, token),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const classified = classifyFetchFailure(error, { url, doing, timeoutMs });
    logger.warn("jira.request_failed", {
      doing,
      host: hostOf(url),
      ms: Date.now() - startedAt,
      code: classified.code,
      err: error,
    });
    throw classified;
  }

  logger.debug("jira.request", {
    doing,
    method,
    host: hostOf(url),
    status: res.status,
    ms: Date.now() - startedAt,
  });
  return res;
}

/**
 * Validate credentials against `/myself` and return the identity we persist on `User`.
 * @param {{ baseUrl: string, email: string, token: string }} args
 * @returns {Promise<{ accountId: string, displayName: string, avatarUrl: string | null }>}
 * @throws {JiraAuthError} on 401/403; {@link JiraUnreachableError}/{@link JiraTimeoutError} when
 *   Jira cannot be reached; {@link JiraApiError} on any other non-2xx.
 */
export async function fetchMyself({ baseUrl, email, token }) {
  const res = await jiraFetch({
    url: `${baseUrl}/rest/api/3/myself`,
    doing: "validating your Jira identity",
    email,
    token,
  });
  if (res.status === 401 || res.status === 403) {
    throw new JiraAuthError();
  }
  if (!res.ok) {
    throw await toJiraError(res, "validating your Jira identity");
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

/**
 * Fetch a saved Jira filter (GET /rest/api/3/filter/{id}) — sync uses its CURRENT `jql`
 * (sync decision 9).
 * @param {{ auth: { baseUrl: string, email: string, token: string }, filterId: string }} args
 * @returns {Promise<{ id: string, name: string, jql: string }>}
 */
export async function fetchFilter({ auth, filterId }) {
  const doing = `fetching filter ${filterId}`;
  const res = await jiraFetch({
    url: `${auth.baseUrl}/rest/api/3/filter/${encodeURIComponent(filterId)}`,
    doing,
    email: auth.email,
    token: auth.token,
  });
  if (!res.ok) {
    throw await toJiraError(res, doing, { jiraFilterId: String(filterId) });
  }
  const parsed = validate(jiraFilterSchema, await res.json());
  if (!parsed.success) {
    throw new JiraApiError(`Unexpected Jira filter response: ${parsed.error}`, {
      jiraFilterId: String(filterId),
    });
  }
  return parsed.data;
}

/**
 * List all Jira fields (GET /rest/api/3/field). Used to discover a CUSTOM field's REST id
 * (`customfield_XXXXX`) from its JQL clause name / display name — the search `fields` param needs
 * the id, not the human name (enhancing-bug-board.md (b)). Returns the raw field-metadata array;
 * the caller does the matching.
 * @param {{ auth: { baseUrl: string, email: string, token: string } }} args
 * @returns {Promise<Array<{ id: string, key?: string, name?: string, clauseNames?: string[] }>>}
 */
export async function fetchFields({ auth }) {
  const res = await jiraFetch({
    url: `${auth.baseUrl}/rest/api/3/field`,
    doing: "listing Jira fields",
    email: auth.email,
    token: auth.token,
  });
  if (!res.ok) {
    throw await toJiraError(res, "listing Jira fields");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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
 * Every failure carries the (truncated) JQL in `details.jql` — when Jira says a field does not
 * exist, the next question is always "in which query?".
 *
 * @param {{ auth: { baseUrl: string, email: string, token: string }, jql: string, fields: string[], maxIssues?: number }} args
 * @returns {Promise<Array<{ key: string, fields: Record<string, unknown> }>>}
 */
export async function searchIssues({ auth, jql, fields, maxIssues = SEARCH_MAX_ISSUES }) {
  const issues = [];
  let nextPageToken = null;
  const jqlDetail = typeof jql === "string" ? jql.slice(0, JQL_DETAIL_MAX) : null;

  for (;;) {
    const body = { jql, maxResults: SEARCH_PAGE_SIZE, fields };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    const res = await jiraFetch({
      url: `${auth.baseUrl}/rest/api/3/search/jql`,
      doing: "searching issues",
      email: auth.email,
      token: auth.token,
      method: "POST",
      body,
      timeoutMs: SEARCH_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw await toJiraError(res, "searching issues", { jql: jqlDetail });
    }
    const parsed = validate(jiraSearchPageSchema, await res.json());
    if (!parsed.success) {
      throw new JiraApiError(`Unexpected Jira search response: ${parsed.error}`, { jql: jqlDetail });
    }
    const page = parsed.data;
    issues.push(...page.issues);

    if (issues.length > maxIssues) {
      throw new JiraApiError(`JQL returned more than ${maxIssues} issues — narrow the filter's JQL`, {
        jql: jqlDetail,
        maxIssues,
      });
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
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.cloudId ?? null;
  } catch (error) {
    logger.debug("jira.cloud_id_unavailable", { host: hostOf(baseUrl), err: error });
    return null;
  }
}

/**
 * Unauthenticated reachability probe for /api/diagnostics: can this container reach the Jira host
 * at all? Deliberately credential-free, so it separates a NETWORK problem from a TOKEN problem —
 * the distinction that "Failed to validate credentials with Jira" used to hide.
 *
 * @param {{ baseUrl?: string, timeoutMs?: number }} [args]
 * @returns {Promise<{ reachable: boolean, host: string | null, ms: number, status?: number,
 *   code?: string, error?: string }>}
 */
export async function probeJiraReachable({ baseUrl, timeoutMs = 8000 } = {}) {
  const startedAt = Date.now();
  let target;
  try {
    target = baseUrl ?? getJiraBaseUrl();
  } catch (error) {
    return { reachable: false, host: null, ms: 0, code: error.code, error: error.message };
  }

  try {
    const res = await fetch(`${target}/_edgeProxy/tenant_info`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { reachable: true, host: hostOf(target), ms: Date.now() - startedAt, status: res.status };
  } catch (error) {
    const classified = classifyFetchFailure(error, {
      url: target,
      doing: "probing Jira",
      timeoutMs,
    });
    return {
      reachable: false,
      host: hostOf(target),
      ms: Date.now() - startedAt,
      code: classified.code,
      error: classified.message,
    };
  }
}
