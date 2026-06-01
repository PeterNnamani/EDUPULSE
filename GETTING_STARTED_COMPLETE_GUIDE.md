# Complete Getting Started Guide - Academic Session Management Engine

---

## OVERVIEW

This guide provides **complete, step-by-step instructions** for implementing the Academic Session Management Engine. Each step is explained in detail with code examples, expected outputs, and troubleshooting tips.

**Timeline**: Steps 1-3 take approximately 30 minutes. Step 4 is optional but recommended.

---

# STEP 1: RUN DATABASE MIGRATION

## What This Does
Creates all 13 required database tables with relationships, indexes, and Row Level Security (RLS) policies.

### Command to Run

Open PowerShell in your EduPulse project directory:

```powershell
cd C:\Users\HYPE_OIU\Documents\EDUPULSE
npx supabase migration up 008_academic_session_management_engine.sql
```

### Alternative (If above doesn't work)

```powershell
npx supabase db push --schema-only
```

### What Gets Created

#### Main Tables:
1. **class_definitions** - Standard class levels (JSS1, SS3, etc.)
2. **promotion_rules** - Progression rules per school
3. **academic_calendars** - Term schedules
4. **student_academic_records** - PERMANENT historical records
5. **graduation_records** - Graduation tracking
6. **fee_structures** - Fee definitions per class
7. **fee_obligations** - Student-specific fees
8. **term_automation_logs** - Audit trail
9. **session_transitions** - Year-end rollover logs

#### Historical Archive Tables:
- `archived_attendance` - Backup of attendance
- `archived_assignments` - Backup of assignments
- `archived_results` - Backup of grades
- `archived_risk_assessments` - Backup of risk scores

### Expected Output

```
✓ Migration completed successfully
✓ 13 tables created
✓ All indexes created
✓ RLS policies applied
✓ Foreign keys established
```

### Verification

After migration completes, verify in Supabase dashboard:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'class_definitions%' 
OR table_name LIKE 'promotion_rules%'
```

**Expected**: Should list all new tables

### Troubleshooting

**Error: "Migration already applied"**
- Migration was already run
- Safe to proceed to Step 2

**Error: "Connection timeout"**
- Check internet connection
- Verify Supabase project is accessible
- Try again in 1 minute

**Error: "Permission denied"**
- User account doesn't have migration permissions
- Contact your Supabase admin

---

# STEP 2: CONFIGURE SCHOOL SETTINGS

## What This Does
Sets up promotion rules and fee structures specific to your school.

This step **must be completed before activating any terms**.

---

## PART A: CREATE PROMOTION RULES

Promotion rules define how students progress through classes. Each school configures these based on their policy.

### What Are Promotion Rules?

A promotion rule connects two classes and defines eligibility thresholds:

```
Example:
JSS1A → JSS2A: Requires 80% attendance, 40 average score, 40 behaviour
SS3A → Graduation: Requires 80% attendance, 40 all subjects, 40 behaviour
```

### Configuration Values (Nigerian Standard)

**Attendance Threshold**: 80% (standard)
- Students must attend 80% of school days
- Example: 160 days school year = 128 days minimum attendance

**Grade Threshold**: 40 (passing grade)
- Students must average 40 or higher
- Below 40 = automatic repetition

**Behaviour Threshold**: 40 (good conduct)
- Behaviour score starts at 50
- +5 for merits, -5 for demerits
- Below 40 = needs intervention

### Step-by-Step: Create First Rule (JSS1 → JSS2)

**In your admin component or database tool, run:**

```typescript
// Import the service
import { promotionEngine } from '@/services/promotionEngine';

// Get the class IDs first
// You can find these by querying the classes table
// Let's assume: jss1ClassId = "class-jss1-uuid"
//              jss2ClassId = "class-jss2-uuid"
//              schoolId = "your-school-uuid"

const result = await promotionEngine.createPromotionRule(
  schoolId,           // Your school's UUID
  jss1ClassId,        // From class ID (JSS1)
  jss2ClassId,        // To class ID (JSS2)
  80,                 // Attendance threshold (%)
  40,                 // Grade threshold
  40                  // Behaviour threshold
);

