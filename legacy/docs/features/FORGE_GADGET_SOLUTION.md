# Forge App Gadget - Cannot Extract Filter ID

## 🎯 The Issue

The widget you're trying to track is a **Forge app gadget** (custom Jira dashboard widget), not a standard Jira filter gadget.

**Widget Details:**
- **Title**: "Issues related to GM (Overall Support, > 100 Days, FV Expiry & FV Empty, Disposition SLA, Resolution SLA, RCA SLA Breaches)"
- **Type**: `com.atlassian.forge` (Forge app)
- **Dashboard**: 15653
- **Gadget ID**: 485396

**Why it doesn't work:**
Forge apps are custom-built dashboard widgets that don't expose filter IDs through Jira's REST API. They have `properties: undefined` in the API response.

## ✅ **Solution: Use Filter ID or JQL Query Mode**

### **Option 1: Find the Filter ID (Recommended)**

**Step 1:** Go to the dashboard:
```
https://tekion.atlassian.net/jira/dashboards/15653
```

**Step 2:** Find the "Issues related to GM..." widget

**Step 3:** Look for one of these in the widget:
- A clickable filter name/link (usually at the top)
- A "View in Issue Navigator" link
- A settings/configure option that shows the filter

**Step 4:** Click it to open the filter view

**Step 5:** The URL will show:
```
https://tekion.atlassian.net/issues/?filter=12345
                                            ^^^^^
                                      Use this number!
```

**Step 6:** In the app:
- Click "Add Jira filter"
- Select **"Filter ID"**
- Enter the filter ID (e.g., `12345`)
- Click "Add Source"

---

### **Option 2: Create a Matching JQL Query**

Based on the widget title, it appears to track multiple types of support issues. Try this:

**Step 1:** Click "Add Jira filter"

**Step 2:** Select **"JQL Query"**

**Step 3:** Enter:
- **Name**: `DR_GM Support - All Categories`
- **Query**:
  ```jql
  project = DR_GM AND resolution = Unresolved
  ```

**Step 4:** Click "Add Source"

**Refine if needed:**

If you want to match the specific categories mentioned in the widget title, try:

```jql
project = DR_GM AND (
  summary ~ "Overall Support" OR
  summary ~ "100 Days" OR
  summary ~ "FV Expiry" OR
  summary ~ "FV Empty" OR
  summary ~ "Disposition SLA" OR
  summary ~ "Resolution SLA" OR
  summary ~ "RCA SLA"
)
```

Or if they're labeled:

```jql
project = DR_GM AND labels IN (support, sla, escalation)
```

---

### **Option 3: Contact Widget Owner**

If the widget was created by someone on your team:

1. Find out who created/owns the Forge app widget
2. Ask them for the JQL query or filter ID
3. Use that in Filter ID or JQL Query mode

---

## 🔍 **How to Inspect the Widget**

### **Check Widget Configuration:**

1. Go to the dashboard
2. Hover over the widget
3. Look for a **⋮** (3 dots) menu
4. Click "Edit" or "Configure"
5. Look for:
   - Filter ID field
   - JQL query field
   - Data source configuration

### **Use Browser DevTools:**

1. Open the dashboard
2. Press **F12** → Network tab
3. Refresh the page
4. Look for API calls from the widget
5. Check requests for `/search` or `/filter/`
6. Extract the JQL or filter ID from the request

---

## 📝 **Common DR_GM Queries**

Try these based on what the widget might be showing:

### **All Open DR_GM Issues:**
```jql
project = DR_GM AND resolution = Unresolved
```

### **Support Issues by Priority:**
```jql
project = DR_GM AND resolution = Unresolved AND priority IN (Highest, High)
```

### **SLA-Related Issues:**
```jql
project = DR_GM AND (
  labels = sla OR
  summary ~ "SLA" OR
  summary ~ "Disposition" OR
  summary ~ "Resolution" OR
  summary ~ "RCA"
)
```

### **Long-Running Issues (>100 Days):**
```jql
project = DR_GM AND created < -100d AND resolution = Unresolved
```

### **All Categories Combined:**
```jql
project = DR_GM AND resolution = Unresolved AND (
  created < -100d OR
  labels IN (sla, support, escalation) OR
  summary ~ "SLA"
)
```

---

## 🎯 **Recommended Quick Start**

**Try this now:**

1. Restart server: `node server.js`
2. Refresh browser
3. Click "Add Jira filter"
4. Select **"JQL Query"**
5. Name: `DR_GM Support Issues`
6. Query: `project = DR_GM AND resolution = Unresolved`
7. Click "Add Source"

Then **compare** what you see with the dashboard widget. If it doesn't match perfectly, refine the query based on the differences.

---

## 💡 **Why Forge Gadgets Are Different**

**Standard Jira Gadgets:**
```json
{
  "properties": {
    "filterId": "12345"
  }
}
```

**Forge App Gadgets:**
```json
{
  "properties": undefined,
  "moduleKey": "com.atlassian.forge:..."
}
```

Forge apps are custom-built and can:
- Use complex data sources
- Combine multiple filters
- Access external APIs
- Have custom logic

That's why they don't expose a simple filter ID!

---

## 🚀 **Next Steps**

1. **Try JQL first** (fastest):
   ```jql
   project = DR_GM AND resolution = Unresolved
   ```

2. **If that doesn't match**, look for the filter link in the widget

3. **If you find the filter ID**, use Filter ID mode

4. **If needed**, refine the JQL query to match what you see on the dashboard

---

## ✅ **Summary**

**The Problem:**
- Dashboard gadget 485396 is a Forge app (custom widget)
- Doesn't expose filter IDs via API

**The Solution:**
- Use **JQL Query** mode with: `project = DR_GM AND resolution = Unresolved`
- OR find the filter link in the widget and use **Filter ID** mode

**Both methods will get you the same data!** 🎉
