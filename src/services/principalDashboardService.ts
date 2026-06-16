import { supabase } from '@/lib/supabase';
import { formatClassDisplay } from '@/utils/displayUtils';

export interface PrincipalKeyMetrics {
  totalStudents: number;
  totalStaff: number;
  attendanceRate: number;
  averageGrade: number;
  highRiskStudents: number;
  openCases: number;
  studentsChange: string;
  staffChange: string;
  attendanceChange: string;
  gradeChange: string;
  highRiskChange: string;
  openCasesChange: string;
}

export interface MonthlyTrendPoint {
  month: string;
  attendance: number;
  performance: number;
  behaviour: number;
}

export interface ClassRanking {
  class: string;
  average: number;
  students: number;
}

export interface SubjectPerformance {
  subject: string;
  score: number;
}

export interface RiskTrendPoint {
  week: string;
  high: number;
  medium: number;
  low: number;
}

export interface PrincipalAlert {
  id: string;
  type: 'critical' | 'warning' | 'positive';
  title: string;
  description: string;
}

export interface PrincipalDashboardData {
  metrics: PrincipalKeyMetrics;
  monthlyTrends: MonthlyTrendPoint[];
  classRankings: ClassRanking[];
  subjectPerformance: SubjectPerformance[];
  riskTrend: RiskTrendPoint[];
  alerts: PrincipalAlert[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function gradePercent(score: number | null, maxScore: number | null): number {
  const max = maxScore && maxScore > 0 ? maxScore : 100;
  if (score == null) return 0;
  return Math.round((score / max) * 100);
}

export async function fetchPrincipalDashboard(schoolId: string): Promise<PrincipalDashboardData> {
  const [
    metrics,
    monthlyTrends,
    classRankings,
    subjectPerformance,
    riskTrend,
    alerts,
  ] = await Promise.all([
    fetchKeyMetrics(schoolId),
    fetchMonthlyTrends(schoolId),
    fetchClassRankings(schoolId),
    fetchSubjectPerformance(schoolId),
    fetchRiskTrend(schoolId),
    fetchRecentAlerts(schoolId),
  ]);

  return { metrics, monthlyTrends, classRankings, subjectPerformance, riskTrend, alerts };
}

async function fetchKeyMetrics(schoolId: string): Promise<PrincipalKeyMetrics> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: students, count: studentCount } = await supabase
    .from('students')
    .select('id, admission_date', { count: 'exact' })
    .eq('school_id', schoolId)
    .eq('status', 'active');

  const totalStudents = studentCount ?? 0;
  const newStudents = (students ?? []).filter(
    (s) => s.admission_date && new Date(s.admission_date) > threeMonthsAgo
  ).length;

  const { data: staff, count: staffCount } = await supabase
    .from('staff')
    .select('id, is_active', { count: 'exact' })
    .eq('school_id', schoolId);

  const totalStaff = staffCount ?? 0;
  const inactiveStaff = (staff ?? []).filter((s) => s.is_active === false).length;

  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('school_id', schoolId)
    .gte('date', sevenDaysAgo.split('T')[0]);

  let attendanceRate = 0;
  if (attendanceRows && attendanceRows.length > 0) {
    const present = attendanceRows.filter((a) => a.status === 'present' || a.status === 'late').length;
    attendanceRate = pct(present, attendanceRows.length);
  }

  const { data: gradeRows } = await supabase
    .from('grades')
    .select('score, max_score, created_at')
    .eq('school_id', schoolId)
    .gte('created_at', thirtyDaysAgo);

  let averageGrade = 0;
  if (gradeRows && gradeRows.length > 0) {
    const sum = gradeRows.reduce((acc, g) => acc + gradePercent(g.score, g.max_score), 0);
    averageGrade = Math.round(sum / gradeRows.length);
  }

  const { count: highRiskFromScores } = await supabase
    .from('risk_scores')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('risk_level', ['high', 'critical']);

  let highRiskStudents = highRiskFromScores ?? 0;
  if (highRiskStudents === 0) {
    const { count: highRiskFromStudents } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .in('risk_level', ['high', 'critical']);
    highRiskStudents = highRiskFromStudents ?? 0;
  }

