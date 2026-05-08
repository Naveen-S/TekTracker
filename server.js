import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
try {
  const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Loaded .env file');
} catch (error) {
  console.log('ℹ️  No .env file found - using environment variables');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Jira configuration - these would typically come from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://tekion.atlassian.net';
const JIRA_API_BASE = process.env.JIRA_API_BASE || 'https://api.atlassian.com/ex/jira/92da72f4-8c05-4b25-a53d-cb44c0205f44/rest/api/3';

// API token authentication (required for SSO)
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (JIRA_EMAIL && JIRA_API_TOKEN) {
  console.log('✅ Using Jira API token authentication');
  console.log(`📧 Email: ${JIRA_EMAIL}`);
} else {
  console.log('⚠️  No Jira credentials found. Please set JIRA_EMAIL and JIRA_API_TOKEN in .env file');
  console.log('   See SETUP_AUTH.md for instructions');
}

app.use(cors());
app.use(express.json());

// Middleware to add Jira auth headers
// Note: In production, you'd use OAuth or API tokens stored securely
function addJiraHeaders(headers = {}) {
  const baseHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...headers,
  };

  // If API token is configured, use it for authentication
  if (JIRA_EMAIL && JIRA_API_TOKEN) {
    const authString = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
    baseHeaders['Authorization'] = `Basic ${authString}`;
  }

  return baseHeaders;
}

// Get filter details
app.get('/api/jira/filter/:filterId', async (req, res) => {
  try {
    const { filterId } = req.params;
    console.log(`Fetching filter ${filterId} from Jira...`);

    const response = await fetch(`${JIRA_API_BASE}/filter/${filterId}`, {
      method: 'GET',
      headers: addJiraHeaders(),
    });

    console.log(`Jira response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jira API error: ${response.status} - ${errorText}`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched filter: ${data.name}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching filter:', error);
    res.status(500).json({
      error: error.message,
      details: 'Make sure you are logged into Jira and have access to this filter.'
    });
  }
});

// Search for issues using JQL
app.post('/api/jira/search', async (req, res) => {
  try {
    const { jql, maxResults = 50, fields } = req.body;
    console.log(`Searching Jira with JQL: ${jql.substring(0, 100)}...`);

    // Use the new /search/jql endpoint (the old /search endpoint is deprecated)
    const response = await fetch(`${JIRA_API_BASE}/search/jql`, {
      method: 'POST',
      headers: addJiraHeaders(),
      body: JSON.stringify({
        jql,
        maxResults,
        fields: fields || [
          'summary',
          'status',
          'assignee',
          'issuetype',
          'customfield_10016',
          'duedate',
          'priority',
          'customfield_10020',
        ],
      }),
    });

    console.log(`Jira search response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jira API error: ${response.status} - ${errorText}`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.issues?.length || 0} issues`);
    res.json(data);
  } catch (error) {
    console.error('Error searching issues:', error);
    res.status(500).json({
      error: error.message,
      details: 'Make sure you are logged into Jira and have access to these issues.'
    });
  }
});

// Get issue details
app.get('/api/jira/issue/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;

    const response = await fetch(`${JIRA_API_BASE}/issue/${issueKey}`, {
      method: 'GET',
      headers: addJiraHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard details
app.get('/api/jira/dashboard/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    console.log(`Fetching dashboard ${dashboardId} from Jira...`);

    const response = await fetch(`${JIRA_API_BASE}/dashboard/${dashboardId}`, {
      method: 'GET',
      headers: addJiraHeaders(),
    });

    console.log(`Jira dashboard response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jira API error: ${response.status} - ${errorText}`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched dashboard: ${data.name}`);
    console.log(`Dashboard has ${data.gadgets?.length || 0} gadgets`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      error: error.message,
      details: 'Make sure you are logged into Jira and have access to this dashboard.'
    });
  }
});

