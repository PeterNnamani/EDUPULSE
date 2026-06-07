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

export const EDUPULSE_PLATFORM_GUIDE = {
  modules: [
    'Dashboard — role-specific overview and quick stats',
    'Students — enrollment, profiles, academic history, promotion',
    'Staff — teachers, admin, counselors, finance roles',
    'Classes & Subjects — class setup, subject curriculum, teacher assignments',
    'Attendance — daily student attendance and duty attendance for staff',
    'Grades & Reports — score entry, report cards, preschool assessments',
    'Assignments — homework, classwork, projects with parent submission',
    'Behaviour — merit/demerit points and behaviour trends',
    'Interventions — counselor cases, risk flags, follow-up workflows',
    'Fees & Finance — fee structures, Monnify virtual accounts, reconciliation',
    'Risk Analysis — early warning scores across attendance, grades, behaviour',
    'Settings — school profile, academic calendar, grading rules, notifications',
    'Subscriptions — plan tiers (Starter, Growth, Enterprise)',
  ],
  tips: [
    'Configure academic session/term in Settings before recording grades.',
    'Link subjects to classes and assign teachers for accurate teaching load.',
    'Parents pay fees via unique Monnify virtual accounts on their dashboard.',
    'Use Risk Analysis to find students needing intervention before exams.',
  ],
};

export type ChatIntent =
  | 'lesson_note'
  | 'timetable'
  | 'curriculum'
  | 'fees'
  | 'platform_help'
  | 'general';

/** When true, skip DB shortcuts and let the LLM answer (ChatGPT-style). */
export function shouldSkipFactualAnswer(question: string, intent: ChatIntent): boolean {
  if (intent === 'lesson_note' || intent === 'general') return true;

  const q = question.toLowerCase();

  const classLevel =
    /\bss\s*[1-3]\b|\bjss\s*[1-3]\b|\bprimary\s*[1-6]\b|\bbasic\s*[1-9]\b|\bgrade\s*\d+/;
  const subjectName =
    /\bgeneral maths\b|\bmathematics\b|\benglish\b|\bphysics\b|\bchemistry\b|\bbiology\b|\beconomics\b|\bliterature\b|\bgeography\b|\bagric|\bfurther maths\b|\bbasic science\b|\bsocial studies\b|\bcommerce\b|\baccounting\b|\bcivic\b|\bcrs\b|\birs\b|\byoruba\b|\bigbo\b|\bhausa\b|\bphe\b/;
  const termRef = /\b(1st|2nd|3rd|first|second|third)\s*term\b|\bterm\s*[123]\b/;
  const schemeRef =
    /\bscheme of work\b|\btopic(s)?\b|\bsyllabus\b|\bweekly plan\b|\blesson sequence\b/;

  if (classLevel.test(q) || subjectName.test(q) || schemeRef.test(q)) return true;
  if (termRef.test(q) && (classLevel.test(q) || subjectName.test(q) || intent === 'timetable' || intent === 'curriculum')) {
    return true;
  }

  if (intent === 'timetable') {
    const wantsSchoolRecords =
      /\b(my|our school|school)\b.*\b(timetable|schedule|teaching load)\b/.test(q) ||
      /\bteaching load\b/.test(q) ||
      /\bwhat (classes|subjects) do i teach\b/.test(q);
    if (!wantsSchoolRecords) return true;
  }

  if (intent === 'curriculum') {
    const wantsSchoolList =
      /\b(our school|in our school|school curriculum|list (all )?subjects)\b/.test(q);
    if (!wantsSchoolList) return true;
  }

  if (intent === 'platform_help' && q.length > 100) return true;

  return false;
}

export function detectChatIntent(question: string): ChatIntent {
  const q = question.toLowerCase();
  if (
    /lesson\s*(note|plan)|scheme of work|instructional note|draft.*(lesson|note|plan)|prepare.*(lesson|class)|teaching note/.test(
      q
    )
  ) {
    return 'lesson_note';
  }
  if (
    /timetable|time table|period|what (do|subject).*teach|my schedule|class schedule|weekly plan|scheme of work/.test(
      q
    )
  ) {
    return 'timetable';
  }
  if (/curriculum|subject list|what subjects|syllabus|scheme/.test(q)) {
    return 'curriculum';
  }
  if (/fee|payment|outstanding|virtual account|monnify|tuition/.test(q)) {
    return 'fees';
  }
  if (
    /how (do|to)|where (is|can)|what is edupulse|help me with|navigate|use the app|feature/.test(q)
  ) {
    return 'platform_help';
  }
  return 'general';
}

