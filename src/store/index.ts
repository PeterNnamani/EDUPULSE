import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserRole, SchoolState } from '@/types';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  selectedRole: UserRole | null;
  onboardingComplete: boolean;
  school: SchoolState;
  darkMode: boolean;
  sidebarOpen: boolean;
  selectedParentChildId: string | null;

  setUser: (user: User | null) => void;
  setSelectedRole: (role: UserRole | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setSchool: (school: SchoolState) => void;
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setSelectedParentChildId: (childId: string | null) => void;
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

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSelectedRole: (selectedRole) => set({ selectedRole }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      setSchool: (school) => set({ school }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSelectedParentChildId: (selectedParentChildId) => set({ selectedParentChildId }),
      logout: () => set({
        user: null,
        isAuthenticated: false,
        selectedRole: null,
        school: {
          currentSchool: null,
          currentTerm: null,
          currentSession: null,
        },
        selectedParentChildId: null,
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
