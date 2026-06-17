import { supabase } from '@/lib/supabase';
import { extractParentPhones, normalizePhone } from '@/utils/phoneUtils';
import { generateStudentId, getNextStudentSequence } from '@/utils/schoolIdUtils';
import { checkStudentLimit } from '@/services/studentService';
import type { ParsedStudentRow } from './columnMap';
import {
  ensureClassForCode,
  loadSchoolClasses,
  type SchoolClass,
} from './classResolver';
import {
  buildStudentDuplicateIndex,
  rememberStudentInSession,
  resolveStudentDuplicate,
} from './duplicateMatch';

export interface ImportRowError {
  rowIndex: number;
  message: string;
}

export interface StudentImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

type ProgressFn = (done: number, total: number) => void;

async function findParentByPhones(
  schoolId: string,
  fatherPhone?: string,
  motherPhone?: string
): Promise<string | null> {
  const targets = [fatherPhone, motherPhone].filter(Boolean) as string[];
  if (!targets.length) return null;

  const { data: parents } = await supabase
    .from('parents')
    .select('id, primary_phone, father_phone, mother_phone, guardian_phone, secondary_phone')
    .eq('school_id', schoolId);

  for (const parent of parents ?? []) {
    const phones = extractParentPhones(parent);
    if (targets.some((t) => phones.includes(t))) return parent.id;
  }
  return null;
}

async function upsertParentForStudent(
  schoolId: string,
  row: ParsedStudentRow
): Promise<string | null> {
  const fatherPhone = row.fatherPhone ? normalizePhone(row.fatherPhone) ?? undefined : undefined;
  const motherPhone = row.motherPhone ? normalizePhone(row.motherPhone) ?? undefined : undefined;
  if (!fatherPhone && !motherPhone) return null;

  let parentId = await findParentByPhones(schoolId, fatherPhone, motherPhone);

  const payload = {
    father_name: row.fatherName ?? null,
    father_phone: fatherPhone ?? null,
    father_email: row.fatherEmail ?? null,
    mother_name: row.motherName ?? null,
    mother_phone: motherPhone ?? null,
    primary_phone: fatherPhone ?? motherPhone ?? null,
    secondary_phone:
      fatherPhone && motherPhone && fatherPhone !== motherPhone ? motherPhone : null,
    address: row.fatherAddress ?? row.motherAddress ?? null,
    email: row.fatherEmail ?? null,
    is_active: true,
  };

  if (parentId) {
    await supabase
      .from('parents')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', parentId);
  } else {
    const { data, error } = await supabase
      .from('parents')
      .insert({ school_id: schoolId, ...payload })
      .select('id')
      .single();
    if (error || !data) return null;
    parentId = data.id;
  }

  return parentId;
}

async function linkStudentParent(
  studentId: string,
  parentId: string,
  row: ParsedStudentRow
): Promise<void> {
  const relationship = row.fatherPhone ? 'father' : row.motherPhone ? 'mother' : 'guardian';

  await supabase.from('student_parents').delete().eq('student_id', studentId);

  await supabase.from('student_parents').upsert(
    {
      student_id: studentId,
      parent_id: parentId,
      relationship,
      is_primary: true,
    },
    { onConflict: 'student_id,parent_id' }
  );
}

const studentUpdatePayload = (row: ParsedStudentRow, classId: string) => ({
  first_name: row.firstName,
  last_name: row.lastName,
  middle_name: row.middleName ?? null,
  date_of_birth: row.dateOfBirth ?? null,
  gender: row.gender ?? null,
  state_of_origin: row.stateOfOrigin ?? null,
  religion: row.religion ?? null,
  blood_group: row.bloodGroup ?? null,
  genotype: row.genotype ?? null,
  medical_conditions: row.disability ?? null,
  class_id: classId,
  status: 'active' as const,
  updated_at: new Date().toISOString(),
});

export async function bulkImportStudents(
  schoolId: string,
  rows: ParsedStudentRow[],
  onProgress?: ProgressFn
): Promise<StudentImportResult> {
  const result: StudentImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  if (!rows.length) return result;

  const duplicateIndex = await buildStudentDuplicateIndex(schoolId);
  const sessionByKey = new Map<string, string>();

  const limit = await checkStudentLimit(schoolId);
  const classCache = new Map<string, SchoolClass>();
  const existingClasses = await loadSchoolClasses(schoolId);
  existingClasses.forEach((c) => {
    classCache.set(c.name.toUpperCase().replace(/\s/g, ''), c);
  });

  let newNeeded = 0;
  const quotaSession = new Map<string, string>();
  for (const row of rows) {
    if (!resolveStudentDuplicate(duplicateIndex, quotaSession, row)) {
      newNeeded++;
      rememberStudentInSession(quotaSession, `quota-${row.rowIndex}`, row);
    }
  }

  if (Number.isFinite(limit.max) && limit.current + newNeeded > limit.max) {
    throw new Error(
      `Import would exceed your ${limit.planName} plan limit (${limit.max} students). ` +
        `You have ${limit.current} active students and the file adds ${newNeeded} new.`
    );
  }

  let done = 0;
  for (const row of rows) {
    done++;
    onProgress?.(done, rows.length);

    try {
      const classRow = await ensureClassForCode(schoolId, row.classCode, classCache);
      if (!classRow) {
        result.errors.push({ rowIndex: row.rowIndex, message: `Class not found: ${row.classCode}` });
        result.skipped++;
        continue;
      }

      const existingId = resolveStudentDuplicate(duplicateIndex, sessionByKey, row);

      if (existingId) {
        const { error } = await supabase
          .from('students')
          .update(studentUpdatePayload(row, classRow.id))
          .eq('id', existingId);

        if (error) throw new Error(error.message);

        const parentId = await upsertParentForStudent(schoolId, row);
        if (parentId) await linkStudentParent(existingId, parentId, row);

        rememberStudentInSession(sessionByKey, existingId, row);
        result.updated++;
      } else {
        const seq = await getNextStudentSequence(schoolId);
        const studentId = await generateStudentId(schoolId, seq);

        const { data: created, error } = await supabase
          .from('students')
          .insert({
            school_id: schoolId,
            student_id: studentId,
            ...studentUpdatePayload(row, classRow.id),
            admission_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (error || !created) throw new Error(error?.message ?? 'Insert failed');

        const parentId = await upsertParentForStudent(schoolId, row);
        if (parentId) await linkStudentParent(created.id, parentId, row);

        rememberStudentInSession(sessionByKey, created.id, row);

        import('@/services/feeAssignmentService').then(({ feeAssignmentService }) => {
          void feeAssignmentService.assignFeesForStudent(
            schoolId,
            created.id,
            classRow.id,
            'registration'
          );
        });

        result.created++;
      }
    } catch (e) {
      result.errors.push({
        rowIndex: row.rowIndex,
        message: e instanceof Error ? e.message : 'Unknown error',
      });
      result.skipped++;
    }
  }

  return result;
}
