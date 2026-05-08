// Jira integration service for fetching filters and issues

const JIRA_BASE_URL = 'https://tekion.atlassian.net';
const USE_PROXY = true; // Set to false to use direct Jira API (requires CORS configuration)

// Determine the API base URL
const API_BASE = USE_PROXY ? 'http://localhost:3001/api/jira' : JIRA_BASE_URL;

/**
 * Fetch filter details by filter ID
 */
export async function fetchFilterDetails(filterId) {
  try {
    const url = USE_PROXY
      ? `${API_BASE}/filter/${filterId}`
      : `${JIRA_BASE_URL}/rest/api/3/filter/${filterId}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: USE_PROXY ? 'omit' : 'include',
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
    throw new Error(`Cannot connect to Jira API. Make sure the proxy server is running on port 3001. Error: ${error.message}`);
  }
}

/**
 * Fetch issues from a Jira filter
 */
export async function fetchFilterIssues(filterId, maxResults = 50) {
  try {
    // First get the filter to extract the JQL
    const filter = await fetchFilterDetails(filterId);

    // Build the search URL
    const fields = [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'customfield_10008', // Story points (Tekion)
      'duedate',
      'priority',
      'customfield_10020', // Sprint
    ];

    let response;
    if (USE_PROXY) {
      response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql: filter.jql,
          maxResults,
          fields,
        }),
      });
    } else {
      const params = new URLSearchParams({
        jql: filter.jql,
        maxResults: maxResults.toString(),
        fields: fields.join(','),
      });
      response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch issues (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return {
      filter,
      issues: data.issues || [],
    };
  } catch (error) {
    console.error('Error fetching filter issues:', error);
    throw error;
  }
}

/**
 * Fetch issues from a Jira dashboard gadget
 */
export async function fetchDashboardGadgetIssues(dashboardId, gadgetId, maxResults = 50) {
  try {
    // Fetch the specific gadget directly using the gadget endpoint
    const url = USE_PROXY
      ? `${API_BASE}/dashboard/${dashboardId}/gadget/${gadgetId}`
      : `${JIRA_BASE_URL}/rest/api/3/dashboard/${dashboardId}/gadget/${gadgetId}`;

    console.log(`Fetching gadget from: ${url}`);

    const gadgetResponse = await fetch(url, {
      method: 'GET',
      credentials: USE_PROXY ? 'omit' : 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!gadgetResponse.ok) {
      const errorText = await gadgetResponse.text();
      console.error('Gadget fetch failed:', errorText);

      // Provide more helpful error message
      let errorMessage = `Failed to fetch gadget (${gadgetResponse.status})`;

      if (gadgetResponse.status === 404) {
        errorMessage += `\n\nThe gadget ${gadgetId} in dashboard ${dashboardId} was not found.\n\n` +
          `This could mean:\n` +
          `1. The dashboard ID or gadget ID is incorrect\n` +
          `2. You don't have permission to access this dashboard\n` +
          `3. The gadget was removed from the dashboard\n\n` +
          `Please verify by visiting:\n` +
          `https://tekion.atlassian.net/jira/dashboards/${dashboardId}?maximized=${gadgetId}`;
      } else if (gadgetResponse.status === 403) {
        errorMessage += `\n\nYou don't have permission to access this dashboard/gadget.`;
      }

      throw new Error(errorMessage);
    }

    const gadget = await gadgetResponse.json();
    console.log('Gadget fetched:', gadget);
    console.log('Gadget full object:', JSON.stringify(gadget, null, 2));

    // Check if this is a Forge app gadget (custom dashboard widget)
    const isForgeGadget = gadget.moduleKey && gadget.moduleKey.includes('atlassian.forge');

    if (isForgeGadget) {
      console.error('This is a Forge app gadget, not a standard filter gadget');
      console.error('Gadget moduleKey:', gadget.moduleKey);
      console.error('Gadget title:', gadget.title);

      throw new Error(
        `This is a Forge app gadget (custom dashboard widget), not a standard Jira filter.\n\n` +
        `Widget: "${gadget.title}"\n\n` +
        `Forge widgets don't expose filter IDs through the API.\n\n` +
        `📝 To track these issues:\n\n` +
        `1. Look for a filter link in the widget (usually at the top or in settings)\n` +
        `2. Click it to open the filter in Issue Navigator\n` +
        `3. Get the filter ID from URL: /issues/?filter=XXXXX\n` +
        `4. Use "Filter ID" mode with that number\n\n` +
        `OR create a JQL query that matches the widget's data:\n\n` +
        `Use "JQL Query" mode with:\n` +
        `project = DR_GM AND resolution = Unresolved`
      );
    }

    // Extract the filter ID from the gadget configuration
    // Most filter gadgets store the filter ID in their properties
    let filterId = null;

    if (gadget.properties?.filterId) {
      filterId = gadget.properties.filterId;
    } else if (gadget.properties?.filterOrProjectId) {
      // Handle format: "filter-12345" or just "12345"
      const filterOrProjectId = gadget.properties.filterOrProjectId;
      if (filterOrProjectId.startsWith('filter-')) {
        filterId = filterOrProjectId.split('-')[1];
      } else {
        filterId = filterOrProjectId;
      }
    } else if (gadget.uri && gadget.uri.includes('filterId=')) {
      const match = gadget.uri.match(/filterId=(\d+)/);
      if (match) filterId = match[1];
    }

    if (!filterId) {
      console.error('Gadget properties:', gadget.properties);
      console.error('Full gadget object:', JSON.stringify(gadget, null, 2));
      throw new Error(
        `Could not extract filter ID from this gadget.\n\n` +
        `Gadget type: ${gadget.moduleKey || 'unknown'}\n` +
        `Gadget title: ${gadget.title || 'unknown'}\n\n` +
        `This gadget may not contain a filter. Try using "Filter ID" or "JQL Query" mode instead.`
      );
    }

    console.log(`Extracted filter ID: ${filterId}`);

    // Now fetch issues using the extracted filter ID
    const result = await fetchFilterIssues(filterId, maxResults);

    // Return with dashboard context
    return {
      filter: {
        ...result.filter,
        name: `${gadget.title || result.filter.name} (Dashboard)`,
        dashboardId,
        gadgetId,
      },
      issues: result.issues,
    };
  } catch (error) {
    console.error('Error fetching dashboard gadget issues:', error);
    throw error;
  }
}