if (result.success) {
  console.log('Rule created successfully:', result.data);
} else {
  console.error('Failed to create rule:', result.error);
}
```

### Complete Rule Set (Nigerian School Example)

Create these rules **in order**:

```typescript
// All Primary classes
await promotionEngine.createPromotionRule(schoolId, primary1Id, primary2Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, primary2Id, primary3Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, primary3Id, primary4Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, primary4Id, primary5Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, primary5Id, primary6Id, 80, 40, 40);

// All Junior Secondary classes
await promotionEngine.createPromotionRule(schoolId, jss1Id, jss2Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, jss2Id, jss3Id, 80, 40, 40);

// All Senior Secondary classes
await promotionEngine.createPromotionRule(schoolId, ss1Id, ss2Id, 80, 40, 40);
await promotionEngine.createPromotionRule(schoolId, ss2Id, ss3Id, 80, 40, 40);

// Graduation (SS3 completion)
await promotionEngine.createPromotionRule(schoolId, ss3Id, graduationId, 80, 40, 40);
```

### Verification

To verify rules were created:

```typescript
const { data: rules } = await promotionEngine.getPromotionRules(schoolId);
console.log(`Created ${rules.length} promotion rules`);
```

**Expected**: Should show 10 rules (or however many class transitions your school has)

---

## PART B: CREATE FEE STRUCTURES

Fee structures define what fees students pay and when they're due.

### What Are Fee Structures?

A fee structure specifies:
- Amount to pay
- When it's due (month)
- Any late fee penalties

Example:
```
JSS1 Tuition: ₦45,000 due in September, 5% late fee
JSS1 Development Levy: ₦5,000 due in September, no late fee
```

### Step-by-Step: Create Fees for JSS1

**First, you need fee type IDs. Query to find them:**

```typescript
const { data: feeTypes } = await supabase
  .from('fee_types')
  .select('*');

// Will show: tuition, development_levy, sports_fee, uniform, books, etc.
// Get the IDs of the fee types you want
```

**Create tuition fee for JSS1:**

```typescript
import { feeAutomationService } from '@/services/feeAutomationService';

const result = await feeAutomationService.createFeeStructure(
  schoolId,           // Your school UUID
  jss1ClassId,        // JSS1 class UUID
  sessionId,          // Current session UUID
  tuitionFeeTypeId,   // Fee type (from fee_types table)
  45000,              // Amount in NGN
  9,                  // Due month (9 = September)
  null,               // Due date (null = month end, or specify 1-28)
  5                   // Late fee percentage (5%)
);

console.log('Tuition fee created:', result.success);
```

**Create development levy for JSS1:**

```typescript
const result = await feeAutomationService.createFeeStructure(
  schoolId,
  jss1ClassId,
  sessionId,
  developmentFeeTypeId,
  5000,               // Amount: ₦5,000
  9,                  // Due in September
  null,
  0                   // No late fee
);
```

### Complete Fee Set (Nigerian School Example)

```typescript
// JSS1 fees
await feeAutomationService.createFeeStructure(schoolId, jss1Id, sessionId, tuitionId, 45000, 9, null, 5);
await feeAutomationService.createFeeStructure(schoolId, jss1Id, sessionId, developmentId, 5000, 9, null, 0);
await feeAutomationService.createFeeStructure(schoolId, jss1Id, sessionId, sportsId, 2000, 9, null, 0);

// JSS2 fees
await feeAutomationService.createFeeStructure(schoolId, jss2Id, sessionId, tuitionId, 50000, 9, null, 5);
await feeAutomationService.createFeeStructure(schoolId, jss2Id, sessionId, developmentId, 5000, 9, null, 0);
await feeAutomationService.createFeeStructure(schoolId, jss2Id, sessionId, sportsId, 2000, 9, null, 0);

