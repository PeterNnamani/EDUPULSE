import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, User, Lock, Phone } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

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

  const handleDemoLogin = () => {
    setError('');
    setLoading(true);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      const demoUsers = {
        admin: {
          id: 'demo-admin-001',
          email: 'admin@demo.school',
          role: 'admin' as UserRole,
          schoolId: 'demo-school-001',
          staffId: 'ADM0001',
          fullName: 'Admin Demo User',
          phone: '+234 800 000 0001',
          photoUrl: null,
        },
        teacher: {
          id: 'demo-teacher-001',
          email: 'teacher@demo.school',
          role: 'teacher' as UserRole,
          schoolId: 'demo-school-001',
          staffId: 'TCH0001',
          fullName: 'Teacher Demo User',
          phone: '+234 800 000 0002',
          photoUrl: null,
        },
        principal: {
          id: 'demo-principal-001',
          email: 'principal@demo.school',
          role: 'principal' as UserRole,
          schoolId: 'demo-school-001',
          staffId: 'PRN0001',
          fullName: 'Principal Demo User',
          phone: '+234 800 000 0003',
          photoUrl: null,
        },
        counselor: {
          id: 'demo-counselor-001',
          email: 'counselor@demo.school',
          role: 'counselor' as UserRole,
          schoolId: 'demo-school-001',
          staffId: 'CNS0001',
          fullName: 'Counselor Demo User',
          phone: '+234 800 000 0004',
          photoUrl: null,
        },
        finance: {
          id: 'demo-finance-001',
          email: 'finance@demo.school',
          role: 'finance' as UserRole,
          schoolId: 'demo-school-001',
          staffId: 'FIN0001',
          fullName: 'Finance Officer Demo User',
          phone: '+234 800 000 0005',
          photoUrl: null,
        },
        parent: {
          id: 'demo-parent-001',
          role: 'parent' as UserRole,
          schoolId: 'demo-school-001',
          fullName: 'Parent Demo User',
          phone: '+234 800 000 0006',
          photoUrl: null,
        },
      };

      const demoUser = demoUsers[selectedRole as keyof typeof demoUsers];
      if (demoUser) {
        setUser(demoUser);
      }
      setLoading(false);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (selectedRole === 'admin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

        if (authError) throw authError;

        if (data.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('*, schools(*)')
            .eq('email', form.email)
            .maybeSingle();

          if (staffData) {
            setUser({
              id: data.user.id,
              email: form.email,
              role: 'admin',
              schoolId: staffData.school_id,
              staffId: staffData.staff_id,
              fullName: staffData.full_name,
              phone: staffData.phone,
              photoUrl: staffData.photo_url,
            });
          }
        }
      } else if (selectedRole === 'parent') {
        const { data: parentData, error: parentError } = await supabase
          .from('parents')
          .select('*, schools(*)')
          .eq('primary_phone', form.phone)
          .maybeSingle();

        if (parentError) throw parentError;

        if (parentData) {
          setUser({
            id: parentData.id,
            role: 'parent',
            schoolId: parentData.school_id,
            fullName: parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent',
            phone: form.phone,
          });
        } else {
          setError('No account found with this phone number');
        }
      } else {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*, schools(*)')
          .eq('staff_id', form.staffId)
          .eq('pin', form.pin)
          .eq('role', selectedRole)
          .maybeSingle();

        if (staffError) throw staffError;

        if (staffData) {
          setUser({
            id: staffData.id,
            role: selectedRole as UserRole,
            schoolId: staffData.school_id,
            staffId: staffData.staff_id,
            fullName: staffData.full_name,
            phone: staffData.phone,
            photoUrl: staffData.photo_url,
          });
        } else {
          setError('Invalid Staff ID or PIN');
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

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="btn-secondary w-full flex items-center justify-center gap-2 border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Demo Login
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
