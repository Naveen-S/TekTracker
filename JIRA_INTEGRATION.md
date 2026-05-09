# Jira Filter Integration Guide

This guide explains how to add real Jira filters to your Sprint Tracker application.

## Features

✅ Add Jira filters by filter ID
✅ Automatically fetch and display issues from Jira
✅ Sync filters to get latest data
✅ Remove filters you no longer need
✅ View issues in the sprint matrix and card views

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `express` - Backend server for Jira API proxy
- `cors` - Enable cross-origin requests
- `concurrently` - Run both frontend and backend simultaneously

### 2. Start the Application

Run both the frontend and backend server:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1 - Frontend (Vite)
npm run dev

# Terminal 2 - Backend (Express proxy)
npm run dev:server
```

The application will be available at:
- Frontend: http://localhost:3000 (or the port Vite assigns)
- Backend API: the value of `VITE_JIRA_API_BASE_URL` (defaults to `http://localhost:3001/api/jira` locally)

## How to Add a Jira Filter

### Step 1: Get Your Filter ID

1. Go to Jira and navigate to your filter
2. Look at the URL: `https://your-domain.atlassian.net/issues?filter=65834`
3. The filter ID is the number at the end: `65834`

### Step 2: Add the Filter to Sprint Tracker

1. Click the **"Add Jira filter"** button in the hero section
2. Enter the filter ID (e.g., `65834`)
3. Click **"Add Filter"**

The app will:
- Fetch the filter details from Jira
- Load all issues matching the filter's JQL query
- Transform the data to match the app's format
- Display the issues in all views (matrix, cards, metrics)

### Step 3: Sync Your Filters

Click the **"Sync Jira"** button to refresh all dynamically added filters with the latest data from Jira.

## Data Mapping

The app automatically maps Jira data to the sprint tracker format:

| Jira Field | Sprint Tracker Field |
|------------|---------------------|
| Issue Key | key |
| Summary | title |
| Assignee | owner |
| Status | status (mapped to: Done, On Track, In Progress, At Risk, New) |
| Issue Type | type |
| Story Points (customfield_10008, with customfield_10016 fallback) | points |
| Due Date | due |

### Status Mapping

Jira statuses are mapped to simplified app statuses:

- **Done** → Done
- **In Progress**, **Code Review**, **Testing** → In Progress
- **Blocked** → At Risk
- **Groomed**, **Backlog** → New

### Stage Calculation

Issues are assigned to delivery stages based on their Jira status:

- Backlog → Stage 0 (PM clarification)
- Groomed → Stage 1 (HLD/LLD)
- In Progress → Stage 3 (Working APIs)
- Code Review → Stage 5 (FE integration)
- Testing → Stage 6 (E2E testing)
- Done → Stage 7 (Release ready)

## Removing Filters

To remove a dynamically added filter:

1. Find the filter in the left sidebar
2. Click the **X** button on the filter card
3. The filter and its issues will be removed from all views

Note: You can only remove dynamically added filters. The default mock filters cannot be removed.

## Authentication Note

Currently, the proxy server relies on you being logged into Jira in your browser. For production use, you should:

1. Set up Jira API tokens
2. Store them securely in environment variables
3. Update `server.js` to include proper authentication headers

## Troubleshooting

**Issue: "Failed to add filter" error**
- Make sure the backend server is running (`npm run dev:server`)
- Verify you're logged into Jira in your browser
- Check that the filter ID is correct and you have access to it

**Issue: CORS errors**
- Ensure the backend server is running on port 3001
- Check that `cors` package is installed

**Issue: Empty issues list**
- Verify the JQL query in your filter returns results in Jira
- Check the browser console for errors
- Ensure the filter is not private (you need read access)

## Next Steps

Consider enhancing the integration with:

- OAuth authentication for secure Jira access
- Ability to edit filter JQL directly in the app
- Custom field mapping configuration
- Webhook support for real-time updates
- Export sprint data back to Jira