// JSS3 fees
await feeAutomationService.createFeeStructure(schoolId, jss3Id, sessionId, tuitionId, 55000, 9, null, 5);
await feeAutomationService.createFeeStructure(schoolId, jss3Id, sessionId, developmentId, 5000, 9, null, 0);
await feeAutomationService.createFeeStructure(schoolId, jss3Id, sessionId, sportsId, 2000, 9, null, 0);

// Repeat for SS1, SS2, SS3...
```

### Verification

```typescript
const { data: structures } = await feeAutomationService.getFeeStructures(
  jss1ClassId, 
  sessionId
);

console.log(`Created ${structures.length} fee structures for JSS1`);
// Expected: 3 (tuition + development + sports)
```

---

# STEP 3: CREATE FIRST ACADEMIC SESSION

## What This Does
Creates the 2025/2026 academic session and automatically generates three terms.

### Command: Create Session

**In an admin endpoint or component:**

```typescript
import { sessionManagementService } from '@/services/sessionManagementService';

// Step A: Create the session
const sessionResult = await sessionManagementService.createSession(
  schoolId,           // Your school UUID
  "2025/2026",        // Session name
  2025,               // Start year
  2026,               // End year
  9,                  // Start month (September)
  7                   // End month (July)
);

if (!sessionResult.success) {
  console.error('Failed to create session:', sessionResult.error);
  return;
}

const sessionId = sessionResult.data.id;
console.log('Session created:', sessionId);

// Step B: Create default terms (Nigerian calendar)
const termsResult = await sessionManagementService.createDefaultTerms(
  schoolId,
  sessionId,
  calendarId  // Optional: use custom calendar or Nigerian default
);

if (!termsResult.success) {
  console.error('Failed to create terms:', termsResult.error);
  return;
}

console.log('Three terms created successfully');

// Step C: Activate the session (make it current)
const activateResult = await sessionManagementService.activateSession(
  schoolId,
  sessionId
);

if (!activateResult.success) {
  console.error('Failed to activate session:', activateResult.error);
  return;
}

console.log('Session activated!');
```

### What Gets Created Automatically

**Three Terms** (Nigerian Standard):

```
TERM 1 (First Term):
- Start: September 1, 2025
- End: December 15, 2025
- Duration: ~3.5 months
- Activities: Normal school, First set of exams

TERM 2 (Second Term):
- Start: January 1, 2026
- End: March 31, 2026
- Duration: ~3 months
- Activities: Normal school, Second set of exams

TERM 3 (Third Term):
- Start: April 1, 2026
- End: July 15, 2026
- Duration: ~3.5 months
- Activities: Normal school, Final exams, Promotions

VACATION:
- August 2026 (full month)
- For holidays and year-end activities
```

### Verification

```typescript
// Get the active session
const currentResult = await sessionManagementService.getCurrentSession(schoolId);
console.log('Current session:', currentResult.data);

// Get all terms in session
const termsResult = await sessionManagementService.getSessionTerms(sessionId);
console.log('Terms:', termsResult.data);

// Should show 3 terms + 1 vacation
```

**Expected Output**:
- Session: "2025/2026"
- Terms: 4 (3 terms + 1 vacation)
- Status: "is_current" = true

---

# STEP 4: USE THE ADMIN DASHBOARD (OPTIONAL BUT RECOMMENDED)

## What This Does
Provides a visual interface to manage sessions, terms, and monitor the system.

### Setup Component

**In your admin layout file (e.g., `src/pages/admin/Dashboard.tsx`):**

```typescript
import AcademicSessionDashboard from '@/pages/admin/AcademicSessionDashboard';

