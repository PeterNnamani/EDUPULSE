# Academic Session Management Engine - Implementation Guide

## Overview

The Academic Session Management Engine is a production-grade system that automates the complete lifecycle of a Nigerian school's academic operations. It preserves historical records while eliminating repetitive manual setup.

## Core Principles

1. **Student Profiles are Permanent**: Student records remain throughout their lifecycle
2. **Academic Records are Historical**: Never overwrite academic history
3. **Multi-Tenant Isolation**: All data is isolated by school_id
4. **Full Audit Trail**: All actions are logged and timestamped

## Database Schema

### New Tables Created

#### 1. `class_definitions`
Stores standard class definitions for the school.

```typescript
- id: UUID (Primary Key)
- school_id: UUID (References schools)
- class_name: TEXT (e.g., "JSS1A")
- class_level: TEXT (e.g., "JSS1")
- display_order: INTEGER
- is_primary: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### 2. `promotion_rules`
Defines rules for class progression and promotion eligibility.

```typescript
- id: UUID (Primary Key)
- school_id: UUID
- from_class_id: UUID
- to_class_id: UUID
- attendance_threshold: INTEGER (default 80)
- grade_threshold: DECIMAL (default 40.00)
- behaviour_threshold: INTEGER (default 40)
- allows_repeat: BOOLEAN (default true)
- allows_manual_review: BOOLEAN (default true)
- requires_principal_approval: BOOLEAN (default false)
```

#### 3. `academic_calendars`
Custom academic calendar configurations.

```typescript
- id: UUID
- school_id: UUID
- calendar_name: TEXT
- is_default: BOOLEAN
- first_term_start_month: INTEGER
- first_term_end_month: INTEGER
- second_term_start_month: INTEGER
- second_term_end_month: INTEGER
- third_term_start_month: INTEGER
- third_term_end_month: INTEGER
- vacation_month: INTEGER
```

#### 4. `student_academic_records`
Historical records of student academic progress.

```typescript
- id: UUID
- school_id: UUID
- student_id: UUID
- session_id: UUID
- term_id: UUID (nullable)
- class_id: UUID
- average_score: DECIMAL
- attendance_rate: DECIMAL
- behaviour_score: INTEGER
- risk_level: TEXT ('low' | 'medium' | 'high' | 'critical')
- promotion_status: TEXT ('promoted' | 'repeat' | 'manual_review' | 'graduated' | 'pending')
- principal_approved: BOOLEAN
- approved_by: UUID
```

#### 5. `graduation_records`
Tracks graduating students and certificate generation.

```typescript
- id: UUID
- school_id: UUID
- student_id: UUID
- final_class_id: UUID
- session_id: UUID
- graduation_date: DATE
- final_gpa: DECIMAL
- certificate_number: TEXT (UNIQUE)
- transcript_generated: BOOLEAN
- transcript_url: TEXT
```

#### 6. `fee_structures`
Dynamic fee structures by class and session.

```typescript
- id: UUID
- school_id: UUID
- session_id: UUID
- class_id: UUID
- fee_type_id: UUID
- amount: DECIMAL
- due_month: INTEGER
- due_date: INTEGER
- late_fee_percentage: DECIMAL
```

#### 7. `fee_obligations`
Student-specific fee obligations with payment tracking.

```typescript
- id: UUID
- school_id: UUID
- student_id: UUID
- fee_structure_id: UUID
- session_id: UUID
- amount_due: DECIMAL
- amount_paid: DECIMAL
- amount_outstanding: DECIMAL
- carry_over_balance: DECIMAL
- paid_in_full: BOOLEAN
- exemption_reason: TEXT
```

#### 8. Archived Tables
- `archived_attendance`: Historical attendance records
- `archived_assignments`: Historical assignment records
- `archived_results`: Historical grade records
- `archived_risk_assessments`: Historical risk scores

#### 9. `term_automation_logs`
Log of all automated actions during term activation.

```typescript
- id: UUID
- school_id: UUID
- session_id: UUID
- term_id: UUID
- action_type: TEXT
- action_details: JSONB
- success: BOOLEAN
- error_message: TEXT
```

#### 10. `session_transitions`
Tracks complete session rollover operations.

```typescript
- id: UUID
- school_id: UUID
- from_session_id: UUID
- to_session_id: UUID
- transition_date: TIMESTAMPTZ
- students_promoted: INTEGER
- students_graduated: INTEGER
- students_repeated: INTEGER
- status: TEXT ('pending' | 'in_progress' | 'completed' | 'failed')
```

## Services Overview

### 1. Session Management Service (`sessionManagementService.ts`)

**Key Functions:**
- `createSession()` - Create new academic session
- `getCurrentSession()` - Get active session
- `activateSession()` - Set session as current
- `createDefaultTerms()` - Create terms using Nigerian calendar
- `activateTerm()` - Set term as current
- `getCurrentTerm()` - Get active term
- `archiveSession()` - Archive all session data

**Usage:**
```typescript
// Create new session
const result = await sessionManagementService.createSession(
  schoolId,
  "2025/2026",
  2025,
  2026
);

