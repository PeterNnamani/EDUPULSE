import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Building,
  BookOpen,
  CalendarDays,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  FileText,
  Settings,
  Bell,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Activity,
  ShieldCheck,
  UserCheck,
  Wallet,
  MessageSquare,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useState, useEffect } from 'react';
import { ChatBot, WelcomeMessage } from '@/components/Chatbot';
import NotificationBell from '@/components/NotificationBell';
import { InAppNotificationProvider } from '@/contexts/InAppNotificationContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useDutyAssignment } from '@/hooks/useDutyAssignment';
import { type FeatureKey } from '@/config/planFeatures';

const adminNavItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Students', path: '/admin/students', icon: Users },
  { label: 'Staff', path: '/admin/staff', icon: GraduationCap },
  { label: 'Classes', path: '/admin/classes', icon: Building },
  { label: 'Subjects', path: '/admin/subjects', icon: BookOpen },
  { label: 'Subscriptions', path: '/admin/subscriptions', icon: DollarSign },
  { label: 'Fee Structures', path: '/admin/fee-settings', icon: DollarSign },
  { label: 'Academic calendar', path: '/admin/academic-calendar', icon: CalendarDays },
  { label: 'Promotion', path: '/admin/academic-lifecycle', icon: GraduationCap },
  { label: 'Duty Attendance', path: '/duty-attendance', icon: UserCheck },
  { label: 'Teacher Activity', path: '/admin/teacher-activity', icon: Activity },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
];

const teacherNavItems = [
  { label: 'Dashboard', path: '/teacher', icon: LayoutDashboard },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Attendance', path: '/attendance', icon: CalendarDays },
  { label: 'Duty Attendance', path: '/duty-attendance', icon: UserCheck },
  { label: 'Grades', path: '/grades', icon: ClipboardList },
  { label: 'Assignments', path: '/assignments', icon: BookOpen },
  { label: 'Behaviour', path: '/behaviour', icon: AlertTriangle },
  { label: 'Reports', path: '/reports', icon: FileText },
];

