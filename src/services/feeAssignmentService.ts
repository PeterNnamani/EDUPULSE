import { supabase } from '@/lib/supabase';

/**
 * FEE ASSIGNMENT SERVICE (Advanced Finance Automation)
 *
 * Automatically assigns class fee structures to students on registration,
 * promotion or class-change. Creates fee_obligations (invoice model) and
 * payment schedules, and computes balances. fee_obligations is the source of truth.
 */

export type FeeTrigger = 'registration' | 'promotion' | 'class_change' | 'manual';

export interface StudentInvoice {
  studentId: string;
  invoiceNumber: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
  lineItems: Array<{
    obligationId: string;
    feeTypeName: string;
    amountDue: number;
    amountPaid: number;
    amountOutstanding: number;
    dueDate: string | null;
  }>;
}

function generateInvoiceNumber(schoolId: string): string {
  const short = schoolId.slice(0, 6).toUpperCase();
  return `INV-${short}-${Date.now().toString(36).toUpperCase()}`;
}

export const feeAssignmentService = {
  async getCurrentSession(schoolId: string): Promise<{ id: string } | null> {
    const { data: current } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();
    if (current) return current;
    const { data: latest } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return latest;
  },

  async getCurrentTerm(schoolId: string): Promise<{ id: string } | null> {
    const { data: current } = await supabase
      .from('academic_terms')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();
    if (current) return current;
    const { data: latest } = await supabase
      .from('academic_terms')
      .select('id')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return latest;
  },

  /**
   * Create fee obligations for a student from the active fee structures of their class.
   */
  async assignFeesForStudent(
    schoolId: string,
    studentId: string,
    classId: string,
    trigger: FeeTrigger = 'manual'
  ): Promise<{ success: boolean; created: number; error?: string }> {
    try {
      if (!schoolId || !studentId || !classId) {
        return { success: false, created: 0, error: 'Missing parameters' };
      }

      const session = await this.getCurrentSession(schoolId);
      if (!session) return { success: false, created: 0, error: 'No academic session configured' };

      const term = await this.getCurrentTerm(schoolId);

      // Active fee structures for this class in this session (or session-agnostic).
      const { data: structures } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('is_active', true);

      const applicable = (structures ?? []).filter(
        (s) => !s.session_id || s.session_id === session.id
      );
      if (applicable.length === 0) return { success: true, created: 0 };

      // Existing obligations to avoid duplicates.
      const { data: existing } = await supabase
        .from('fee_obligations')
        .select('fee_structure_id')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('session_id', session.id);
      const existingSet = new Set((existing ?? []).map((e) => e.fee_structure_id));

      const invoiceNumber = generateInvoiceNumber(schoolId);
      let created = 0;

      for (const s of applicable) {
        if (existingSet.has(s.id)) continue;

        const amountDue = Number(s.amount ?? 0);
        const dueDate = s.due_date
          ? new Date(new Date().getFullYear(), (s.due_month ?? new Date().getMonth() + 1) - 1, s.due_date)
              .toISOString()
              .slice(0, 10)
          : null;

        const { data: obligation, error } = await supabase
          .from('fee_obligations')
          .insert([
            {
              school_id: schoolId,
              student_id: studentId,
              fee_structure_id: s.id,
              session_id: session.id,
              term_id: term?.id ?? null,
              amount_due: amountDue,
              amount_paid: 0,
              amount_outstanding: amountDue,
              due_date: dueDate,
              invoice_number: invoiceNumber,
            },
          ])
          .select('id')
          .single();

        if (error || !obligation) {
          console.warn('[FEE_ASSIGN] obligation insert failed:', error?.message);
          continue;
        }
        created += 1;

        // Single installment schedule (can be split later).
        await supabase.from('payment_schedules').insert([
          {
            school_id: schoolId,
            student_id: studentId,
            fee_obligation_id: obligation.id,
            due_date: dueDate ?? new Date().toISOString().slice(0, 10),
            amount: amountDue,
            status: 'pending',
          },
        ]);
      }

      if (created > 0) {
        const { auditService } = await import('@/services/auditService');
        void auditService.logAudit({
          schoolId,
          userType: 'system',
          action: 'fee_assigned',
          entityType: 'fee_obligation',
          entityId: studentId,
          newValues: { classId, trigger, created, invoiceNumber },
        });
      }

      return { success: true, created };
    } catch (err) {
      return {
        success: false,
        created: 0,
        error: err instanceof Error ? err.message : 'Failed to assign fees',
      };
    }
  },

  /**
   * Build a consolidated invoice view for a student from their obligations.
   */
  async getStudentInvoice(schoolId: string, studentId: string): Promise<StudentInvoice> {
    const { data: obligations } = await supabase
      .from('fee_obligations')
      .select('id, amount_due, amount_paid, amount_outstanding, due_date, invoice_number, fee_structure_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);

    const rows = obligations ?? [];

    // Resolve fee type names via structures.
    const structureIds = [...new Set(rows.map((r) => r.fee_structure_id))];
    const feeTypeNameByStructure = new Map<string, string>();
    if (structureIds.length) {
      const { data: structures } = await supabase
        .from('fee_structures')
        .select('id, fee_type_id, description, fee_types(name)')
        .in('id', structureIds);
      for (const s of structures ?? []) {
        const name =
          (s.fee_types as { name?: string } | null)?.name || s.description || 'Fee';
        feeTypeNameByStructure.set(s.id, name);
      }
    }

    let totalDue = 0;
    let totalPaid = 0;
    const lineItems = rows.map((r) => {
      totalDue += Number(r.amount_due ?? 0);
      totalPaid += Number(r.amount_paid ?? 0);
      return {
        obligationId: r.id,
        feeTypeName: feeTypeNameByStructure.get(r.fee_structure_id) ?? 'Fee',
        amountDue: Number(r.amount_due ?? 0),
        amountPaid: Number(r.amount_paid ?? 0),
        amountOutstanding: Number(r.amount_outstanding ?? 0),
        dueDate: r.due_date,
      };
    });

    return {
      studentId,
      invoiceNumber: rows[0]?.invoice_number ?? null,
      totalDue,
      totalPaid,
      balance: Math.max(0, totalDue - totalPaid),
      lineItems,
    };
  },

  /**
   * Apply a payment amount against a student's outstanding obligations (FIFO),
   * updating amount_paid/outstanding and schedule status. Returns new balance.
   */
  async applyPaymentToObligations(
    schoolId: string,
    studentId: string,
    amount: number
  ): Promise<{ newBalance: number }> {
    let remaining = amount;
    const { data: obligations } = await supabase
      .from('fee_obligations')
      .select('id, amount_due, amount_paid, amount_outstanding')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('due_date', { ascending: true });

    for (const o of obligations ?? []) {
      if (remaining <= 0) break;
      const outstanding = Number(o.amount_outstanding ?? 0);
      if (outstanding <= 0) continue;
      const applied = Math.min(remaining, outstanding);
      const newPaid = Number(o.amount_paid ?? 0) + applied;
      const newOutstanding = Number(o.amount_due ?? 0) - newPaid;
      await supabase
        .from('fee_obligations')
        .update({
          amount_paid: newPaid,
          amount_outstanding: Math.max(0, newOutstanding),
          paid_in_full: newOutstanding <= 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', o.id);
      remaining -= applied;
    }

    const invoice = await this.getStudentInvoice(schoolId, studentId);
    return { newBalance: invoice.balance };
  },
};
