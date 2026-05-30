import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider } from '@/lib/react-query';
import { useAppStore } from '@/store';
import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import RoleSelection from '@/components/RoleSelection';
import SchoolRegistration from '@/pages/school/Registration';
import Login from '@/pages/auth/Login';
import AdminDashboard from '@/pages/admin/Dashboard';
import TeacherDashboard from '@/pages/teacher/Dashboard';
import PrincipalDashboard from '@/pages/principal/Dashboard';
import CounselorDashboard from '@/pages/counselor/Dashboard';
import FinanceDashboard from '@/pages/finance/Dashboard';
import ParentDashboard from '@/pages/parent/Dashboard';
import StudentManagement from '@/pages/admin/StudentManagement';
import StaffManagement from '@/pages/admin/StaffManagement';
import ClassManagement from '@/pages/admin/ClassManagement';
import AttendancePage from '@/pages/attendance/AttendancePage';
import GradesPage from '@/pages/grades/GradesPage';
import AssignmentsPage from '@/pages/assignments/AssignmentsPage';
import BehaviourPage from '@/pages/behaviour/BehaviourPage';
import FeesPage from '@/pages/fees/FeesPage';
import RiskAnalysisPage from '@/pages/risk/RiskAnalysisPage';
import InterventionsPage from '@/pages/interventions/InterventionsPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import SubscriptionsPage from '@/pages/admin/SubscriptionsPage';
import ParentAttendance from '@/pages/parent/ParentAttendance';
import ParentGrades from '@/pages/parent/ParentGrades';
import ParentAssignments from '@/pages/parent/ParentAssignments';
import Layout from '@/components/Layout';

function AppContent() {
  const { onboardingComplete, selectedRole, isAuthenticated, darkMode, user } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!onboardingComplete) {
    return <>
      <OnboardingFlow />
    </>;
  }

  if (!selectedRole) {
    return <RoleSelection />;
  }

  if (!isAuthenticated) {
    if (selectedRole === 'admin') {
      return (
        <Routes>
          <Route path="/register" element={<SchoolRegistration />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
    return <Login />;
  }

  const getDashboardRoute = () => {
    switch (user?.role) {
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
        return '/';
    }
  };

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<StudentManagement />} />
        <Route path="/admin/staff" element={<StaffManagement />} />
        <Route path="/admin/classes" element={<ClassManagement />} />
        <Route path="/admin/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/principal" element={<PrincipalDashboard />} />
        <Route path="/counselor" element={<CounselorDashboard />} />
        <Route path="/finance" element={<FinanceDashboard />} />
        <Route path="/parent" element={<ParentDashboard />} />

        {/* Teacher/Staff Pages */}
        <Route path="/attendance" element={user?.role === 'parent' ? <ParentAttendance /> : <AttendancePage />} />
        <Route path="/grades" element={user?.role === 'parent' ? <ParentGrades /> : <GradesPage />} />
        <Route path="/assignments" element={user?.role === 'parent' ? <ParentAssignments /> : <AssignmentsPage />} />

        {/* Parent-specific Pages */}
        <Route path="/parent/attendance" element={<ParentAttendance />} />
        <Route path="/parent/grades" element={<ParentGrades />} />
        <Route path="/parent/assignments" element={<ParentAssignments />} />

        <Route path="/behaviour" element={<BehaviourPage />} />
        <Route path="/fees" element={<FeesPage />} />
        <Route path="/risk" element={<RiskAnalysisPage />} />
        <Route path="/interventions" element={<InterventionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to={getDashboardRoute()} replace />} />
        <Route path="*" element={<Navigate to={getDashboardRoute()} replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;
