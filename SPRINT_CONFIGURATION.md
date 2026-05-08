# Sprint Configuration Feature

## 🎯 Dynamic Sprint Settings

Configure your sprint name, start date, and end date to match your actual sprint schedule!

## 📊 What You Can Configure

### 1. **Sprint Name**
- Custom name for your sprint
- Examples: "June Sprint", "Sprint 24", "Q2 Release Sprint"
- Displays in the hero section

### 2. **Start Date**
- When the sprint begins
- Used to calculate sprint duration
- Format: YYYY-MM-DD (e.g., 2024-06-01)

### 3. **End Date**
- When the sprint ends
- Used to calculate days remaining
- Format: YYYY-MM-DD (e.g., 2024-06-14)

## 🎨 How to Configure

### **Step 1: Open Configuration**
Click the **"Configure Sprint"** button in the hero section (top of the page)

### **Step 2: Fill in Details**
```
Sprint Name:  June Sprint
Start Date:   June 1, 2024
End Date:     June 14, 2024
```

### **Step 3: Save**
Click **"Save Configuration"** and the dashboard updates immediately!

## 📈 What Updates Automatically

### **Hero Section Header**
```
Before:  "June sprint tractor"
After:   "June Sprint · Jun 1, 2024 - Jun 14, 2024"
```

### **Days Remaining Indicator**
Displays automatically under the description:
```
✅ "8 days remaining" (Green - plenty of time)
⚠️  "2 days remaining" (Red - sprint ending soon!)
🎉 "Last day!" (Red - final sprint day)
❌ "Sprint ended" (Gray - past end date)
```

**Color Coding**:
- **Green**: 3+ days remaining
- **Red**: Less than 3 days remaining
- **Gray**: Sprint has ended

## 💡 Real-World Examples

### Example 1: Standard Two-Week Sprint
```
Sprint Name:  Sprint 24
Start Date:   2024-06-01
End Date:     2024-06-14
Duration:     14 days
```

**Display**:
```
┌─────────────────────────────────────────────────┐
│ Sprint 24 · Jun 1, 2024 - Jun 14, 2024         │
│ Multi-filter sprint planner                     │
│ ...description...                               │
│ 8 days remaining ✅                             │
└─────────────────────────────────────────────────┘
```

### Example 2: One-Week Sprint
```
Sprint Name:  Quick Sprint
Start Date:   2024-06-10
End Date:     2024-06-17
Duration:     7 days
```

### Example 3: Monthly Sprint
```
Sprint Name:  June Release
Start Date:   2024-06-01
End Date:     2024-06-30
Duration:     30 days
```

### Example 4: Quarter-End Sprint
```
Sprint Name:  Q2 2024 Finale
Start Date:   2024-06-17
End Date:     2024-06-30
Duration:     14 days
```

## 🎯 Smart Features

### **Automatic Calculations**

**Sprint Duration**:
```javascript
End Date - Start Date = Total Days
Jun 14 - Jun 1 = 14 days
```

**Days Remaining**:
```javascript
End Date - Today = Days Left
Jun 14 - Jun 6 = 8 days remaining
```

**Progress Percentage** (Future enhancement):
```javascript
(Today - Start Date) / (End Date - Start Date) = % Complete
(Jun 6 - Jun 1) / (Jun 14 - Jun 1) = 5/14 = 36% through sprint
```

### **Date Validation**

The modal validates your input:

❌ **End date before start date**:
```
Error: "End date must be after start date"
```

❌ **Missing dates**:
```
Error: "Please select both start and end dates"
```

❌ **Empty sprint name**:
```
Error: "Please enter a sprint name"
```

✅ **Valid configuration**:
```
Sprint saved successfully! ✅
```

## 📅 Date Format

### **Input Format** (in modal):
- Browser date picker
- Format: MM/DD/YYYY or DD/MM/YYYY (based on locale)

### **Display Format** (on dashboard):
- Human-readable
- Format: "Jun 1, 2024 - Jun 14, 2024"
- Example: "Dec 25, 2024"

## 🎨 Visual Design

### **Hero Section**
```
┌──────────────────────────────────────────────────┐
│ 📅 June Sprint · Jun 1, 2024 - Jun 14, 2024     │
│                                                  │
│ 🎯 Multi-filter sprint planner                  │
│                                                  │
│ A single operating view for roadmap...          │
│ 8 days remaining ✅                              │
│                                                  │
│ [Configure Sprint] [Add Filter] [Sync Jira]     │
└──────────────────────────────────────────────────┘
```

### **Configuration Modal**
```
┌────────────────────────────────┐
│ Configure Sprint           [X] │
├────────────────────────────────┤
│                                │
│ Sprint Name                    │
│ [June Sprint              ]    │
│ Give your sprint a name        │
│                                │
│ Start Date                     │
│ [📅 06/01/2024           ]    │
│                                │
│ End Date                       │
│ [📅 06/14/2024           ]    │
│                                │
│     [Cancel] [Save Config]     │
└────────────────────────────────┘
```

## 💾 Persistence

**Current**: In-memory only (lost on page refresh)

**Future Enhancement Options**:
1. **LocalStorage** - Saves to browser
2. **Backend API** - Saves to database
3. **URL Parameters** - Share sprint config via URL
4. **Jira Sprint Sync** - Auto-load from Jira sprint data

## 🚀 Use Cases

### For Scrum Masters
```
- Configure sprint at the start
- Team sees sprint timeline
- Track days remaining
- Plan demos before end date
```

### For Teams
```
- Know when sprint ends
- See how much time left
- Plan work accordingly
- Stay aligned on timeline
```

### For Managers
```
- Track multiple sprints
- See sprint duration
- Monitor progress
- Plan releases
```

## 🎯 Pro Tips

### 1. **Configure at Sprint Start**
Set up the sprint configuration at the beginning of your sprint so the team always knows the timeline.

### 2. **Use Descriptive Names**
```
✅ Good: "Sprint 24 - Auth Redesign"
✅ Good: "June Q2 Release"
❌ Bad: "Sprint"
❌ Bad: "Test"
```

### 3. **Align with Jira Sprints**
Match your sprint dates with your actual Jira sprint dates for consistency.

### 4. **Check Days Remaining Daily**
The indicator helps you pace work and identify if you're running out of time.

## 📊 Future Enhancements

Potential features to add:

- ✨ Sprint velocity tracking
- ✨ Burndown chart integration
- ✨ Sprint goal setting
- ✨ Team capacity planning
- ✨ Auto-sync with Jira sprint dates
- ✨ Sprint retrospective notes
- ✨ Multiple sprint comparison

## 🎉 Benefits

✅ **Customizable** - Match your actual sprint schedule
✅ **Visual feedback** - See days remaining with color coding
✅ **Team alignment** - Everyone sees the same timeline
✅ **Planning aid** - Know how much time you have
✅ **Professional** - Looks polished in presentations

Configure your sprint and keep everyone aligned! 🚀
