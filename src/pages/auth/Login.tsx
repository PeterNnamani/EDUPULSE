import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, User, Lock, Phone } from 'lucide-react';
import { useAppStore } from '@/store';
import { adminLogin, staffLogin, parentLogin } from '@/services/authService';
import type { UserRole } from '@/types';
import { unlockNotificationAudio } from '@/utils/playNotificationSound';

export default function Login() {
  const selectedRole = useAppStore((s) => s.selectedRole);
  const setUser = useAppStore((s) => s.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    staffId: '',
    pin: '',
    phone: '',
    rememberMe: false,
  });

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



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    unlockNotificationAudio();

    try {
      if (selectedRole === 'admin') {
        const response = await adminLogin(form.email, form.password);

        if (!response.success) {
          setError(response.error || 'Login failed');
          setLoading(false);
          return;
        }

        if (response.user) {
          setUser({
            id: response.user.id,
            email: response.user.email,
            role: 'admin',
            schoolId: response.user.schoolId,
            staffId: response.user.staffId,
            fullName: response.user.fullName,
            phone: response.user.phone,
            photoUrl: response.user.photoUrl,
          });
        }
      } else if (selectedRole === 'parent') {
        const response = await parentLogin(form.phone);

        if (!response.success) {
          setError(response.error || 'Login failed');
          setLoading(false);
          return;
        }

        if (response.user) {
          setUser({
            id: response.user.id,
            role: 'parent',
            schoolId: response.user.schoolId,
            fullName: response.user.fullName,
            phone: response.user.phone,
            children: response.user.children,
          });
        }
      } else {
        const response = await staffLogin(form.staffId, form.pin, selectedRole);

        if (!response.success) {
          setError(response.error || 'Login failed');
          setLoading(false);
          return;
        }

        if (response.user) {
          setUser({
            id: response.user.id,
            role: selectedRole as UserRole,
            schoolId: response.user.schoolId,
            staffId: response.user.staffId,
            fullName: response.user.fullName,
            phone: response.user.phone,
            photoUrl: response.user.photoUrl,
          });
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderRoleSpecificFields = () => {
    if (selectedRole === 'admin') {
      return (
        <>
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
        <div>
          <label className="label mb-1.5 block">
            {selectedRole === 'teacher' ? 'Teacher ID' : selectedRole === 'principal' ? 'Principal ID' : selectedRole === 'counselor' ? 'Counselor ID' : 'Finance Officer ID'}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input
              type="text"
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              className="input-field pl-10"
              placeholder={selectedRole === 'teacher' ? 'TCH0001' : selectedRole === 'principal' ? 'PRN0001' : selectedRole === 'counselor' ? 'CNS0001' : 'FIN0001'}
              required
            />
          </div>
        </div>
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
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="card">
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
            {renderRoleSpecificFields()}

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
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                Don't have an account?{' '}
                <a href="/register" className="text-black dark:text-white font-medium hover:underline">
                  Register your school
                </a>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
