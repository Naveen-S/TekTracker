# How to Extract Filter ID from Dashboard

## 🎯 The Dashboard API Doesn't Support Direct Access

Unfortunately, Jira's REST API doesn't support GET requests on the gadget endpoint. But don't worry - there are easy workarounds!

## ✅ **Method 1: Click Through to Filter (Easiest)**

### **Steps:**

1. Go to your dashboard:
   ```
   https://tekion.atlassian.net/jira/dashboards/15653
   ```

2. Find the "Support - Dashboard" widget (gadget 485396)

3. **Look for a clickable filter name or title** at the top of the widget
   - Usually says something like "Filter: Support Issues" or just the filter name

4. **Click on it** - this will navigate to the filter view

5. Check the URL - it will be:
   ```
   https://tekion.atlassian.net/issues/?filter=12345
   ```

6. Copy the number after `filter=` (e.g., `12345`)

7. Use that in **Filter ID** mode in the app!

### **Example:**

```
Dashboard Widget → Click Filter Name → URL shows filter=67890
                                                      ^^^^^^
                                              Use this in the app!
```

## ✅ **Method 2: Use Browser DevTools**

### **Steps:**

1. Open the dashboard in your browser
2. Press **F12** to open Developer Tools
3. Go to the **Network** tab
4. Refresh the page (F5)
5. Look for requests containing `/filter/` or `/search`
6. Click on one of these requests
7. Look at the **Request URL** or **Response** tab
8. You'll find either:
   - Filter ID in the URL
   - JQL query in the response

### **What to Look For:**

**In Request URLs:**
```
https://tekion.atlassian.net/rest/api/3/filter/12345
                                              ^^^^^
```

**In Response (for search requests):**
```json
{
  "jql": "project = DR_GM AND status != Done",
  ...
}
```

## ✅ **Method 3: Inspect Widget Configuration**

### **Steps:**

1. Go to the dashboard
2. Hover over the widget
3. Click the **⋮** (3 dots) menu in the top-right corner
4. Select **"Edit"** or **"Configure"**
5. You should see either:
   - A dropdown showing the filter name
   - A JQL query text area
6. Note down the filter name or JQL

## ✅ **Method 4: Use Common DR_GM Queries**

If the widget shows DR_GM support issues, try these common queries:

### **All Open DR_GM Issues:**
```jql
project = DR_GM AND resolution = Unresolved
```

### **All DR_GM Issues:**
```jql
project = DR_GM
```

### **DR_GM Issues by Component:**
```jql
project = DR_GM AND component = "Support"
```

### **DR_GM Issues from Dashboard:**
If you know this is a specific support dashboard, try:
```jql
project = DR_GM AND labels = support AND resolution = Unresolved
```

## 🚀 **Quick Start: Try JQL First**

**Easiest approach:**

1. Click **"Add Jira filter"** in the app
2. Select **"JQL Query"**
3. Name: `DR_GM Support Issues`
4. Query: Start with this:
   ```jql
   project = DR_GM AND resolution = Unresolved
   ```
5. Click **"Add Source"**

**Then refine:**
- If you get too many issues, add more filters
- If you get too few, simplify the query
- Compare with what you see on the dashboard

## 📝 **Example Workflow**

### **Scenario: Find DR_GM Support Filter**

**Step 1:** Go to dashboard
```
https://tekion.atlassian.net/jira/dashboards/15653
```

**Step 2:** Find the widget showing DR_GM issues

**Step 3:** Click the filter name/title in the widget

**Step 4:** URL changes to:
```
https://tekion.atlassian.net/issues/?filter=67890
```

**Step 5:** In the app:
- Click "Add Jira filter"
- Select "Filter ID"
- Enter: `67890`
- Click "Add Source"

**Done!** ✅

## 🔍 **Troubleshooting**

### **Can't Find Filter Name to Click?**

Try **Method 2** (DevTools) or **Method 4** (use JQL directly)

### **Widget Doesn't Have a Filter?**

Some widgets use JQL directly. Try:
1. Edit the widget configuration
2. Copy the JQL shown
3. Use JQL Query mode

### **Still Stuck?**

**Fastest solution:**
1. Use JQL Query mode
2. Try: `project = DR_GM`
3. Refine based on what you see

## 💡 **Why This Happens**

Jira's REST API has limitations:
- ❌ Dashboard gadget endpoints don't support GET
- ❌ Some gadgets are configured differently
- ✅ But filters and JQL always work!

## 🎯 **Recommended Approach**

**For DR_GM Support Issues:**

1. **Try JQL first** (fastest):
   ```jql
   project = DR_GM AND resolution = Unresolved
   ```

2. **If that doesn't match dashboard**, use Method 1:
   - Click filter name on dashboard
   - Get filter ID from URL
   - Use Filter ID mode

3. **Compare results** with the dashboard to verify

## ✅ **Summary**

**Best Methods (in order):**

1. **JQL Query** - `project = DR_GM AND resolution = Unresolved`
2. **Click filter name** on dashboard → Get filter ID from URL
3. **Browser DevTools** → Find filter ID or JQL in network requests
4. **Widget config** → Get JQL from edit dialog

All of these will work! Start with #1 (JQL) as it's the fastest! 🚀
