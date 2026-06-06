import type { ReportCategory } from '@/services/reportExportService';
import type { UserRole } from '@/types';

/** Report categories each role may generate or download. Admin & principal get full school scope. */
export const REPORT_CATEGORIES_BY_ROLE: Record<UserRole, ReportCategory[]> = {
  admin: ['attendance', 'academic', 'behaviour', 'risk', 'financial', 'student'],
  principal: ['attendance', 'academic', 'behaviour', 'risk', 'financial', 'student'],
  teacher: ['attendance', 'academic', 'behaviour'],
  counselor: ['behaviour', 'risk', 'student'],
  finance: ['financial'],
  parent: [],
};

export function getReportCategoriesForRole(
  role: UserRole | undefined,
  options?: { hasRiskFeature?: boolean }
): ReportCategory[] {
  if (!role) return [];
  const base = REPORT_CATEGORIES_BY_ROLE[role] ?? [];
  if (options?.hasRiskFeature === false) {
    return base.filter((c) => c !== 'risk');
  }
  return base;
}

export function canAccessReportCategory(
  role: UserRole | undefined,
  category: ReportCategory,
  options?: { hasRiskFeature?: boolean }
): boolean {
  return getReportCategoriesForRole(role, options).includes(category);
}

export const REPORTS_PAGE_SUBTITLE: Partial<Record<UserRole, string>> = {
  admin: 'School-wide reports across attendance, academics, behaviour, risk, and finance',
  principal: 'Leadership summaries and school-wide exports from live data',
  teacher: 'Attendance, grades, and behaviour exports for your assigned classes only',
  counselor: 'Behaviour, risk, and student profile exports for your caseload',
  finance: 'Fee collection and outstanding balance reports',
};

export const REPORTS_FOOTER_BY_ROLE: Partial<Record<UserRole, string>> = {
  admin:
    'Generate school-wide PDF exports for attendance, academics, behaviour, risk, finance, and student profiles.',
  principal:
    'Generate school-wide PDF exports for attendance, academics, behaviour, risk, finance, and student profiles.',
  teacher:
    'Export attendance, academic, and behaviour summaries for classes you teach or form-manage.',
  counselor: 'Export behaviour, risk analysis, and student profile reports.',
  finance: 'Export fee collection and outstanding balance reports.',
};

/** Roles that see all school data (not limited to assigned classes). */
export function isSchoolWideReportRole(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'principal' || role === 'counselor' || role === 'finance';
}
