export type UserRole = 'admin' | 'principal' | 'teacher' | 'counselor' | 'finance' | 'parent';

export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise' | 'lifetime';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type StudentStatus = 'active' | 'graduated' | 'withdrawn' | 'suspended' | 'transferred';

export type BehaviourType = 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'paystack' | 'flutterwave';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type InterventionStatus = 'open' | 'in_progress' | 'completed' | 'closed' | 'escalated';

export type NotificationType =
  | 'attendance_alert'
  | 'academic_alert'
  | 'behaviour_alert'
  | 'assignment_alert'
  | 'fee_reminder'
  | 'fee_alert'
  | 'risk_alert'
  | 'intervention_reminder'
  | 'escalation_alert'
  | 'academic_event'
  | 'system_alert'
  | 'arrival_alert'
  | 'departure_alert'
  | 'birthday_greeting'
  | 'teacher_activity'
  | 'payment_confirmation'
  | 'reconciliation_alert'
  | 'school_message';

export interface User {
  id: string;
  email?: string;
  name?: string;
  role: UserRole;
  schoolId: string;
  staffId?: string;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  children?: Array<{
    id: string;
    studentId: string;
    firstName: string;
    lastName: string;
    gender: string;
    classId?: string;
    className?: string;
  }>;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface SchoolState {
  currentSchool: {
    id: string;
    name: string;
    logoUrl?: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
  } | null;
  currentTerm: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  currentSession: {
    id: string;
    name: string;
  } | null;
}

export interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  attendanceRate: number;
  averageGrade: number;
  highRiskStudents: number;
  pendingFees: number;
  openInterventions: number;
}

