import { supabase } from '@/lib/supabase';
import { getCurrentSession, getCurrentTerm } from '@/utils/calendarUtils';
function gradePercent(score: number | null, maxScore: number | null): number {
  const max = maxScore && maxScore > 0 ? maxScore : 100;
  if (score == null) return 0;
  return Math.round((score / max) * 100);
}

/** Build or refresh session academic record from live attendance, grades, behaviour, fees. */
export async function syncStudentAcademicRecord(
  schoolId: string,
  studentId: string,
  sessionId?: string,
  termId?: string
): Promise<{ success: boolean; error?: string }> {
  const session = sessionId
    ? { id: sessionId }
    : await getCurrentSession(schoolId);
  if (!session?.id) {
    return { success: false, error: 'No current academic session' };
  }

  const term = termId ? { id: termId } : await getCurrentTerm(schoolId);

  const { data: student } = await supabase
    .from('students')
    .select('id, class_id, risk_level, risk_score')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!student?.class_id) {
    return { success: false, error: 'Student has no class assigned' };
  }

  let attendanceQuery = supabase
    .from('attendance')
    .select('status')
    .eq('school_id', schoolId)
    .eq('student_id', studentId);
  if (term?.id) attendanceQuery = attendanceQuery.eq('academic_term_id', term.id);

  const { data: attendanceRows } = await attendanceQuery;
  const attTotal = attendanceRows?.length ?? 0;
  const attPresent =
    attendanceRows?.filter((a) => a.status === 'present' || a.status === 'late').length ?? 0;
  const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

  let gradesQuery = supabase
    .from('grades')
    .select('score, max_score')
    .eq('school_id', schoolId)
    .eq('student_id', studentId);
  if (term?.id) gradesQuery = gradesQuery.eq('academic_term_id', term.id);

  const { data: gradeRows } = await gradesQuery;
  const averageScore =
    gradeRows && gradeRows.length > 0
      ? Math.round(
          gradeRows.reduce((s, g) => s + gradePercent(g.score, g.max_score), 0) / gradeRows.length
        )
      : 0;

  const { data: behaviourRows } = await supabase
    .from('behaviour_records')
    .select('behaviour_type')
    .eq('school_id', schoolId)
    .eq('student_id', studentId);

  const merits =
    behaviourRows?.filter((b) => b.behaviour_type === 'merit' || b.behaviour_type === 'commendation')
      .length ?? 0;
  const demerits =
    behaviourRows?.filter((b) => b.behaviour_type === 'demerit' || b.behaviour_type === 'warning')
      .length ?? 0;
  const behaviourScore = Math.max(0, Math.min(100, 50 + merits * 5 - demerits * 8));

  const [{ data: classFee }, { data: payments }] = await Promise.all([
    supabase
      .from('fees')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('class_id', student.class_id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('status', 'completed'),
  ]);
  const payload = {
    school_id: schoolId,
    student_id: studentId,
    session_id: session.id,
    term_id: term?.id ?? null,
    class_id: student.class_id,
    average_score: averageScore,
    attendance_rate: attendanceRate,
    behaviour_score: behaviourScore,
    risk_level: student.risk_level ?? 'low',
    subjects_count: gradeRows?.length ?? 0,
    promotion_status: 'pending' as const,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('student_academic_records').upsert(payload, {
    onConflict: 'student_id,session_id,term_id',
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function syncAllStudentsAcademicRecords(schoolId: string): Promise<{
  synced: number;
  failed: number;
}> {
  const session = await getCurrentSession(schoolId);
  if (!session) return { synced: 0, failed: 0 };

  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  let synced = 0;
  let failed = 0;
  for (const s of students ?? []) {
    const r = await syncStudentAcademicRecord(schoolId, s.id, session.id);
    if (r.success) synced++;
    else failed++;
  }
  return { synced, failed };
}
