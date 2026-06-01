# QUICK SETUP CARD - 4 Steps to Launch

---

## 🚀 THE 4 STEPS (30 minutes total)

### STEP 1: DATABASE MIGRATION (2 minutes)
**What**: Create database tables
**Where**: PowerShell terminal
**Command**:
```powershell
cd C:\Users\HYPE_OIU\Documents\EDUPULSE
npx supabase migration up 008_academic_session_management_engine.sql
```
**Verify**: All 13 tables created ✓

---

### STEP 2: CONFIGURE SCHOOL (15 minutes)
**What**: Set up promotion rules and fees

#### 2A: Create Promotion Rules
```typescript
// One rule per class transition
await promotionEngine.createPromotionRule(
  schoolId,      // Your school
  jss1ClassId,   // From class
  jss2ClassId,   // To class
  80,            // Attendance threshold (%)
  40,            // Grade threshold
  40             // Behaviour threshold
);

// Create 10 rules total (all transitions)
```

#### 2B: Create Fee Structures
```typescript
// One fee per class per type
await feeAutomationService.createFeeStructure(
  schoolId,
  jss1ClassId,
  sessionId,
  tuitionFeeTypeId,
  45000,         // ₦45,000
  9,             // Due in September
  null,          // Month end
  5              // 5% late fee
);

// Create fees for all classes and types
```

**Verify**: All rules and fees saved ✓

---

### STEP 3: CREATE FIRST SESSION (10 minutes)
**What**: Create 2025/2026 session with 3 terms

```typescript
// Step A: Create session
const session = await sessionManagementService.createSession(
  schoolId,
  "2025/2026",
  2025,
  2026
);
const sessionId = session.data.id;

// Step B: Auto-create 3 Nigerian terms
await sessionManagementService.createDefaultTerms(schoolId, sessionId);

// Step C: Activate
await sessionManagementService.activateSession(schoolId, sessionId);
```

**Verify**: Session active, 3 terms created ✓

---

### STEP 4: MOUNT DASHBOARD (3 minutes)
**What**: Add UI component
**Where**: Admin page

```typescript
import AcademicSessionDashboard from '@/pages/admin/AcademicSessionDashboard';

export default function AdminDashboard() {
  return <AcademicSessionDashboard schoolId={schoolId} />;
}
```

**Verify**: Dashboard loads and shows session ✓

---

## ✅ YOU'RE READY!

Your system is now configured. Next steps:
1. View dashboard
2. When ready to start term: Click "Activate Term 1"
3. System automatically creates all structures
4. Teachers and students can now work

---

---

# 📋 REPORT CARD DISTRIBUTION QUICK GUIDE

## WHO RECEIVES EACH TERM?

### Recipients & Their Access

| Who | Gets Report Card | How | When |
|-----|------------------|-----|------|
| **Parents** | ✅ Yes | Email + SMS + Portal | Dec 15, Mar 20, Jul 25 |
| **Students** | ✅ Yes | Student Portal | Same day as parents |
| **Teachers** | ✅ Yes | Staff Portal | Same day (read-only) |
| **Counselor** | ✅ Yes | Admin Dashboard | Real-time monitoring |
| **Principal** | ✅ Yes | Admin Dashboard | Real-time overview |
| **Records** | ✅ Yes | Permanent Archive | Forever stored |

---

## REPORT CARD GENERATION PROCESS

### Timeline
```
Week 1:  Exams held
Week 2:  Grades finalized by teachers
Week 3:  System generates all report cards
         ↓
         Parents notified automatically
         ↓
         Accessible in parent portal
         ↓
         Students can view their cards
```

### What Triggers Generation

```typescript
// Admin calls this function
const reportCard = await reportCardService.generateReportCard(
  studentId,
  sessionId,
  termId
);

// System automatically:
// 1. Collects all grades
// 2. Calculates totals and grades
// 3. Gathers attendance data
// 4. Gets behaviour records
// 5. Assesses risk level
// 6. Generates professional card
// 7. Notifies all parents
// 8. Archives permanently
```

---

## WHAT'S IN THE REPORT CARD?

### 📊 Academic Performance
- Subject breakdown (CA1, CA2, CA3, Test, Exam)
- Final grade per subject (A/B/C/D/E)
- Class average
- **Class position** (1st, 2nd, etc.)

### 📍 Attendance
- Present: X days
- Absent: X days  
- Late: X days
- **Percentage: X%** (Must be ≥80%)

### 😊 Behaviour
- Behaviour score (0-100)
- Merits count
- Demerits count
- Commendations

### ⚠️ Risk Assessment
- Risk level (Green/Yellow/Red)
- Risk score (0-100)
- Identified factors
- Intervention recommendations

### 💬 Comments
- Teacher remarks
- Principal/Counselor notes

---

## DISTRIBUTION CHANNELS

### 1️⃣ **Parent Email**
```
Subject: Report Card Released - [Student Name]

Hi Mr./Mrs. [Parent Name],

Report card for [Student Name] in [Class] for [Term] has been released.

View here: [Portal Link]
Download PDF: [PDF Link]

Best regards,
School Admin
```