// Activate session
await sessionManagementService.activateSession(schoolId, sessionId);

// Create default terms
await sessionManagementService.createDefaultTerms(schoolId, sessionId);
```

### 2. Promotion Engine (`promotionEngine.ts`)

**Key Functions:**
- `checkPromotionEligibility()` - Check if student can be promoted
- `promoteStudent()` - Record promotion
- `processBatchPromotions()` - Process all students in class
- `createPromotionRule()` - Define promotion rules
- `getPromotionRules()` - Retrieve rules

**Eligibility Criteria:**
- Attendance ≥ threshold
- Average grade ≥ threshold
- Behaviour score ≥ threshold
- Outstanding fees = 0

**Usage:**
```typescript
// Check eligibility
const eligibility = await promotionEngine.checkPromotionEligibility(
  studentId,
  sessionId,
  fromClassId,
  toClassId,
  schoolId
);

// Process batch promotions
const results = await promotionEngine.processBatchPromotions(
  schoolId,
  sessionId,
  fromClassId,
  toClassId
);
```

### 3. Fee Automation Service (`feeAutomationService.ts`)

**Key Functions:**
- `createFeeStructure()` - Define fees for class
- `getFeeStructures()` - Retrieve fee structures
- `generateFeeObligations()` - Auto-create fees for student
- `recordPayment()` - Record student payment
- `calculateOutstandingFees()` - Get total outstanding
- `getFeeCollectionReport()` - School-wide fee metrics
- `applyExemption()` - Exempt student from fees

**Features:**
- Automatic carry-over balance management
- Support for multiple fee types per class
- Configurable due dates
- Late fee percentages
- Exemption tracking

**Usage:**
```typescript
// Create fee structure
await feeAutomationService.createFeeStructure(
  schoolId,
  classId,
  sessionId,
  feeTypeId,
  50000, // amount in NGN
  9      // due month (September)
);

// Generate obligations for student
const result = await feeAutomationService.generateFeeObligations(
  schoolId,
  studentId,
  classId,
  sessionId,
  termId
);
```

### 4. Term Automation Service (`termAutomationService.ts`)

**Key Functions:**
- `activateTermWithAutomation()` - Activate term and auto-setup
- `createAttendanceStructures()` - Initialize attendance
- `createAssignmentStructures()` - Create assignment workspaces
- `createGradebookStructures()` - Initialize gradebooks
- `generateFeeObligationsForTerm()` - Create all fees
- `activateTeacherWorkspaces()` - Activate teacher access
- `activateRiskMonitoring()` - Enable risk monitoring
- `endTerm()` - Archive term data

**Automatic Actions on Term Activation:**
1. Creates attendance registers for all students
2. Generates assignment workspaces for teachers
3. Initializes gradebook structures
4. Creates fee obligations for all students
5. Activates teacher workspaces
6. Enables risk monitoring

**Usage:**
```typescript
// Activate term with full automation
const result = await termAutomationService.activateTermWithAutomation(
  schoolId,
  sessionId,
  termId,
  userId
);
```

### 5. Academic History Service (`academicHistoryService.ts`)

**Key Functions:**
- `getStudentAcademicHistory()` - Complete academic journey
- `getStudentAttendanceHistory()` - Historical attendance
- `getStudentResultsHistory()` - Historical grades
- `getStudentRiskHistory()` - Historical risk scores
- `getStudentTermRecord()` - Complete record for term
- `getStudentClassProgression()` - Class progression timeline
- `getPerformanceTrend()` - Performance over time
- `exportStudentHistory()` - Export as JSON
- `searchAcademicRecords()` - Search with filters

**Features:**
- Permanent historical record
- Never overwrites data
- Filterable by session/term/class
- Export capabilities
- Performance trend analysis

**Usage:**
```typescript
// Get complete history
const result = await academicHistoryService.getStudentAcademicHistory(
  studentId
);

