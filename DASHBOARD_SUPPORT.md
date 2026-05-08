# Dashboard + Gadget Support

## 🎯 Track Issues from Jira Dashboards

You can now add issues directly from Jira dashboards by specifying the dashboard ID and gadget ID!

## 📊 What's New

Previously, you could only add **Filter IDs**. Now you can also add:
- **Dashboard ID** + **Gadget ID** combinations
- Perfect for tracking support issues from team dashboards
- Automatically extracts the filter from dashboard gadgets

## 🎨 How to Use

### **Step 1: Open Add Source Modal**
Click **"Add Jira filter"** button in the hero section

### **Step 2: Choose Source Type**
You'll see two options:
1. ⭐ **Filter ID** (existing method)
2. 🆕 **Dashboard + Gadget** (new method)

### **Step 3: Enter Dashboard Details**

**For Dashboard + Gadget:**
1. Enter **Dashboard ID** (from the URL)
2. Enter **Gadget ID** (from the URL parameter)
3. Click **"Add Source"**

## 🔍 How to Find IDs

### **Finding Dashboard ID**

From your dashboard URL:
```
https://tekion.atlassian.net/jira/dashboards/15653
                                              ^^^^^
                                        Dashboard ID = 15653
```

### **Finding Gadget ID**

When you maximize a gadget on a dashboard:
```
https://tekion.atlassian.net/jira/dashboards/15653?maximized=485396
                                                               ^^^^^^
                                                          Gadget ID = 485396
```

**To find the Gadget ID:**
1. Go to your dashboard
2. Find the specific widget/gadget you want to track (e.g., "DR_GM Issues")
3. Click the maximize icon (⛶) on that gadget
4. Look at the URL - the number after `?maximized=` is your Gadget ID

## 📝 Example: DR_GM Support Issues

**Dashboard URL:**
```
https://tekion.atlassian.net/jira/dashboards/15653?maximized=485396
```

**Extract:**
- Dashboard ID: `15653`
- Gadget ID: `485396`

**Enter in Modal:**
```
Source Type: ● Dashboard + Gadget
Dashboard ID: 15653
Gadget ID: 485396
```

**Result:**
The app will:
1. Fetch the dashboard configuration
2. Find gadget `485396` within dashboard `15653`
3. Extract the filter ID from that gadget
4. Load all issues from that filter
5. Display them with the name from the gadget

## 🎯 Use Cases

### **Support Tracking**
Track support issues from team dashboards:
```
Dashboard: Support Overview (15653)
Gadget: DR_GM Issues (485396)
```

### **Team Dashboards**
Monitor specific team boards:
```
Dashboard: Engineering Dashboard (12345)
Gadget: Current Sprint (67890)
```

### **Multi-Team Coordination**
Track multiple streams from different dashboards:
```
Filter 1: Dashboard 15653 / Gadget 485396 (DR_GM Support)
Filter 2: Dashboard 12000 / Gadget 50001 (Feature Work)
Filter 3: Filter ID 65834 (Tech Debt)
```

## 🔧 What Happens Behind the Scenes

**When you add a Dashboard + Gadget:**

1. **Fetch Dashboard Config**
   ```
   GET /api/jira/dashboard/15653
   ```

2. **Find Specific Gadget**
   ```javascript
   gadget = dashboard.gadgets.find(g => g.id === '485396')
   ```

3. **Extract Filter ID**
   ```javascript
   filterId = gadget.properties.filterId
   // or
   filterId = gadget.properties.filterOrProjectId
   ```

4. **Fetch Issues**
   ```
   GET /api/jira/filter/{filterId}
   POST /api/jira/search (with filter's JQL)
   ```

5. **Display**
   ```
   Issues appear in the sprint tracker matrix
   ```

## ⚙️ Supported Gadget Types

The app attempts to extract filter IDs from:
- Filter Results gadgets
- Issue Statistics gadgets
- Two Dimensional Filter Statistics
- Any gadget that stores a `filterId` property

## 🎨 Visual Guide

### **Add Source Modal**

**Filter ID Mode:**
```
┌─────────────────────────────────┐
│ Add Jira Source            [X] │
├─────────────────────────────────┤
│                                 │
│ Source Type                     │
│ ● Filter ID  ○ Dashboard        │
│                                 │
│ Filter ID                       │
│ [65834                     ]    │
│ Enter the numeric filter ID...  │
│                                 │
│          [Cancel] [Add Source]  │
└─────────────────────────────────┘
```

**Dashboard + Gadget Mode:**
```
┌─────────────────────────────────┐
│ Add Jira Source            [X] │
├─────────────────────────────────┤
│                                 │
│ Source Type                     │
│ ○ Filter ID  ● Dashboard        │
│                                 │
│ Dashboard ID                    │
│ [15653                     ]    │
│ From URL: /dashboards/15653     │
│                                 │
│ Gadget ID                       │
│ [485396                    ]    │
│ From URL: ?maximized=485396     │
│                                 │
│          [Cancel] [Add Source]  │
└─────────────────────────────────┘
```

## 🚨 Error Handling

**Dashboard Not Found:**
```
Error: Failed to fetch dashboard (404)
→ Check that dashboard ID is correct
→ Verify you have access to this dashboard
```

**Gadget Not Found:**
```
Error: Gadget 485396 not found in dashboard 15653
→ Check that gadget ID is correct
→ Verify the gadget exists on this dashboard
```

**No Filter in Gadget:**
```
Error: Could not extract filter ID from gadget
→ This gadget type may not contain a filter
→ Try using Filter ID mode instead
```

## 💡 Pro Tips

### **1. Use Dashboard Mode for Team Boards**
Perfect for tracking issues that are already visualized on team dashboards

### **2. Combine Both Methods**
```
✅ Filter ID: For custom filters (65834)
✅ Dashboard: For support dashboards (15653/485396)
```

### **3. Find Gadget IDs Easily**
Just maximize any gadget on a dashboard and check the URL!

### **4. Name Recognition**
When adding from a dashboard, the filter inherits the gadget's title:
```
"DR_GM Issues (Dashboard)"
```

## 🎯 Benefits

✅ **No need to find filter IDs** - Use dashboard URLs directly  
✅ **Easier for non-technical users** - Dashboard links are more common  
✅ **Team alignment** - Track exactly what's on team dashboards  
✅ **Support workflows** - Perfect for support issue tracking  
✅ **Flexible** - Use Filter ID OR Dashboard + Gadget  

## 🚀 Quick Start

**To add DR_GM support issues:**

1. Click **"Add Jira filter"**
2. Select **"Dashboard + Gadget"**
3. Enter Dashboard ID: `15653`
4. Enter Gadget ID: `485396`
5. Click **"Add Source"**

Done! Your DR_GM support issues will appear in the sprint tracker! 🎉
