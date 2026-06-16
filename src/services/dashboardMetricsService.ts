import { supabase } from '@/lib/supabase';
import { computeFeeMetrics } from './feeMetricsService';
import { formatClassDisplay } from '@/utils/displayUtils';

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function gradePercent(score: number | null, maxScore: number | null): number {
  const max = maxScore && maxScore > 0 ? maxScore : 100;
  if (score == null) return 0;
  return Math.round((score / max) * 100);
}

export async function getAttendanceRate(schoolId: string, days = 7): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const { data: rows } = await supabase
    .from('attendance')
    .select('status')
    .eq('school_id', schoolId)
    .gte('date', sinceStr);

  if (!rows?.length) return 0;
  const present = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
  return pct(present, rows.length);
}

export async function getAverageGrade(schoolId: string, days = 30): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from('grades')
    .select('score, max_score')
    .eq('school_id', schoolId)
    .gte('created_at', since);

  if (!rows?.length) return 0;
  const sum = rows.reduce((acc, g) => acc + gradePercent(g.score, g.max_score), 0);
  return Math.round(sum / rows.length);
}

export async function countHighRiskStudents(schoolId: string): Promise<number> {
  const { count: fromScores } = await supabase
    .from('risk_scores')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('risk_level', ['high', 'critical']);

  if (fromScores && fromScores > 0) return fromScores;

  const { count: fromStudents } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .in('risk_level', ['high', 'critical']);

  return fromStudents ?? 0;
}

export async function getPendingFeesStudentCount(schoolId: string): Promise<number> {
  const { studentsWithBalance } = await computeFeeMetrics(schoolId);
  return studentsWithBalance;
}

export interface DailyAttendancePoint {
  day: string;
  present: number;
  absent: number;
}

export async function fetchWeeklyAttendanceChart(schoolId: string): Promise<DailyAttendancePoint[]> {
  const days: DailyAttendancePoint[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const { data: rows } = await supabase
      .from('attendance')
      .select('status')
      .eq('school_id', schoolId)
      .eq('date', dateStr);

    const present = (rows ?? []).filter((r) => r.status === 'present' || r.status === 'late').length;
    const absent = (rows ?? []).filter((r) => r.status === 'absent').length;

    days.push({
      day: dayNames[d.getDay()],
      present,
      absent,
    });
  }

  return days;
}

export interface ClassPerformancePoint {
  class: string;
  average: number;
}

export async function fetchClassPerformanceChart(schoolId: string): Promise<ClassPerformancePoint[]> {
  const [{ data: classes }, { data: grades }] = await Promise.all([
    supabase.from('classes').select('id, name, grade_level, section').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('grades').select('class_id, score, max_score').eq('school_id', schoolId),
  ]);

  if (!classes?.length) return [];

  return classes
    .map((cls) => {
      const classGrades = (grades ?? []).filter((g) => g.class_id === cls.id);
      if (!classGrades.length) return { class: formatClassDisplay(cls), average: 0 };
      const avg =
        classGrades.reduce((sum, g) => sum + gradePercent(g.score, g.max_score), 0) / classGrades.length;
      return { class: formatClassDisplay(cls), average: Math.round(avg) };
    })
    .filter((p) => p.average > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, 6);
}
