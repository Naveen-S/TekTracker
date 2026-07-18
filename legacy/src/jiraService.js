// Jira integration service for fetching filters and issues

const normalizeBaseUrl = (url) => (url || '').replace(/\/+$/, '');

const JIRA_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_JIRA_BASE_URL);
const USE_PROXY = import.meta.env.VITE_USE_JIRA_PROXY !== 'false';
const PROXY_API_BASE = normalizeBaseUrl(import.meta.env.VITE_JIRA_API_BASE_URL);
const STORY_POINTS_FIELD = 'customfield_10008';
const LEGACY_STORY_POINTS_FIELD = 'customfield_10016';

// Determine the API base URL
const API_BASE = USE_PROXY ? PROXY_API_BASE : JIRA_BASE_URL;

export function getJiraIssueUrl(issueKey) {
  return JIRA_BASE_URL ? `${JIRA_BASE_URL}/browse/${issueKey}` : '#';
}

/**
 * Fetch filter details by filter ID
 */
async function fetchFilterDetails(filterId) {
  try {
    const url = USE_PROXY
      ? `${API_BASE}/filter/${filterId}`
      : `${JIRA_BASE_URL}/rest/api/3/filter/${filterId}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch filter (${response.status}): ${errorText || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching filter details:', error);
    throw new Error(`Cannot connect to Jira API. Make sure the proxy server is running and VITE_JIRA_API_BASE_URL is configured. Error: ${error.message}`);
  }
}

const FIELDS = [
  'summary',
  'status',
  'assignee',
  'issuetype',
  STORY_POINTS_FIELD,
  LEGACY_STORY_POINTS_FIELD,
  'duedate',
  'priority',
  'customfield_10020',
  'fixVersions',
];

const PAGE_SIZE = 100;

async function searchAllIssues(jql) {
  let allIssues = [];
  let nextPageToken = null;
  let isLast = false;

  while (!isLast) {
    let response;
    if (USE_PROXY) {
      const body = { jql, maxResults: PAGE_SIZE, fields: FIELDS };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      const params = new URLSearchParams({
        jql,
        maxResults: PAGE_SIZE.toString(),
        fields: FIELDS.join(','),
      });
      response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch issues (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const page = data.issues || [];
    allIssues = allIssues.concat(page);
    isLast = data.isLast ?? true;
    nextPageToken = data.nextPageToken ?? null;
    if (page.length < PAGE_SIZE) break;
  }

  return allIssues;
}

/**
 * Fetch issues from a Jira filter
 */
export async function fetchFilterIssues(filterId) {
  try {
    const filter = await fetchFilterDetails(filterId);
    const issues = await searchAllIssues(filter.jql);
    return { filter, issues };
  } catch (error) {
    console.error('Error fetching filter issues:', error);
    throw error;
  }
}

/**
 * Fetch issues from a direct JQL query
 */
export async function fetchJQLIssues(jql, filterName) {
  try {
    const issues = await searchAllIssues(jql);
    const filter = {
      id: `jql-${Date.now()}`,
      name: filterName,
      jql,
    };
    return { filter, issues };
  } catch (error) {
    console.error('Error fetching JQL issues:', error);
    throw error;
  }
}

/**
 * Transform Jira issue to app format
 */
function transformJiraIssue(jiraIssue, index) {
  const fields = jiraIssue.fields;

  // Extract assignee name - get first name or full display name
  let owner = 'Unassigned';
  if (fields.assignee) {
    const displayName = fields.assignee.displayName || fields.assignee.name || 'Unassigned';
    // Extract first name if display name contains multiple words
    owner = displayName.split(' ')[0];
  }

  // Extract story points - customfield_10008 is the current Tekion field.
  const points = fields[STORY_POINTS_FIELD] ?? fields[LEGACY_STORY_POINTS_FIELD] ?? 0;

  // Map Jira status to app status
  const statusMapping = {
    'Done': 'Done',
    'In Progress': 'In Progress',
    'Groomed': 'New',
    'Backlog': 'New',
    'Code Review': 'In Progress',
    'Testing': 'In Progress',
    'Blocked': 'At Risk',
  };

  const jiraStatus = fields.status?.name || 'New';
  const status = statusMapping[jiraStatus] || 'In Progress';

  // Calculate a stage based on status (0-9 for 10 stages)
  const stageMapping = {
    'New': 0,
    'Backlog': 0,
    'Groomed': 1,
    'In Progress': 4,
    'Code Review': 7,
    'Testing': 6,
    'Done': 9,
  };
  const stage = stageMapping[jiraStatus] || 0;

  // Calculate progress percentage based on status (10% per stage now)
  const progressMapping = {
    'Backlog': 0,
    'Groomed': 10,
    'In Progress': 40,
    'Testing': 60,
    'Code Review': 70,
    'Done': 100,
  };
  const percent = progressMapping[jiraStatus] || 0;

  // Format due date
  const dueDate = fields.duedate ? new Date(fields.duedate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) : 'No due date';

  // Sprint: customfield_10020 can be an array of objects, a single object, or a legacy string
  let sprint = null;
  const rawSprint = fields.customfield_10020;
  if (Array.isArray(rawSprint) && rawSprint.length > 0) {
    const active = rawSprint.find(s => s.state === 'active' || s.state === 'ACTIVE');
    const chosen = active ?? rawSprint[rawSprint.length - 1];
    sprint = chosen.name ?? null;
  } else if (rawSprint && typeof rawSprint === 'object' && rawSprint.name) {
    sprint = rawSprint.name;
  } else if (typeof rawSprint === 'string') {
    // Legacy Jira string format: "...name=Sprint 1,startDate=..."
    const match = rawSprint.match(/name=([^,\]]+)/);
    if (match) sprint = match[1].trim();
  }

  // Fix versions: standard Jira array field
  const fixVersions = Array.isArray(fields.fixVersions) && fields.fixVersions.length > 0
    ? fields.fixVersions.map(v => v.name).join(', ')
    : null;

  return {
    key: jiraIssue.key,
    title: fields.summary,
    owner,
    status,
    jiraStatus,
    type: fields.issuetype?.name || 'Story',
    points,
    percent,
    blocker: '',
    stage,
    due: dueDate,
    sprint,
    fixVersions,
  };
}

/**
 * Transform filter data to app format
 */
export function transformFilter(filterData, issues) {
  const colors = ['#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#dc2626', '#f59e0b'];
  const filterColors = colors.filter(c => c !== '#dc2626');
  const colorIndex = Math.floor(Math.random() * filterColors.length);

  return {
    id: filterData.id,
    name: filterData.name,
    jql: filterData.jql,
    accent: filterColors[colorIndex],
    issues: issues.map(transformJiraIssue),
  };
}
