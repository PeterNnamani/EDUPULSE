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
  | 'grade_alert'
  | 'behaviour_alert'
  | 'fee_reminder'
  | 'risk_alert'
  | 'intervention_reminder'
  | 'assignment_alert'
  | 'system';

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
