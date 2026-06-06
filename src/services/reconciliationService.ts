import { supabase } from '@/lib/supabase';

/**
 * RECONCILIATION SERVICE
 *
 * Reconciles expected vs received fees, computes daily finance summaries,
 * collection/outstanding reports, and flags anomalies (overpayments, partials,
 * large outstanding balances). Anomalies alert finance officers + admins.
 */

export interface ReconciliationSummary {
  date: string;
  expected: number;
  received: number;
  overpaid: number;
  partial: number;
  outstanding: number;
  collectionRate: number;
  anomalies: ReconciliationAnomaly[];
}

export interface ReconciliationAnomaly {
  type: 'overpayment' | 'partial' | 'large_outstanding';
  studentId: string;
  studentName: string;
  amount: number;
  detail: string;
}

export interface OutstandingRow {
  studentId: string;
  studentName: string;
  className: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

const LARGE_OUTSTANDING_THRESHOLD = 100000;

export const reconciliationService = {
  /**
   * Build a reconciliation snapshot from current obligations + payments.
   * `date` defaults to today (used for the daily collected figure).
   */
  async buildSummary(schoolId: string, date?: string): Promise<ReconciliationSummary> {
    const day = date ?? new Date().toISOString().slice(0, 10);

    const { data: obligations } = await supabase
      .from('fee_obligations')
      .select('student_id, amount_due, amount_paid, amount_outstanding')
      .eq('school_id', schoolId);

    const rows = obligations ?? [];
    let expected = 0;
    let received = 0;
    let outstanding = 0;
    let overpaid = 0;
    let partial = 0;

    const byStudent = new Map<string, { due: number; paid: number; outstanding: number }>();
    for (const o of rows) {
      const due = Number(o.amount_due ?? 0);
      const paid = Number(o.amount_paid ?? 0);
      const out = Number(o.amount_outstanding ?? 0);
      expected += due;
      received += paid;
      outstanding += Math.max(0, out);
      if (paid > due) overpaid += paid - due;
      if (paid > 0 && out > 0) partial += out;

      const agg = byStudent.get(o.student_id) ?? { due: 0, paid: 0, outstanding: 0 };
      agg.due += due;
      agg.paid += paid;
      agg.outstanding += Math.max(0, out);
      byStudent.set(o.student_id, agg);
    }

    // Detect anomalies and resolve student names.
    const anomalies: ReconciliationAnomaly[] = [];
    const flaggedIds: string[] = [];
    for (const [studentId, agg] of byStudent) {
      if (agg.paid > agg.due && agg.due > 0) {
        anomalies.push({ type: 'overpayment', studentId, studentName: '', amount: agg.paid - agg.due, detail: 'Paid more than owed' });
        flaggedIds.push(studentId);
      } else if (agg.outstanding >= LARGE_OUTSTANDING_THRESHOLD) {
        anomalies.push({ type: 'large_outstanding', studentId, studentName: '', amount: agg.outstanding, detail: 'Large outstanding balance' });
        flaggedIds.push(studentId);
      }
    }

    if (flaggedIds.length) {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', [...new Set(flaggedIds)]);
      const nameMap = new Map((students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]));
      for (const a of anomalies) a.studentName = nameMap.get(a.studentId) ?? 'Student';
    }

    const collectionRate = expected > 0 ? Math.round((received / expected) * 100) : 0;

    return { date: day, expected, received, overpaid, partial, outstanding, collectionRate, anomalies };
  },

  /** Per-student outstanding report. */
  async getOutstandingReport(schoolId: string): Promise<OutstandingRow[]> {
    const { data: obligations } = await supabase
      .from('fee_obligations')
      .select('student_id, amount_due, amount_paid, amount_outstanding')
      .eq('school_id', schoolId);

    const byStudent = new Map<string, { due: number; paid: number; balance: number }>();
    for (const o of obligations ?? []) {
      const agg = byStudent.get(o.student_id) ?? { due: 0, paid: 0, balance: 0 };
      agg.due += Number(o.amount_due ?? 0);
      agg.paid += Number(o.amount_paid ?? 0);
      agg.balance += Math.max(0, Number(o.amount_outstanding ?? 0));
      byStudent.set(o.student_id, agg);
    }

    const ids = [...byStudent.keys()];
    if (!ids.length) return [];

    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, class_id')
      .in('id', ids);
    const classIds = [...new Set((students ?? []).map((s) => s.class_id).filter(Boolean))];
    const { data: classes } = classIds.length
      ? await supabase.from('classes').select('id, name').in('id', classIds as string[])
      : { data: [] as Array<{ id: string; name: string }> };
    const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

    const rows: OutstandingRow[] = (students ?? []).map((s) => {
      const agg = byStudent.get(s.id)!;
      return {
        studentId: s.id,
        studentName: `${s.first_name} ${s.last_name}`.trim(),
        className: s.class_id ? classMap.get(s.class_id) ?? '—' : '—',
        totalDue: agg.due,
        totalPaid: agg.paid,
        balance: agg.balance,
      };
    });

    return rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  },

  /** Persist today's summary and alert finance/admins of anomalies. */
  async runDailyReconciliation(schoolId: string): Promise<ReconciliationSummary> {
    const summary = await this.buildSummary(schoolId);

    await supabase.from('reconciliation_summaries').upsert(
      [
        {
          school_id: schoolId,
          summary_date: summary.date,
          expected: summary.expected,
          received: summary.received,
          overpaid: summary.overpaid,
          partial: summary.partial,
          outstanding: summary.outstanding,
          anomalies: summary.anomalies,
        },
      ],
      { onConflict: 'school_id,summary_date' }
    );

    if (summary.anomalies.length > 0) {
      try {
        const [{ data: finance }, { data: admins }] = await Promise.all([
          supabase.from('staff').select('id').eq('school_id', schoolId).eq('role', 'finance'),
          supabase.from('staff').select('id').eq('school_id', schoolId).eq('role', 'admin'),
        ]);
        const { notificationTriggerService } = await import('@/services/notificationTriggerService');
        const msg = `${summary.anomalies.length} payment anomaly(ies) detected. Collection rate ${summary.collectionRate}%. Outstanding ₦${summary.outstanding.toLocaleString()}.`;
        await notificationTriggerService.onReconciliationAnomaly(
          schoolId,
          (finance ?? []).map((f) => f.id),
          (admins ?? []).map((a) => a.id),
          msg
        );
      } catch (e) {
        console.warn('[RECONCILIATION] anomaly alert failed:', e);
      }
    }

    return summary;
  },

  async getRecentSummaries(schoolId: string, limit = 14) {
    const { data } = await supabase
      .from('reconciliation_summaries')
      .select('*')
      .eq('school_id', schoolId)
      .order('summary_date', { ascending: false })
      .limit(limit);
    return data ?? [];
  },
};
