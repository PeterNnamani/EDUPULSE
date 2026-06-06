import type { UserRole } from '@/types';

/** Default dashboard path per role — used when redirecting unauthorized users. */
export function dashboardPathForRole(role?: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'teacher':
      return '/teacher';
    case 'principal':
      return '/principal';
    case 'counselor':
      return '/counselor';
    case 'finance':
      return '/finance';
    case 'parent':
      return '/parent';
    default:
      return '/login';
  }
}

export function isRoleAllowed(userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/** Shared role groups for route guards */
export const ROLES = {
  admin: ['admin'] as UserRole[],
  adminPrincipal: ['admin', 'principal'] as UserRole[],
  staffTeaching: ['admin', 'teacher', 'principal'] as UserRole[],
  staffAll: ['admin', 'principal', 'teacher', 'counselor', 'finance'] as UserRole[],
  riskTeam: ['admin', 'principal', 'counselor'] as UserRole[],
  finance: ['admin', 'finance'] as UserRole[],
  parent: ['parent'] as UserRole[],
  messaging: ['admin', 'teacher', 'parent', 'principal'] as UserRole[],
  everyone: ['admin', 'principal', 'teacher', 'counselor', 'finance', 'parent'] as UserRole[],
};
