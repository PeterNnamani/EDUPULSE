import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, ArrowRight, ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import {
  SCHOOL_TYPE_OPTIONS,
  formatSchoolTypesLabel,
  highestSchoolType,
  type SchoolType,
} from '@/config/schoolTypes';
import { generateStaffId } from '@/utils/schoolIdUtils';

const registerSchema = z.object({
  schoolName: z.string().min(2, 'School name is required'),
  schoolTypes: z
    .array(z.enum(['nursery', 'primary', 'secondary', 'tertiary']))
    .min(1, 'Select at least one school type'),
  schoolPhone: z.string().min(10, 'Valid phone number is required'),
  schoolEmail: z.string().email('Valid email is required'),
  schoolAddress: z.string().min(5, 'Address is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  adminFullName: z.string().min(2, 'Administrator name is required'),
  adminPhone: z.string().min(10, 'Valid phone number is required'),
  adminEmail: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export default function SchoolRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [schoolTypeOpen, setSchoolTypeOpen] = useState(false);
  const schoolTypeRef = useRef<HTMLDivElement>(null);
  const setUser = useAppStore((s) => s.setUser);
  const setSelectedRole = useAppStore((s) => s.setSelectedRole);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedRole('admin');
  }, [setSelectedRole]);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (schoolTypeRef.current && !schoolTypeRef.current.contains(event.target as Node)) {
        setSchoolTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      schoolTypes: [],
    },
  });

  const selectedSchoolTypes = watch('schoolTypes') ?? [];

  const toggleSchoolType = (type: SchoolType) => {
    const next = selectedSchoolTypes.includes(type)
      ? selectedSchoolTypes.filter((t) => t !== type)
      : [...selectedSchoolTypes, type];

    const ordered = SCHOOL_TYPE_OPTIONS.map((o) => o.value).filter((v) => next.includes(v));
    setValue('schoolTypes', ordered, { shouldValidate: true });
  };

  const goToAdminStep = async () => {
    const valid = await trigger([
      'schoolName',
      'schoolTypes',
      'schoolPhone',
      'schoolEmail',
      'schoolAddress',
      'state',
      'city',
    ]);
    if (valid) setStep(2);
  };

  const onSubmit = async (data: RegisterForm) => {
    setError('');
    setLoading(true);

    try {
      const adminEmail = data.adminEmail.trim();
      let authUserId: string | undefined;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: data.password,
      });

      if (authError) {
        const alreadyExists =
          authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already been registered');

        if (!alreadyExists) throw authError;

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: data.password,
        });

        if (signInError) throw signInError;
        authUserId = signInData.user?.id;
      } else {
        authUserId = authData.user?.id;
      }

      if (!authUserId) {
        throw new Error('Could not create or sign in to your admin account.');
      }

      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id, staff_id, school_id, full_name, phone')
        .eq('user_id', authUserId)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();

      if (existingStaff) {
        setSelectedRole('admin');
        setUser({
          id: authUserId,
          email: adminEmail,
          role: 'admin',
          schoolId: existingStaff.school_id,
          staffId: existingStaff.staff_id,
          fullName: existingStaff.full_name,
          phone: existingStaff.phone,
        });
        navigate('/admin');
        return;
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      let school: { id: string };

      const { data: existingSchool } = await supabase
        .from('schools')
        .select('id')
        .eq('email', data.schoolEmail.trim())
        .maybeSingle();

      if (existingSchool) {
        school = existingSchool;
      } else {
        const schoolRow = {
          name: data.schoolName,
          school_type: highestSchoolType(data.schoolTypes),
          phone: data.schoolPhone,
          email: data.schoolEmail,
          address: data.schoolAddress,
          state: data.state,
          city: data.city,
          trial_ends_at: trialEndsAt.toISOString(),
          subscription_status: 'trial',
        };

        let insertResult = await supabase
          .from('schools')
          .insert({ ...schoolRow, school_types: data.schoolTypes })
          .select('id')
          .single();

        if (
          insertResult.error &&
          (insertResult.error.code === 'PGRST204' ||
            insertResult.error.message?.includes('school_types'))
        ) {
          insertResult = await supabase.from('schools').insert(schoolRow).select('id').single();
        }

        if (insertResult.error) throw insertResult.error;
        school = insertResult.data!;
      }

      const { data: existingAdminStaff } = await supabase
        .from('staff')
        .select('id, staff_id')
        .eq('school_id', school.id)
        .eq('role', 'admin')
        .ilike('email', adminEmail)
        .maybeSingle();

      let staffId: string;

      if (existingAdminStaff) {
        staffId = existingAdminStaff.staff_id;
        const { error: staffUpdateError } = await supabase
          .from('staff')
          .update({
            user_id: authUserId,
            full_name: data.adminFullName,
            phone: data.adminPhone,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAdminStaff.id);

        if (staffUpdateError) throw staffUpdateError;
      } else {
        staffId = await generateStaffId(school.id, 'admin', 1);

        const { error: staffError } = await supabase.from('staff').insert({
          school_id: school.id,
          user_id: authUserId,
          staff_id: staffId,
          full_name: data.adminFullName,
          email: adminEmail,
          phone: data.adminPhone,
          role: 'admin',
          position: 'Administrator',
          is_active: true,
        });

        if (staffError) throw staffError;
      }

      const currentYear = new Date().getFullYear();
      const sessionName = `${currentYear}/${currentYear + 1}`;

      let session: { id: string } | null = null;

      const { data: existingSession } = await supabase
        .from('academic_sessions')
        .select('id')
        .eq('school_id', school.id)
        .eq('is_current', true)
        .maybeSingle();

      if (existingSession) {
        session = existingSession;
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('academic_sessions')
          .insert({
            school_id: school.id,
            name: sessionName,
            start_date: `${currentYear}-09-01`,
            end_date: `${currentYear + 1}-07-31`,
            is_current: true,
          })
          .select('id')
          .single();

        if (sessionError) throw sessionError;
        session = newSession;
      }

      if (session) {
        const terms = [
          { name: 'First Term', term_number: 1, start: `${currentYear}-09-01`, end: `${currentYear}-12-15` },
          { name: 'Second Term', term_number: 2, start: `${currentYear + 1}-01-10`, end: `${currentYear + 1}-04-10` },
          { name: 'Third Term', term_number: 3, start: `${currentYear + 1}-04-25`, end: `${currentYear + 1}-07-31` },
        ];

        for (const term of terms) {
          await supabase
            .from('academic_terms')
            .insert({
              school_id: school.id,
              session_id: session.id,
              name: term.name,
              term_number: term.term_number,
              start_date: term.start,
              end_date: term.end,
              is_current: term.term_number === 1,
            });
        }
      }

      const { data: existingSettings } = await supabase
        .from('school_settings')
        .select('id')
        .eq('school_id', school.id)
        .maybeSingle();

      if (!existingSettings) {
        const { error: settingsError } = await supabase
          .from('school_settings')
          .insert({ school_id: school.id });

        if (settingsError) throw settingsError;
      }

      setSelectedRole('admin');
      setUser({
        id: authUserId,
        email: adminEmail,
        role: 'admin',
        schoolId: school.id,
        staffId,
        fullName: data.adminFullName,
        phone: data.adminPhone,
      });

      navigate('/admin');
    } catch (err) {
      console.error('Registration error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-secondary-bg dark:bg-dark-card mx-auto mb-4 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-black dark:text-white" />
            </div>
            <h1 className="text-2xl font-bold text-black dark:text-white mb-2">
              Register Your School
            </h1>
            <p className="text-secondary-text dark:text-gray-400">
              Create your school workspace and get started with a 30-day free trial
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                      s === step
                        ? 'bg-black dark:bg-white text-white dark:text-black'
                        : s < step
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 text-secondary-text'
                    }`}
                  >
                    {s < step ? '✓' : s}
                  </div>
                  {s < 2 && (
                    <div className={`w-24 h-1 ${s < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-8">
              <span className="text-xs text-secondary-text">School Info</span>
              <span className="text-xs text-secondary-text">Admin Info</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label mb-1.5 block">School Name</label>
                    <input
                      {...register('schoolName')}
                      className="input-field"
                      placeholder="e.g., Wisdom International School"
                    />
                    {errors.schoolName && (
                      <p className="text-xs text-red-500 mt-1">{errors.schoolName.message}</p>
                    )}
                  </div>

                  <div className="relative" ref={schoolTypeRef}>
                    <label className="label mb-1.5 block">School Type</label>
                    <button
                      type="button"
                      onClick={() => setSchoolTypeOpen((open) => !open)}
                      className="input-field w-full flex items-center justify-between gap-2 text-left"
                      aria-expanded={schoolTypeOpen}
                      aria-haspopup="listbox"
                    >
                      <span
                        className={`truncate ${
                          selectedSchoolTypes.length === 0 ? 'text-secondary-text' : ''
                        }`}
                      >
                        {formatSchoolTypesLabel(selectedSchoolTypes)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 text-secondary-text transition-transform ${
                          schoolTypeOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {schoolTypeOpen && (
                      <div
                        role="listbox"
                        className="absolute z-30 mt-1 w-full rounded-xl border border-border dark:border-dark-border bg-white dark:bg-dark-card shadow-elevated dark:shadow-dark-elevated overflow-hidden"
                      >
                        <p className="px-3 py-2 text-[11px] text-secondary-text border-b border-border dark:border-dark-border">
                          Select all levels offered (lowest to highest)
                        </p>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {SCHOOL_TYPE_OPTIONS.map((option) => {
                            const checked = selectedSchoolTypes.includes(option.value);
                            return (
                              <label
                                key={option.value}
                                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-secondary-bg dark:bg-dark-elevated'
                                    : 'hover:bg-secondary-bg/70 dark:hover:bg-dark-elevated/70'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => toggleSchoolType(option.value)}
                                />
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    checked
                                      ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                                      : 'border-border dark:border-dark-border'
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                <span className="min-w-0 text-sm text-black dark:text-white">
                                  {option.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {errors.schoolTypes && (
                      <p className="text-xs text-red-500 mt-1">{errors.schoolTypes.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">School Phone</label>
                    <input
                      {...register('schoolPhone')}
                      className="input-field"
                      placeholder="08012345678"
                    />
                    {errors.schoolPhone && (
                      <p className="text-xs text-red-500 mt-1">{errors.schoolPhone.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="label mb-1.5 block">School Email</label>
                    <input
                      type="email"
                      {...register('schoolEmail')}
                      className="input-field"
                      placeholder="school@example.com"
                    />
                    {errors.schoolEmail && (
                      <p className="text-xs text-red-500 mt-1">{errors.schoolEmail.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="label mb-1.5 block">School Address</label>
                    <input
                      {...register('schoolAddress')}
                      className="input-field"
                      placeholder="Full address"
                    />
                    {errors.schoolAddress && (
                      <p className="text-xs text-red-500 mt-1">{errors.schoolAddress.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">State</label>
                    <select {...register('state')} className="input-field">
                      <option value="">Select State</option>
                      {nigerianStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {errors.state && (
                      <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">City</label>
                    <input
                      {...register('city')}
                      className="input-field"
                      placeholder="City"
                    />
                    {errors.city && (
                      <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void goToAdminStep()}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label mb-1.5 block">Administrator Full Name</label>
                    <input
                      {...register('adminFullName')}
                      className="input-field"
                      placeholder="John Doe"
                    />
                    {errors.adminFullName && (
                      <p className="text-xs text-red-500 mt-1">{errors.adminFullName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">Administrator Phone</label>
                    <input
                      {...register('adminPhone')}
                      className="input-field"
                      placeholder="08012345678"
                    />
                    {errors.adminPhone && (
                      <p className="text-xs text-red-500 mt-1">{errors.adminPhone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">Administrator Email</label>
                    <input
                      type="email"
                      {...register('adminEmail')}
                      className="input-field"
                      placeholder="admin@school.com"
                    />
                    {errors.adminEmail && (
                      <p className="text-xs text-red-500 mt-1">{errors.adminEmail.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">Password</label>
                    <input
                      type="password"
                      {...register('password')}
                      className="input-field"
                      placeholder="Min 8 characters"
                    />
                    {errors.password && (
                      <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label mb-1.5 block">Confirm Password</label>
                    <input
                      type="password"
                      {...register('confirmPassword')}
                      className="input-field"
                      placeholder="Re-enter password"
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-secondary-text">
              Already have an account?{' '}
              <Link to="/login" className="text-black dark:text-white font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
