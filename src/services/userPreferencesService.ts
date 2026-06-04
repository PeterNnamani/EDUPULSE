import type { UserRole } from '@/types';

export interface UserPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  attendanceAlerts: boolean;
  riskAlerts: boolean;
  gradeAlerts: boolean;
  feeAlerts: boolean;
  interventionAlerts: boolean;
}

const DEFAULTS: UserPreferences = {
  emailNotifications: true,
  smsNotifications: false,
  attendanceAlerts: true,
  riskAlerts: true,
  gradeAlerts: true,
  feeAlerts: true,
  interventionAlerts: true,
};

function storageKey(userId: string, schoolId: string, role: UserRole): string {
  return `edupulse-prefs:${schoolId}:${role}:${userId}`;
}

export function loadUserPreferences(
  userId: string,
  schoolId: string,
  role: UserRole
): UserPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId, schoolId, role));
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUserPreferences(
  userId: string,
  schoolId: string,
  role: UserRole,
  prefs: UserPreferences
): void {
  localStorage.setItem(storageKey(userId, schoolId, role), JSON.stringify(prefs));
}

export type PreferenceKey = keyof UserPreferences;

export function getNotificationItemsForRole(role: UserRole): {
  key: PreferenceKey;
  title: string;
  desc: string;
}[] {
  const common = [
    { key: 'emailNotifications' as const, title: 'Email notifications', desc: 'Receive updates via email' },
    { key: 'smsNotifications' as const, title: 'SMS notifications', desc: 'Receive updates via SMS' },
  ];

  switch (role) {
    case 'admin':
      return [
        ...common,
        { key: 'attendanceAlerts', title: 'Attendance alerts', desc: 'School-wide attendance warnings' },
        { key: 'riskAlerts', title: 'Risk alerts', desc: 'High-risk student notifications' },
        { key: 'feeAlerts', title: 'Fee alerts', desc: 'Payment and outstanding balance alerts' },
      ];
    case 'principal':
      return [
        ...common,
        { key: 'riskAlerts', title: 'Risk alerts', desc: 'Critical and high-risk student flags' },
        { key: 'attendanceAlerts', title: 'Attendance alerts', desc: 'School attendance threshold breaches' },
        { key: 'interventionAlerts', title: 'Intervention updates', desc: 'Open cases and escalations' },
      ];
    case 'teacher':
      return [
        ...common,
        { key: 'attendanceAlerts', title: 'Class attendance', desc: 'Alerts for your assigned classes' },
        { key: 'gradeAlerts', title: 'Grade reminders', desc: 'Pending grade entry reminders' },
      ];
    case 'counselor':
      return [
        ...common,
        { key: 'interventionAlerts', title: 'Case updates', desc: 'Assigned intervention cases' },
        { key: 'riskAlerts', title: 'Risk alerts', desc: 'Students requiring counseling' },
      ];
    case 'finance':
      return [
        ...common,
        { key: 'feeAlerts', title: 'Payment alerts', desc: 'Collections and outstanding fees' },
      ];
    case 'parent':
      return [
        ...common,
        { key: 'attendanceAlerts', title: 'Child attendance', desc: 'When your child is absent or late' },
        { key: 'gradeAlerts', title: 'Grade updates', desc: 'New grades and report cards' },
        { key: 'feeAlerts', title: 'Fee reminders', desc: 'Outstanding balance notifications' },
      ];
    default:
      return common;
  }
}
