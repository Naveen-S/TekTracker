# Testing Guide

## Quick Test Checklist

### ✅ Step 1: Verify Server is Running

Open terminal and run:
```bash
node server.js
```

You should see:
```
✅ Loaded .env file
✅ Using Jira API token authentication
📧 Email: your-email@tekion.com
Jira proxy server running on http://localhost:3001
```

### ✅ Step 2: Open the App

Your Vite dev server should be running (usually on http://localhost:5173)

### ✅ Step 3: Verify Empty State

You should see:
- Empty filter panel with message "No filters added yet"
- Empty delivery matrix
- Empty issue cards section
- Metrics showing 0 filters, 0 issues

### ✅ Step 4: Add a Filter

1. Click **"Add Jira filter"** button
2. Modal appears
3. Enter filter ID: `65834`
4. Click **"Add Filter"**

Watch the server terminal - you should see:
```
Fetching filter 65834 from Jira...
Jira response status: 200
Successfully fetched filter: PreCheckout - June release
Searching Jira with JQL: type = Story AND project = GM...
Jira search response status: 200
Successfully fetched 8 issues
```

### ✅ Step 5: Verify Data Loaded

After successful load, you should see:

**Metrics Panel:**
- Filters tracked: 1
- Issues in scope: 8
- Story points total
- Completion percentage

**Left Panel:**
- Filter card with "PreCheckout - June release"
- JQL query displayed
- "8 issues" and total points
- X button to remove

**Delivery Matrix:**
- 8 rows (one per issue)
- Issue keys like GM-6640, GM-6639, etc.
- Status badges
- Progress through 8 stages

**Issue Cards:**
- 8 cards at the bottom
- Each showing title, assignee, points, progress bar

### ✅ Step 6: Test Sync

1. Click **"Sync Jira"** button
2. Should see "Syncing..." on button
3. Server logs show fetching filter and issues again
4. "Last synced" timestamp updates

### ✅ Step 7: Test Remove Filter

1. Click the **X** button on the filter card
2. Filter disappears
3. All views return to empty state

## 🐛 Common Issues & Solutions

### Issue: "Failed to add filter: Cannot connect to Jira API"

**Solution**: Server isn't running
```bash
# In a new terminal
cd /Users/naveen/tekion/sprint_tracker
node server.js
```

### Issue: 401 Unauthorized

**Solution**: Invalid credentials in `.env`
1. Check `.env` file has correct email and API token
2. No extra spaces around `=`
3. API token is valid (not expired)

### Issue: 404 Not Found

**Solutions**:
- Filter ID is wrong (check the URL in Jira)
- Filter is private to someone else
- You don't have access to the filter

### Issue: Empty issues list (filter loads but no issues)

**Solutions**:
- JQL query returns no results
- Check the filter in Jira directly
- Might be sprint-specific and sprint is empty

### Issue: Server shows "command not found: node"

**Solution**: Use interactive terminal
```bash
# In VS Code terminal (not launch-process)
node server.js
```

## 📝 Test Data Reference

**Filter ID**: `65834`
**Filter Name**: PreCheckout - June release
**Project**: GM
**Expected Issues**: 8 Stories
**Assignees**: Real team members
**Status**: Groomed, Backlog

## 🎯 Success Criteria

✅ Server starts without errors
✅ App loads with empty states
✅ Can add filter by ID
✅ Filter data displays in all 4 sections
✅ Can sync to refresh data
✅ Can remove filter
✅ Last sync time updates correctly
✅ All 8 issues from filter appear
✅ Metrics calculate correctly

## 📊 What to Check in Browser DevTools

Open browser console (F12) and look for:

**Good Signs**:
- No red errors
- Successful fetch to `http://localhost:3001/api/jira/filter/65834`
- Successful fetch to `http://localhost:3001/api/jira/search`

**Bad Signs**:
- CORS errors (server not running)
- Network errors (wrong port)
- 401/403 (auth issues)
- 404 (filter not found)

## 🔄 Full Reset

If things get messy, reset everything:

```bash
# Kill all node processes
lsof -ti:3001 | xargs kill -9

# Restart server
node server.js

# In browser
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```
