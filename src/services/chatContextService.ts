import { supabase } from '@/lib/supabase';
import { getTeacherClasses } from '@/services/classService';
import { getTeacherAssignments } from '@/services/assignmentService';
import type { UserRole } from '@/types';

export interface ChatAccountContext {
  userName: string;
  role: UserRole;
  schoolId: string;
  generatedAt: string;
  platform: {
    earlyIntervention: string;
  };
  data: Record<string, unknown>;
}

const EARLY_INTERVENTION_NOTE =
  'EduPulse supports early intervention through risk-based monitoring, counselor case workflows, behaviour tracking, and automated parent notifications — not just identifying struggling students.';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export type TodayAttendanceSnapshot = {
  date: string;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  totalActiveStudents: number;
  notMarked: number;
  byClass: Array<{
    className: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    notMarked: number;
    presentStudents: string[];
  }>;
};

/** Live attendance for today — never invented by the assistant. */
export async function fetchTodayAttendanceSnapshot(
  schoolId: string,
  options?: { classIds?: string[]; maxNamesPerClass?: number }
): Promise<TodayAttendanceSnapshot> {
  const today = todayISO();
  const maxNames = options?.maxNamesPerClass ?? 30;

  let classQuery = supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');

  if (options?.classIds?.length) {
    classQuery = classQuery.in('id', options.classIds);
  }

  const { data: classes } = await classQuery;
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const classIds = [...classMap.keys()];

  const empty: TodayAttendanceSnapshot = {
    date: today,
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    totalExcused: 0,
    totalActiveStudents: 0,
    notMarked: 0,
    byClass: [],
  };

  if (!classIds.length) return empty;

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, class_id')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .in('class_id', classIds);

  const studentRows = students ?? [];
  if (!studentRows.length) return empty;

  const studentIds = studentRows.map((s) => s.id);
  const { data: attendance } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('school_id', schoolId)
    .eq('date', today)
    .in('student_id', studentIds);

  const attByStudent = new Map((attendance ?? []).map((a) => [a.student_id, a.status]));

  const byClassId = new Map<
    string,
    {
      present: number;
      absent: number;
      late: number;
      excused: number;
      notMarked: number;
      presentStudents: string[];
    }
  >();

  for (const classId of classIds) {
    byClassId.set(classId, {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      notMarked: 0,
      presentStudents: [],
    });
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;
  let notMarked = 0;

  for (const s of studentRows) {
    if (!s.class_id || !byClassId.has(s.class_id)) continue;
    const bucket = byClassId.get(s.class_id)!;
    const status = attByStudent.get(s.id);
    const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Student';

    if (!status) {
      bucket.notMarked++;
      notMarked++;
      continue;
    }

    if (status === 'present') {
      bucket.present++;
      totalPresent++;
      if (bucket.presentStudents.length < maxNames) bucket.presentStudents.push(name);
    } else if (status === 'absent') {
      bucket.absent++;
      totalAbsent++;
    } else if (status === 'late') {
      bucket.late++;
      totalLate++;
    } else if (status === 'excused') {
      bucket.excused++;
      totalExcused++;
    }
  }

  const byClass = classIds.map((id) => {
    const b = byClassId.get(id)!;
    return {
      className: classMap.get(id) ?? 'Class',
      present: b.present,
      absent: b.absent,
      late: b.late,
      excused: b.excused,
      notMarked: b.notMarked,
      presentStudents: b.presentStudents,
    };
  });

  return {
    date: today,
    totalPresent,
    totalAbsent,
    totalLate,
    totalExcused,
    totalActiveStudents: studentRows.length,
    notMarked,
    byClass,
  };
}

export function formatTodayAttendanceAnswer(snapshot: TodayAttendanceSnapshot): string {
  const dateLabel = new Date(snapshot.date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const anyMarked =
    snapshot.totalPresent +
      snapshot.totalAbsent +
      snapshot.totalLate +
      snapshot.totalExcused >
    0;

  if (!anyMarked) {
    return `No attendance has been marked for today (${dateLabel}) in your school records yet. Open the Attendance page to record it.`;
  }

  const lines: string[] = [
    `Today's attendance (${dateLabel}) from your school database:`,
    '',
    `Present: ${snapshot.totalPresent}`,
    `Absent: ${snapshot.totalAbsent}`,
    `Late: ${snapshot.totalLate}`,
    `Excused: ${snapshot.totalExcused}`,
    `Not marked yet: ${snapshot.notMarked}`,
    '',
    'By class:',
  ];

  for (const row of snapshot.byClass) {
    const names =
      row.presentStudents.length > 0
        ? ` — ${row.presentStudents.join(', ')}${row.present > row.presentStudents.length ? ` (+${row.present - row.presentStudents.length} more)` : ''}`
        : '';
    lines.push(
      `• ${row.className}: ${row.present} present${row.late ? `, ${row.late} late` : ''}${row.absent ? `, ${row.absent} absent` : ''}${names}`
    );
  }

  return lines.join('\n');
}

async function fetchAtRiskStudents(schoolId: string, classIds: string[], limit = 8) {
  if (classIds.length === 0) return [];

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, class_id')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .in('class_id', classIds);

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return [];

  const { data: risks } = await supabase
    .from('risk_scores')
    .select('student_id, overall_risk, risk_level')
    .eq('school_id', schoolId)
    .in('student_id', studentIds)
    .in('risk_level', ['medium', 'high', 'critical'])
    .order('overall_risk', { ascending: false })
    .limit(limit);

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  return (risks ?? []).map((r) => {
    const s = studentMap.get(r.student_id);
    return {
      name: s ? `${s.first_name} ${s.last_name}`.trim() : 'Student',
      riskLevel: r.risk_level,
      overallRisk: r.overall_risk,
    };
  });
}

async function buildTeacherContext(schoolId: string, staffId: string) {
  const [classes, assignments] = await Promise.all([
    getTeacherClasses(schoolId, staffId),
    getTeacherAssignments(schoolId, staffId),
  ]);

  const classIds = classes.map((c) => c.id);
  const [atRisk, attendanceToday] = await Promise.all([
    fetchAtRiskStudents(schoolId, classIds),
    fetchTodayAttendanceSnapshot(schoolId, { classIds }),
  ]);

  const activeAssignments = assignments
    .filter((a) => a.status === 'active')
    .slice(0, 12)
    .map((a) => ({
      title: a.title,
      type: a.assignment_type,
      dueDate: a.due_date,
      description: a.description?.slice(0, 200) || null,
      submissions: a.submissions ?? 0,
      totalStudents: a.total_students ?? 0,
    }));

  const schoolOverview = await fetchSchoolOverview(schoolId);

  return {
    schoolOverview,
    classes: classes.map((c) => ({
      name: c.name,
      students: c.students,
      gradeLevel: c.grade_level,
    })),
    schoolActivities: activeAssignments,
    lessonNotesHint:
      'Assignment descriptions and activity titles in schoolActivities can be used as lesson notes. You may also draft new lesson note outlines on request.',
    attendanceToday,
    studentsNeedingAttention: atRisk,
  };
}

export type SchoolOverview = {
  activeStudents: number;
  activeStaff: number;
  activeClasses: number;
  staffByRole: Record<string, number>;
  staff: Array<{ name: string; role: string }>;
  classes: Array<{ name: string; students: number }>;
  openInterventionCases: number;
  studentsOnRiskWatch: number;
  activeAssignments: number;
  subscription: { plan: string; ends: string } | null;
};

/** School-wide facts — included for every staff role so the bot can answer count/list questions. */
export async function fetchSchoolOverview(schoolId: string): Promise<SchoolOverview> {
  const [
    { count: studentCount },
    { data: staffRows },
    { data: classRows },
    { count: interventionCount },
    { data: riskRows },
    { count: assignmentCount },
    { data: sub },
    { data: activeStudents },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase
      .from('staff')
      .select('full_name, role')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('intervention_cases')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .in('status', ['open', 'in_progress', 'on_hold']),
    supabase
      .from('risk_scores')
      .select('student_id')
      .eq('school_id', schoolId)
      .in('risk_level', ['high', 'critical']),
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase
      .from('subscriptions')
      .select('plan, end_date')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('students')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('status', 'active'),
  ]);

  const staffByRole: Record<string, number> = {};
  for (const s of staffRows ?? []) {
    const role = s.role ?? 'staff';
    staffByRole[role] = (staffByRole[role] ?? 0) + 1;
  }

  const studentsPerClass = new Map<string, number>();
  for (const s of activeStudents ?? []) {
    if (!s.class_id) continue;
    studentsPerClass.set(s.class_id, (studentsPerClass.get(s.class_id) ?? 0) + 1);
  }

  const uniqueRiskStudents = new Set((riskRows ?? []).map((r) => r.student_id));

  return {
    activeStudents: studentCount ?? 0,
    activeStaff: staffRows?.length ?? 0,
    activeClasses: classRows?.length ?? 0,
    staffByRole,
    staff: (staffRows ?? []).slice(0, 80).map((s) => ({
      name: s.full_name,
      role: s.role ?? 'staff',
    })),
    classes: (classRows ?? []).map((c) => ({
      name: c.name,
      students: studentsPerClass.get(c.id) ?? 0,
    })),
    openInterventionCases: interventionCount ?? 0,
    studentsOnRiskWatch: uniqueRiskStudents.size,
    activeAssignments: assignmentCount ?? 0,
    subscription: sub ? { plan: sub.plan, ends: sub.end_date } : null,
  };
}

async function buildAdminContext(schoolId: string) {
  const [schoolOverview, attendanceToday] = await Promise.all([
    fetchSchoolOverview(schoolId),
    fetchTodayAttendanceSnapshot(schoolId),
  ]);
  return { schoolOverview, attendanceToday, ...schoolOverview };
}

async function buildCounselorContext(schoolId: string, staffId: string) {
  const { data: cases } = await supabase
    .from('intervention_cases')
    .select('id, case_title, status, priority, case_category, student_id')
    .eq('school_id', schoolId)
    .eq('assigned_to_id', staffId)
    .in('status', ['open', 'in_progress', 'on_hold'])
    .order('updated_at', { ascending: false })
    .limit(12);

  const studentIds = [...new Set((cases ?? []).map((c) => c.student_id))];
  const { data: students } = studentIds.length
    ? await supabase.from('students').select('id, first_name, last_name').in('id', studentIds)
    : { data: [] };

  const nameMap = new Map((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]));

  const { data: highRisk } = await supabase
    .from('risk_scores')
    .select('student_id, overall_risk, risk_level')
    .eq('school_id', schoolId)
    .in('risk_level', ['high', 'critical'])
    .order('overall_risk', { ascending: false })
    .limit(10);

  const schoolOverview = await fetchSchoolOverview(schoolId);

  return {
    schoolOverview,
    myCases: (cases ?? []).map((c) => ({
      title: c.case_title,
      status: c.status,
      priority: c.priority,
      category: c.case_category,
      student: nameMap.get(c.student_id) ?? 'Student',
    })),
    openInterventionCases: schoolOverview.openInterventionCases,
    highRiskStudents: await enrichRiskNames(schoolId, highRisk ?? []),
  };
}

