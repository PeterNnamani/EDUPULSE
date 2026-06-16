import { supabase } from '@/lib/supabase';
import { buildClassDisplayMap } from '@/utils/displayUtils';
import {
  computeFeeMetrics,
  fetchMonthlyCollections,
  fetchOutstandingByClass,
  formatNgn,
} from './feeMetricsService';

export interface FinanceRecentPayment {
  id: string;
  student: string;
  class: string;
  amount: number;
  method: string;
  time: string;
}

export interface FinanceDashboardData {
  sessionLabel: string;
  collectedToday: number;
  paymentsTodayCount: number;
  metrics: {
    totalCollected: string;
    totalCollectedSub: string;
    outstanding: string;
    outstandingSub: string;
    collectedToday: string;
    collectedTodaySub: string;
    collectionRate: string;
    collectionRateSub: string;
  };
  monthlyChart: { month: string; revenue: number; collections: number }[];
  outstandingByClass: { class: string; amount: number; students: number }[];
  recentPayments: FinanceRecentPayment[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
  return `${Math.floor(diff / 86_400_000)} days ago`;
}

export async function fetchFinanceDashboard(
  schoolId: string,
  sessionLabel: string
): Promise<FinanceDashboardData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [feeMetrics, monthly, outstandingByClass, paymentsRes, studentsRes, classesRes] =
    await Promise.all([
      computeFeeMetrics(schoolId),
      fetchMonthlyCollections(schoolId, 6),
      fetchOutstandingByClass(schoolId, 8),
      supabase
        .from('payments')
        .select('id, student_id, amount, payment_method, created_at, paid_at, status')
        .eq('school_id', schoolId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', schoolId),
      supabase.from('classes').select('id, name, grade_level, section').eq('school_id', schoolId),
    ]);

  const payments = paymentsRes.data ?? [];
  const studentMap = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
  const classMap = buildClassDisplayMap(classesRes.data ?? []);

  const todayPayments = payments.filter((p) => {
    const raw = p.paid_at ?? p.created_at;
    return raw && new Date(raw) >= todayStart;
  });
  const collectedToday = todayPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const recentPayments: FinanceRecentPayment[] = payments.slice(0, 5).map((p) => {
    const student = studentMap.get(p.student_id);
    const className = student?.class_id ? classMap.get(student.class_id) ?? '—' : '—';
    return {
      id: p.id,
      student: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
      class: className,
      amount: Number(p.amount ?? 0),
      method: (p.payment_method ?? 'transfer').replace('_', ' '),
      time: relativeTime(p.paid_at ?? p.created_at),
    };
  });

  return {
    sessionLabel,
    collectedToday,
    paymentsTodayCount: todayPayments.length,
    metrics: {
      totalCollected: formatNgn(feeMetrics.totalCollected),
      totalCollectedSub: `${feeMetrics.collectionRate}% of expected`,
      outstanding: formatNgn(feeMetrics.totalOutstanding),
      outstandingSub: `${feeMetrics.studentsWithBalance} student${feeMetrics.studentsWithBalance !== 1 ? 's' : ''} owing`,
      collectedToday: formatNgn(collectedToday),
      collectedTodaySub: `${todayPayments.length} payment${todayPayments.length !== 1 ? 's' : ''} today`,
      collectionRate: `${feeMetrics.collectionRate}%`,
      collectionRateSub:
        feeMetrics.totalExpected > 0
          ? `${formatNgn(feeMetrics.totalExpected)} expected`
          : 'No fees configured',
    },
    monthlyChart: monthly.map((m) => ({
      month: m.month,
      revenue: m.expected,
      collections: m.collected,
    })),
    outstandingByClass,
    recentPayments,
  };
}