  const { count: openCases } = await supabase
    .from('intervention_cases')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('status', ['open', 'in_progress']);

  const { count: prevHighRisk } = await supabase
    .from('risk_scores')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('risk_level', ['high', 'critical'])
    .lt('last_calculated', thirtyDaysAgo);

  const riskDelta = (prevHighRisk ?? 0) - highRiskStudents;

  return {
    totalStudents,
    totalStaff,
    attendanceRate,
    averageGrade,
    highRiskStudents,
    openCases: openCases ?? 0,
    studentsChange: newStudents > 0 ? `+${newStudents} this term` : 'No new enrollments',
    staffChange: inactiveStaff === 0 ? 'All active' : `${inactiveStaff} inactive`,
    attendanceChange: attendanceRows?.length ? `${attendanceRate}% (7d)` : 'No records yet',
    gradeChange: gradeRows?.length ? `${averageGrade}% avg (30d)` : 'No grades yet',
    highRiskChange: riskDelta >= 0 ? `-${riskDelta}` : `+${Math.abs(riskDelta)}`,
    openCasesChange: `${openCases ?? 0} active`,
  };
}

async function fetchMonthlyTrends(schoolId: string): Promise<MonthlyTrendPoint[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - 5);
  start.setDate(1);
  const startIso = start.toISOString().split('T')[0];

  const [{ data: attendance }, { data: grades }, { data: behaviour }] = await Promise.all([
    supabase
      .from('attendance')
      .select('status, date')
      .eq('school_id', schoolId)
      .gte('date', startIso),
    supabase
      .from('grades')
      .select('score, max_score, created_at')
      .eq('school_id', schoolId)
      .gte('created_at', start.toISOString()),
    supabase
      .from('behaviour_records')
      .select('behaviour_type, date')
      .eq('school_id', schoolId)
      .gte('date', startIso),
  ]);

  const buckets = new Map<string, { att: { p: number; t: number }; perf: number[]; beh: { pos: number; total: number } }>();

  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { att: { p: 0, t: 0 }, perf: [], beh: { pos: 0, total: 0 } });
  }

  attendance?.forEach((row) => {
    const key = row.date?.slice(0, 7);
    const b = key ? buckets.get(key) : undefined;
    if (!b) return;
    b.att.t += 1;
    if (row.status === 'present' || row.status === 'late') b.att.p += 1;
  });

  grades?.forEach((row) => {
    const key = row.created_at?.slice(0, 7);
    const b = key ? buckets.get(key) : undefined;
    if (!b) return;
    b.perf.push(gradePercent(row.score, row.max_score));
  });

  behaviour?.forEach((row) => {
    const key = row.date?.slice(0, 7);
    const b = key ? buckets.get(key) : undefined;
    if (!b) return;
    b.beh.total += 1;
    if (['merit', 'commendation'].includes(row.behaviour_type)) b.beh.pos += 1;
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => {
      const monthIndex = parseInt(key.split('-')[1], 10) - 1;
      const perfAvg = b.perf.length ? Math.round(b.perf.reduce((s, v) => s + v, 0) / b.perf.length) : 0;
      const behScore = b.beh.total ? pct(b.beh.pos, b.beh.total) : 0;
      return {
        month: MONTH_LABELS[monthIndex] ?? key,
        attendance: pct(b.att.p, b.att.t),
        performance: perfAvg,
        behaviour: behScore,
      };
    });
}

