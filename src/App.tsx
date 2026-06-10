import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryProvider } from '@/lib/react-query';
import { useAppStore } from '@/store';
import { NotificationProvider } from '@/contexts/NotificationContext';
import ToastContainer from '@/components/ToastContainer';
import { useEffect, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import RoleSelection from '@/components/RoleSelection';
import SchoolRegistration from '@/pages/school/Registration';
import Login from '@/pages/auth/Login';
import AdminDashboard from '@/pages/admin/Dashboard';
import TeacherDashboard from '@/pages/teacher/Dashboard';
import PrincipalDashboard from '@/pages/principal/Dashboard';
import PrincipalStudentsOverview from '@/pages/principal/StudentsOverview';
import PrincipalStaffOverview from '@/pages/principal/StaffOverview';
import PrincipalAttendanceOverview from '@/pages/principal/AttendanceOverview';
import PrincipalBehaviourOverview from '@/pages/principal/BehaviourOverview';
import CounselorDashboard from '@/pages/counselor/Dashboard';
import FinanceDashboard from '@/pages/finance/Dashboard';
import ReconciliationPage from '@/pages/finance/ReconciliationPage';
import ParentDashboard from '@/pages/parent/Dashboard';
import StudentManagement from '@/pages/admin/StudentManagement';
import StaffManagement from '@/pages/admin/StaffManagement';
import ClassManagement from '@/pages/admin/ClassManagement';
import SubjectsManagement from '@/pages/admin/SubjectsManagement';
import AttendancePage from '@/pages/attendance/AttendancePage';
import DutyAttendancePage from '@/pages/attendance/DutyAttendancePage';
import DutyRouteGuard from '@/components/DutyRouteGuard';
import GradesPage from '@/pages/grades/GradesPage';
import AssignmentsPage from '@/pages/assignments/AssignmentsPage';
import BehaviourPage from '@/pages/behaviour/BehaviourPage';
import FeesPage from '@/pages/fees/FeesPage';
import RiskAnalysisPage from '@/pages/risk/RiskAnalysisPage';
import InterventionsPage from '@/pages/interventions/InterventionsPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import NotificationCenter from '@/pages/NotificationCenter';
import SubscriptionsPage from '@/pages/admin/SubscriptionsPage';
import FeeSettingsPage from '@/pages/admin/FeeSettingsPage';
import AcademicCalendarSettings from '@/pages/admin/AcademicCalendarSettings';
import AcademicLifecyclePage from '@/pages/admin/AcademicLifecyclePage';
import TeacherActivityPage from '@/pages/admin/TeacherActivityPage';
import AuditLogPage from '@/pages/admin/AuditLogPage';
import ReportCardsPage from '@/pages/admin/ReportCardsPage';
import ParentAttendance from '@/pages/parent/ParentAttendance';
import ParentGrades from '@/pages/parent/ParentGrades';
import ParentAssignments from '@/pages/parent/ParentAssignments';
import ParentBehaviour from '@/pages/parent/ParentBehaviour';
import Layout from '@/components/Layout';
import MessagesPage from '@/pages/messages/MessagesPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import CleanUrlBar, { RestoreAppPath } from '@/components/CleanUrlBar';
import { ROLES } from '@/config/routeAccess';

function AppContent() {
  const { onboardingComplete, selectedRole, isAuthenticated, darkMode, user } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Give splash screen and intro audio time to play (3 seconds instead of 2.5)
    const timer = setTimeout(() => setShowSplash(false), 3000);
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

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/register" element={<SchoolRegistration />} />
        <Route
          path="/login"
          element={selectedRole ? <Login /> : <Navigate to="/" replace />}
        />
        <Route
          path="/"
          element={selectedRole ? <Navigate to="/login" replace /> : <RoleSelection />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!selectedRole) {
    return <RoleSelection />;
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
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <StaffManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/classes"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <ClassManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subjects"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <SubjectsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscriptions"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <SubscriptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/fee-settings"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <FeeSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/academic-calendar"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <AcademicCalendarSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/academic-lifecycle"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <AcademicLifecyclePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-cards"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin}>
              <ReportCardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/teacher-activity"
          element={
            <ProtectedRoute allowedRoles={ROLES.adminPrincipal} feature="teacher_activity">
              <TeacherActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={ROLES.admin} feature="audit_logs">
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal"
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <PrincipalDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/students"
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <PrincipalStudentsOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/staff"
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <PrincipalStaffOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/attendance"
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <PrincipalAttendanceOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/principal/behaviour"
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <PrincipalBehaviourOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/counselor"
          element={
            <ProtectedRoute allowedRoles={['counselor']}>
              <CounselorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance"
          element={
            <ProtectedRoute allowedRoles={['finance']}>
              <FinanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/reconciliation"
          element={
            <ProtectedRoute allowedRoles={ROLES.finance} feature="reconciliation">
              <ReconciliationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent"
          element={
            <ProtectedRoute allowedRoles={ROLES.parent}>
              <ParentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={ROLES.staffTeaching}>
              <AttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/duty-attendance"
          element={
            <ProtectedRoute allowedRoles={ROLES.staffTeaching} feature="duty_attendance">
              <DutyRouteGuard>
                <DutyAttendancePage />
              </DutyRouteGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/grades"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'principal']}>
              <GradesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'principal']}>
              <AssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/behaviour"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'principal', 'counselor']}>
              <BehaviourPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/parent/attendance"
          element={
            <ProtectedRoute allowedRoles={ROLES.parent}>
              <ParentAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/grades"
          element={
            <ProtectedRoute allowedRoles={ROLES.parent}>
              <ParentGrades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/assignments"
          element={
            <ProtectedRoute allowedRoles={ROLES.parent}>
              <ParentAssignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/behaviour"
          element={
            <ProtectedRoute allowedRoles={ROLES.parent}>
              <ParentBehaviour />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fees"
          element={
            <ProtectedRoute allowedRoles={ROLES.finance}>
              <FeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/risk"
          element={
            <ProtectedRoute allowedRoles={ROLES.riskTeam} feature="risk_detection">
              <RiskAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interventions"
          element={
            <ProtectedRoute allowedRoles={ROLES.riskTeam} feature="interventions">
              <InterventionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'principal', 'counselor', 'finance']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={ROLES.everyone}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={ROLES.everyone}>
              <NotificationCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute allowedRoles={ROLES.messaging} feature="school_messaging">
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={getDashboardRoute()} replace />} />
        <Route path="*" element={<Navigate to={getDashboardRoute()} replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryProvider>
      <NotificationProvider>
        <BrowserRouter>
          <RestoreAppPath />
          <CleanUrlBar />
          <AppContent />
          <ToastContainer />
        </BrowserRouter>
      </NotificationProvider>
    </QueryProvider>
  );
}

export default App;
