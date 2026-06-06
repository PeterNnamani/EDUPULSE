import { supabase } from '@/lib/supabase';
import { notificationTriggerService } from '@/services/notificationTriggerService';
import { notificationService } from '@/services/notificationService';
import {
  buildActivityPreviewUrl,
  buildDutyPreviewUrl,
} from '@/services/notificationPreviewService';
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

/** Auth user IDs for in-app notifications (falls back to staff id when user_id is missing). */
export async function getRecipientIdsByRole(schoolId: string, role: UserRole): Promise<string[]> {
  const { data } = await supabase
    .from('staff')
    .select('id, user_id')
    .eq('school_id', schoolId)
    .eq('role', role)
    .eq('is_active', true);
  return (data ?? []).map((s) => s.user_id || s.id).filter(Boolean);
}

const TEACHER_ACTIVITY_LABELS: Record<string, string> = {
  attendance_submitted: 'marked attendance',
  grade_recorded: 'recorded grades',
  assignment_created: 'created an assignment',
  behaviour_recorded: 'recorded behaviour',
  intervention_created: 'created an intervention',
  results_uploaded: 'uploaded results',
  parent_communication: 'contacted a parent',
  login: 'logged in',
  logout: 'logged out',
};

const STAFF_SESSION_ACTIONS = new Set(['login', 'logout']);

export function isStaffSessionAction(action: string): boolean {
  return STAFF_SESSION_ACTIONS.has(action);
}

/** Hide staff sign-in/sign-out toasts and bell items for school overseers. */
export function isStaffSessionNotification(notification: {
  notificationType: string;
  message: string;
}): boolean {
  if (notification.notificationType !== 'teacher_activity') return false;
  const msg = notification.message.toLowerCase();
  return msg.includes('logged in') || msg.includes('logged out');
}

export function shouldHideStaffSessionNotificationsForRole(
  role: UserRole | string | undefined
): boolean {
  return role === 'admin' || role === 'principal';
}

export function filterNotificationsForViewer<T extends { notificationType: string; message: string }>(
  notifications: T[],
  viewerRole: UserRole | string | undefined
): T[] {
  if (!shouldHideStaffSessionNotificationsForRole(viewerRole)) return notifications;
  return notifications.filter((n) => !isStaffSessionNotification(n));
}

export async function dispatchTeacherActivity(
  schoolId: string,
  staffName: string | null,
  action: string,
  context?: {
    details?: Record<string, unknown>;
    entityType?: string | null;
    entityId?: string | null;
    relatedClassId?: string | null;
    relatedStudentId?: string | null;
  }
): Promise<void> {
  if (isStaffSessionAction(action)) return;

  const details = context?.details;
  const label = TEACHER_ACTIVITY_LABELS[action] ?? action.replace(/_/g, ' ');
  const name = staffName?.trim() || 'A teacher';

  let classHint = '';
  if (action === 'attendance_submitted' && context?.relatedClassId) {
    const { data: classRow } = await supabase
      .from('classes')
      .select('name')
      .eq('id', context.relatedClassId)
      .maybeSingle();
    const className = classRow?.name ?? 'a class';
    classHint = details?.date
      ? ` for ${className} on ${details.date}`
      : ` for ${className}`;
  } else if (details?.date && action === 'attendance_submitted') {
    classHint = ` on ${details.date}`;
  } else if (details?.title) {
    classHint = `: ${details.title}`;
  }

  const message = `${name} ${label}${classHint}. Tap View details to see the student list.`;
  const previewUrl = buildActivityPreviewUrl(action, {
    entityId: context?.entityId,
    relatedClassId: context?.relatedClassId,
    relatedStudentId: context?.relatedStudentId,
    details,
  });

  const priority =
    action === 'attendance_submitted' || action === 'behaviour_recorded' ? 'medium' : 'low';

  const recipients: Array<{ id: string; role: UserRole }> = [
    ...(await getRecipientIdsByRole(schoolId, 'admin')).map((id) => ({
      id,
      role: 'admin' as UserRole,
    })),
    ...(await getRecipientIdsByRole(schoolId, 'principal')).map((id) => ({
      id,
      role: 'principal' as UserRole,
    })),
  ];

  for (const { id: recipientId, role } of recipients) {
    await notificationService.sendNotification({
      schoolId,
      recipientId,
      recipientRole: role,
      notificationType: 'teacher_activity',
      title: 'Teacher activity',
      message,
      priority,
      actionUrl: previewUrl,
      relatedStudentId: context?.relatedStudentId ?? undefined,
    });
  }
}

