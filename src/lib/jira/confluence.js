/**
 * Confluence reads for the security tracker's vocabulary (security-vulnerability-tracker.md (b)).
 * Lives under lib/jira/ because it is the SAME Atlassian site and the same Basic-auth credential;
 * every call goes through `jiraFetch` (timeout, cause-chain classification, logging).
 *
 * READ-ONLY: a single GET. Nothing in the security feature calls a Confluence or Jira write.
 */
import { jiraFetch, toJiraError, JiraAuthError, JiraApiError } from "@/lib/jira/client";

/**
 * GET /wiki/api/v2/pages/{id}?body-format=storage
 * @param {{ auth: { baseUrl: string, email: string, token: string }, pageId: string }} args
 * @returns {Promise<{ id: string, title: string, version: number | null, storage: string }>}
 */
export async function fetchConfluencePage({ auth, pageId }) {
  const doing = `reading Confluence page ${pageId}`;
  const res = await jiraFetch({
    url: `${auth.baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`,
    doing,
    email: auth.email,
    token: auth.token,
  });
  if (res.status === 401 || res.status === 403) throw new JiraAuthError();
  if (!res.ok) throw await toJiraError(res, doing, { pageId: String(pageId) });
  const data = await res.json();
  const storage = data?.body?.storage?.value;
  if (typeof storage !== "string") {
    throw new JiraApiError(`Confluence page ${pageId} came back without a storage body`, { pageId: String(pageId) });
  }
  return { id: String(data.id ?? pageId), title: data.title ?? "", version: data.version?.number ?? null, storage };
}