export default function AdminDashboard() {
  const schoolId = useAuth().schoolId;  // Get from auth context

  return (
    <div className="admin-dashboard">
      <h1>School Administration</h1>
      
      {/* Add the Academic Session Dashboard */}
      <AcademicSessionDashboard schoolId={schoolId} />
      
      {/* Other admin components... */}
    </div>
  );
}
```

### Dashboard Features

**What You'll See**:

1. **Current Session Card**
   - Shows: "2025/2026"
   - Status indicator
   - Action buttons

2. **Current Term Card**
   - Shows: "First Term" or term name
   - Start/end dates
   - Days remaining

3. **Fee Collection Card**
   - Percentage collected
   - Total amount
   - Outstanding amount

4. **Term List**
   - All 4 terms displayed
   - "Active" badge on current term
   - Buttons to activate other terms

5. **Fee Collection Chart**
   - Pie chart showing paid vs outstanding
   - Percentage breakdown

6. **Session Rollover Card**
   - Readiness checklist:
     ✓ Promotion rules configured
     ✓ Fee structures configured
     ✓ Active classes exist
   - "Execute Rollover" button (enabled when all checks pass)

---

# NEXT: TERM ACTIVATION

## When You're Ready to Start the Academic Year

After completing Steps 1-4, you're ready to activate the first term. This will automatically:

```typescript
import { termAutomationService } from '@/services/termAutomationService';

// Get the first term
const { data: terms } = await sessionManagementService.getSessionTerms(sessionId);
const firstTerm = terms.find(t => t.term_number === 1);

// Activate with one call (everything automates!)
const result = await termAutomationService.activateTermWithAutomation(
  schoolId,
  sessionId,
  firstTerm.id,
  staffUserId  // Who is activating this
);

// Automatic actions triggered:
// ✓ Attendance registers created for all students
// ✓ Assignment structures created for all teachers
// ✓ Gradebooks initialized
// ✓ Fee obligations generated for all students
// ✓ Teacher workspaces activated
// ✓ Risk monitoring started
// ✓ All actions logged in audit trail

console.log('Term activated with full automation!');
```

---

---

# REPORT CARD DISTRIBUTION - COMPLETE DETAILS

## Who Receives Report Cards Each Term?

### Recipients

**PRIMARY RECIPIENTS**:
1. **Parents** - Via notification system
2. **Teachers** - Can view in staff portal
3. **Students** - Can view via student portal (if enabled)
4. **Principal/Counselor** - Administrative access

### Distribution Process

#### When Report Cards Are Generated

**Typical Timeline**:
- Week 1-2 of next term: Grades finalized
- Day 1 of report card release: System generates all cards
- Day 1-2: Parents notified
- Day 3-7: Parents can access via parent portal

#### Automatic Notification to Parents

**System automatically sends**:

```typescript
// When report card is generated:
const reportCard = await reportCardService.generateReportCard(
  studentId,
  sessionId,
  termId
);

// System automatically notifies parents:
const parents = await getStudentParents(studentId);

for (const parent of parents) {
  await reportCardService.shareReportCardWithParent(
    studentId,
    parent.id,
    reportCard
  );
}

// Creates notification in system:
{
  recipient_type: 'parent',
  recipient_id: parent.id,
  notification_type: 'report_card_available',
  title: 'Report Card Released',
  message: `Report card for John Doe is now available`,
  data: {
    studentId: 'student-uuid',
    reportCardData: { ... }  // Complete report card
  }
}
```

### What's In The Report Card?

#### Complete Report Card Contents

**Student Information**:
- Name
- Admission number
- Class
- Date of birth

**Academic Performance**:
- Subject breakdown:
  - Continuous Assessment 1 (CA1) score
  - Continuous Assessment 2 (CA2) score
  - Continuous Assessment 3 (CA3) score
  - Test score
  - Exam score
  - **Total score** (calculated)
  - **Grade** (A/B/C/D/E)
- Class average
- Total number of subjects
- **Class position** (e.g., "1st in class")

**Attendance**:
- Days present
- Days absent
- Days late
- Days excused
- Total school days
- **Attendance percentage**

**Behaviour**:
- Behaviour score (0-100)
- Merits count
- Demerits count
- Commendations count

**Risk Assessment**:
- Risk score (0-100)
- Risk level (Low/Medium/High)
- Risk factors identified
- Recommendations for intervention

**Comments**:
- Teacher comments
- Principal comments

**Metadata**:
- Generated date/time
- Session name
- Term name

### Grade Scale

```
Grade A: 70-100 (Excellent)
Grade B: 60-69  (Good)
Grade C: 50-59  (Credit/Average)
Grade D: 40-49  (Pass/Below Average)
Grade E: <40    (Fail)
```

### Report Card Examples

#### Example 1: High Performer

```
STUDENT: Chioma Okafor
ADMISSION #: ADM-2024-001
CLASS: JSS2A
SESSION: 2025/2026 TERM 1

