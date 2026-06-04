import { supabase } from '@/lib/supabase';
import { notificationTriggerService } from '@/services/notificationTriggerService';
import { notificationService } from '@/services/notificationService';
import type { UserRole } from '@/types';

export async function getStaffIdsByRole(schoolId: string, role: UserRole): Promise<string[]> {
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', role)
    .eq('is_active', true);
  return (data ?? []).map((s) => s.id);
}

export async function getParentIdsForStudent(studentId: string): Promise<string[]> {
  const { data: links } = await supabase
    .from('student_parents')
    .select('parent_id')
    .eq('student_id', studentId);

  return (links ?? []).map((l) => l.parent_id);
}

export async function getStudentDisplayName(studentId: string): Promise<string> {
  const { data } = await supabase
    .from('students')
    .select('first_name, last_name')
    .eq('id', studentId)
    .maybeSingle();
  if (!data) return 'Student';
  return `${data.first_name} ${data.last_name}`.trim();
}

export async function dispatchAttendanceMarked(
  schoolId: string,
  classId: string,
  date: string,
  records: Array<{ studentId: string; status: string }>
): Promise<void> {
  const absent = records.filter((r) => r.status === 'absent');
  if (absent.length === 0) return;

  for (const { studentId } of absent) {
    const [studentName, parentIds] = await Promise.all([
      getStudentDisplayName(studentId),
      getParentIdsForStudent(studentId),
    ]);

    if (parentIds.length) {
      await notificationTriggerService.onAttendanceAlert(
        schoolId,
        studentId,
        studentName,
        parentIds,
        0,
        1
      );
    }

    const counselors = await getStaffIdsByRole(schoolId, 'counselor');
    for (const counselorId of counselors) {
      await notificationService.sendNotification({
        schoolId,
        recipientId: counselorId,
        recipientRole: 'counselor',
        notificationType: 'attendance_alert',
        title: '⏰ Attendance alert',
        message: `${studentName} was marked absent on ${date}`,
        priority: 'medium',
        relatedStudentId: studentId,
        actionUrl: '/attendance',
      });
    }
  }

  const principals = await getStaffIdsByRole(schoolId, 'principal');
  if (absent.length >= 3) {
    for (const principalId of principals) {
      await notificationService.sendNotification({
        schoolId,
        recipientId: principalId,
        recipientRole: 'principal',
        notificationType: 'attendance_alert',
        title: '⏰ Multiple absences today',
        message: `${absent.length} student(s) marked absent in class`,
        priority: 'high',
        actionUrl: '/principal/attendance',
      });
    }
  }
}

export async function dispatchBehaviourRecorded(
  schoolId: string,
  studentId: string,
  behaviourType: string,
  description: string
): Promise<void> {
  const studentName = await getStudentDisplayName(studentId);
  const parentIds = await getParentIdsForStudent(studentId);
  const counselors = await getStaffIdsByRole(schoolId, 'counselor');
  const principals = await getStaffIdsByRole(schoolId, 'principal');

  const severity =
    behaviourType === 'expulsion' || behaviourType === 'suspension'
      ? 'critical'
      : behaviourType === 'demerit' || behaviourType === 'warning'
        ? 'major'
        : 'minor';

  await notificationTriggerService.onBehaviorIncident(
    schoolId,
    studentId,
    studentName,
    parentIds,
    counselors,
    principals[0] ?? counselors[0] ?? '',
    description,
    severity as 'minor' | 'major' | 'critical'
  );
}

export async function dispatchGradeRecorded(
  schoolId: string,
  studentId: string,
  subjectName: string,
  score: number
): Promise<void> {
  const studentName = await getStudentDisplayName(studentId);
  const parentIds = await getParentIdsForStudent(studentId);

  const { data: cls } = await supabase
    .from('students')
    .select('class_id, classes(class_teacher_id)')
    .eq('id', studentId)
    .maybeSingle();

  const teacherId =
    (cls?.classes as { class_teacher_id?: string } | null)?.class_teacher_id ?? '';

  await notificationTriggerService.onGradeResultEvent(
    schoolId,
    studentId,
    studentName,
    parentIds,
    teacherId,
    subjectName,
    String(score),
    'posted'
  );
}

export async function dispatchNewAssignment(
  schoolId: string,
  assignmentTitle: string,
  assignmentId: string,
  classId: string,
  dueDate: string
): Promise<void> {
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('status', 'active');

  const studentIds = (students ?? []).map((s) => s.id);
  const parentIds: string[] = [];
  for (const sid of studentIds) {
    const pids = await getParentIdsForStudent(sid);
    parentIds.push(...pids);
  }

  await notificationTriggerService.onAssignmentEvent(
    schoolId,
    studentIds,
    [...new Set(parentIds)],
    assignmentTitle,
    assignmentId,
    dueDate,
    'created'
  );
}

export async function dispatchStudentEnrolled(
  schoolId: string,
  studentName: string,
  classId: string,
  className: string
): Promise<void> {
  const { data: cls } = await supabase
    .from('classes')
    .select('class_teacher_id')
    .eq('id', classId)
    .eq('school_id', schoolId)
    .maybeSingle();

  const teacherIds = cls?.class_teacher_id ? [cls.class_teacher_id] : [];
  const principals = await getStaffIdsByRole(schoolId, 'principal');
  const admins = await getStaffIdsByRole(schoolId, 'admin');

  await notificationTriggerService.onStudentEnrollment(
    schoolId,
    studentName,
    classId,
    className,
    teacherIds,
    principals[0] ?? '',
    admins
  );
}
