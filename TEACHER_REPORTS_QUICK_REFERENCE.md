# 📋 TEACHER REPORTS PAGE - QUICK REFERENCE CARD

## 🚀 Quick Start

**URL**: `/teacher/reports`

**File**: `src/pages/teacher/ReportsPage.tsx`

---

## 📊 Page Features (3 Tabs)

### **Tab 1: Enter Results** ✏️
- Click "+ Start Entering Results"
- 4-stage workflow
- Select Class → Student → Subject → Enter Scores
- Real-time calculation
- Auto-assigned grades

### **Tab 2: View All Results** 👁️
- Table view of ALL entered results
- Filter by status: Draft | Submitted | Approved | Published | Rejected
- See: Student, Subject, CA, Test, Exam, Total, Grade, Status
- Sortable and searchable

### **Tab 3: Submitted Results** 📤
- Card view of submitted/approved/published results
- Easy status tracking
- Shows only non-draft results

---

## 📈 Statistics Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Total Entered: 270  │ Draft: 45  │ Submitted: 225  │ Approved: 0 │
└─────────────────────────────────────────────────────────┘
```

**Updates in real-time** as you enter/submit results

---

## 🎯 Main Actions

### **Enter Results**
1. Click "Enter Results" tab
2. Click "+ Start Entering Results"
3. Follow 4-stage workflow
4. Enter scores (CA, Test, Exam)
5. Click "Save Result"
6. Repeat for all students/subjects

### **View Results**
1. Click "View All Results" tab
2. See table of all entered results
3. Filter by status if needed
4. Verify all calculations

### **Submit for Approval**
1. Click "Submit X Results for Approval" button (bottom-right)
2. Confirms submission
3. All DRAFT results → SUBMITTED status
4. Button disappears (no more drafts)

---

## 🔄 Status Flow

```
DRAFT (Editing) 
    ↓ [Teacher Submits]
SUBMITTED (Principal Reviews)
    ↓ [Principal Approves]
APPROVED (Ready to Publish)
    ↓ [Principal Publishes]
PUBLISHED (Locked, Reports Generated)
    ↓ [Parents Notified]
VISIBLE TO PARENTS (Read-Only)
```

---

## 💾 Database Tables Used

| Table | Purpose | Query |
|-------|---------|-------|
| **student_results** | All entered scores | Main query |
| **academic_sessions** | Current session | Filter results |
| **academic_terms** | Current term | Filter results |
| **classes** | Teacher's classes | Validation |
| **students** | Student names | Join for display |
| **subjects** | Subject names | Join for display |

---

## 🎨 UI Components

### **Statistics Cards**
- 4 cards showing counts
- Color-coded per status
- Updates real-time

### **Tab Selector**
- 3 tabs with counts
- Easy switching between views
- Active tab highlighted

### **Results Table**
- 8 columns: Student | Subject | CA | Test | Exam | Total | Grade | Status
- Status badges with colors
- Hover highlights rows

### **Results Cards**
- Compact view of submitted results
- Shows key info: Student • Subject • Scores • Status
- Easy to scan

### **Submit Button**
- Fixed position (bottom-right)
- Only shows when Draft count > 0
- Shows count of results to submit
- Submitting state with loader

---

## 🔐 Permissions

✅ **Can Do:**
- Enter results for own classes
- View own entered results
- Submit own results to principal
- Edit DRAFT results only

❌ **Cannot Do:**
- Edit submitted/approved results
- View other teachers' results
- See principal-only data
- Access other schools' data

---

## 🛠️ Data Flow Summary

```
Teacher Opens Page
    ↓
Load: Current session, term, classes, results
    ↓
Calculate: Statistics (total, draft, submitted, approved)
    ↓
Display: Dashboard with 3 tabs
    ↓
Teacher Action:
  - Enter results → Save to DRAFT
  - View results → Show in table/cards
  - Submit → Change DRAFT → SUBMITTED
    ↓
Update Database & Statistics
    ↓
Show success message & refresh
```

---

## 📱 Responsive Design

- **Desktop**: Full width, all columns visible
- **Tablet**: Adjusted width, compact view
- **Mobile**: Horizontal scroll, simplified cards

---

## 🔔 Messages

### **Success Messages**
```
✅ Result entered successfully!
✅ Successfully submitted 270 results for approval!
```

### **Error Messages**
```
⚠️ No draft results to submit
⚠️ Failed to load data
⚠️ Session or term not found
```

---

## 🎯 Common Tasks

### **Task 1: Enter results for 1 class**
1. Open ReportsPage
2. Click "Enter Results"
3. Repeat 4-stage workflow
4. Takes ~5 min per student
5. 45 students × 6 subjects = ~3.5 hours

### **Task 2: Review all results before submitting**
1. Click "View All Results" tab
2. Scroll through table
3. Verify scores and grades
4. Check for missing data

### **Task 3: Submit all results at once**
1. Click "Submit 270 Results for Approval"
2. Confirm action
3. Wait for success message
4. All results now SUBMITTED

### **Task 4: Track approval progress**
1. Open ReportsPage
2. Check statistics panel
3. See which are SUBMITTED vs APPROVED
4. Wait for PUBLISHED status

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Results not showing** | Check current session/term exists |
| **Can't submit results** | Ensure results are in DRAFT status |
| **Calculations wrong** | Verify CA + Test + Exam = Total |
| **Permission denied** | Check you're logged in as teacher |
| **Page won't load** | Check internet connection, RLS policies |

---

## ⚡ Keyboard Shortcuts (Future)

- `Ctrl+E`: Enter results
- `Ctrl+V`: View all results
- `Ctrl+S`: Submit results
- `Ctrl+F`: Filter results

---

## 📊 Viewing Results Examples

### **Example 1: All Results**
```
Student: Chioma Okafor
Subject: English
CA: 18  Test: 10  Exam: 55
Total: 83  Grade: A  Status: Draft
```

### **Example 2: After Submission**
```
Student: Chioma Okafor
Subject: English
CA: 18  Test: 10  Exam: 55
Total: 83  Grade: A  Status: Submitted ← Changed!
```

### **Example 3: After Approval**
```
Student: Chioma Okafor
Subject: English
CA: 18  Test: 10  Exam: 55
Total: 83  Grade: A  Status: Approved ← Updated!
```

---

## 📞 Support

**Issues?** Check:
1. Database schema is created (migration ran)
2. User is logged in as a teacher
3. Teacher has assigned classes
4. Current session & term exist in database
5. RLS policies are enabled

---

## 🎓 Integration Points

**ReportsPage connects to:**
- ✅ ResultEntryForm (component)
- ✅ Supabase (database)
- ✅ Authentication (user context)
- ✅ App store (school ID, staff ID)
- ✅ report_card_management (principal side)

---

**Teacher Reports Page Ready!** ✨