ACADEMIC PERFORMANCE:
Mathematics      | CA1: 18 | CA2: 17 | CA3: 18 | Test: 15 | Exam: 45 | Total: 113/120 | Grade: A
English          | CA1: 18 | CA2: 18 | CA3: 17 | Test: 14 | Exam: 42 | Total: 109/120 | Grade: A
Biology          | CA1: 17 | CA2: 16 | CA3: 18 | Test: 14 | Exam: 41 | Total: 106/120 | Grade: A
Chemistry        | CA1: 16 | CA2: 17 | CA3: 17 | Test: 13 | Exam: 39 | Total: 102/120 | Grade: A
Physics          | CA1: 18 | CA2: 17 | CA3: 18 | Test: 14 | Exam: 41 | Total: 108/120 | Grade: A

CLASS AVERAGE: 87.6/100
CLASS POSITION: 1st (Top student)

ATTENDANCE:
Present: 160 days | Absent: 0 days | Late: 2 days | Excused: 0 days | Total: 162 days
Attendance Percentage: 98.8% ✓ (Exceeds 80% requirement)

BEHAVIOUR:
Score: 85/100
Merits: 5 | Demerits: 0 | Commendations: 3

RISK ASSESSMENT:
Risk Score: 15/100 (Low Risk) ✓
Risk Level: GREEN - Thriving
Factors: None identified
Recommendations: Continue with current performance level

COMMENTS:
Teacher: "Exceptional performance. Chioma demonstrates mastery of all concepts."
Principal: "An excellent role model for her peers. Recommend for higher responsibilities."

PROMOTION STATUS: ✓ PROMOTED TO JSS3A
```

#### Example 2: At-Risk Student

```
STUDENT: Oluwaseun Adeleke
ADMISSION #: ADM-2024-045
CLASS: JSS2A
SESSION: 2025/2026 TERM 1

ACADEMIC PERFORMANCE:
Mathematics      | CA1: 8  | CA2: 9  | CA3: 7  | Test: 6  | Exam: 18 | Total: 48/120 | Grade: D
English          | CA1: 10 | CA2: 11 | CA3: 9  | Test: 7  | Exam: 20 | Total: 57/120 | Grade: C
Biology          | CA1: 6  | CA2: 7  | CA3: 8  | Test: 5  | Exam: 16 | Total: 42/120 | Grade: E (FAIL)
Chemistry        | CA1: 7  | CA2: 8  | CA3: 6  | Test: 5  | Exam: 15 | Total: 41/120 | Grade: E (FAIL)
Physics          | CA1: 9  | CA2: 8  | CA3: 7  | Test: 6  | Exam: 17 | Total: 47/120 | Grade: D

CLASS AVERAGE: 47.0/100 (BELOW AVERAGE)
CLASS POSITION: 35th of 40 students

ATTENDANCE:
Present: 120 days | Absent: 25 days | Late: 15 days | Excused: 2 days | Total: 162 days
Attendance Percentage: 74.1% ⚠️ (BELOW 80% requirement)

BEHAVIOUR:
Score: 35/100 ⚠️ (Below Threshold)
Merits: 0 | Demerits: 5 | Commendations: 0

RISK ASSESSMENT:
Risk Score: 72/100 (High Risk) ⚠️
Risk Level: RED - At Risk
Factors: 
- Low academic performance (2 failed subjects)
- Attendance below threshold
- Behaviour concerns
- Possible learning difficulties
Recommendations:
- Immediate intervention meeting with parents
- Additional tutoring in Mathematics
- Counseling sessions
- Attendance follow-up

COMMENTS:
Teacher: "Oluwaseun is struggling with core subjects. Requires intervention."
Principal: "Parents must be involved. Consider remedial classes."

