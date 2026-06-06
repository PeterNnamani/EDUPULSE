import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserRole, SchoolState } from '@/types';
import type { PlanTier } from '@/config/planFeatures';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  selectedRole: UserRole | null;
  onboardingComplete: boolean;
  school: SchoolState;
  darkMode: boolean;
  sidebarOpen: boolean;
  selectedParentChildId: string | null;
  /** Set immediately after payment so gated features unlock without reload. */
  activePlanTier: PlanTier | null;
  featureAccessNonce: number;

  setUser: (user: User | null) => void;
  setSelectedRole: (role: UserRole | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setSchool: (school: SchoolState) => void;
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setSelectedParentChildId: (childId: string | null) => void;
  setActivePlanTier: (tier: PlanTier | null) => void;
  bumpFeatureAccess: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      selectedRole: null,
      onboardingComplete: false,
      school: {
        currentSchool: null,
        currentTerm: null,
        currentSession: null,
      },
      darkMode: false,
      sidebarOpen: true,
      selectedParentChildId: null,
      activePlanTier: null,
      featureAccessNonce: 0,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSelectedRole: (selectedRole) => set({ selectedRole }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      setSchool: (school) => set({ school }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSelectedParentChildId: (selectedParentChildId) => set({ selectedParentChildId }),
      setActivePlanTier: (activePlanTier) => set({ activePlanTier }),
      bumpFeatureAccess: () =>
        set((state) => ({ featureAccessNonce: state.featureAccessNonce + 1 })),
      logout: () => set((state) => {
        const u = state.user;
        if (u?.role === 'teacher' && u.schoolId) {
          void import('@/services/teacherActivityService').then(({ teacherActivityService }) => {
            void teacherActivityService.logActivity({
              schoolId: u.schoolId!,
              staffId: u.id,
              staffName: u.fullName,
              action: 'logout',
              details: { at: new Date().toISOString() },
            });
          });
        }
        return {
          user: null,
          isAuthenticated: false,
          selectedRole: null,
          school: {
            currentSchool: null,
            currentTerm: null,
            currentSession: null,
          },
          selectedParentChildId: null,
          activePlanTier: null,
        };
      }),
    }),
    {
      name: 'edupulse-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        darkMode: state.darkMode,
      }),
    }
  )
);
