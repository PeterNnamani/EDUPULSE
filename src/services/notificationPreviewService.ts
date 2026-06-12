import { supabase } from '@/lib/supabase';
import { getClassAttendanceForDate } from '@/services/attendanceService';
import type { Notification } from '@/services/notificationService';
import type { TeacherActivityRow } from '@/services/teacherActivityService';

export interface PreviewRow {
  label: string;
  value: string;
}

export interface NotificationPreviewData {
  type: string;
  title: string;
  summary?: string;
  rows: PreviewRow[];
  tableHeaders?: string[];
  tableRows?: string[][];
  /** When set, the modal renders status values in this column as colored badges. */
  tableStatusColumn?: number;
}

interface AttendanceRosterEntry {
  name: string;
  status: string;
}

const PREVIEWABLE_TYPES = new Set([
  'teacher_activity',
  'arrival_alert',
  'departure_alert',
  'assignment_alert',
  'attendance_alert',
]);

export function buildPreviewParamsFromActivityRow(row: TeacherActivityRow): URLSearchParams {
  const params = new URLSearchParams();
  const previewAction =
    row.action === 'results_uploaded' ? 'grade_recorded' : row.action;
  params.set('preview', previewAction);

  const classId =
    row.related_class_id ??
    (row.action === 'attendance_submitted' ? row.entity_id : null);
  if (classId) params.set('classId', classId);
  if (row.related_student_id) params.set('studentId', row.related_student_id);
  if (row.entity_id) params.set('entityId', row.entity_id);
  if (row.details?.date) params.set('date', String(row.details.date));
  return params;
}

function extractDateFromNotification(notification: Notification): string {
  const message = notification.message;
  const patterns = [
    /on\s+(\d{4}-\d{2}-\d{2})/i,
    /for\s+(\d{4}-\d{2}-\d{2})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return (
    notification.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  );
}

function inferActionFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('marked attendance') || lower.includes('submitted attendance')) {
    return 'attendance_submitted';
  }
  if (lower.includes('recorded behaviour') || lower.includes('recorded behavior')) {
    return 'behaviour_recorded';
  }
  if (lower.includes('created an assignment')) {
    return 'assignment_created';
  }
  if (lower.includes('uploaded results') || lower.includes('recorded grades')) {
    return 'grade_recorded';
  }
  return null;
}

function normalizePreviewAction(preview: string): string {
  if (preview === 'attendance' || preview === 'marked_attendance') {
    return 'attendance_submitted';
  }
  return preview;
}

async function findMatchingActivityLog(
  schoolId: string,
  notification: Notification
): Promise<TeacherActivityRow | null> {
  const inferredAction = inferActionFromMessage(notification.message);
  const date = extractDateFromNotification(notification);

  if (inferredAction) {
    const { data: byDate } = await supabase
      .from('teacher_activity_logs')
      .select('*')
      .eq('school_id', schoolId)
      .eq('action', inferredAction)
      .filter('details->>date', 'eq', date)
      .order('created_at', { ascending: false })
      .limit(5);

    if (byDate?.length) {
      const target = new Date(notification.createdAt).getTime();
      const closest = byDate.reduce((best, row) => {
        const bestDiff = Math.abs(new Date(best.created_at).getTime() - target);
        const rowDiff = Math.abs(new Date(row.created_at).getTime() - target);
        return rowDiff < bestDiff ? row : best;
      });
      return closest as TeacherActivityRow;
    }
  }

  const created = new Date(notification.createdAt);
  const windowStart = new Date(created.getTime() - 300_000).toISOString();
  const windowEnd = new Date(created.getTime() + 300_000).toISOString();

  let query = supabase
    .from('teacher_activity_logs')
    .select('*')
    .eq('school_id', schoolId)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  if (inferredAction) {
    query = query.eq('action', inferredAction);
  }

  const { data: byWindow } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (byWindow as TeacherActivityRow | null) ?? null;
}

