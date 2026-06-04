import { supabase } from '@/lib/supabase';

export interface SchoolProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  passMark: number;
  gradeA: number;
  gradeB: number;
  attendanceWarning: number;
  attendanceCritical: number;
  timezone: string;
  currency: string;
}

export interface SchoolProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  passMark?: number;
  gradeA?: number;
  gradeB?: number;
  attendanceWarning?: number;
  attendanceCritical?: number;
  timezone?: string;
  currency?: string;
}

export async function fetchSchoolProfile(schoolId: string): Promise<SchoolProfile | null> {
  const [{ data: school }, { data: settings }] = await Promise.all([
    supabase.from('schools').select('name, email, phone, city, state').eq('id', schoolId).single(),
    supabase
      .from('school_settings')
      .select(
        'grade_pass_mark, grade_a, grade_b, attendance_threshold_warning, attendance_threshold_critical, timezone, currency'
      )
      .eq('school_id', schoolId)
      .maybeSingle(),
  ]);

  if (!school) return null;

  return {
    name: school.name,
    email: school.email,
    phone: school.phone ?? '',
    city: school.city,
    state: school.state,
    passMark: Number(settings?.grade_pass_mark ?? 40),
    gradeA: Number(settings?.grade_a ?? 70),
    gradeB: Number(settings?.grade_b ?? 60),
    attendanceWarning: settings?.attendance_threshold_warning ?? 80,
    attendanceCritical: settings?.attendance_threshold_critical ?? 60,
    timezone: settings?.timezone ?? 'Africa/Lagos',
    currency: settings?.currency ?? 'NGN',
  };
}

export async function updateSchoolProfile(
  schoolId: string,
  update: SchoolProfileUpdate
): Promise<{ success: boolean; error?: string }> {
  try {
    if (update.name !== undefined || update.email !== undefined || update.phone !== undefined) {
      const { error } = await supabase
        .from('schools')
        .update({
          ...(update.name !== undefined && { name: update.name }),
          ...(update.email !== undefined && { email: update.email }),
          ...(update.phone !== undefined && { phone: update.phone }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', schoolId);

      if (error) return { success: false, error: error.message };
    }

    const settingsPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (update.passMark !== undefined) settingsPayload.grade_pass_mark = update.passMark;
    if (update.gradeA !== undefined) settingsPayload.grade_a = update.gradeA;
    if (update.gradeB !== undefined) settingsPayload.grade_b = update.gradeB;
    if (update.attendanceWarning !== undefined) {
      settingsPayload.attendance_threshold_warning = update.attendanceWarning;
    }
    if (update.attendanceCritical !== undefined) {
      settingsPayload.attendance_threshold_critical = update.attendanceCritical;
    }
    if (update.timezone !== undefined) settingsPayload.timezone = update.timezone;
    if (update.currency !== undefined) settingsPayload.currency = update.currency;

    if (Object.keys(settingsPayload).length > 1) {
      const { data: existing } = await supabase
        .from('school_settings')
        .select('id')
        .eq('school_id', schoolId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('school_settings')
          .update(settingsPayload)
          .eq('school_id', schoolId);
        if (error) return { success: false, error: error.message };
      } else {
        const { error } = await supabase
          .from('school_settings')
          .insert({ school_id: schoolId, ...settingsPayload });
        if (error) return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Update failed' };
  }
}

export async function fetchStaffProfile(
  staffId: string,
  schoolId: string
): Promise<{
  staffId: string;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
} | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id, full_name, role, email, phone')
    .eq('id', staffId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    staffId: data.staff_id,
    fullName: data.full_name,
    role: data.role,
    email: data.email,
    phone: data.phone,
  };
}