async function enrichRiskNames(
  schoolId: string,
  rows: Array<{ student_id: string; overall_risk: number; risk_level: string }>
) {
  const ids = rows.map((r) => r.student_id);
  if (!ids.length) return [];
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('school_id', schoolId)
    .in('id', ids);
  const map = new Map((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]));
  return rows.map((r) => ({
    name: map.get(r.student_id) ?? 'Student',
    riskLevel: r.risk_level,
    overallRisk: r.overall_risk,
  }));
}

async function buildParentContext(
  schoolId: string,
  children: Array<{ id: string; firstName: string; lastName: string; className?: string }>
) {
  const childSummaries = [];
  for (const child of children.slice(0, 5)) {
    const { count: attPresent } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('student_id', child.id)
      .eq('status', 'present')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

    const { data: behaviour } = await supabase
      .from('behaviour_records')
      .select('behaviour_type, points, created_at')
      .eq('school_id', schoolId)
      .eq('student_id', child.id)
      .order('created_at', { ascending: false })
      .limit(3);

    childSummaries.push({
      name: `${child.firstName} ${child.lastName}`.trim(),
      class: child.className ?? '—',
      attendancePresentLast30Days: attPresent ?? 0,
      recentBehaviour: (behaviour ?? []).map((b) => ({
        type: b.behaviour_type,
        points: b.points,
      })),
    });
  }
  return { children: childSummaries };
}