export type TeachingLoadEntry = {
  className: string;
  gradeLevel: string;
  subjectName: string;
  subjectCode: string | null;
  curriculumType: string;
  teacherName: string;
};

export type CurriculumSnapshot = {
  curriculumTypes: string[];
  subjects: Array<{
    name: string;
    code: string | null;
    curriculumType: string;
    description: string | null;
  }>;
  teachingLoad: TeachingLoadEntry[];
};

async function fetchSchoolProfile(schoolId: string) {
  const { data } = await supabase
    .from('schools')
    .select('name, school_type, state, city, motto')
    .eq('id', schoolId)
    .maybeSingle();
  return data
    ? {
        name: data.name,
        type: data.school_type,
        location: [data.city, data.state].filter(Boolean).join(', '),
        motto: data.motto,
      }
    : null;
}

async function fetchAcademicCalendarSnapshot(schoolId: string) {
  const [{ data: session }, { data: term }] = await Promise.all([
    supabase
      .from('academic_sessions')
      .select('name, start_date, end_date, is_current')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('academic_terms')
      .select('name, term_number, start_date, end_date, is_current')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle(),
  ]);
  return {
    session: session
      ? { name: session.name, start: session.start_date, end: session.end_date }
      : null,
    term: term
      ? { name: term.name, number: term.term_number, start: term.start_date, end: term.end_date }
      : null,
  };
}

async function fetchCurriculumSnapshot(
  schoolId: string,
  options?: { teacherId?: string }
): Promise<CurriculumSnapshot> {
  const [{ data: subjects }, { data: classSubjects }] = await Promise.all([
    supabase
      .from('subjects')
      .select('name, code, curriculum_type, description')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('class_subjects')
      .select(
        'teacher_id, classes(name, grade_level), subjects(name, code, curriculum_type), staff:teacher_id(full_name)'
      )
      .eq('school_id', schoolId),
  ]);

  const curriculumTypes = [
    ...new Set((subjects ?? []).map((s) => s.curriculum_type ?? 'nigerian')),
  ];

  let rows = classSubjects ?? [];
  if (options?.teacherId) {
    rows = rows.filter((r) => r.teacher_id === options.teacherId);
  }

  const teachingLoad: TeachingLoadEntry[] = rows.map((row) => {
    const cls = row.classes as { name?: string; grade_level?: string } | null;
    const sub = row.subjects as { name?: string; code?: string; curriculum_type?: string } | null;
    const staff = row.staff as { full_name?: string } | null;
    return {
      className: cls?.name ?? 'Class',
      gradeLevel: cls?.grade_level ?? '',
      subjectName: sub?.name ?? 'Subject',
      subjectCode: sub?.code ?? null,
      curriculumType: sub?.curriculum_type ?? 'nigerian',
      teacherName: staff?.full_name ?? 'Unassigned',
    };
  });

  return {
    curriculumTypes,
    subjects: (subjects ?? []).map((s) => ({
      name: s.name,
      code: s.code,
      curriculumType: s.curriculum_type ?? 'nigerian',
      description: s.description?.slice(0, 120) ?? null,
    })),
    teachingLoad,
  };
}

async function fetchDutyRosterSnapshot(schoolId: string) {
  const today = todayISO();
  const { data } = await supabase
    .from('duty_rosters')
    .select('week_start, week_end, staff_name, staff:staff_id(full_name), notes')
    .eq('school_id', schoolId)
    .lte('week_start', today)
    .gte('week_end', today)
    .order('week_start');

  return (data ?? []).map((row) => ({
    teacher: row.staff_name ?? (row.staff as { full_name?: string } | null)?.full_name ?? 'Staff',
    notes: row.notes,
    week: `${row.week_start} – ${row.week_end}`,
  }));
}