// Get performance trends
const trends = await academicHistoryService.getPerformanceTrend(
  studentId
);
```

### 6. Graduation Service (`graduationService.ts`)

**Key Functions:**
- `checkGraduationEligibility()` - Check if eligible to graduate
- `graduateStudent()` - Record graduation
- `generateCertificateNumber()` - Auto-generate certificate
- `getGraduationCandidates()` - Find candidates
- `generateTranscript()` - Create transcript
- `getAlumni()` - List graduates
- `getGraduationStatus()` - Check status

**Eligibility:**
- In final class (SS3 or equivalent)
- Passed all subjects
- Good attendance (≥80%)
- Good behaviour
- No outstanding fees

**Usage:**
```typescript
// Check eligibility
const eligibility = await graduationService.checkGraduationEligibility(
  studentId,
  finalClassId,
  sessionId
);

// Graduate student
const result = await graduationService.graduateStudent(
  studentId,
  finalClassId,
  sessionId,
  3.8, // final GPA
  "Excellent performance throughout"
);
```

### 7. Report Card Service (`reportCardService.ts`)

**Key Functions:**
- `generateReportCard()` - Create professional report card
- `generateClassReportCards()` - Batch generate
- `exportReportCardPDF()` - Export to PDF
- `shareReportCardWithParent()` - Send to parent

**Report Card Includes:**
- Student information
- Subject-wise scores (CA1, CA2, CA3, Test, Exam)
- Class position
- Attendance statistics
- Behaviour records
- Risk assessment
- Teacher comments
- Principal comments

**Usage:**
```typescript
// Generate report card
const result = await reportCardService.generateReportCard(
  studentId,
  sessionId,
  termId
);
```

### 8. Session Rollover Service (`sessionRolloverService.ts`)

**Key Functions:**
- `executeSessionRollover()` - Complete end-of-year transition
- `processPromotionsForSession()` - Promote all eligible students
- `getRolloverStatus()` - Check readiness

**Rollover Process:**
1. Archives current session data
2. Creates new session
3. Creates default terms
4. Processes all promotions
5. Handles graduations
6. Creates new class assignments
7. Generates fee obligations
8. Activates new session

**Comprehensive Logging:**
- All actions logged
- Error tracking
- Transition audit trail

**Usage:**
```typescript
// Execute complete rollover
const result = await sessionRolloverService.executeSessionRollover(
  schoolId,
  currentSessionId,
  "2026/2027",
  2026,
  2027,
  userId
);
```

## UI Components

### 1. `AcademicSessionDashboard` Component
Admin dashboard for managing sessions, terms, and fees.

**Features:**
- Current session display
- Term management
- Fee collection metrics
- Session rollover controls
- Pie chart for fee collection

### 2. `StudentAcademicHistoryViewer` Component
View complete academic history for any student.

**Features:**
- Timeline view of academic journey
- Performance trends visualization
- Class progression display
- Detailed term-by-term records
- Export functionality

### 3. `PromotionManagement` Component
Manage promotions for a class.

**Features:**
- Eligibility summary
- Student-by-student eligibility
- Batch promotion processing
- Detailed eligibility checks

### 4. `ReportCardGenerator` Component
Generate professional report cards.

**Features:**
- Student selection
- Automatic report card generation
- Subject-wise breakdown
- Attendance and behaviour records
- PDF export
- Parent sharing

## Integration Guide

### Step 1: Database Migration
Run the migration to create all required tables:

```bash
supabase migration up 008_academic_session_management_engine.sql
```

### Step 2: Install Services
Import services into your admin pages:

```typescript
import { sessionManagementService } from '@/services/sessionManagementService';
import { promotionEngine } from '@/services/promotionEngine';
import { feeAutomationService } from '@/services/feeAutomationService';
import { termAutomationService } from '@/services/termAutomationService';
import { graduationService } from '@/services/graduationService';
import { academicHistoryService } from '@/services/academicHistoryService';
import { reportCardService } from '@/services/reportCardService';
import { sessionRolloverService } from '@/services/sessionRolloverService';
```

### Step 3: Setup Components
Add components to admin dashboard:

```typescript
import AcademicSessionDashboard from '@/pages/admin/AcademicSessionDashboard';
import PromotionManagement from '@/pages/admin/PromotionManagement';
import ReportCardGenerator from '@/pages/admin/ReportCardGenerator';
import StudentAcademicHistoryViewer from '@/pages/admin/StudentAcademicHistoryViewer';
```

### Step 4: Configure Promotion Rules
Set up promotion rules for your school's class structure:

```typescript
// Example for Nigerian secondary school
await promotionEngine.createPromotionRule(
  schoolId,
  jss1ClassId,      // from class
  jss2ClassId,      // to class
  80,               // attendance threshold
  40,               // grade threshold
  40                // behaviour threshold
);
```

### Step 5: Configure Fee Structures
Define fee structures for each class:

```typescript
await feeAutomationService.createFeeStructure(
  schoolId,
  classId,
  sessionId,
  tuitionFeeTypeId,
  45000,            // amount
  9,                // due month (September)
  null,             // due date (default to month end)
  5                 // late fee percentage
);
```

### Step 6: Create Default Academic Calendar
Set up the Nigerian academic calendar:

```typescript
// This is automatically created with default Nigerian calendar
// September - December: First Term
// January - March: Second Term
// April - July: Third Term
// August: Vacation
```

## Workflow: Complete Session Setup

### New Session Setup (Start of Academic Year)

1. **Create Session:**
   ```typescript
   await sessionManagementService.createSession(
     schoolId,
     "2025/2026",
     2025,
     2026
   );
   ```

2. **Create Default Terms:**
   ```typescript
   await sessionManagementService.createDefaultTerms(schoolId, sessionId);
   ```

3. **Activate Session:**
   ```typescript
   await sessionManagementService.activateSession(schoolId, sessionId);
   ```

4. **Create Promotion Rules (first time only):**
   ```typescript
   // Define progression for each class
   ```

5. **Create Fee Structures:**
   ```typescript
   // Define fees for each class
   ```

### First Term Activation

1. **Get First Term:**
   ```typescript
   const terms = await sessionManagementService.getSessionTerms(sessionId);
   const firstTerm = terms.data?.[0];
   ```

2. **Activate Term with Automation:**
   ```typescript
   await termAutomationService.activateTermWithAutomation(
     schoolId,
     sessionId,
     firstTerm.id
   );
   ```

3. **System Automatically:**
   - Creates attendance registers
   - Sets up assignments
   - Initializes gradebooks
   - Generates fee obligations
   - Activates teacher workspaces

### End of Year Rollover

1. **Check Readiness:**
   ```typescript
   const status = await sessionRolloverService.getRolloverStatus(schoolId);
   ```

2. **Execute Rollover:**
   ```typescript
   await sessionRolloverService.executeSessionRollover(
     schoolId,
     currentSessionId,
     "2026/2027",
     2026,
     2027,
     userId
   );
   ```

3. **System Automatically:**
   - Archives all data
   - Processes promotions
   - Handles graduations
   - Creates new classes
   - Generates new fees
   - Activates new session

## Security & Data Protection

### Row Level Security (RLS)
All tables have RLS policies ensuring:
- Schools can only access their own data
- Staff can only access their school's data
- Parents can only access their children's data

### Audit Trail
All actions are logged in `term_automation_logs` with:
- Action type
- Timestamp
- User ID
- Success/failure status
- Error details
- Affected record count

### Backup Strategy
- All data automatically archived before deletion
- Historical records never overwritten
- Complete audit trail maintained

## Scalability Considerations

1. **Bulk Operations:**
   - Batch promotion processing
   - Bulk fee generation
   - Class-wide report cards

2. **Performance Optimization:**
   - Indexed queries
   - Archived data separation
   - Efficient joins

3. **Large School Support:**
   - Tested with 1000+ students
   - Multi-tenant isolation
   - Parallel processing ready

## Nigerian Education System Integration

The system is specifically designed for Nigerian schools:

### Standard Class Structure:
- Creche, Nursery 1, Nursery 2
- KG, Primary 1-6
- JSS1-3, SS1-3

### Standard Academic Calendar:
- First Term: September - December
- Second Term: January - March
- Third Term: April - July
- Vacation: August

### Standard Grading:
- A: 70-100
- B: 60-69
- C: 50-59
- D: 40-49
- E: Below 40 (Fail)

All configurable per school.

## Support & Future Enhancements

### Planned Features:
1. PDF Report Card generation
2. WhatsApp parent notifications
3. Mobile app support
4. Advanced AI-driven risk prediction
5. Attendance biometric integration
6. Fee payment gateway integration

### Extension Points:
- Custom gradebook formulas
- Behavioral merit/demerit systems
- Advanced filtering and reporting
- Custom notifications

## Troubleshooting

### Common Issues:

**Issue: Promotions not processing**
- Check promotion rules are defined
- Verify attendance/grade data exists
- Check fees are marked paid

**Issue: Fee obligations not created**
- Verify fee structures exist for class
- Check session has terms created
- Ensure students assigned to classes

**Issue: Report cards empty**
- Verify grades entered for subjects
- Check attendance records exist
- Confirm students enrolled in term

## Summary

This complete Academic Session Management Engine provides:

✓ Automated session management
✓ Intelligent promotion processing
✓ Dynamic fee automation
✓ Complete academic history preservation
✓ Graduation management
✓ Professional report cards
✓ Risk monitoring integration
✓ Multi-tenant support
✓ Full audit trails
✓ Nigerian education system alignment

The system eliminates manual data recreation every academic year while maintaining complete historical records for every student's entire journey through the school.
