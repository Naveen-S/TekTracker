# Quick Start Guide

## Add Your Jira Filter in 3 Steps

### 1️⃣ Install & Start

```bash
npm install
npm run dev:all
```

### 2️⃣ Get Filter ID from Jira

Open your Jira filter URL:
```
https://your-domain.atlassian.net/issues?filter=65834
                                                 ^^^^^ This is your filter ID
```

### 3️⃣ Add to Sprint Tracker

1. Click **"Add Jira filter"** button
2. Enter filter ID: `65834`
3. Click **"Add Filter"**

✅ Done! Your filter and all its issues will appear in the dashboard.

## What You'll See

Your Jira issues will automatically appear in:

- 📊 **Sprint Metrics** - Story points, completion rate, at-risk count
- 📋 **Filter Panel** - JQL query, issue count, total points
- 🎯 **Delivery Matrix** - 8-stage pipeline progress for each issue
- 🗂️ **Issue Cards** - Detailed cards with progress bars and blockers

## Example: PreCheckout - June Release

Filter ID: `65834`

**JQL Query:**
```sql
type = Story
AND project = GM
AND "sub-component[dropdown]" IN (DR_GM-Configurator, DR_GM-Appointments, ...)
AND sprint IN (25779, 25778)
ORDER BY issuetype ASC
```

**Results:**
- 8 Stories
- Assignees: Naveen, Rohan, etc.
- Statuses: Groomed, Backlog, In Progress
- Priority: P2 - Medium

## Features

✅ **Dynamic Filter Management**
- Add filters by ID
- Remove filters with one click
- Sync to get latest data from Jira

✅ **Smart Data Mapping**
- Story points → Points
- Assignee → Owner (first name)
- Status → Simplified status (Done, In Progress, At Risk, New)
- Calculated delivery stage (0-7)

✅ **Live Sync**
- Click "Sync Jira" to refresh all filters
- See last sync time
- Updates all views automatically

## Troubleshooting

**Can't connect to Jira?**
- Make sure backend server is running (port 3001)
- Check you're logged into Jira in your browser

**Filter not found?**
- Verify the filter ID is correct
- Ensure you have access to the filter in Jira

**No issues showing?**
- Check the filter's JQL query in Jira returns results
- Look at browser console for errors

## Next Steps

🎨 **Customize**
- Edit `src/jiraService.js` for custom field mappings
- Update status mapping for your workflow
- Adjust stage calculations

🔐 **Production Setup**
- Add Jira API token to `.env`
- Configure proper authentication
- Deploy backend server

📚 **Learn More**
- See [`../features/JIRA_INTEGRATION.md`](../features/JIRA_INTEGRATION.md) for detailed documentation
- Check `src/jiraService.js` for data transformation logic
