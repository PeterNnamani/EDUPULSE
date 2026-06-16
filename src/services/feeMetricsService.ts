import { supabase } from '@/lib/supabase';
import { buildClassDisplayMap, formatClassDisplay } from '@/utils/displayUtils';

export interface FeeMetrics {
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  studentsWithBalance: number;
  collectionRate: number;
}

export interface ClassOutstanding {
  class: string;
  amount: number;
  students: number;
}

export interface MonthlyCollection {
  month: string;
  expected: number;
  collected: number;
}

/** Fee totals aligned with Fees page: class fees × active students vs completed payments. */
export async function computeFeeMetrics(schoolId: string): Promise<FeeMetrics> {
  const [{ data: students }, { data: fees }, { data: payments }] = await Promise.all([
    supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', schoolId)
      .eq('status', 'active'),
    supabase.from('fees').select('class_id, amount').eq('school_id', schoolId).eq('is_active', true),
    supabase
      .from('payments')
      .select('student_id, amount')
      .eq('school_id', schoolId)
      .eq('status', 'completed'),
  ]);

  const feeByClass = new Map((fees ?? []).map((f) => [f.class_id, Number(f.amount ?? 0)]));
  let totalExpected = 0;
  const paidByStudent = new Map<string, number>();

  for (const p of payments ?? []) {
    paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) ?? 0) + Number(p.amount ?? 0));
  }

  let studentsWithBalance = 0;
  for (const s of students ?? []) {
    const expected = s.class_id ? feeByClass.get(s.class_id) ?? 0 : 0;
    totalExpected += expected;
    const paid = paidByStudent.get(s.id) ?? 0;
    if (expected > paid) studentsWithBalance++;
  }

  const totalCollected = [...paidByStudent.values()].reduce((sum, n) => sum + n, 0);
  const totalOutstanding = Math.max(0, totalExpected - totalCollected);
  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : totalCollected > 0 ? 100 : 0;

  return {
    totalExpected,
    totalCollected,
    totalOutstanding,
    studentsWithBalance,
    collectionRate,
  };
}

export async function fetchOutstandingByClass(
  schoolId: string,
  limit = 8
): Promise<ClassOutstanding[]> {
  const [{ data: students }, { data: classes }, { data: fees }, { data: payments }] = await Promise.all([
    supabase.from('students').select('id, class_id').eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('classes').select('id, name, grade_level, section').eq('school_id', schoolId),
    supabase.from('fees').select('class_id, amount').eq('school_id', schoolId).eq('is_active', true),
    supabase
      .from('payments')
      .select('student_id, amount')
      .eq('school_id', schoolId)
      .eq('status', 'completed'),
  ]);

  const feeByClass = new Map((fees ?? []).map((f) => [f.class_id, Number(f.amount ?? 0)]));
  const paidByStudent = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) ?? 0) + Number(p.amount ?? 0));
  }

  const classMap = buildClassDisplayMap(classes ?? []);
  const byClass = new Map<string, { amount: number; students: number }>();

  for (const s of students ?? []) {
    if (!s.class_id) continue;
    const expected = feeByClass.get(s.class_id) ?? 0;
    const paid = paidByStudent.get(s.id) ?? 0;
    const balance = Math.max(0, expected - paid);
    if (balance <= 0) continue;

    const name = classMap.get(s.class_id) ?? 'Unknown';
    const cur = byClass.get(name) ?? { amount: 0, students: 0 };
    byClass.set(name, { amount: cur.amount + balance, students: cur.students + 1 });
  }

  return [...byClass.entries()]
    .map(([className, v]) => ({ class: className, amount: v.amount, students: v.students }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export async function fetchMonthlyCollections(schoolId: string, months = 6): Promise<MonthlyCollection[]> {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, created_at, paid_at')
    .eq('school_id', schoolId)
    .eq('status', 'completed');

  const { totalExpected } = await computeFeeMetrics(schoolId);
  const monthlyExpected = months > 0 ? totalExpected / months : 0;

  const result: MonthlyCollection[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    const collected = (payments ?? [])
      .filter((p) => {
        const raw = p.paid_at ?? p.created_at;
        if (!raw) return false;
        const d = new Date(raw);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    result.push({
      month: monthStart.toLocaleString('default', { month: 'short' }),
      expected: Math.round(monthlyExpected),
      collected,
    });
  }

  return result;
}

export function formatNgn(amount: number, compact = true): string {
  if (compact) {
    if (amount >= 1_000_000) return `NGN ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `NGN ${(amount / 1_000).toFixed(0)}K`;
  }
  return `NGN ${amount.toLocaleString()}`;
}