/** Sync fallback when action_url has no preview query (older notifications). */
export function resolvePreviewParamsSync(notification: Notification): URLSearchParams | null {
  const fromUrl = parsePreviewFromActionUrl(notification.actionUrl);
  if (fromUrl) {
    const preview = fromUrl.get('preview');
    if (preview) fromUrl.set('preview', normalizePreviewAction(preview));
    return fromUrl;
  }

  const date = extractDateFromNotification(notification);

  if (notification.notificationType === 'arrival_alert' && notification.relatedStudentId) {
    const params = new URLSearchParams();
    params.set('preview', 'duty_arrival');
    params.set('studentId', notification.relatedStudentId);
    params.set('date', date);
    return params;
  }

  if (notification.notificationType === 'departure_alert' && notification.relatedStudentId) {
    const params = new URLSearchParams();
    params.set('preview', 'duty_departure');
    params.set('studentId', notification.relatedStudentId);
    params.set('date', date);
    return params;
  }

  if (notification.notificationType === 'assignment_alert' && notification.relatedStudentId) {
    const params = new URLSearchParams();
    params.set('preview', 'assignment_alert');
    params.set('studentId', notification.relatedStudentId);
    const entityId = parsePreviewFromActionUrl(notification.actionUrl)?.get('entityId');
    if (entityId) params.set('entityId', entityId);
    return params;
  }

  if (notification.notificationType === 'teacher_activity') {
    const inferredAction = inferActionFromMessage(notification.message);
    if (inferredAction) {
      const params = new URLSearchParams();
      params.set('preview', inferredAction);
      params.set('date', date);
      return params;
    }
  }

  return null;
}

/** Resolve preview params — falls back to matching teacher_activity_logs for legacy notifications. */
export async function resolvePreviewParams(
  schoolId: string,
  notification: Notification
): Promise<URLSearchParams | null> {
  const sync = resolvePreviewParamsSync(notification);
  const previewAction = sync?.get('preview');
  const needsClassLookup =
    previewAction === 'attendance_submitted' &&
    !sync?.get('classId') &&
    !sync?.get('entityId');

  if (
    sync?.get('classId') ||
    (sync?.get('entityId') && !needsClassLookup) ||
    sync?.get('preview')?.startsWith('duty_')
  ) {
    return sync;
  }

  if (notification.notificationType === 'teacher_activity' || needsClassLookup) {
    const log = await findMatchingActivityLog(schoolId, notification);
    if (log) {
      return buildPreviewParamsFromActivityRow(log);
    }
    if (sync) return sync;
  }

  return sync;
}

const PREVIEWABLE_ACTIONS = new Set([
  'attendance_submitted',
  'results_uploaded',
  'grade_recorded',
  'assignment_created',
  'behaviour_recorded',
]);

export function canPreviewNotification(notification: Notification): boolean {
  if (parsePreviewFromActionUrl(notification.actionUrl)) return true;
  if (PREVIEWABLE_TYPES.has(notification.notificationType)) return true;
  return false;
}

export function canPreviewActivityRow(row: TeacherActivityRow): boolean {
  return PREVIEWABLE_ACTIONS.has(row.action);
}

export function parsePreviewFromActionUrl(actionUrl?: string): URLSearchParams | null {
  if (!actionUrl) return null;
  try {
    const url = actionUrl.startsWith('http')
      ? new URL(actionUrl)
      : new URL(actionUrl, 'http://local');
    if (!url.searchParams.get('preview')) return null;
    return url.searchParams;
  } catch {
    return null;
  }
}

export function buildActivityPreviewUrl(
  action: string,
  ctx: {
    entityId?: string | null;
    relatedClassId?: string | null;
    relatedStudentId?: string | null;
    details?: Record<string, unknown>;
  }
): string {
  const params = new URLSearchParams();
  params.set('preview', action);
  if (ctx.relatedClassId) params.set('classId', ctx.relatedClassId);
  if (ctx.relatedStudentId) params.set('studentId', ctx.relatedStudentId);
  if (ctx.entityId) params.set('entityId', ctx.entityId);
  if (ctx.details?.date) params.set('date', String(ctx.details.date));
  return `/notifications?${params.toString()}`;
}

export function buildDutyPreviewUrl(
  kind: 'duty_arrival' | 'duty_departure',
  studentId: string,
  date: string
): string {
  const params = new URLSearchParams();
  params.set('preview', kind);
  params.set('studentId', studentId);
  params.set('date', date);
  return `/notifications?${params.toString()}`;
}

export async function loadNotificationPreview(
  schoolId: string,
  params: URLSearchParams
): Promise<NotificationPreviewData | null> {
  const preview = normalizePreviewAction(params.get('preview') ?? '');
  if (!preview) return null;

  switch (preview) {
    case 'attendance_submitted':
      return loadAttendancePreview(schoolId, params);
    case 'grade_recorded':
    case 'results_uploaded':
      return loadGradesPreview(schoolId, params);
    case 'assignment_created':
    case 'assignment_alert':
      return loadAssignmentPreview(schoolId, params);
    case 'behaviour_recorded':
      return loadBehaviourPreview(schoolId, params);
    case 'duty_arrival':
    case 'duty_departure':
      return loadDutyPreview(schoolId, params, preview);
    default:
      return null;
  }
}