export interface ChartData {
  name: string;
  value: number;
  percentage?: number;
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface RiskCalculation {
  overall: number;
  attendance: number;
  academic: number;
  behaviour: number;
  payment: number;
  assignment: number;
  factors: RiskFactor[];
  recommendations: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

export interface TableColumn<T = unknown> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

// Academic Session Management Types
export type PromotionStatus = 'promoted' | 'repeat' | 'manual_review' | 'graduated' | 'pending';

export type TermAutomationAction =
  | 'term_activated'
  | 'attendance_created'
  | 'assignments_created'
  | 'gradebook_created'
  | 'fees_generated'
  | 'risk_monitoring_activated'
  | 'teacher_workspace_activated'
  | 'promotion_processed'
  | 'graduation_processed'
  | 'session_archived'
  | 'session_created';

export interface ClassDefinition {
  id: string;
  schoolId: string;
  className: string;
  classLevel: string;
  displayOrder: number;
  isPrimary: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionRule {
  id: string;
  schoolId: string;
  fromClassId: string;
  toClassId: string;
  attendanceThreshold: number;
  gradeThreshold: number;
  behaviourThreshold: number;
  allowsRepeat: boolean;
  allowsManualReview: boolean;
  requiresPrincipalApproval: boolean;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicCalendar {
  id: string;
  schoolId: string;
  calendarName: string;
  isDefault: boolean;
  isActive: boolean;
  firstTermStartMonth: number;
  firstTermEndMonth: number;
  secondTermStartMonth: number;
  secondTermEndMonth: number;
  thirdTermStartMonth: number;
  thirdTermEndMonth: number;
  vacationMonth: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAcademicRecord {
  id: string;
  schoolId: string;
  studentId: string;
  sessionId: string;
  termId?: string;
  classId: string;
  averageScore?: number;
  attendanceRate?: number;
  behaviourScore?: number;
  riskLevel?: RiskLevel;
  subjectsCount: number;
  promoted?: boolean;
  promotionStatus: PromotionStatus;
  promotionNotes?: string;
  principalApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface GraduationRecord {
  id: string;
  schoolId: string;
  studentId: string;
  finalClassId: string;
  sessionId: string;
  graduationDate: string;
  finalGPA?: number;
  qualification?: string;
  certificateNumber?: string;
  transcriptGenerated: boolean;
  transcriptUrl?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  sessionId?: string;
  classId: string;
  feeTypeId?: string;
  amount: number;
  dueMonth?: number;
  dueDate?: number;
  lateFeePercentage: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeObligation {
  id: string;
  schoolId: string;
  studentId: string;
  feeStructureId: string;
  sessionId: string;
  termId?: string;
  amountDue: number;
  amountPaid: number;
  amountOutstanding: number;
  carryOverBalance: number;
  dueDate?: string;
  paidInFull: boolean;
  paymentPlan?: string;
  exemptionReason?: string;
  exemptionApprovedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArchivedAttendance {
  id: string;
  schoolId: string;
  studentId: string;
  sessionId: string;
  termId?: string;
  attendanceData: Record<string, unknown>;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendancePercentage: number;
  archivedAt: string;
}

export interface ArchivedResults {
  id: string;
  schoolId: string;
  studentId: string;
  sessionId: string;
  termId?: string;
  resultsData: Record<string, unknown>;
  averageScore: number;
  totalSubjects: number;
  classPosition?: number;
  bestSubject?: string;
  weakestSubject?: string;
  archivedAt: string;
}

export interface ArchivedRiskAssessment {
  id: string;
  schoolId: string;
  studentId: string;
  sessionId: string;
  termId?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: Record<string, unknown>;
  recommendations: Record<string, unknown>;
  interventionsCount: number;
  archivedAt: string;
}

export interface TermAutomationLog {
  id: string;
  schoolId: string;
  sessionId: string;
  termId?: string;
  actionType: TermAutomationAction;
  actionDetails: Record<string, unknown>;
  executedBy?: string;
  success: boolean;
  errorMessage?: string;
  affectedCount: number;
  createdAt: string;
}

export interface SessionTransition {
  id: string;
  schoolId: string;
  fromSessionId?: string;
  toSessionId: string;
  transitionDate: string;
  studentsPromoted: number;
  studentsGraduated: number;
  studentsRepeated: number;
  newClassesCreated: number;
  feesObligationsCreated: number;
  executedBy?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorDetails?: Record<string, unknown>;
  createdAt: string;
}

// Report Card Engine Types
export type ResultApprovalStatus = 'draft' | 'submitted' | 'approved' | 'published' | 'rejected';

export type ReportCardPromotionStatus = 'promoted' | 'repeat' | 'under_review' | 'graduated' | 'pending';

export interface GradingScale {
  id: string;
  schoolId: string;
  scaleName: string;
  isDefault: boolean;
  isActive: boolean;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradeRangeRule {
  id: string;
  gradingScaleId: string;
  minScore: number;
  maxScore: number;
  gradeLetter: string;
  gradePoint: number;
  remark: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentResult {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  sessionId: string;
  termId: string;

  // Input scores
  caScore?: number;
  testScore?: number;
  examScore?: number;

  // Calculated scores
  totalScore: number;
  grade: string;
  gradePoint: number;
  remark: string;

  // Metadata
  gradingScaleId: string;
  teacherId: string;
  approvalStatus: ResultApprovalStatus;
  teacherComments?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
}

export interface ResultApproval {
  id: string;
  schoolId: string;
  classId: string;
  sessionId: string;
  termId: string;

  currentStatus: ResultApprovalStatus;
  submittedBy?: string;
  approvedBy?: string;
  publishedBy?: string;

  classTeacherComment?: string;
  principalComment?: string;
  rejectionReason?: string;

  submittedAt?: string;
  approvedAt?: string;
  publishedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ReportCard {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  sessionId: string;
  termId: string;

  // Summary
  totalSubjects: number;
  totalMarks: number;
  averageScore: number;
  overallGrade: string;
  classPosition: number;

  // Integrated data
  attendanceDaysPresent: number;
  attendanceDaysAbsent: number;
  attendancePercentage: number;
  behaviourRating?: string;
  behaviourMerits: number;
  behaviourDemerits: number;
  riskLevel?: RiskLevel;
  riskScore?: number;

  // Assignments
  assignmentsGiven: number;
  assignmentsSubmitted: number;
  assignmentsCompletionPercentage: number;

  // Comments
  classTeacherComment?: string;
  principalComment?: string;
  promotionStatus: ReportCardPromotionStatus;

  // Status
  isPublished: boolean;
  isLocked: boolean;

  // Timestamps
  generatedAt: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardSummary {
  id: string;
  schoolId: string;
  classId: string;
  sessionId: string;
  termId: string;

  // Statistics
  totalStudents: number;
  averageClassScore: number;
  highestAverage: number;
  lowestAverage: number;
  passCount: number;
  failCount: number;
  passRate: number;

  // Subject analysis
  bestPerformingSubjectId?: string;
  worstPerformingSubjectId?: string;
  subjectAverages?: Record<string, number>;

  // Attendance
  classAverageAttendance: number;

  // Timestamps
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassPosition {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  sessionId: string;
  termId: string;

  averageScore: number;
  position: number;
  totalStudents: number;

  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResultTemplate {
  id: string;
  schoolId: string;
  templateName: string;
  isDefault: boolean;

  // Configuration
  headerText?: string;
  footerText?: string;
  showRiskLevel: boolean;
  showBehaviour: boolean;
  showAssignments: boolean;
  showAttendance: boolean;
  customFields?: Record<string, unknown>;

  // Branding
  logoUrl?: string;
  schoolColors?: Record<string, string>;

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParentReportAccess {
  id: string;
  schoolId: string;
  parentId: string;
  studentId: string;
  reportCardId: string;

  accessedAt: string;
  downloadedPdf: boolean;
  printed: boolean;

  createdAt: string;
}

export interface ResultAnalytics {
  classId: string;
  sessionId: string;
  termId: string;

  // Performance
  classAverage: number;
  topPerformers: Array<{
    studentId: string;
    studentName: string;
    average: number;
    position: number;
  }>;
  bottomPerformers: Array<{
    studentId: string;
    studentName: string;
    average: number;
    position: number;
  }>;

  // Subject Performance
  subjectPerformance: Array<{
    subjectId: string;
    subjectName: string;
    average: number;
    passRate: number;
  }>;

  // Distribution
  gradeDistribution: Record<string, number>;
  passFailRate: {
    passCount: number;
    failCount: number;
    passRate: number;
  };

  // Trends
  attendanceTrends: {
    averageAttendance: number;
    highestAttendance: number;
    lowestAttendance: number;
  };

  generatedAt: string;
}
