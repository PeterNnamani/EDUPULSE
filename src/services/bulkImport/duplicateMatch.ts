import { supabase } from '@/lib/supabase';
import { extractParentPhones, normalizePhone } from '@/utils/phoneUtils';

export function normalizeNamePart(value: string | null | undefined): string {
  const s = (value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s || s === '.' || s === '--') return '';
  return s;
}

export function nameKeys(
  firstName: string,
  lastName: string,
  middleName?: string | null
): string[] {
  const last = normalizeNamePart(lastName);
  const first = normalizeNamePart(firstName);
  const middle = normalizeNamePart(middleName);
  if (!last && !first) return [];

  const keys = new Set<string>();
  keys.add(`${last}|${first}|${middle}`);
  keys.add(`${last}|${first}|`);
  if (middle) keys.add(`${last}|${first}|${middle.charAt(0)}`);
  return [...keys];
}

export interface StudentDuplicateIndex {
  byNameKey: Map<string, string>;
  byPhoneAndName: Map<string, string>;
}

export async function buildStudentDuplicateIndex(
  schoolId: string
): Promise<StudentDuplicateIndex> {
  const byNameKey = new Map<string, string>();
  const byPhoneAndName = new Map<string, string>();

  const [{ data: students }, { data: links }, { data: parents }] = await Promise.all([
    supabase
      .from('students')
      .select('id, first_name, last_name, middle_name')
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase.from('student_parents').select('student_id, parent_id'),
    supabase
      .from('parents')
      .select('id, father_phone, mother_phone, primary_phone, secondary_phone, guardian_phone')
      .eq('school_id', schoolId),
  ]);

  const phonesByParentId = new Map<string, string[]>();
  for (const parent of parents ?? []) {
    phonesByParentId.set(parent.id, extractParentPhones(parent));
  }

  const phonesByStudentId = new Map<string, Set<string>>();
  for (const link of links ?? []) {
    const set = phonesByStudentId.get(link.student_id) ?? new Set<string>();
    for (const phone of phonesByParentId.get(link.parent_id) ?? []) {
      set.add(phone);
    }
    phonesByStudentId.set(link.student_id, set);
  }

  for (const student of students ?? []) {
    for (const key of nameKeys(student.first_name, student.last_name, student.middle_name)) {
      if (!byNameKey.has(key)) byNameKey.set(key, student.id);
    }

    const last = normalizeNamePart(student.last_name);
    const first = normalizeNamePart(student.first_name);
    const phones = phonesByStudentId.get(student.id);
    if (!phones || !last || !first) continue;

    for (const phone of phones) {
      const phoneKey = `${phone}|${last}|${first}`;
      if (!byPhoneAndName.has(phoneKey)) byPhoneAndName.set(phoneKey, student.id);
    }
  }

  return { byNameKey, byPhoneAndName };
}

export function resolveStudentDuplicate(
  index: StudentDuplicateIndex,
  sessionByKey: Map<string, string>,
  row: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    fatherPhone?: string | null;
    motherPhone?: string | null;
  }
): string | null {
  const keys = nameKeys(row.firstName, row.lastName, row.middleName);

  for (const key of keys) {
    const sessionId = sessionByKey.get(key);
    if (sessionId) return sessionId;

    const dbId = index.byNameKey.get(key);
    if (dbId) return dbId;
  }

  const last = normalizeNamePart(row.lastName);
  const first = normalizeNamePart(row.firstName);
  if (!last || !first) return null;

  const phones = [row.fatherPhone, row.motherPhone]
    .map((p) => (p ? normalizePhone(p) : null))
    .filter(Boolean) as string[];

  for (const phone of phones) {
    const phoneKey = `${phone}|${last}|${first}`;
    const sessionPhoneKey = `phone:${phoneKey}`;
    const sessionId = sessionByKey.get(sessionPhoneKey);
    if (sessionId) return sessionId;

    const dbId = index.byPhoneAndName.get(phoneKey);
    if (dbId) return dbId;
  }

  return null;
}

export function rememberStudentInSession(
  sessionByKey: Map<string, string>,
  studentId: string,
  row: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    fatherPhone?: string | null;
    motherPhone?: string | null;
  }
): void {
  for (const key of nameKeys(row.firstName, row.lastName, row.middleName)) {
    sessionByKey.set(key, studentId);
  }

  const last = normalizeNamePart(row.lastName);
  const first = normalizeNamePart(row.firstName);
  const phones = [row.fatherPhone, row.motherPhone]
    .map((p) => (p ? normalizePhone(p) : null))
    .filter(Boolean) as string[];

  for (const phone of phones) {
    sessionByKey.set(`phone:${phone}|${last}|${first}`, studentId);
  }
}

export interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: string;
  department: string | null;
  pin: string | null;
}

export async function findExistingStaff(
  schoolId: string,
  row: { fullName: string; email?: string; phone: string }
): Promise<StaffRow | null> {
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, staff_id, full_name, email, phone, role, department, pin')
    .eq('school_id', schoolId)
    .eq('is_active', true);

  if (!staffList?.length) return null;

  const targetPhone = normalizePhone(row.phone);
  const targetEmail = row.email?.trim().toLowerCase() ?? '';
  const targetName = row.fullName.trim().toUpperCase();

  if (targetPhone) {
    const byPhone = staffList.find((s) => normalizePhone(s.phone) === targetPhone);
    if (byPhone) return byPhone as StaffRow;
  }

  if (targetEmail) {
    const byEmail = staffList.find((s) => (s.email ?? '').trim().toLowerCase() === targetEmail);
    if (byEmail) return byEmail as StaffRow;
  }

  const byName = staffList.find((s) => s.full_name.trim().toUpperCase() === targetName);
  return (byName as StaffRow) ?? null;
}