/**
 * Fetch issues from a direct JQL query
 */
export async function fetchJQLIssues(jql, filterName, maxResults = 50) {
  try {
    const fields = [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'customfield_10008', // Story points (Tekion)
      'duedate',
      'priority',
      'customfield_10020', // Sprint
    ];

    let response;
    if (USE_PROXY) {
      response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jql,
          maxResults,
          fields,
        }),
      });
    } else {
      const params = new URLSearchParams({
        jql,
        maxResults: maxResults.toString(),
        fields: fields.join(','),
      });
      response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch issues (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();

    // Create a pseudo-filter object for the JQL query
    const filter = {
      id: `jql-${Date.now()}`, // Generate a unique ID
      name: filterName,
      jql: jql,
    };

    return {
      filter,
      issues: data.issues || [],
    };
  } catch (error) {
    console.error('Error fetching JQL issues:', error);
    throw error;
  }
}

/**
 * Transform Jira issue to app format
 */
export function transformJiraIssue(jiraIssue, index) {
  const fields = jiraIssue.fields;

  // Extract assignee name - get first name or full display name
  let owner = 'Unassigned';
  if (fields.assignee) {
    const displayName = fields.assignee.displayName || fields.assignee.name || 'Unassigned';
    // Extract first name if display name contains multiple words
    owner = displayName.split(' ')[0];
  }

  // Extract story points - customfield_10008 for Tekion Jira instance
  const points = fields.customfield_10008 || 0;

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

  return {
    key: jiraIssue.key,
    title: fields.summary,
    owner,
    status,
    jiraStatus, // Add the actual Jira status
    type: fields.issuetype?.name || 'Story',
    points,
    percent,
    blocker: '', // Can be enhanced to extract from comments or custom fields
    stage,
    due: dueDate,
  };
}

/**
 * Scrape dashboard widget and fetch issues
 */
export async function scrapeDashboardWidget(dashboardId, gadgetId, maxResults = 100) {
  try {
    console.log('🔬 scrapeDashboardWidget called');
    console.log('📍 API_BASE:', API_BASE);
    console.log('📍 Dashboard ID:', dashboardId);
    console.log('📍 Gadget ID:', gadgetId);

    const url = `${API_BASE}/scrape-dashboard`;
    console.log('📍 Calling URL:', url);

    // Call the scraping endpoint
    const scrapeResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dashboardId, gadgetId }),
    });

    console.log('📡 Scrape response status:', scrapeResponse.status);

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Scraping failed:', errorText);
      throw new Error(`Failed to scrape dashboard (${scrapeResponse.status}): ${errorText}`);
    }

    const { issueKeys, count, totalMatches, allKeys } = await scrapeResponse.json();
    console.log(`📊 Scraping results:`);
    console.log(`   Total regex matches: ${totalMatches}`);
    console.log(`   Issue keys to fetch: ${count}`);
    console.log(`   Keys:`, issueKeys);
    if (allKeys && allKeys.length > 0) {
      console.log(`   All keys found:`, allKeys);
    }

    if (!issueKeys || issueKeys.length === 0) {
      throw new Error(
        `No issues found in the dashboard widget HTML.\n\n` +
        `Total issue key patterns found: ${totalMatches || 0}\n` +
        `All keys: ${allKeys ? allKeys.join(', ') : 'none'}\n\n` +
        `This likely means the dashboard uses JavaScript rendering.\n` +
        `Modern Jira dashboards render content client-side, so the HTML\n` +
        `returned from the server is just an empty shell.\n\n` +
        `✅ SOLUTION: Use "JQL Query" mode instead:\n\n` +
        `Query: project = DR_GM AND resolution = Unresolved`
      );
    }

    // Build JQL to fetch all these issues
    const jql = `key IN (${issueKeys.join(', ')})`;
    console.log('Fetching issues with JQL:', jql);

    // Fetch the issues using the keys
    const fields = [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'customfield_10008', // Story points (Tekion)
      'duedate',
      'priority',
      'customfield_10020', // Sprint
    ];

    const searchResponse = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql,
        maxResults,
        fields,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Failed to fetch issues: ${searchResponse.status} ${errorText}`);
    }

    const data = await searchResponse.json();

    // Create a pseudo-filter object
    const filter = {
      id: `dashboard-${dashboardId}-${gadgetId}`,
      name: `Dashboard Widget (${count} issues)`,
      jql: jql,
    };

    return {
      filter,
      issues: data.issues || [],
    };
  } catch (error) {
    console.error('Error scraping dashboard widget:', error);
    throw error;
  }
}

/**
 * Transform filter data to app format
 */
export function transformFilter(filterData, issues) {
  const colors = ['#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#dc2626', '#f59e0b'];
  const colorIndex = Math.floor(Math.random() * colors.length);

  return {
    id: filterData.id,
    name: filterData.name,
    jql: filterData.jql,
    accent: colors[colorIndex],
    issues: issues.map(transformJiraIssue),
  };
}
