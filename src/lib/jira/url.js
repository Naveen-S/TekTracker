/**
 * Build a clickable Jira issue-navigator URL for a filter's Jira Filter ID or JQL. Mirrors the
 * inline `${jiraBaseUrl}/issues/?jql=...` / `?filter=...` pattern already duplicated across
 * needs-attention-panel.jsx and the bug-report components (filter id wins when both are present,
 * matching bug-lists.jsx's BugReferenceLinks precedence — though in practice a Filter only ever
 * populates one, per its sourceType).
 * @param {{ jiraBaseUrl?: string|null, jql?: string|null, jiraFilterId?: string|null }} args
 * @returns {string|null} null when no base URL or neither jql/jiraFilterId is set
 */
export function buildJiraSearchUrl({ jiraBaseUrl, jql, jiraFilterId }) {
  if (!jiraBaseUrl) return null;
  if (jiraFilterId) return `${jiraBaseUrl}/issues/?filter=${encodeURIComponent(jiraFilterId)}`;
  if (jql) return `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}`;
  return null;
}
