import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import FileStore from 'session-file-store';

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

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.replace(/\/+$/, '');
}

let JIRA_BASE_URL;
let JIRA_API_BASE;
try {
  JIRA_BASE_URL = requireEnv('JIRA_BASE_URL');
  JIRA_API_BASE = requireEnv('JIRA_API_BASE');
} catch (error) {
  console.error(`❌ ${error.message}`);
  console.error('   Copy .env.example to .env and set your Jira URLs before starting the server.');
  process.exit(1);
}

const STORY_POINTS_FIELD = 'customfield_10008';
const LEGACY_STORY_POINTS_FIELD = 'customfield_10016';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const DEFAULT_FIELDS = [
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

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET not set. Using default (insecure). Set SESSION_SECRET in .env for production.');
}

const SessionFileStore = FileStore(session);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '64kb' }));
app.use(session({
  store: new SessionFileStore({
    path: join(__dirname, '.sessions'),
    ttl: 30 * 24 * 60 * 60,
    retries: 1,
    reapInterval: 24 * 60 * 60,
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

function sendClientError(res, message, details) {
  res.status(400).json({ error: message, details });
}

function sendProxyError(res, error, details) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({
    error: error.publicMessage || 'Jira proxy request failed',
    details,
  });
}

async function assertJiraOk(response, action) {
  if (response.ok) {
    return;
  }

  const errorBody = await response.text();
  console.error(`Jira API error while ${action}: ${response.status} ${response.statusText}`);
  if (errorBody) {
    console.error(`Jira API error body length: ${errorBody.length}`);
  }

  const error = new Error(`Jira API error: ${response.status} ${response.statusText}`);
  error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
  error.publicMessage = `Jira API error: ${response.status} ${response.statusText}`;
  throw error;
}

function requireNumericParam(res, value, label) {
  if (/^\d+$/.test(String(value || ''))) {
    return String(value);
  }
  sendClientError(res, `${label} must be numeric.`);
  return null;
}

function requireIssueKeyParam(res, value) {
  const issueKey = String(value || '').trim().toUpperCase();
  if (/^[A-Z][A-Z0-9_]*-\d+$/.test(issueKey)) {
    return issueKey;
  }
  sendClientError(res, 'Issue key is invalid.');
  return null;
}

function normalizeMaxResults(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 50;
  }
  return Math.min(Math.max(parsed, 1), 100);
}


function normalizeFields(fields) {
  if (!Array.isArray(fields)) {
    return DEFAULT_FIELDS;
  }

  const cleanFields = fields
    .map(field => String(field).trim())
    .filter(field => /^[A-Za-z0-9_.-]+$/.test(field));

  return cleanFields.length > 0 ? cleanFields : DEFAULT_FIELDS;
}

function requireAuth(req, res, next) {
  if (req.session?.jiraEmail && req.session?.jiraToken) {
    next();
    return;
  }
  res.status(401).json({ error: 'Not authenticated' });
}

function addJiraHeaders(req, extraHeaders = {}) {
  const email = req.session?.jiraEmail;
  const token = req.session?.jiraToken;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (email && token) {
    const authString = Buffer.from(`${email}:${token}`).toString('base64');
    headers['Authorization'] = `Basic ${authString}`;
  }
  return headers;
}

// Auth endpoints (public — no session required)
app.post('/api/auth/login', async (req, res) => {
  const { email, token } = req.body || {};
  if (!email?.trim() || !token?.trim()) {
    return res.status(400).json({ error: 'Email and token are required' });
  }
  try {
    const authString = Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64');
    const response = await fetch(`${JIRA_API_BASE}/myself`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid credentials. Check your Jira email and API token.' });
    }
    const user = await response.json();
    req.session.jiraEmail = email.trim();
    req.session.jiraToken = token.trim();
    req.session.displayName = user.displayName || email.trim();
    res.json({ email: email.trim(), displayName: user.displayName || email.trim() });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to validate credentials with Jira' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (req.session?.jiraEmail) {
    res.json({ email: req.session.jiraEmail, displayName: req.session.displayName || req.session.jiraEmail });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ ok: true });
  });
});

// All /api/jira/* routes require a valid session
app.use('/api/jira', requireAuth);