export async function buildChatAccountContext(params: {
  schoolId: string;
  userId: string;
  role: UserRole;
  userName: string;
  staffId?: string;
  children?: Array<{ id: string; firstName: string; lastName: string; className?: string }>;
}): Promise<ChatAccountContext> {
  const staffId = params.staffId ?? params.userId;
  let data: Record<string, unknown> = {};

  switch (params.role) {
    case 'teacher':
      data = await buildTeacherContext(params.schoolId, staffId);
      break;
    case 'counselor':
      data = await buildCounselorContext(params.schoolId, params.userId);
      break;
    case 'parent':
      data = await buildParentContext(params.schoolId, params.children ?? []);
      break;
    case 'admin':
    case 'principal':
    case 'finance':
      data =
        params.role === 'finance'
          ? {
              ...(await buildAdminContext(params.schoolId)),
              focus: 'fees, payments, and school finances',
            }
          : await buildAdminContext(params.schoolId);
      if (params.role === 'principal') {
        const { data: highRisk } = await supabase
          .from('risk_scores')
          .select('student_id, overall_risk, risk_level')
          .eq('school_id', params.schoolId)
          .in('risk_level', ['high', 'critical'])
          .order('overall_risk', { ascending: false })
          .limit(10);
        data.highRiskStudents = await enrichRiskNames(params.schoolId, highRisk ?? []);
      }
      break;
    default:
      data = {};
  }

  return {
    userName: params.userName,
    role: params.role,
    schoolId: params.schoolId,
    generatedAt: new Date().toISOString(),
    platform: { earlyIntervention: EARLY_INTERVENTION_NOTE },
    data,
  };
}