### 2️⃣ **Parent SMS** (if configured)
```
Subject: Report Card Available

Hi, report card for [Student] is ready.
Access at: [Portal]

[School Name]
```

### 3️⃣ **Parent Portal**
```
Login → My Children → [Student Name]
→ Academic History → [Term] → View Report Card

Can:
- View full card
- Download PDF
- See trends
- Print
```

### 4️⃣ **Student Portal** (if enabled)
```
Login → My Academic Record
→ [Term] → View My Report Card

Can:
- View own card
- See grades
- Check attendance
- View behaviour record
```

### 5️⃣ **Teacher Staff Portal**
```
Login → My Classes → [Class Name]
→ Term Reports → [Term]

Can:
- View all student cards
- See class statistics
- Identify struggling students
- Export class report
```

### 6️⃣ **Admin Dashboard**
```
Admin → Analytics → Report Cards

Can:
- View all cards
- Filter by class/performance/risk
- Generate school reports
- Monitor at-risk students
```

---

## REPORT CARD RECIPIENTS BY TERM

### 📅 TERM 1 (December)
- ✅ Report cards generated mid-December
- ✅ Parents notified Dec 15-16
- ✅ Accessible Dec 16-20
- ✅ Used for promotion decisions

### 📅 TERM 2 (March)
- ✅ Report cards generated mid-March
- ✅ Parents notified Mar 20-21
- ✅ Accessible Mar 21-25
- ✅ Used for intervention planning

### 📅 TERM 3 (July)
- ✅ Report cards generated mid-July
- ✅ Parents notified Jul 25-26
- ✅ Accessible Jul 26-31
- ✅ Used for final promotions/graduation

---

## AUTOMATIC PARENT NOTIFICATION

### System Does This Automatically:

1. **Generate Card**
   - Collect all grades
   - Calculate averages
   - Determine grades

2. **Assess Risk**
   - Score risk level
   - Identify issues
   - Plan interventions

3. **Notify Parent**
   ```typescript
   await reportCardService.shareReportCardWithParent(
     studentId,
     parentId,
     reportCardData
   );
   
   // Creates notification:
   // - Email sent
   // - SMS sent
   // - Portal notification created
   // - Portal access enabled
   ```

4. **Archive**
   - Store permanently
   - Enable historical access
   - Support trend analysis

---

## REPORT CARD GRADES

```
Grade A: 70-100  → Excellent
Grade B: 60-69   → Good
Grade C: 50-59   → Average/Credit
Grade D: 40-49   → Pass
Grade E: <40     → Fail ⚠️
```

### Automatic Grade Determination
```
Total = CA1 + CA2 + CA3 + Test + Exam
If Total ≥ 70 → Grade A
If Total ≥ 60 → Grade B
If Total ≥ 50 → Grade C
If Total ≥ 40 → Grade D
If Total < 40 → Grade E (Fail)
```

---

## QUICK FACTS

✅ **Everyone gets a card** - Parents, students, teachers, admin
✅ **3 times per year** - Term 1, Term 2, Term 3
✅ **Fully automatic** - System does all calculations
✅ **Instant notifications** - Parents alerted immediately
✅ **Permanent record** - Stored forever
✅ **Multi-access** - Portal, email, SMS, print
✅ **Risk integrated** - Shows at-risk students
✅ **Promotion linked** - Used for promotion decisions

---

## EXAMPLE: HOW IT WORKS

### Friday (Exam Week)
```
Morning: Final exams
Afternoon: Grades entered by teachers
```

### Saturday-Sunday
```
Teachers finalize all grades
Counselor reviews for risk assessment
```

### Monday (Report Release Day)
```
9:00 AM - Admin runs: reportCardService.generateReportCard()

10:00 AM - System:
  ✓ Generates all report cards
  ✓ Calculates all grades
  ✓ Assesses risks
  ✓ Sends parent emails
  ✓ Sends SMS notifications
  ✓ Creates portal access
  ✓ Archives in database

10:15 AM - Parents receive:
  Email: "Report card ready"
  SMS: "View at [portal]"
  Portal: Card accessible

11:00 AM - Teachers can view:
  Staff portal → Class reports
  
1:00 PM - Principal sees:
  Admin dashboard → Analytics
  Identifies at-risk students
  Plans interventions

SAME DAY - Students can view:
  Student portal → My grades
  See where they stand
```

---

## WHAT HAPPENS WITH THE DATA

### Stored Permanently
- ✅ All report cards in database
- ✅ All grades preserved
- ✅ Historical data searchable
- ✅ Accessible anytime
- ✅ Used for trends
- ✅ Support graduation decisions

### Never Deleted
- ✅ Complete student history
- ✅ Performance trends tracked
- ✅ Intervention history maintained
- ✅ Promotion basis preserved
- ✅ Graduation documentation kept

---

**Summary**: 
- **3 report cards per student per year** 
- **Delivered to 5+ recipients automatically**
- **All data stored permanently**
- **Used for promotions, risk assessment, interventions, and graduation**