async function loadAttendanceRosterFromSnapshot(
  schoolId: string,
  classId: string,
  date: string
): Promise<{ roster: AttendanceRosterEntry[]; teacherName?: string } | null> {
  const { data: log } = await supabase
    .from('teacher_activity_logs')
    .select('details, staff_name')
    .eq('school_id', schoolId)
    .eq('action', 'attendance_submitted')
    .or(`related_class_id.eq.${classId},entity_id.eq.${classId}`)
    .filter('details->>date', 'eq', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawRoster = log?.details?.roster;
  if (!Array.isArray(rawRoster) || rawRoster.length === 0) return null;

  const roster = rawRoster.map((entry: { name?: string; status?: string }) => ({
    name: entry.name?.trim() || 'Student',
    status: entry.status ?? 'unknown',
  }));

  return { roster, teacherName: log?.staff_name ?? undefined };
}

async function loadAttendanceRosterFromDb(
  schoolId: string,
  classId: string,
  date: string
): Promise<AttendanceRosterEntry[]> {
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('last_name', { ascending: true });

  const studentIds = (students ?? []).map((s) => s.id);
  const statusByStudent = new Map<string, string>();

  if (studentIds.length > 0) {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('school_id', schoolId)
      .eq('date', date)
      .in('student_id', studentIds);

    for (const row of attendance ?? []) {
      statusByStudent.set(row.student_id, row.status);
    }
  }

  if ((students ?? []).length > 0) {
    return (students ?? []).map((s) => ({
      name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student',
      status: statusByStudent.get(s.id) ?? 'not marked',
    }));
  }

  const records = await getClassAttendanceForDate(classId, date);
  return records.map((r) => ({
    name: r.student_name || 'Student',
    status: r.status,
  }));
}

async function resolveAttendanceClassId(
  schoolId: string,
  date: string
): Promise<string | null> {
  const { data: logs } = await supabase
    .from('teacher_activity_logs')
    .select('related_class_id, entity_id, created_at')
    .eq('school_id', schoolId)
    .eq('action', 'attendance_submitted')
    .filter('details->>date', 'eq', date)
    .order('created_at', { ascending: false })
    .limit(1);

  const log = logs?.[0];
  if (!log) return null;
  return log.related_class_id ?? log.entity_id ?? null;
}

async function loadAttendancePreview(
  schoolId: string,
  params: URLSearchParams
): Promise<NotificationPreviewData | null> {
  const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
  let classId = params.get('classId') ?? params.get('entityId');
  if (!classId) {
    classId = await resolveAttendanceClassId(schoolId, date);
  }
  if (!classId) return null;

  const { data: classRow } = await supabase
    .from('classes')
    .select('name')
    .eq('id', classId)
    .maybeSingle();

  const className = classRow?.name ?? 'Class';

  const snapshot = await loadAttendanceRosterFromSnapshot(schoolId, classId, date);
  const roster =
    snapshot?.roster ?? (await loadAttendanceRosterFromDb(schoolId, classId, date));

  const tableRows = roster.map((entry, index) => [
    String(index + 1),
    entry.name,
    entry.status,
  ]);

  const present = roster.filter((r) => r.status === 'present').length;
  const absent = roster.filter((r) => r.status === 'absent').length;
  const late = roster.filter((r) => r.status === 'late').length;
  const excused = roster.filter((r) => r.status === 'excused').length;

  const summaryParts = [
    `${present} present`,
    absent ? `${absent} absent` : null,
    late ? `${late} late` : null,
    excused ? `${excused} excused` : null,
  ].filter(Boolean);

  const rows: PreviewRow[] = [
    { label: 'Class', value: className },
    { label: 'Date', value: date },
    { label: 'Students', value: String(roster.length) },
  ];
  if (snapshot?.teacherName) {
    rows.push({ label: 'Marked by', value: snapshot.teacherName });
  }

  return {
    type: 'attendance_submitted',
    title: `${className} — Attendance`,
    summary: `${date} · ${summaryParts.join(', ')}`,
    rows,
    tableHeaders: ['#', 'Student', 'Status'],
    tableRows,
    tableStatusColumn: 2,
  };
}

async function loadGradesPreview(
  schoolId: string,
  params: URLSearchParams
): Promise<NotificationPreviewData | null> {
  const classId = params.get('classId');
  const studentId = params.get('studentId');

  let query = supabase
    .from('grades')
    .select('score, max_score, assessment_type, students(first_name, last_name), subjects(name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (classId) query = query.eq('class_id', classId);
  if (studentId) query = query.eq('student_id', studentId);

  const { data } = await query;
  const rows = data ?? [];

  return {
    type: 'grade_recorded',
    title: 'Grade records',
    summary: `${rows.length} recent grade(s)`,
    rows: [],
    tableHeaders: ['Student', 'Subject', 'Assessment', 'Score'],
    tableRows: rows.map((g: any) => [
      g.students ? `${g.students.first_name} ${g.students.last_name}` : 'Student',
      g.subjects?.name ?? 'Subject',
      g.assessment_type ?? '',
      `${g.score ?? 0}/${g.max_score ?? 100}`,
    ]),
  };
}

async function loadAssignmentPreview(
  schoolId: string,
  params: URLSearchParams
): Promise<NotificationPreviewData | null> {
  const entityId = params.get('entityId');
  const studentId = params.get('studentId');
  if (!entityId) return null;

  const { data: assignment } = await supabase
    .from('assignments')
    .select('title, due_date, total_marks, assignment_type, classes(name)')
    .eq('id', entityId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!assignment) return null;

  let submissionStatus = '';
  if (studentId) {
    const { data: sub } = await supabase
      .from('assignment_submissions')
      .select('status, submitted_at, remarks')
      .eq('assignment_id', entityId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (sub) {
      submissionStatus = `${sub.status}${sub.submitted_at ? ` on ${new Date(sub.submitted_at).toLocaleDateString()}` : ''}`;
    }
  }

  const rows: PreviewRow[] = [
    { label: 'Title', value: assignment.title },
    { label: 'Class', value: (assignment.classes as { name?: string } | null)?.name ?? 'N/A' },
    { label: 'Due', value: assignment.due_date },
    { label: 'Type', value: assignment.assignment_type },
    { label: 'Marks', value: String(assignment.total_marks) },
  ];
  if (submissionStatus) rows.push({ label: 'Submission', value: submissionStatus });

  return {
    type: 'assignment',
    title: assignment.title,
    summary: 'Assignment details',
    rows,
  };
}

async function loadBehaviourPreview(
  schoolId: string,
  params: URLSearchParams
): Promise<NotificationPreviewData | null> {
  let entityId = params.get('entityId');
  if (!entityId && params.get('studentId')) {
    const { data: latest } = await supabase
      .from('behaviour_records')
      .select('id')
      .eq('school_id', schoolId)
      .eq('student_id', params.get('studentId')!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    entityId = latest?.id ?? null;
  }
  if (!entityId) return null;

  const { data } = await supabase
    .from('behaviour_records')
    .select('behaviour_type, points, description, date, students(first_name, last_name)')
    .eq('id', entityId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!data) return null;

  return {
    type: 'behaviour_recorded',
    title: 'Behaviour record',
    rows: [
      {
        label: 'Student',
        value: (() => {
          const student = Array.isArray(data.students) ? data.students[0] : data.students;
          if (!student || typeof student !== 'object') return 'Student';
          const row = student as { first_name?: string; last_name?: string };
          const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
          return name || 'Student';
        })(),
      },
      { label: 'Type', value: data.behaviour_type },
      { label: 'Points', value: String(data.points ?? 0) },
      { label: 'Date', value: data.date },
      { label: 'Description', value: data.description ?? '' },
    ],
  };
}

async function loadDutyPreview(
  schoolId: string,
  params: URLSearchParams,
  kind: 'duty_arrival' | 'duty_departure'
): Promise<NotificationPreviewData | null> {
  const studentId = params.get('studentId');
  const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
  if (!studentId) return null;

  const [{ data: student }, { data: duty }] = await Promise.all([
    supabase.from('students').select('first_name, last_name, class_id').eq('id', studentId).maybeSingle(),
    supabase
      .from('duty_attendance')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('date', date)
      .maybeSingle(),
  ]);

  let className = 'N/A';
  if (student?.class_id) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', student.class_id).maybeSingle();
    className = cls?.name ?? 'N/A';
  }

  const title = kind === 'duty_arrival' ? 'Duty — Student arrival' : 'Duty — Student departure';

  return {
    type: kind,
    title,
    summary: student ? `${student.first_name} ${student.last_name}` : 'Student',
    rows: [
      { label: 'Student', value: student ? `${student.first_name} ${student.last_name}` : 'Unknown' },
      { label: 'Class', value: className },
      { label: 'Date', value: date },
      { label: 'Arrival', value: duty?.arrival_time ?? '—' },
      { label: 'Departure', value: duty?.departure_time ?? '—' },
      { label: 'Late', value: duty?.is_late ? 'Yes' : 'No' },
      { label: 'Pickup status', value: duty?.pickup_status ?? '—' },
      { label: 'Notes', value: duty?.visitor_notes ?? '—' },
    ],
  };
}
