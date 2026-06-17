import { supabase } from '@/lib/supabase';
import { getCurrentTerm } from '@/utils/calendarUtils';

/**
 * Subject-teacher assignments live in `class_subjects(class_id, subject_id,
 * teacher_id, academic_term_id)` with UNIQUE(class_id, subject_id,
 * academic_term_id). This means a single class can have many teachers, each
 * teaching a different subject. `classes.class_teacher_id` remains the single
 * form/class teacher and is intentionally NOT touched here.
 */

interface AssignSubjectTeacherParams {
  schoolId: string;
  classId: string;
  teacherId: string;
  subjectIds: string[];
  /** Optional explicit term; resolved from the current term when omitted. */
  academicTermId?: string | null;
}

interface AssignResult {
  success: boolean;
  error?: string;
}

async function resolveTermId(
  schoolId: string,
  explicit?: string | null
): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  try {
    const term = await getCurrentTerm(schoolId);
    return term?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Assign `teacherId` as the teacher of each given subject within a class.
 * Existing rows for the same (class, subject, term) are updated; missing ones
 * are inserted. Other subjects' teachers in the same class are left untouched,
 * so two different teachers can coexist on one class.
 */
export async function assignSubjectTeacher(
  params: AssignSubjectTeacherParams
): Promise<AssignResult> {
  const { schoolId, classId, teacherId, subjectIds } = params;
  if (!schoolId || !classId || !teacherId || subjectIds.length === 0) {
    return { success: false, error: 'Missing class, teacher, or subject selection.' };
  }

  try {
    const termId = await resolveTermId(schoolId, params.academicTermId);

    for (const subjectId of subjectIds) {
      let existingQuery = supabase
        .from('class_subjects')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId);

      existingQuery = termId
        ? existingQuery.eq('academic_term_id', termId)
        : existingQuery.is('academic_term_id', null);

      const { data: existing, error: findError } = await existingQuery.maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('class_subjects')
          .update({ teacher_id: teacherId })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('class_subjects').insert({
          school_id: schoolId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          academic_term_id: termId,
        });
        if (insertError) throw insertError;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[teachingAssignmentService] assignSubjectTeacher failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign subject teacher.',
    };
  }
}

/**
 * Clear the teacher for the given subjects in a class (sets teacher_id = null,
 * keeping the subject available on the class).
 */
export async function unassignSubjectTeacher(
  params: AssignSubjectTeacherParams
): Promise<AssignResult> {
  const { schoolId, classId, subjectIds } = params;
  if (!schoolId || !classId || subjectIds.length === 0) {
    return { success: false, error: 'Missing class or subject selection.' };
  }

  try {
    const termId = await resolveTermId(schoolId, params.academicTermId);

    let query = supabase
      .from('class_subjects')
      .update({ teacher_id: null })
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .in('subject_id', subjectIds);

    query = termId ? query.eq('academic_term_id', termId) : query.is('academic_term_id', null);

    const { error } = await query;
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[teachingAssignmentService] unassignSubjectTeacher failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unassign subject teacher.',
    };
  }
}
