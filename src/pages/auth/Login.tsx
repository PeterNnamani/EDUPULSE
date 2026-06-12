import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, ArrowLeft, User, Lock, Phone } from 'lucide-react';
import { useAppStore } from '@/store';
import { adminLogin, staffLogin, parentLogin } from '@/services/authService';
import type { UserRole } from '@/types';
import { dashboardPathForRole } from '@/config/routeAccess';
import { unlockNotificationAudio } from '@/utils/playNotificationSound';
import { getInitialsFromName } from '@/utils/displayUtils';
import {
  getRememberedAccount,
  saveRememberedAccount,
  clearRememberedAccount,
  getRememberedIdentifier,
  type RememberedAccount,
} from '@/utils/rememberedAccount';

type LoginView = 'welcome' | 'credentials' | 'full';

export default function Login() {
  const navigate = useNavigate();
  const selectedRole = useAppStore((s) => s.selectedRole);
  const setUser = useAppStore((s) => s.setUser);
  const setSelectedRole = useAppStore((s) => s.setSelectedRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<LoginView>('full');
  const [remembered, setRemembered] = useState<RememberedAccount | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    staffId: '',
    pin: '',
    phone: '',
    rememberMe: false,
  });

  useEffect(() => {
    const saved = getRememberedAccount(selectedRole);
    if (!saved) {
      setRemembered(null);
      setView('full');
      return;
    }

    setRemembered(saved);
    setView('welcome');
    setForm((prev) => ({
      ...prev,
      email: saved.email ?? prev.email,
      staffId: saved.staffId ?? prev.staffId,
      phone: saved.phone ?? prev.phone,
      rememberMe: true,
    }));
  }, [selectedRole]);

  const getRoleLabel = () => {
    switch (selectedRole) {
      case 'admin':
        return 'School Administrator';
      case 'teacher':
        return 'Teacher';
      case 'principal':
        return 'Principal';
      case 'counselor':
        return 'Counselor';
      case 'finance':
        return 'Finance Officer';
      case 'parent':
        return 'Parent';
      default:
        return '';
    }
  };

  const persistRemembered = (
    role: UserRole,
    fullName: string,
    photoUrl?: string | null
  ) => {
    if (!form.rememberMe) {
      clearRememberedAccount();
      return;
    }
    saveRememberedAccount({
      role,
      fullName,
      photoUrl,
      email: role === 'admin' ? form.email : undefined,
      staffId: role !== 'admin' && role !== 'parent' ? form.staffId : undefined,
      phone: role === 'parent' ? form.phone : undefined,
      savedAt: new Date().toISOString(),
    });
  };

  const completeLogin = async () => {
    if (loading) return;

    setError('');
    setLoading(true);
    unlockNotificationAudio();

    const finish = (loggedInUser?: { role: UserRole }) => {
      setLoading(false);
      if (loggedInUser) {
        navigate(dashboardPathForRole(loggedInUser.role), { replace: true });
      }
    };

    try {
      if (selectedRole === 'admin') {
        if (!form.email.trim() || !form.password) {
          setError('Enter your email and password.');
          setLoading(false);
          return;
        }

        const response = await adminLogin(form.email.trim(), form.password);

        if (!response.success || !response.user) {
          setError(response.error || 'Login failed');
          setLoading(false);
          return;
        }

        persistRemembered('admin', response.user.fullName, response.user.photoUrl);
        setUser({
          id: response.user.id,
          email: response.user.email,
          role: 'admin',
          schoolId: response.user.schoolId,
          staffId: response.user.staffId,
          fullName: response.user.fullName,
          phone: response.user.phone,
          photoUrl: response.user.photoUrl ?? undefined,
        });
        finish({ role: 'admin' });
        return;
      }

      if (selectedRole === 'parent') {
        if (!form.phone.trim()) {
          setError('Enter your phone number.');
          setLoading(false);
          return;
        }

        const response = await parentLogin(form.phone);

        if (!response.success || !response.user) {
          setError(response.error || 'Login failed');
          setLoading(false);
          return;
        }

        persistRemembered('parent', response.user.fullName);
        setUser({
          id: response.user.id,
          role: 'parent',
          schoolId: response.user.schoolId,
          fullName: response.user.fullName,
          phone: response.user.phone,
          children: response.user.children,
        });
        finish({ role: 'parent' });
        return;
      }

      if (!form.staffId.trim() || !form.pin.trim()) {
        setError('Enter your staff ID and PIN.');
        setLoading(false);
        return;
      }

      const response = await staffLogin(form.staffId, form.pin, selectedRole!);

      if (!response.success || !response.user) {
        setError(response.error || 'Login failed');
        setLoading(false);
        return;
      }

      persistRemembered(
        selectedRole as UserRole,
        response.user.fullName,
        response.user.photoUrl
      );
      setUser({
        id: response.user.id,
        role: selectedRole as UserRole,
        schoolId: response.user.schoolId,
        staffId: response.user.staffId,
        fullName: response.user.fullName,
        phone: response.user.phone,
        photoUrl: response.user.photoUrl ?? undefined,
      });

      if (selectedRole === 'teacher' && response.user.schoolId) {
        const { teacherActivityService } = await import('@/services/teacherActivityService');
        void teacherActivityService.logActivity({
          schoolId: response.user.schoolId,
          staffId: response.user.id,
          staffName: response.user.fullName,
          action: 'login',
          details: { at: new Date().toISOString() },
        });
      }

      finish({ role: selectedRole as UserRole });
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeLogin();
  };

  const handleWelcomeSignIn = async () => {
    if (loading) return;

    if (selectedRole === 'parent') {
      if (!form.phone.trim()) {
        setView('full');
        setError('Enter your phone number to continue.');
        return;
      }
      await completeLogin();
      return;
    }

    setView('credentials');
    setError('');
  };

  const handleUseAnotherAccount = () => {
    clearRememberedAccount();
    setRemembered(null);
    setView('full');
    setForm({
      email: '',
      password: '',
      staffId: '',
      pin: '',
      phone: '',
      rememberMe: false,
    });
    setError('');
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
  };

  const BackToRolesButton = () => (
    <button
      type="button"
      onClick={handleBackToRoles}
      className="inline-flex items-center gap-2 px-3 py-2 -ml-1 mb-6 rounded-xl text-sm font-medium text-secondary-text hover:text-black dark:hover:text-white hover:bg-secondary-bg dark:hover:bg-dark-card transition-all group"
      aria-label="Back to role selection"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full border border-border dark:border-gray-700 bg-white dark:bg-dark-card group-hover:border-black dark:group-hover:border-white group-hover:shadow-sm transition-all">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      </span>
      <span>Select role</span>
    </button>
  );

  const renderCredentialFields = (compact = false) => {
    if (selectedRole === 'admin') {
      return (
        <>
          {!compact && (
            <div>
              <label className="label mb-1.5 block">Email Address</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field pl-10"
                  placeholder="admin@school.com"
                  required
                />
              </div>
            </div>
          )}
          <div>
            <label className="label mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input-field pl-10 pr-10"
                placeholder="Enter your password"
                required
                autoFocus={compact}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-secondary-text" />
                ) : (
                  <Eye className="w-5 h-5 text-secondary-text" />
                )}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (selectedRole === 'parent') {
      return (
        <div>
          <label className="label mb-1.5 block">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field pl-10"
              placeholder="e.g., 08012345678"
              required
            />
          </div>
        </div>
      );
    }

    return (
      <>
        {!compact && (
          <div>
            <label className="label mb-1.5 block">
              {selectedRole === 'teacher'
                ? 'Teacher ID'
                : selectedRole === 'principal'
                  ? 'Principal ID'
                  : selectedRole === 'counselor'
                    ? 'Counselor ID'
                    : 'Finance Officer ID'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
              <input
                type="text"
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                className="input-field pl-10"
                placeholder={
                  selectedRole === 'teacher'
                    ? 'TCH0001'
                    : selectedRole === 'principal'
                      ? 'PRN0001'
                      : selectedRole === 'counselor'
                        ? 'CNS0001'
                        : 'FIN0001'
                }
                required
              />
            </div>
          </div>
        )}
        <div>
          <label className="label mb-1.5 block">PIN</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input
              type="password"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              className="input-field pl-10"
              placeholder="Enter your PIN"
              maxLength={6}
              required
              autoFocus={compact}
            />
          </div>
        </div>
      </>
    );
  };

  const renderWelcomeScreen = () => {
    if (!remembered) return null;
    const identifier = getRememberedIdentifier(remembered);

    return (
      <motion.div
        key="welcome"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="space-y-6"
      >
        <div className="text-center">
          <p className="text-sm text-secondary-text dark:text-gray-400 mb-1">EduPulse</p>
          <h1 className="text-2xl font-semibold text-black dark:text-white">Sign in</h1>
        </div>

        <button
          type="button"
          onClick={handleWelcomeSignIn}
          disabled={loading}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-border dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold shrink-0 overflow-hidden">
            {remembered.photoUrl ? (
              <img
                src={remembered.photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              getInitialsFromName(remembered.fullName)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-black dark:text-white truncate">
              {remembered.fullName}
            </p>
            {identifier && (
              <p className="text-sm text-secondary-text dark:text-gray-400 truncate">
                {identifier}
              </p>
            )}
            <p className="text-xs text-secondary-text dark:text-gray-500 mt-0.5">
              {getRoleLabel()}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-secondary-text group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
        </button>

        {loading && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-secondary-text">Signing in…</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={handleUseAnotherAccount}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Use another account
          </button>
        </div>
      </motion.div>
    );
  };

  const renderCredentialsScreen = () => {
    if (!remembered) return null;

    return (
      <motion.div
        key="credentials"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold mx-auto mb-3 overflow-hidden">
            {remembered.photoUrl ? (
              <img src={remembered.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitialsFromName(remembered.fullName)
            )}
          </div>
          <h1 className="text-xl font-semibold text-black dark:text-white">
            {remembered.fullName}
          </h1>
          <p className="text-sm text-secondary-text dark:text-gray-400 mt-1">
            {getRememberedIdentifier(remembered)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {renderCredentialFields(true)}

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-secondary-text">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              setView('welcome');
              setError('');
              setForm((f) => ({ ...f, password: '', pin: '' }));
            }}
            className="inline-flex items-center gap-1.5 text-sm text-secondary-text hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-border dark:text-gray-700">|</span>
          <button
            type="button"
            onClick={handleUseAnotherAccount}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Use another account
          </button>
        </div>
      </motion.div>
    );
  };

  const renderFullForm = () => (
    <motion.div
      key="full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">
          {getRoleLabel()} Login
        </h1>
        <p className="text-secondary-text dark:text-gray-400">
          Enter your credentials to access your dashboard
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {renderCredentialFields(false)}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm text-secondary-text">Remember me</span>
          </label>
          {selectedRole === 'admin' && (
            <button type="button" className="text-sm text-black dark:text-white hover:underline">
              Forgot password?
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {selectedRole === 'admin' && (
        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-secondary-text">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-black dark:text-white font-medium hover:underline">
              Register your school
            </Link>
          </p>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="card">
          <BackToRolesButton />
          <AnimatePresence mode="wait">
            {view === 'welcome' && renderWelcomeScreen()}
            {view === 'credentials' && renderCredentialsScreen()}
            {view === 'full' && renderFullForm()}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
