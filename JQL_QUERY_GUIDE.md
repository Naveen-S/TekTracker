# JQL Query Support - Easiest Way to Add Issues!

## 🎯 Direct JQL Queries (Recommended for DR_GM)

The **easiest way** to add DR_GM support issues is using a **JQL Query** directly!

## ⭐ Why Use JQL Instead of Dashboard?

**Problems with Dashboard mode:**
- Dashboard API may not be accessible
- Complex to find gadget IDs
- May have permission issues

**Benefits of JQL mode:**
- ✅ **Simpler** - Just copy the JQL query
- ✅ **More reliable** - Direct to Jira search API
- ✅ **Flexible** - Customize any query you want
- ✅ **No ID hunting** - No need to find dashboard/gadget IDs

## 🚀 How to Add DR_GM Support Issues Using JQL

### **Step 1: Get the JQL Query**

Go to the DR_GM dashboard widget and find the filter link, or use this common query:

```jql
project = DR_GM AND status != Done
```

Or to see all DR_GM issues:
```jql
project = DR_GM
```

### **Step 2: Open Add Source Modal**

Click **"Add Jira filter"** in the app

### **Step 3: Select JQL Query**

Choose the **"JQL Query"** radio button option

### **Step 4: Fill in Details**

**Filter Name:** `DR_GM Support Issues`

**JQL Query:**
```
project = DR_GM AND status != Done
```

### **Step 5: Add**

Click **"Add Source"** - Done! 🎉

## 📝 Common JQL Queries for DR_GM

### **Active DR_GM Issues**
```jql
project = DR_GM AND status != Done
```

### **All DR_GM Issues**
```jql
project = DR_GM
```

### **High Priority DR_GM**
```jql
project = DR_GM AND priority in (Highest, High) AND status != Done
```

### **DR_GM Issues Assigned to You**
```jql
project = DR_GM AND assignee = currentUser() AND status != Done
```

### **DR_GM Created This Month**
```jql
project = DR_GM AND created >= startOfMonth()
```

### **DR_GM In Progress**
```jql
project = DR_GM AND status = "In Progress"
```

## 🎨 Complete Example

**Adding DR_GM Support:**

```
┌────────────────────────────────────────┐
│ Add Jira Source               [X]     │
├────────────────────────────────────────┤
│ Source Type                            │
│ ○ Filter ID  ● JQL Query  ○ Dashboard │
│                                        │
│ Filter Name                            │
│ [DR_GM Support Issues            ]    │
│                                        │
│ JQL Query                              │
│ ┌────────────────────────────────────┐ │
│ │ project = DR_GM AND                │ │
│ │ status != Done                     │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│ Enter the JQL query to fetch issues    │
│                                        │
│                 [Cancel] [Add Source]  │
└────────────────────────────────────────┘
```

## 🔍 How to Find JQL Queries

### **Method 1: From Jira Search**
1. Go to Jira Issues search
2. Use the filters to narrow down
3. Click "Advanced" to see JQL
4. Copy the JQL query

### **Method 2: From Dashboard Widget**
1. Go to your dashboard
2. Find the widget showing DR_GM issues  
3. Click the filter name/link
4. Click "View in Issue Navigator"
5. Switch to "Advanced" search
6. Copy the JQL

### **Method 3: Build Your Own**
Use Jira's JQL syntax:
```jql
project = PROJECT_KEY AND [conditions]
```

## 💡 JQL Syntax Quick Reference

### **Basic Structure**
```jql
field OPERATOR value
```

### **Common Fields**
- `project` - Project key (e.g., DR_GM)
- `status` - Issue status (e.g., "In Progress")
- `assignee` - Who it's assigned to
- `priority` - Priority level
- `created` - Creation date
- `updated` - Last update date

### **Common Operators**
- `=` - Equals
- `!=` - Not equals
- `IN` - In a list
- `>` / `<` - Greater/Less than
- `>=` / `<=` - Greater/Less or equal

### **Combining Conditions**
- `AND` - Both conditions must be true
- `OR` - Either condition can be true
- `NOT` - Negation

### **Functions**
- `currentUser()` - Logged in user
- `startOfMonth()` - Start of current month
- `endOfMonth()` - End of current month
- `now()` - Current time

## 🎯 Examples for Different Use Cases

### **Support Issues (DR_GM)**
```jql
project = DR_GM AND status IN ("To Do", "In Progress", "Code Review")
```

### **Feature Work**
```jql
project = GM AND type = Story AND sprint in openSprints()
```

### **Tech Debt**
```jql
labels = tech-debt AND status != Done
```

### **Bugs**
```jql
type = Bug AND priority in (Highest, High) AND status != Done
```

### **Your Work**
```jql
assignee = currentUser() AND status != Done
```

## ⚡ Advantages Over Other Methods

| Feature | Filter ID | Dashboard | JQL Query |
|---------|-----------|-----------|-----------|
| Ease of use | Medium | Hard | ⭐ **Easy** |
| Reliability | High | Low | ⭐ **High** |
| Flexibility | Low | Low | ⭐ **High** |
| No setup | ✅ | ❌ | ⭐ **✅** |
| Works anywhere | ✅ | ❌ | ⭐ **✅** |

## 🚨 Troubleshooting

**"Failed to fetch issues"**
→ Check your JQL syntax is valid
→ Test the query in Jira's issue navigator first

**"No issues found"**
→ Query might be too restrictive
→ Try simplifying: `project = DR_GM`

**"Permission error"**
→ Make sure you have access to the project
→ Try a project you know you can access

## 🎉 Quick Start for DR_GM

**Copy-paste ready:**

1. Click "Add Jira filter"
2. Select "JQL Query"
3. Name: `DR_GM Support`
4. Query: `project = DR_GM AND status != Done`
5. Click "Add Source"

**That's it!** Your DR_GM support issues will appear in the sprint tracker! 🚀

## 💪 Pro Tips

### **1. Test in Jira First**
Always test your JQL query in Jira's issue navigator before adding it to the app

### **2. Use Descriptive Names**
```
✅ "DR_GM Active Support"
✅ "GM High Priority Bugs"
❌ "Query 1"
❌ "Test"
```

### **3. Start Simple**
Begin with: `project = DR_GM`  
Then refine to: `project = DR_GM AND status != Done`

### **4. Bookmark Common Queries**
Save your most-used JQL queries for quick access

## 🎯 Summary

**For DR_GM Support Issues, use JQL Query mode:**

- ✅ Easier than finding dashboard/gadget IDs
- ✅ More reliable than dashboard API
- ✅ Works the same as filter IDs
- ✅ Full Jira search power
- ✅ No permission issues

**Just use:** `project = DR_GM AND status != Done`

Simple, reliable, and powerful! 🎉