function getSchoolOverview(d: Record<string, unknown>): SchoolOverview | null {
  return (d.schoolOverview as SchoolOverview) ?? null;
}

function isAttendanceQuestion(q: string): boolean {
  return (
    q.includes('attendance') ||
    q.includes('present today') ||
    q.includes('absent today') ||
    (q.includes('present') && (q.includes('today') || q.includes('how many'))) ||
    (q.includes('how many') && q.includes('student') && (q.includes('today') || q.includes('present') || q.includes('class')))
  );
}

function isStaffQuestion(q: string): boolean {
  return (
    q.includes('staff') ||
    q.includes('employee') ||
    q.includes('workforce') ||
    (q.includes('how many') && (q.includes('teacher') || q.includes('admin') || q.includes('counselor'))) ||
    (q.includes('list') && q.includes('staff'))
  );
}

function isClassQuestion(q: string, role: UserRole): boolean {
  if (role === 'teacher' && (q.includes('my class') || q.includes('classes do i') || q.includes('classes i teach'))) {
    return true;
  }
  return (
    q.includes('how many class') ||
    q.includes('list class') ||
    q.includes('all classes') ||
    (q.includes('class') && (q.includes('how many') || q.includes('list')))
  );
}

function isStudentCountQuestion(q: string): boolean {
  return (
    (q.includes('how many') || q.includes('total') || q.includes('number of')) &&
    q.includes('student') &&
    !isAttendanceQuestion(q)
  );
}

function formatStaffAnswer(ov: SchoolOverview, q: string): string {
  const roleBreakdown = Object.entries(ov.staffByRole)
    .map(([role, count]) => `${count} ${role}${count === 1 ? '' : 's'}`)
    .join(', ');

  if (q.includes('list') || q.includes('who are') || q.includes('names') || q.includes('name of')) {
    if (!ov.staff.length) return 'No active staff on record.';
    const lines = ov.staff.map((s) => `• ${s.name} (${s.role})`);
    const suffix = ov.activeStaff > ov.staff.length ? `\n…and ${ov.activeStaff - ov.staff.length} more.` : '';
    return `Active staff (${ov.activeStaff}):\n${lines.join('\n')}${suffix}`;
  }

  if (q.includes('teacher') && !q.includes('staff')) {
    const n = ov.staffByRole.teacher ?? 0;
    return `Your school has ${n} active teacher${n === 1 ? '' : 's'} on record.`;
  }

  return `Your school has ${ov.activeStaff} active staff${roleBreakdown ? ` — ${roleBreakdown}` : ''}.`;
}

function formatClassAnswer(
  ov: SchoolOverview,
  teacherClasses: Array<{ name: string; students: number }> | undefined,
  q: string,
  role: UserRole
): string | null {
  if (role === 'teacher' && teacherClasses?.length && (q.includes('my') || q.includes('do i') || q.includes('i teach'))) {
    return `You have ${teacherClasses.length} class${teacherClasses.length === 1 ? '' : 'es'}: ${teacherClasses.map((c) => `${c.name} (${c.students} students)`).join(', ')}.`;
  }

  if (!ov.classes.length) return 'No active classes on record.';
  if (q.includes('list') || q.includes('all class') || q.includes('name')) {
    return `School classes (${ov.activeClasses}):\n${ov.classes.map((c) => `• ${c.name} — ${c.students} students`).join('\n')}`;
  }
  return `Your school has ${ov.activeClasses} active class${ov.activeClasses === 1 ? '' : 'es'} with ${ov.activeStudents} students in total.`;
}

