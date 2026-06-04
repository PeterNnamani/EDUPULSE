import { Building2, Bell, Moon, Shield, User, Wallet, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types';

export type SettingsTabId = 'profile' | 'school' | 'notifications' | 'security' | 'appearance' | 'billing';

export interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
}

export interface RoleSettingsConfig {
  subtitle: string;
  tabs: SettingsTab[];
  canEditSchool: boolean;
  canEditSecurity: boolean;
  showSchoolAcademic: boolean;
  showBilling: boolean;
  infoBanner?: string;
}

export function getRoleSettingsConfig(role: UserRole): RoleSettingsConfig {
  switch (role) {
    case 'admin':
      return {
        subtitle: 'Manage your school profile, policies, and account',
        tabs: [
          { id: 'school', label: 'School', icon: Building2 },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: true,
        canEditSecurity: true,
        showSchoolAcademic: true,
        showBilling: false,
      };
    case 'principal':
      return {
        subtitle: 'View school configuration and manage your preferences',
        tabs: [
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'school', label: 'School Info', icon: Building2 },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: true,
        showBilling: false,
        infoBanner: 'School settings are read-only for principals. Contact your administrator to request changes.',
      };
    case 'teacher':
      return {
        subtitle: 'Your staff profile and classroom notification preferences',
        tabs: [
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: false,
        showBilling: false,
      };
    case 'counselor':
      return {
        subtitle: 'Your counselor profile and case alert preferences',
        tabs: [
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: false,
        showBilling: false,
      };
    case 'finance':
      return {
        subtitle: 'Financial overview settings and notification preferences',
        tabs: [
          { id: 'profile', label: 'My Profile', icon: User },
          { id: 'school', label: 'School & Fees', icon: Wallet },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: false,
        showBilling: true,
        infoBanner: 'Fee amounts are configured by the school administrator in Fee Settings.',
      };
    case 'parent':
      return {
        subtitle: 'Your account and how you receive updates about your children',
        tabs: [
          { id: 'profile', label: 'My Account', icon: User },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'appearance', label: 'Appearance', icon: Moon },
        ],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: false,
        showBilling: false,
      };
    default:
      return {
        subtitle: 'Account preferences',
        tabs: [{ id: 'appearance', label: 'Appearance', icon: Moon }],
        canEditSchool: false,
        canEditSecurity: false,
        showSchoolAcademic: false,
        showBilling: false,
      };
  }
}