const principalNavItems = [
  { label: 'Dashboard', path: '/principal', icon: LayoutDashboard },
  { label: 'Students', path: '/principal/students', icon: Users },
  { label: 'Staff', path: '/principal/staff', icon: GraduationCap },
  { label: 'Attendance', path: '/principal/attendance', icon: CalendarDays },
  { label: 'Behaviour', path: '/principal/behaviour', icon: BookOpen },
  { label: 'Risk Analysis', path: '/risk', icon: AlertTriangle },
  { label: 'Teacher Activity', path: '/admin/teacher-activity', icon: Activity },
  { label: 'Reports', path: '/reports', icon: FileText },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const counselorNavItems = [
  { label: 'Dashboard', path: '/counselor', icon: LayoutDashboard },
  { label: 'Interventions', path: '/interventions', icon: Users },
  { label: 'Risk Analysis', path: '/risk', icon: AlertTriangle },
  { label: 'Reports', path: '/reports', icon: FileText },
];

const financeNavItems = [
  { label: 'Dashboard', path: '/finance', icon: LayoutDashboard },
  { label: 'Fees', path: '/fees', icon: DollarSign },
  { label: 'Reconciliation', path: '/finance/reconciliation', icon: Wallet },
  { label: 'Reports', path: '/reports', icon: FileText },
];

const parentNavItems = [
  { label: 'Dashboard', path: '/parent', icon: LayoutDashboard },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Attendance', path: '/parent/attendance', icon: CalendarDays },
  { label: 'Grades', path: '/parent/grades', icon: ClipboardList },
  { label: 'Assignments', path: '/parent/assignments', icon: BookOpen },
];

const MESSAGING_ROLES = new Set(['admin', 'teacher', 'parent', 'principal']);

function isNavItemActive(path: string, pathname: string) {
  if (path === '/messages') return pathname.startsWith('/messages');
  return pathname === path;
}

const roleNavMap = {
  admin: adminNavItems,
  teacher: teacherNavItems,
  principal: principalNavItems,
  counselor: counselorNavItems,
  finance: financeNavItems,
  parent: parentNavItems,
};

// Nav paths gated behind a plan feature; absent paths are always available.
const NAV_FEATURE_MAP: Record<string, FeatureKey> = {
  '/risk': 'risk_detection',
  '/interventions': 'interventions',
  '/duty-attendance': 'duty_attendance',
  '/admin/teacher-activity': 'teacher_activity',
  '/admin/audit-logs': 'audit_logs',
  '/finance/reconciliation': 'reconciliation',
  '/messages': 'school_messaging',
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, darkMode, toggleDarkMode, sidebarOpen, toggleSidebar, logout, school, isAuthenticated } = useAppStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const { hasFeature, loading: featuresLoading } = useFeatureAccess();
  const { showDutyFeatures, loading: dutyLoading } = useDutyAssignment();
  const allNavItems = user ? roleNavMap[user.role] || [] : [];
  const navItems = allNavItems.filter((item) => {
    if (item.path === '/duty-attendance') {
      if (dutyLoading) return true;
      if (!showDutyFeatures) return false;
    }
    const feature = NAV_FEATURE_MAP[item.path];
    if (!feature) return true;
    // While plan is loading, keep items visible to avoid flicker/hiding.
    return featuresLoading || hasFeature(feature);
  });
  const showMessagesNav =
    !!user &&
    MESSAGING_ROLES.has(user.role) &&
    (featuresLoading || hasFeature('school_messaging'));
  const messagingEnabled = !featuresLoading && hasFeature('school_messaging');
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  useEffect(() => {
    if (!messagingEnabled || !user?.schoolId || !user?.id || !user?.role) {
      setMessageUnreadCount(0);
      return;
    }

    let active = true;
    const refreshUnread = () => {
      import('@/services/messageService')
        .then(({ messageService }) =>
          messageService.getUnreadCount(user.schoolId!, user.id!, user.role!)
        )
        .then((count) => {
          if (active) setMessageUnreadCount(count);
        })
        .catch(() => {
          if (active) setMessageUnreadCount(0);
        });
    };

    refreshUnread();
    const interval = window.setInterval(refreshUnread, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [messagingEnabled, user?.schoolId, user?.id, user?.role, location.pathname]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && user.schoolId) {
      import('@/services/subscriptionService').then(({ runSubscriptionDeadlineChecks }) => {
        void runSubscriptionDeadlineChecks(user.schoolId!).then(() => {
          import('@/hooks/useFeatureAccess').then(({ refreshFeatureAccess }) => {
            refreshFeatureAccess(user.schoolId!);
          });
        });
      });
      import('@/services/birthdayService').then(({ birthdayService }) => {
        void birthdayService.runBirthdayGreetings(user.schoolId!);
      });
    }
    if (isAuthenticated && (user?.role === 'admin' || user?.role === 'finance') && user.schoolId) {
      import('@/services/reconciliationService').then(({ reconciliationService }) => {
        void reconciliationService.runDailyReconciliation(user.schoolId!);
      });
    }
  }, [isAuthenticated, user?.role, user?.schoolId]);

  // Show welcome message only once after login
  useEffect(() => {
    if (isAuthenticated && !hasShownWelcome) {
      setShowWelcome(true);
      setHasShownWelcome(true);
    }
  }, [isAuthenticated, hasShownWelcome]);

  const handleLogout = () => {
    setHasShownWelcome(false);
    setShowWelcome(false);
    setChatOpen(false);
    sessionStorage.removeItem('edupulse-notification-session');
    logout();
    navigate('/');
  };

  const messagesNavClass = (compact = false) => {
    const active = isNavItemActive('/messages', location.pathname);
    return [
      'relative flex items-center gap-2 rounded-lg font-medium transition-colors',
      compact ? 'p-2' : 'px-3 py-2 text-sm',
      active
        ? 'bg-secondary-bg dark:bg-dark-elevated text-primary-text dark:text-dark-text'
        : 'text-secondary-text dark:text-dark-icon hover:bg-secondary-bg dark:hover:bg-dark-elevated hover:text-primary-text dark:hover:text-dark-text',
    ].join(' ');
  };

  const MessagesNavLink = ({ compact = false }: { compact?: boolean }) => {
    if (!showMessagesNav) return null;

    return (
      <Link
        to="/messages"
        onClick={() => window.innerWidth < 1024 && toggleSidebar()}
        className={messagesNavClass(compact)}
        title="Messages"
      >
        <MessageSquare className={compact ? 'w-5 h-5' : 'w-5 h-5'} />
        {!compact && <span>Messages</span>}
        {messageUnreadCount > 0 && (
          <span
            className={`absolute flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold ${
              compact ? 'top-0 right-0 translate-x-1/3 -translate-y-1/3' : 'static ml-0.5'
            }`}
          >
            {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <InAppNotificationProvider>
    <div className={`h-screen flex flex-col bg-white dark:bg-dark-bg ${darkMode ? 'dark' : ''}`}>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-dark-bg border-b border-border dark:border-dark-border z-50 px-4">
        <div className="h-full flex items-center justify-between">
          <button onClick={toggleSidebar} className="p-2 rounded-lg text-secondary-text dark:text-dark-icon hover:bg-secondary-bg dark:hover:bg-dark-elevated">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="font-semibold text-lg dark:text-dark-text">EduPulse</h1>
          <div className="flex items-center gap-2">
            <MessagesNavLink compact />
            <NotificationBell />
            <button onClick={toggleDarkMode} className="p-2 rounded-lg text-secondary-text dark:text-dark-icon hover:bg-secondary-bg dark:hover:bg-dark-elevated">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden pt-16 lg:pt-0">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ x: sidebarOpen ? 0 : '-100%' }}
          className={`fixed lg:static top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-full w-72 lg:w-64 bg-white dark:bg-dark-bg border-r border-border dark:border-dark-border z-50 lg:z-0 lg:translate-x-0 transition-transform`}
        >
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="h-16 lg:h-20 flex items-center justify-between px-6 border-b border-border dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black dark:bg-dark-elevated dark:border dark:border-dark-border flex items-center justify-center">
                  <span className="text-white dark:text-dark-text font-bold text-sm">E</span>
                </div>
                <span className="font-bold text-xl text-black dark:text-dark-text">EduPulse</span>
              </div>
              <button
                onClick={toggleDarkMode}
                className="hidden lg:block p-2 rounded-lg text-secondary-text dark:text-dark-icon hover:bg-secondary-bg dark:hover:bg-dark-elevated transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>

            {/* School Info */}
            {school.currentSchool && (
              <div className="px-4 py-3 border-b border-border dark:border-dark-border">
                <p className="text-xs text-secondary-text">School</p>
                <p className="font-medium text-sm truncate">{school.currentSchool.name}</p>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(item.path, location.pathname);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {item.path === '/messages' && messageUnreadCount > 0 && (
                      <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Settings & Logout */}
            <div className="p-4 border-t border-border dark:border-dark-border space-y-1">
              <Link to="/settings" className="sidebar-item">
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <button onClick={handleLogout} className="sidebar-item w-full text-left text-red-500 dark:text-red-400/90 hover:text-red-600 dark:hover:text-red-300">
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-dark-bg">
          {/* Top Bar */}
          <header className="hidden lg:flex h-16 items-center justify-between px-6 border-b border-border dark:border-dark-border bg-white dark:bg-dark-bg flex-shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium dark:text-dark-text">
                {navItems.find((item) => isNavItemActive(item.path, location.pathname))?.label || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <MessagesNavLink />
              <NotificationBell />

              {/* Profile */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-elevated transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary-bg dark:bg-dark-elevated dark:border dark:border-dark-border flex items-center justify-center">
                    <span className="font-medium text-sm">
                      {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{user?.fullName}</p>
                    <p className="text-xs text-secondary-text capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-secondary-text" />
                </button>

                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-14 w-48 bg-white dark:bg-dark-card border border-border dark:border-dark-border rounded-xl shadow-elevated dark:shadow-dark-elevated z-50 overflow-hidden"
                  >
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-4 py-3 hover:bg-secondary-bg dark:hover:bg-dark-elevated transition-colors dark:text-dark-text"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Settings</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary-bg dark:hover:bg-dark-elevated transition-colors text-red-500 dark:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Chatbot */}
      <ChatBot
        onOpenChange={(open) => {
          setChatOpen(open);
          if (open) setShowWelcome(false);
        }}
      />

      {/* Welcome Message */}
      <WelcomeMessage
        isVisible={showWelcome && !chatOpen}
        onDismiss={() => setShowWelcome(false)}
      />
    </div>
    </InAppNotificationProvider>
  );
}
