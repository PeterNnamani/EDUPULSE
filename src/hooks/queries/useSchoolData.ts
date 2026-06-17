import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getStudents } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import { unwrapJoin } from '@/utils/displayUtils';

/**
 * Centralized, cached data hooks for the heavy school-wide datasets.
 *
 * These wrap the exact same Supabase queries the pages used to run inline, but
 * route them through React Query so that:
 *  - data is prefetched once at login (see {@link prefetchSchoolData})
 *  - navigating between menus reads from cache instead of refetching
 *  - mutations invalidate the relevant keys to stay correct
 */

export type RichClass = {
  id: string;
  name: string;
  grade_level: string;
  section?: string | null;
  class_teacher_id: string | null;
  class_teacher_name?: string;
};

export type ClassSubjectRow = {
  teacher_id: string | null;
  class_id: string;
  subject_id: string;
  classes?: { id: string; name: string; grade_level?: string } | null;
  subjects?: { id: string; name: string } | null;
};

export type SubjectRow = { id: string; name: string };

export const schoolKeys = {
  students: (schoolId: string) => ['students', schoolId] as const,
  staff: (schoolId: string) => ['staff', schoolId] as const,
  classes: (schoolId: string) => ['classes', schoolId] as const,
  classesRich: (schoolId: string) => ['classes-rich', schoolId] as const,
  subjects: (schoolId: string) => ['subjects', schoolId] as const,
  staffSubjects: (schoolId: string) => ['staff-subjects', schoolId] as const,
  classSubjects: (schoolId: string) => ['class-subjects', schoolId] as const,
};

// ---- Fetchers (shared by hooks and prefetch) ----

export async function fetchStaffList(schoolId: string) {
  const { data, error } = await supabase
    .from('staff')
    .select(
      'id, user_id, staff_id, full_name, email, phone, role, department, is_active, pin, created_at'
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchClassesRich(schoolId: string): Promise<RichClass[]> {
  const { data, error } = await supabase
    .from('classes')
    .select(
      `
        id,
        name,
        grade_level,
        section,
        class_teacher_id,
        staff!class_teacher_id(full_name)
      `
    )
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map((cls: any) => ({
    id: cls.id,
    name: cls.name,
    grade_level: cls.grade_level,
    section: cls.section,
    class_teacher_id: cls.class_teacher_id,
    class_teacher_name: unwrapJoin<{ full_name?: string }>(cls.staff)?.full_name,
  }));
}

export async function fetchSubjectsList(schoolId: string): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data as SubjectRow[]) || [];
}

export async function fetchStaffSubjectsMap(
  schoolId: string
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('staff_subjects')
    .select('staff_id, subject_id')
    .eq('school_id', schoolId);
  if (error) throw error;
  const mapping: Record<string, string[]> = {};
  (data || []).forEach((record: any) => {
    if (!mapping[record.staff_id]) mapping[record.staff_id] = [];
    mapping[record.staff_id].push(record.subject_id);
  });
  return mapping;
}

export async function fetchClassSubjectRows(
  schoolId: string
): Promise<ClassSubjectRow[]> {
  const { data, error } = await supabase
    .from('class_subjects')
    .select(
      'teacher_id, class_id, subject_id, classes(id, name, grade_level), subjects(id, name)'
    )
    .eq('school_id', schoolId);
  if (error) throw error;
  return (data as unknown as ClassSubjectRow[]) || [];
}

// ---- Hooks ----

export function useStudents(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.students(schoolId || ''),
    queryFn: () => getStudents(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useStaff(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.staff(schoolId || ''),
    queryFn: () => fetchStaffList(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useClasses(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.classes(schoolId || ''),
    queryFn: () => getClasses(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useClassesRich(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.classesRich(schoolId || ''),
    queryFn: () => fetchClassesRich(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useSubjects(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.subjects(schoolId || ''),
    queryFn: () => fetchSubjectsList(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useStaffSubjects(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.staffSubjects(schoolId || ''),
    queryFn: () => fetchStaffSubjectsMap(schoolId as string),
    enabled: !!schoolId,
  });
}

export function useClassSubjects(schoolId?: string) {
  return useQuery({
    queryKey: schoolKeys.classSubjects(schoolId || ''),
    queryFn: () => fetchClassSubjectRows(schoolId as string),
    enabled: !!schoolId,
  });
}

/**
 * Warm the cache for every heavy dataset in parallel. Called once right after
 * login (and on a warm boot when already authenticated) so that opening any
 * menu reads from cache instead of issuing a fresh round-trip.
 */
export function prefetchSchoolData(queryClient: QueryClient, schoolId?: string) {
  if (!schoolId) return;
  // Fire all in parallel; ignore individual failures so one slow query does not
  // block the rest from warming.
  void Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: schoolKeys.students(schoolId),
      queryFn: () => getStudents(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.staff(schoolId),
      queryFn: () => fetchStaffList(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.classes(schoolId),
      queryFn: () => getClasses(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.classesRich(schoolId),
      queryFn: () => fetchClassesRich(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.subjects(schoolId),
      queryFn: () => fetchSubjectsList(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.staffSubjects(schoolId),
      queryFn: () => fetchStaffSubjectsMap(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.classSubjects(schoolId),
      queryFn: () => fetchClassSubjectRows(schoolId),
    }),
  ]);
}