async function fetchClassRankings(schoolId: string): Promise<ClassRanking[]> {
  const [{ data: classes }, { data: students }, { data: grades }] = await Promise.all([
    supabase.from('classes').select('id, name, grade_level, section').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('students').select('id, class_id').eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('grades').select('class_id, score, max_score').eq('school_id', schoolId),
  ]);

  const studentCountByClass = new Map<string, number>();
  students?.forEach((s) => {
    if (!s.class_id) return;
    studentCountByClass.set(s.class_id, (studentCountByClass.get(s.class_id) ?? 0) + 1);
  });

  const scoresByClass = new Map<string, number[]>();
  grades?.forEach((g) => {
    if (!g.class_id) return;
    const list = scoresByClass.get(g.class_id) ?? [];
    list.push(gradePercent(g.score, g.max_score));
    scoresByClass.set(g.class_id, list);
  });

  const rankings: ClassRanking[] = (classes ?? []).map((c) => {
    const scores = scoresByClass.get(c.id) ?? [];
    const average = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    return {
      class: formatClassDisplay(c),
      average,
      students: studentCountByClass.get(c.id) ?? 0,
    };
  });

  return rankings.sort((a, b) => b.average - a.average).slice(0, 8);
}

async function fetchSubjectPerformance(schoolId: string): Promise<SubjectPerformance[]> {
  const { data: grades } = await supabase
    .from('grades')
    .select('subject_id, score, max_score, subjects(name)')
    .eq('school_id', schoolId);

  const bySubject = new Map<string, number[]>();
  grades?.forEach((g: { subject_id: string; score: number | null; max_score: number | null; subjects?: { name: string } | { name: string }[] }) => {
    const subjectName = Array.isArray(g.subjects)
      ? g.subjects[0]?.name
      : g.subjects?.name ?? 'Unknown';
    const list = bySubject.get(subjectName) ?? [];
    list.push(gradePercent(g.score, g.max_score));
    bySubject.set(subjectName, list);
  });

  return Array.from(bySubject.entries())
    .map(([subject, scores]) => ({
      subject,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function fetchRiskTrend(schoolId: string): Promise<RiskTrendPoint[]> {
  const { data: riskScores } = await supabase
    .from('risk_scores')
    .select('risk_level, last_calculated')
    .eq('school_id', schoolId)
    .order('last_calculated', { ascending: false })
    .limit(500);

  if (!riskScores?.length) {
    const { data: students } = await supabase
      .from('students')
      .select('risk_level')
      .eq('school_id', schoolId)
      .eq('status', 'active');

    const counts = { high: 0, medium: 0, low: 0 };
    students?.forEach((s) => {
      const level = s.risk_level ?? 'low';
      if (level === 'high' || level === 'critical') counts.high += 1;
      else if (level === 'medium') counts.medium += 1;
      else counts.low += 1;
    });
    return [{ week: 'Current', ...counts }];
  }

  const weeks: RiskTrendPoint[] = [];
  for (let i = 3; i >= 0; i--) {
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const inWeek = riskScores.filter((r) => {
      if (!r.last_calculated) return i === 0;
      const d = new Date(r.last_calculated);
      return d >= start && d <= end;
    });
    const slice = i === 0 ? riskScores : inWeek.length ? inWeek : riskScores;
    weeks.push({
      week: `W${4 - i}`,
      high: slice.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length,
      medium: slice.filter((r) => r.risk_level === 'medium').length,
      low: slice.filter((r) => r.risk_level === 'low').length,
    });
  }
  return weeks;
}

async function fetchRecentAlerts(schoolId: string): Promise<PrincipalAlert[]> {
  const { data: alerts } = await supabase
    .from('student_alerts')
    .select('id, alert_type, risk_level, title, description, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (alerts?.length) {
    return alerts.map((a) => ({
      id: a.id,
      type:
        a.risk_level === 'critical' || a.risk_level === 'high'
          ? 'critical'
          : a.risk_level === 'medium'
            ? 'warning'
            : 'positive',
      title: a.title,
      description: a.description,
    }));
  }

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, message, priority, created_at')
    .eq('school_id', schoolId)
    .eq('recipient_role', 'principal')
    .order('created_at', { ascending: false })
    .limit(6);

  return (notifications ?? []).map((n) => ({
    id: n.id,
    type: n.priority === 'high' || n.priority === 'urgent' ? 'critical' : 'warning',
    title: n.title ?? 'School notification',
    description: n.message ?? '',
  }));
}

export type { SchoolProfile } from '@/services/schoolSettingsService';
export { fetchSchoolProfile } from '@/services/schoolSettingsService';