// Get specific gadget from dashboard
app.get('/api/jira/dashboard/:dashboardId/gadget/:gadgetId', async (req, res) => {
  try {
    const { dashboardId, gadgetId } = req.params;
    console.log(`Fetching gadget ${gadgetId} from dashboard ${dashboardId}...`);

    // Fetch all gadgets from the dashboard
    const response = await fetch(`${JIRA_API_BASE}/dashboard/${dashboardId}/gadget`, {
      method: 'GET',
      headers: addJiraHeaders(),
    });

    console.log(`Jira dashboard gadgets response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Jira API error: ${response.status} - ${errorText}`);
      throw new Error(`Jira API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data.gadgets?.length || 0} gadgets from dashboard`);

    // Find the specific gadget by ID
    const targetGadget = data.gadgets?.find(g => String(g.id) === String(gadgetId));

    if (!targetGadget) {
      const availableGadgets = data.gadgets?.map(g => `${g.id} (${g.title})`).join(', ') || 'none';
      console.error(`Gadget ${gadgetId} not found. Available: ${availableGadgets}`);
      throw new Error(
        `Gadget ${gadgetId} not found in dashboard ${dashboardId}.\n` +
        `Available gadgets: ${availableGadgets}`
      );
    }

    console.log(`Successfully found gadget: ${targetGadget.title || 'Untitled'}`);
    console.log(`Gadget type: ${targetGadget.moduleKey || 'unknown'}`);
    console.log(`Gadget properties:`, JSON.stringify(targetGadget.properties, null, 2));

    res.json(targetGadget);
  } catch (error) {
    console.error('Error fetching gadget:', error);
    res.status(500).json({
      error: error.message,
      details: 'Make sure you are logged into Jira and have access to this dashboard and gadget.'
    });
  }
});

// Scrape dashboard widget for issue keys
app.post('/api/jira/scrape-dashboard', async (req, res) => {
  try {
    const { dashboardId, gadgetId } = req.body;
    console.log(`Scraping dashboard ${dashboardId} gadget ${gadgetId}...`);

    // First, get the dashboard HTML
    const dashboardUrl = `${JIRA_BASE_URL}/jira/dashboards/${dashboardId}?maximized=${gadgetId}`;
    console.log(`Fetching dashboard HTML from: ${dashboardUrl}`);

    const response = await fetch(dashboardUrl, {
      method: 'GET',
      headers: addJiraHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard HTML: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`Received HTML, length: ${html.length} characters`);

    // Save a sample of the HTML for debugging
    const htmlSample = html.substring(0, 500);
    console.log('HTML sample:', htmlSample);

    // Extract issue keys from HTML using regex
    // Jira issue keys typically match: PROJECT-NUMBER (e.g., DR_GM-123, GM-456)
    const issueKeyRegex = /\b([A-Z][A-Z0-9_]*-\d+)\b/g;
    const matches = html.match(issueKeyRegex);

    console.log(`Regex found ${matches ? matches.length : 0} total issue key matches`);

    if (!matches) {
      console.log('No issue keys found in HTML');
      console.log('This might be because:');
      console.log('1. The page requires JavaScript to render');
      console.log('2. The authentication failed');
      console.log('3. The HTML structure is different');
      return res.json({ issueKeys: [], count: 0 });
    }

    // Remove duplicates
    const allUniqueKeys = [...new Set(matches)];
    console.log(`Found ${allUniqueKeys.length} unique issue keys total:`, allUniqueKeys.slice(0, 20));

    // Try DR_GM first
    let issueKeys = allUniqueKeys.filter(key => key.startsWith('DR_GM'));
    console.log(`Filtered to ${issueKeys.length} DR_GM issues:`, issueKeys);

    // If no DR_GM issues, try just GM
    if (issueKeys.length === 0) {
      issueKeys = allUniqueKeys.filter(key => key.startsWith('GM-'));
      console.log(`No DR_GM found, trying GM-: ${issueKeys.length} issues:`, issueKeys);
    }

    // If still nothing, return all unique keys
    if (issueKeys.length === 0) {
      console.log(`No DR_GM or GM- issues found, returning all ${allUniqueKeys.length} issue keys`);
      issueKeys = allUniqueKeys;
    }

    res.json({
      issueKeys,
      count: issueKeys.length,
      dashboardUrl,
      totalMatches: allUniqueKeys.length,
      allKeys: allUniqueKeys.slice(0, 50) // Send first 50 for debugging
    });
  } catch (error) {
    console.error('Error scraping dashboard:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to scrape dashboard. Make sure you have access to the dashboard.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Jira proxy server running on http://localhost:${PORT}`);
});