export async function dispatchDutyActivity(
  schoolId: string,
  studentId: string,
  date: string,
  kind: 'arrival' | 'departure',
  staffName?: string | null
): Promise<void> {
  const studentName = await getStudentDisplayName(studentId);
  const previewKind = kind === 'arrival' ? 'duty_arrival' : 'duty_departure';
  const previewUrl = buildDutyPreviewUrl(previewKind, studentId, date);
  const by = staffName?.trim() || 'Duty teacher';
  const message =
    kind === 'arrival'
      ? `${by} recorded arrival for ${studentName} on ${date}. Tap Preview to see details.`
      : `${by} recorded departure for ${studentName} on ${date}. Tap Preview to see details.`;

  const recipientGroups: Array<{ role: UserRole; ids: string[] }> = [
    { role: 'admin', ids: await getRecipientIdsByRole(schoolId, 'admin') },
    { role: 'principal', ids: await getRecipientIdsByRole(schoolId, 'principal') },
    { role: 'finance', ids: await getRecipientIdsByRole(schoolId, 'finance') },
  ];

  for (const group of recipientGroups) {
    for (const recipientId of group.ids) {
      await notificationService.sendNotification({
        schoolId,
        recipientId,
        recipientRole: group.role,
        notificationType: kind === 'arrival' ? 'arrival_alert' : 'departure_alert',
        title: kind === 'arrival' ? 'Duty — arrival recorded' : 'Duty — departure recorded',
        message,
        priority: 'medium',
        actionUrl: previewUrl,
        relatedStudentId: studentId,
      });
    }
  }
}

export async function dispatchAssignmentSubmitted(
  schoolId: string,
  assignmentId: string,
  studentId: string,
  submittedBy: 'parent' | 'teacher',
  submissionNote?: string
): Promise<void> {
  const [studentName, assignmentRow] = await Promise.all([
    getStudentDisplayName(studentId),
    supabase
      .from('assignments')
      .select('title, teacher_id, class_id')
      .eq('id', assignmentId)
      .maybeSingle(),
  ]);

  const assignment = assignmentRow.data;
  if (!assignment) return;

  const teacherStaffId = assignment.teacher_id;
  const { data: teacherStaff } = teacherStaffId
    ? await supabase
        .from('staff')
        .select('user_id, id')
        .eq('id', teacherStaffId)
        .maybeSingle()
    : { data: null };

  const teacherRecipientId = teacherStaff?.user_id || teacherStaff?.id;
  const byLabel = submittedBy === 'parent' ? 'Parent' : 'Teacher';
  const note = submissionNote ? ` (${submissionNote})` : '';

  const previewUrl = buildActivityPreviewUrl('assignment_alert', {
    entityId: assignmentId,
    relatedStudentId: studentId,
    relatedClassId: assignment.class_id,
  });

  if (teacherRecipientId) {
    await notificationService.sendNotification({
      schoolId,
      recipientId: teacherRecipientId,
      recipientRole: 'teacher',
      notificationType: 'assignment_alert',
      title: 'Assignment submitted',
      message: `${byLabel} marked "${assignment.title}" as submitted for ${studentName}${note}.`,
      priority: 'medium',
      relatedStudentId: studentId,
      actionUrl: previewUrl,
    });
  }

  const leadership: Array<{ role: UserRole; ids: string[] }> = [
    { role: 'admin', ids: await getRecipientIdsByRole(schoolId, 'admin') },
    { role: 'principal', ids: await getRecipientIdsByRole(schoolId, 'principal') },
  ];
  for (const group of leadership) {
    for (const recipientId of group.ids) {
      await notificationService.sendNotification({
        schoolId,
        recipientId,
        recipientRole: group.role,
        notificationType: 'assignment_alert',
        title: 'Assignment submitted',
        message: `${byLabel} marked "${assignment.title}" as submitted for ${studentName}${note}.`,
        priority: 'low',
        relatedStudentId: studentId,
        actionUrl: previewUrl,
      });
    }
  }

  if (submittedBy === 'parent') {
    const parentIds = await getParentIdsForStudent(studentId);
    for (const parentId of parentIds) {
      await notificationService.sendNotification({
        schoolId,
        recipientId: parentId,
        recipientRole: 'parent',
        notificationType: 'assignment_alert',
        title: 'Submission recorded',
        message: `"${assignment.title}" was marked as submitted for ${studentName}.`,
        priority: 'low',
        relatedStudentId: studentId,
        actionUrl: '/parent/assignments',
      });
    }
  }
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