async function fetchFeeSnapshot(schoolId: string) {
  const [{ data: structures }, { count: pendingPayments }] = await Promise.all([
    supabase
      .from('fee_structures')
      .select('amount, description, class_id, classes(name), fee_types(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(25),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'pending'),
  ]);

  return {
    feeStructures: (structures ?? []).map((f) => {
      const feeTypeName = (f.fee_types as { name?: string } | null)?.name;
      const name = feeTypeName || f.description || 'School fee';
      return {
        name,
        amount: f.amount,
        className: (f.classes as { name?: string } | null)?.name ?? 'Class',
      };
    }),
    pendingPayments: pendingPayments ?? 0,
  };
}

async function fetchSharedKnowledgeBase(
  schoolId: string,
  options?: { staffId?: string; role?: UserRole }
) {
  const teacherFilter =
    options?.role === 'teacher' && options.staffId ? options.staffId : undefined;

  const [schoolProfile, academicCalendar, curriculum, dutyRoster, fees] = await Promise.all([
    fetchSchoolProfile(schoolId),
    fetchAcademicCalendarSnapshot(schoolId),
    fetchCurriculumSnapshot(schoolId, { teacherId: teacherFilter }),
    fetchDutyRosterSnapshot(schoolId),
    options?.role === 'finance' ||
    options?.role === 'admin' ||
    options?.role === 'principal' ||
    options?.role === 'parent'
      ? fetchFeeSnapshot(schoolId)
      : Promise.resolve(null),
  ]);

  return {
    schoolProfile,
    academicCalendar,
    curriculum,
    dutyRoster,
    fees,
    platformGuide: EDUPULSE_PLATFORM_GUIDE,
    timetableNote:
      'Period-by-period timetables are derived from class–subject–teacher assignments. Ask for "my teaching schedule" or a class timetable.',
  };
}

export function formatTeachingLoadAnswer(
  load: TeachingLoadEntry[],
  options?: { title?: string; forTeacher?: boolean }
): string {
  if (!load.length) {
    return 'No class–subject assignments on record yet. Add subjects and link them to classes in Admin → Subjects / Classes.';
  }

  const byClass = new Map<string, TeachingLoadEntry[]>();
  for (const entry of load) {
    const key = entry.className;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(entry);
  }

  const title =
    options?.title ??
    (options?.forTeacher ? 'Your teaching schedule (from school records):' : 'School teaching load:');

  const lines = [title, ''];
  for (const [className, entries] of byClass) {
    const subjects = entries
      .map((e) => `${e.subjectName}${e.teacherName !== 'Unassigned' ? ` (${e.teacherName})` : ''}`)
      .join(', ');
    lines.push(`• **${className}**${entries[0]?.gradeLevel ? ` (${entries[0].gradeLevel})` : ''}: ${subjects}`);
  }

  lines.push('', '_Based on class–subject assignments. Configure exact periods in Classes & Subjects._');
  return lines.join('\n');
}

export function formatCurriculumAnswer(snapshot: CurriculumSnapshot): string {
  if (!snapshot.subjects.length) {
    return 'No subjects in your curriculum yet. Add them under Admin → Subjects.';
  }

  const types = snapshot.curriculumTypes.join(', ');
  const lines = [
    `School curriculum (${snapshot.subjects.length} subjects, framework: ${types}):`,
    '',
    ...snapshot.subjects.map(
      (s) => `• ${s.name}${s.code ? ` [${s.code}]` : ''} — ${s.curriculumType}${s.description ? `: ${s.description}` : ''}`
    ),
  ];
  return lines.join('\n');
}

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
  const knowledgeBase = await fetchSharedKnowledgeBase(schoolId, { staffId, role: 'teacher' });

  return {
    schoolOverview,
    knowledgeBase,
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

async function buildAdminContext(schoolId: string, role: UserRole) {
  const [schoolOverview, attendanceToday, knowledgeBase] = await Promise.all([
    fetchSchoolOverview(schoolId),
    fetchTodayAttendanceSnapshot(schoolId),
    fetchSharedKnowledgeBase(schoolId, { role }),
  ]);
  return { schoolOverview, attendanceToday, knowledgeBase, ...schoolOverview };
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
  const knowledgeBase = await fetchSharedKnowledgeBase(schoolId, { staffId, role: 'counselor' });

  return {
    schoolOverview,
    knowledgeBase,
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
  const knowledgeBase = await fetchSharedKnowledgeBase(schoolId, { role: 'parent' });
  return { children: childSummaries, knowledgeBase };
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
              ...(await buildAdminContext(params.schoolId, params.role)),
              focus: 'fees, payments, and school finances',
            }
          : await buildAdminContext(params.schoolId, params.role);
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
  const intent = detectChatIntent(question);

  if (shouldSkipFactualAnswer(question, intent)) {
    return null;
  }

  const d = ctx.data;
  const overview = getSchoolOverview(d);
  const knowledgeBase = d.knowledgeBase as {
    curriculum?: CurriculumSnapshot;
    academicCalendar?: { session: { name: string } | null; term: { name: string } | null };
    dutyRoster?: Array<{ teacher: string; week: string; notes?: string | null }>;
    fees?: { feeStructures: Array<{ name: string; amount: number; className: string }>; pendingPayments: number };
    schoolProfile?: { name: string };
    platformGuide?: typeof EDUPULSE_PLATFORM_GUIDE;
  } | undefined;

  if (intent === 'lesson_note') {
    return null;
  }

  if (intent === 'timetable' || (q.includes('schedule') && !q.includes('subscription'))) {
    const load = knowledgeBase?.curriculum?.teachingLoad;
    if (load?.length) {
      return formatTeachingLoadAnswer(load, {
        forTeacher: ctx.role === 'teacher',
        title:
          ctx.role === 'teacher'
            ? 'Your teaching schedule (from school records):'
            : 'School teaching schedule (class–subject assignments):',
      });
    }
  }

  if (intent === 'curriculum' && (q.includes('our school') || q.includes('school curriculum') || q.includes('list all subject') || q.includes('list subject'))) {
    if (knowledgeBase?.curriculum) {
      return formatCurriculumAnswer(knowledgeBase.curriculum);
    }
  }

  if (intent === 'fees' && knowledgeBase?.fees) {
    const { feeStructures, pendingPayments } = knowledgeBase.fees;
    if (!feeStructures.length) {
      return 'No active fee structures on record. Set them up in Admin → Fee Settings.';
    }
    const lines = [
      'Active fee structures:',
      ...feeStructures.map((f) => `• ${f.name} — ₦${Number(f.amount).toLocaleString()} (${f.className})`),
      pendingPayments ? `\nPending payment records: ${pendingPayments}` : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  if (intent === 'platform_help') {
    const guide = knowledgeBase?.platformGuide ?? EDUPULSE_PLATFORM_GUIDE;
    if (q.includes('module') || q.includes('feature') || q.includes('what is edupulse') || q.includes('what can')) {
      return [
        '**EduPulse** is a school management platform focused on early intervention.',
        '',
        'Main modules:',
        ...guide.modules.map((m) => `• ${m}`),
        '',
        'Tips:',
        ...guide.tips.map((t) => `• ${t}`),
      ].join('\n');
    }
    if (q.includes('attendance')) return 'Open **Attendance** from the sidebar to mark daily student attendance or view reports.';
    if (q.includes('grade') || q.includes('report')) return 'Use **Grades** to enter scores and generate report cards. Configure grading rules in Settings first.';
    if (q.includes('fee') || q.includes('payment')) return '**Fees** page handles structures and collections. Parents pay via Monnify virtual accounts on their dashboard.';
    if (q.includes('intervention') || q.includes('counselor')) return '**Interventions** tracks counselor cases linked to risk flags. Counselors see assigned cases on their dashboard.';
    if (q.includes('assignment')) return 'Teachers create assignments under **Assignments**; parents and students can submit work from their portals.';
    if (q.includes('risk')) return '**Risk Analysis** combines attendance, grades, and behaviour into early-warning scores.';
    if (q.includes('subject') || q.includes('class')) return 'Configure **Classes** and **Subjects** under Admin, then link teachers via class–subject assignments.';
  }

  if (
    knowledgeBase?.academicCalendar &&
    (q.includes('academic calendar') ||
      q.includes('current session') ||
      q.includes('current term') ||
      (q.includes('session') && q.includes('school')) ||
      (q.includes('term') && q.includes('school') && q.includes('calendar')))
  ) {
    const { session, term } = knowledgeBase.academicCalendar;
    const parts: string[] = [];
    if (session) parts.push(`Session: **${session.name}** (${session.start} – ${session.end})`);
    if (term) parts.push(`Term: **${term.name}** (${term.start} – ${term.end})`);
    if (parts.length) return `Academic calendar:\n${parts.join('\n')}`;
    return 'No current session/term marked active. Set the academic calendar in Settings.';
  }

  if (knowledgeBase?.dutyRoster?.length && (q.includes('duty') || q.includes('on duty'))) {
    return [
      'Teachers on duty this week:',
      ...knowledgeBase.dutyRoster.map(
        (r) => `• ${r.teacher} (${r.week})${r.notes ? ` — ${r.notes}` : ''}`
      ),
    ].join('\n');
  }

  if (knowledgeBase?.schoolProfile?.name && q.includes('school name')) {
    return `Your school is **${knowledgeBase.schoolProfile.name}**.`;
  }

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