// Get filter details
app.get('/api/jira/filter/:filterId', async (req, res) => {
  try {
    const filterId = requireNumericParam(res, req.params.filterId, 'Filter ID');
    if (!filterId) return;

    console.log(`Fetching filter ${filterId} from Jira...`);

    const response = await fetch(`${JIRA_API_BASE}/filter/${filterId}`, {
      method: 'GET',
      headers: addJiraHeaders(req),
    });

    console.log(`Jira response status: ${response.status}`);

    await assertJiraOk(response, `fetching filter ${filterId}`);

    const data = await response.json();
    console.log(`Successfully fetched filter: ${data.name}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching filter:', error);
    sendProxyError(res, error, 'Make sure you are logged into Jira and have access to this filter.');
  }
});

// Search for issues using JQL
app.post('/api/jira/search', async (req, res) => {
  try {
    const { jql, maxResults = 50, nextPageToken, fields } = req.body;
    const normalizedJql = typeof jql === 'string' ? jql.trim() : '';
    if (!normalizedJql) {
      sendClientError(res, 'JQL is required.');
      return;
    }
    if (normalizedJql.length > 4000) {
      sendClientError(res, 'JQL is too long.', 'Keep JQL under 4000 characters.');
      return;
    }

    console.log(`Searching Jira with JQL: ${normalizedJql.substring(0, 100)}...`);

    const jiraBody = {
      jql: normalizedJql,
      maxResults: normalizeMaxResults(maxResults),
      fields: normalizeFields(fields),
    };
    if (nextPageToken) {
      jiraBody.nextPageToken = String(nextPageToken);
    }

    const response = await fetch(`${JIRA_API_BASE}/search/jql`, {
      method: 'POST',
      headers: addJiraHeaders(req),
      body: JSON.stringify(jiraBody),
    });

    console.log(`Jira search response status: ${response.status}`);

    await assertJiraOk(response, 'searching issues');

    const data = await response.json();
    console.log(`Successfully fetched ${data.issues?.length || 0} issues`);
    res.json(data);
  } catch (error) {
    console.error('Error searching issues:', error);
    sendProxyError(res, error, 'Make sure you are logged into Jira and have access to these issues.');
  }
});

// Get issue details
app.get('/api/jira/issue/:issueKey', async (req, res) => {
  try {
    const issueKey = requireIssueKeyParam(res, req.params.issueKey);
    if (!issueKey) return;

    const response = await fetch(`${JIRA_API_BASE}/issue/${issueKey}`, {
      method: 'GET',
      headers: addJiraHeaders(req),
    });

    await assertJiraOk(response, `fetching issue ${issueKey}`);

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching issue:', error);
    sendProxyError(res, error, 'Make sure you are logged into Jira and have access to this issue.');
  }
});

// Get dashboard details
app.get('/api/jira/dashboard/:dashboardId', async (req, res) => {
  try {
    const dashboardId = requireNumericParam(res, req.params.dashboardId, 'Dashboard ID');
    if (!dashboardId) return;

    console.log(`Fetching dashboard ${dashboardId} from Jira...`);

    const response = await fetch(`${JIRA_API_BASE}/dashboard/${dashboardId}`, {
      method: 'GET',
      headers: addJiraHeaders(req),
    });

    console.log(`Jira dashboard response status: ${response.status}`);

    await assertJiraOk(response, `fetching dashboard ${dashboardId}`);

    const data = await response.json();
    console.log(`Successfully fetched dashboard: ${data.name}`);
    console.log(`Dashboard has ${data.gadgets?.length || 0} gadgets`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    sendProxyError(res, error, 'Make sure you are logged into Jira and have access to this dashboard.');
  }
});

// Get specific gadget from dashboard
app.get('/api/jira/dashboard/:dashboardId/gadget/:gadgetId', async (req, res) => {
  try {
    const dashboardId = requireNumericParam(res, req.params.dashboardId, 'Dashboard ID');
    const gadgetId = requireNumericParam(res, req.params.gadgetId, 'Gadget ID');
    if (!dashboardId || !gadgetId) return;

    console.log(`Fetching gadget ${gadgetId} from dashboard ${dashboardId}...`);

    const response = await fetch(`${JIRA_API_BASE}/dashboard/${dashboardId}/gadget`, {
      method: 'GET',
      headers: addJiraHeaders(req),
    });

    console.log(`Jira dashboard gadgets response status: ${response.status}`);

    await assertJiraOk(response, `fetching gadgets for dashboard ${dashboardId}`);

    const data = await response.json();
    console.log(`Successfully fetched ${data.gadgets?.length || 0} gadgets from dashboard`);

    const targetGadget = data.gadgets?.find(g => String(g.id) === String(gadgetId));

    if (!targetGadget) {
      const availableGadgets = data.gadgets?.map(g => `${g.id} (${g.title})`).join(', ') || 'none';
      console.error(`Gadget ${gadgetId} not found. Available: ${availableGadgets}`);
      const error = new Error(`Gadget ${gadgetId} not found in dashboard ${dashboardId}.`);
      error.status = 404;
      error.publicMessage = error.message;
      throw error;
    }

    console.log(`Successfully found gadget: ${targetGadget.title || 'Untitled'}`);
    res.json(targetGadget);
  } catch (error) {
    console.error('Error fetching gadget:', error);
    sendProxyError(res, error, 'Make sure you are logged into Jira and have access to this dashboard and gadget.');
  }
});

// Scrape dashboard widget for issue keys
app.post('/api/jira/scrape-dashboard', async (req, res) => {
  try {
    const dashboardId = requireNumericParam(res, req.body?.dashboardId, 'Dashboard ID');
    const gadgetId = requireNumericParam(res, req.body?.gadgetId, 'Gadget ID');
    if (!dashboardId || !gadgetId) return;

    console.log(`Scraping dashboard ${dashboardId} gadget ${gadgetId}...`);

    const dashboardUrl = `${JIRA_BASE_URL}/jira/dashboards/${dashboardId}?maximized=${gadgetId}`;
    console.log(`Fetching dashboard HTML from: ${dashboardUrl}`);

    const response = await fetch(dashboardUrl, {
      method: 'GET',
      headers: addJiraHeaders(req, { 'Accept': 'text/html,application/xhtml+xml,application/xml' }),
    });

    await assertJiraOk(response, `fetching dashboard HTML for ${dashboardId}`);

    const html = await response.text();
    console.log(`Received HTML, length: ${html.length} characters`);

    const issueKeyRegex = /\b([A-Z][A-Z0-9_]*-\d+)\b/g;
    const matches = html.match(issueKeyRegex);

    console.log(`Regex found ${matches ? matches.length : 0} total issue key matches`);

    if (!matches) {
      console.log('No issue keys found in HTML');
      return res.json({ issueKeys: [], count: 0 });
    }

    const allUniqueKeys = [...new Set(matches)];
    console.log(`Found ${allUniqueKeys.length} unique issue keys total:`, allUniqueKeys.slice(0, 20));

    let issueKeys = allUniqueKeys.filter(key => key.startsWith('DR_GM'));
    console.log(`Filtered to ${issueKeys.length} DR_GM issues:`, issueKeys);

    if (issueKeys.length === 0) {
      issueKeys = allUniqueKeys.filter(key => key.startsWith('GM-'));
      console.log(`No DR_GM found, trying GM-: ${issueKeys.length} issues:`, issueKeys);
    }

    if (issueKeys.length === 0) {
      console.log(`No DR_GM or GM- issues found, returning all ${allUniqueKeys.length} issue keys`);
      issueKeys = allUniqueKeys;
    }

    res.json({
      issueKeys,
      count: issueKeys.length,
      dashboardUrl,
      totalMatches: allUniqueKeys.length,
      allKeys: allUniqueKeys.slice(0, 50),
    });
  } catch (error) {
    console.error('Error scraping dashboard:', error);
    sendProxyError(res, error, 'Failed to scrape dashboard. Make sure you have access to the dashboard.');
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }

  if (error.message === 'Origin is not allowed by CORS') {
    res.status(403).json({ error: 'Origin is not allowed by CORS.' });
    return;
  }

  console.error('Unhandled proxy error:', error);
  res.status(500).json({ error: 'Unexpected proxy error.' });
});

app.listen(PORT, () => {
  console.log(`Jira proxy server running on http://localhost:${PORT}`);
});