/** Factual answers from live account data — used before the LLM to prevent hallucinations. */
export function answerFromAccountContext(
  question: string,
  ctx: ChatAccountContext
): string | null {
  const q = question.toLowerCase();
  const d = ctx.data;
  const overview = getSchoolOverview(d);

  if (isAttendanceQuestion(q)) {
    const snapshot = d.attendanceToday as TodayAttendanceSnapshot | undefined;
    if (snapshot) return formatTodayAttendanceAnswer(snapshot);
    return "I could not load today's attendance from your account. Please try again or check the Attendance page.";
  }

  if (overview && isStaffQuestion(q) && ctx.role !== 'parent') {
    return formatStaffAnswer(overview, q);
  }

  if (overview && isStudentCountQuestion(q)) {
    return `Your school has ${overview.activeStudents} active students on record.`;
  }

  if (overview && isClassQuestion(q, ctx.role)) {
    const teacherClasses = d.classes as Array<{ name: string; students: number }> | undefined;
    return formatClassAnswer(overview, teacherClasses, q, ctx.role);
  }

  if (overview && (q.includes('intervention') || q.includes('counselor case'))) {
    if (q.includes('how many') || q.includes('open')) {
      const mine = d.myCases as Array<{ title: string; student: string }> | undefined;
      if (ctx.role === 'counselor' && mine) {
        return `You have ${mine.length} open case${mine.length === 1 ? '' : 's'} assigned to you. School-wide: ${overview.openInterventionCases} open intervention cases.`;
      }
      return `Your school has ${overview.openInterventionCases} open intervention case${overview.openInterventionCases === 1 ? '' : 's'}.`;
    }
  }

  if (overview && (q.includes('risk') || q.includes('at risk') || q.includes('struggling'))) {
    const atRisk = (d.studentsNeedingAttention ?? d.highRiskStudents) as
      | Array<{ name: string; riskLevel: string }>
      | undefined;
    if (atRisk?.length) {
      return `${atRisk.length} student${atRisk.length === 1 ? '' : 's'} flagged: ${atRisk.map((s) => `${s.name} (${s.riskLevel})`).join(', ')}. School-wide risk watch: ${overview.studentsOnRiskWatch}.`;
    }
    return `Your school has ${overview.studentsOnRiskWatch} student${overview.studentsOnRiskWatch === 1 ? '' : 's'} on high/critical risk watch.`;
  }

  if (overview && (q.includes('assignment') || q.includes('activit')) && ctx.role !== 'parent') {
    const mine = d.schoolActivities as Array<{ title: string; dueDate: string }> | undefined;
    if (ctx.role === 'teacher' && mine && (q.includes('my') || q.includes('i have'))) {
      return mine.length
        ? `You have ${mine.length} active assignment${mine.length === 1 ? '' : 's'}: ${mine.map((a) => `${a.title} (due ${a.dueDate})`).join('; ')}.`
        : 'You have no active assignments right now.';
    }
    if (q.includes('how many') || q.includes('school')) {
      return `Your school has ${overview.activeAssignments} active assignment${overview.activeAssignments === 1 ? '' : 's'}.`;
    }
  }

  if (overview?.subscription && (q.includes('plan') || q.includes('subscription') || q.includes('subscribed'))) {
    const sub = overview.subscription;
    return `Current subscription: ${sub.plan} plan (active until ${new Date(sub.ends + 'T12:00:00').toLocaleDateString()}).`;
  }

  if (ctx.role === 'parent') {
    const children = d.children as Array<{ name: string; class: string }> | undefined;
    if (children?.length && (q.includes('child') || q.includes('children') || q.includes('my kid'))) {
      return `Your linked children: ${children.map((c) => `${c.name} (${c.class})`).join(', ')}.`;
    }
  }

  if (overview && (q.includes('summary') || q.includes('overview') || q.includes('school stats'))) {
    return [
      'School overview (live data):',
      `• Students: ${overview.activeStudents}`,
      `• Staff: ${overview.activeStaff}`,
      `• Classes: ${overview.activeClasses}`,
      `• Active assignments: ${overview.activeAssignments}`,
      `• Open interventions: ${overview.openInterventionCases}`,
      `• Students on risk watch: ${overview.studentsOnRiskWatch}`,
      overview.subscription ? `• Plan: ${overview.subscription.plan}` : '• Plan: none active',
    ].join('\n');
  }

  if (q.includes('early intervention')) {
    return ctx.platform.earlyIntervention;
  }

  return null;
}