PROMOTION STATUS: ⚠️ REQUIRES MANUAL REVIEW
Promotion Status: PENDING - Principal decision needed
Note: Failed 2 subjects. Attendance below standard. Manual review required for promotion decision.
```

### Distribution Channels

#### 1. **Parent Notification System**

Parents receive notifications through:

**In-App Notification**:
- Dashboard message
- Viewable in parent portal
- Downloadable PDF version

**Email Notification** (if configured):
- Email sent to parent email
- Contains report card summary
- Link to view full card

**SMS Notification** (if configured):
- SMS alert that card is ready
- Link to access portal

#### 2. **Parent Portal Access**

Parents can access through web portal:

```
Login → My Children → Select Child
→ Academic History → Select Term → View Report Card
```

Can:
- View full report card
- See trends over time
- Compare with class average
- Print to PDF
- Share with guardians

#### 3. **Teacher Access**

Teachers view report cards in staff portal:

```
Staff Login → My Classes → Select Class
→ Term Reports → View All Report Cards
```

Can:
- View all student cards
- See class statistics
- Identify at-risk students
- Export class report

#### 4. **Student Portal** (if enabled)

Students see their own report cards:

```
Student Login → My Report Card → Select Term
```

Can:
- View their own card
- See scores and grades
- Check attendance
- View behaviour record

#### 5. **Principal/Counselor Dashboard**

Administrative view of all report cards:

```
Admin Login → Analytics → Report Cards
```

Can:
- View all student cards
- Filter by class, performance, risk level
- Generate school-wide reports
- Identify intervention needs

---

## Report Card Distribution Timeline (Typical School Year)

### Term 1 (December)
**Week 1**: Final exams begin
**Week 2**: Grading completed
**Week 3**: Report cards generated
- Parents notified Dec 15
- Accessible from Dec 16-20
**Week 4**: School holidays begin

### Term 2 (March)
**Week 1**: Final exams begin
**Week 2**: Grading completed
**Week 3**: Report cards generated
- Parents notified March 20
- Accessible from March 21-25
**Week 4**: Easter holidays

### Term 3 (July)
**Week 1-2**: Final exams begin
**Week 3**: Grading completed
**Week 4**: Report cards generated + Promotions
- Parents notified July 25
- Accessible from July 26-31
**Week 5**: School breaks, promotions take effect

---

## Automatic Report Card Features

### 1. **Calculation Automation**

System automatically:
- Sums all CA1, CA2, CA3, Test, Exam scores
- Calculates final total
- Determines grade (A/B/C/D/E)
- Calculates attendance percentage
- Determines behaviour score
- Identifies class position
- Assesses risk level

### 2. **Consistency Checking**

System validates:
- All subjects have grades
- Grades are within 0-100 range
- Attendance records exist
- Behaviour records exist
- Risk assessment completed

### 3. **Archival**

System automatically:
- Archives completed report cards
- Stores in `archived_results` table
- Preserves permanently
- Accessible for future reference

### 4. **Notifications**

System automatically:
- Notifies all parents
- Logs in audit trail
- Tracks view status
- Resends if not viewed

---

## Summary: Report Card Recipients Per Term

| Recipient | Term 1 | Term 2 | Term 3 | Access Method |
|-----------|--------|---------|---------|----------------|
| **Parents** | ✅ Yes | ✅ Yes | ✅ Yes | Email + Portal + SMS |
| **Students** | ✅ Yes | ✅ Yes | ✅ Yes | Student Portal |
| **Teachers** | ✅ Yes | ✅ Yes | ✅ Yes | Staff Portal |
| **Counselor** | ✅ Yes | ✅ Yes | ✅ Yes | Admin Dashboard |
| **Principal** | ✅ Yes | ✅ Yes | ✅ Yes | Admin Dashboard |
| **School Records** | ✅ Yes | ✅ Yes | ✅ Yes | Permanent Archive |

All report cards are automatically:
- Generated after exams
- Sent to parents
- Stored permanently
- Accessible through their respective portals
- Integrated with promotion decisions
