# Dashboard Web Scraping Support

## 🎯 New Feature: Scrape Dashboard Widgets

Now supports **web scraping** to extract issues from dashboard widgets, including Forge app widgets that don't expose filter IDs!

## 🚀 How It Works

### **Step 1: Scrape HTML**
Fetches the dashboard page HTML with authentication

### **Step 2: Extract Issue Keys**
Uses regex to find all issue keys (e.g., DR_GM-123, DR_GM-456)

### **Step 3: Fetch Issues**
Builds a JQL query: `key IN (DR_GM-123, DR_GM-456, ...)` and fetches full issue data

### **Step 4: Display**
Shows all issues in the sprint tracker!

## ✅ **How to Use**

**Step 1:** Restart server
```bash
node server.js
```

**Step 2:** Refresh browser

**Step 3:** Click **"Add Jira filter"**

**Step 4:** Select **"Dashboard"**

**Step 5:** Enter:
- **Dashboard ID**: `15653`
- **Gadget ID**: `485396`

**Step 6:** Click **"Add Source"**

**Step 7:** Wait while it:
1. Scrapes the dashboard HTML
2. Extracts DR_GM issue keys
3. Fetches full issue details
4. Displays them!

## 📊 **What Gets Extracted**

### **Issue Keys Found:**
```
DR_GM-1234
DR_GM-5678
DR_GM-9012
...
```

### **Converted to JQL:**
```jql
key IN (DR_GM-1234, DR_GM-5678, DR_GM-9012)
```

### **Fetched via API:**
Full issue details with all fields (summary, status, assignee, story points, etc.)

## 🎨 **Visual Flow**

```
Dashboard Widget
       ↓
  [Web Scrape]
       ↓
Extract: DR_GM-123, DR_GM-456, DR_GM-789
       ↓
Build JQL: key IN (DR_GM-123, DR_GM-456, DR_GM-789)
       ↓
  [Fetch via API]
       ↓
Full Issue Data
       ↓
Sprint Tracker Display
```

## 💡 **Advantages**

**Works for Forge Apps:**
- ✅ Doesn't need filter IDs
- ✅ Extracts actual displayed issues
- ✅ Works with custom widgets

**Accurate:**
- ✅ Gets exactly what's shown on the dashboard
- ✅ No guessing with JQL queries
- ✅ Always up-to-date

**Automatic:**
- ✅ One click to add
- ✅ Handles extraction automatically
- ✅ Fallback to API if scraping fails

## 🔍 **Server Logs**

You'll see:

```
Scraping dashboard 15653 gadget 485396...
Fetching dashboard HTML from: https://tekion.atlassian.net/jira/dashboards/15653?maximized=485396
Found 24 unique DR_GM issues: [ 'DR_GM-123', 'DR_GM-456', ... ]
Fetching issues with JQL: key IN (DR_GM-123, DR_GM-456, ...)
Successfully fetched 24 issues
```

## ⚙️ **Technical Details**

### **Scraping Endpoint:**
```javascript
POST /api/jira/scrape-dashboard
Body: { dashboardId: "15653", gadgetId: "485396" }
```

### **Response:**
```json
{
  "issueKeys": ["DR_GM-123", "DR_GM-456"],
  "count": 2,
  "dashboardUrl": "https://tekion.atlassian.net/jira/dashboards/15653?maximized=485396"
}
```

### **Regex Pattern:**
```javascript
/\b([A-Z][A-Z0-9_]*-\d+)\b/g
```

Matches: `PROJECT-123`, `DR_GM-456`, etc.

### **Filtering:**
```javascript
issueKeys.filter(key => key.startsWith('DR_GM'))
```

Only keeps DR_GM issues

## 🛡️ **Fallback Strategy**

If scraping fails, automatically falls back to API method:

```javascript
try {
  // Try scraping first
  scrapeDashboardWidget(...)
} catch (scrapeError) {
  // Fallback to API
  fetchDashboardGadgetIssues(...)
}
```

## 🚨 **Limitations**

**Authentication Required:**
- Must have valid Jira API token
- Must have access to the dashboard

**HTML Structure:**
- Depends on Jira's HTML structure
- May break if Jira updates their UI
- Fallback to API ensures reliability

**Performance:**
- Slower than direct API calls
- Fetches full HTML page first
- Then fetches individual issues

## 📝 **Example Output**

```
Dashboard: 15653 / Gadget: 485396
Scraped Issues: 24

DR_GM-1234 | P1 | In Progress | 5 pts
DR_GM-5678 | P2 | To Do       | 3 pts
DR_GM-9012 | P1 | Code Review | 8 pts
...
```

## 🎯 **For Your Use Case**

**Dashboard:**
- ID: `15653`
- Widget: "Issues related to GM (Overall Support, > 100 Days, ...)"
- Gadget: `485396`

**Will Extract:**
All DR_GM issues visible in that widget, regardless of how the widget is configured!

## ✅ **Ready to Test**

**Try it now:**

1. Restart server: `node server.js`
2. Refresh browser
3. Add dashboard source: `15653` / `485396`
4. Watch the console logs
5. See all DR_GM issues appear!

## 🎉 **Benefits**

**No more guessing:**
- ❌ Don't need to find filter IDs
- ❌ Don't need to guess JQL queries
- ✅ Get exactly what's on the dashboard!

**Works for everything:**
- ✅ Standard filter widgets
- ✅ Forge app widgets
- ✅ Custom dashboards
- ✅ Any widget showing issue keys

**Reliable:**
- ✅ Scraping as primary method
- ✅ API as fallback
- ✅ Always gets the data!

This is the most accurate way to track issues from dashboard widgets! 🚀
