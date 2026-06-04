import { supabase } from '@/lib/supabase';

export interface RecordPaymentRequest {
  schoolId: string;
  studentId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'paystack' | 'flutterwave';
  paymentReference?: string;
  notes?: string;
  recordedByStaffId?: string;
  feeId?: string;
}

export interface StudentFeeContext {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  classId: string | null;
  expectedFee: number;
  totalPaid: number;
  balance: number;
}

export async function fetchStudentsForPayment(schoolId: string): Promise<StudentFeeContext[]> {
  const [{ data: students }, { data: classes }, { data: fees }, { data: payments }] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_id, first_name, last_name, class_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('last_name'),
    supabase.from('classes').select('id, name').eq('school_id', schoolId),
    supabase.from('fees').select('id, class_id, amount').eq('school_id', schoolId).eq('is_active', true),
    supabase
      .from('payments')
      .select('student_id, amount, status')
      .eq('school_id', schoolId)
      .eq('status', 'completed'),
  ]);

  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (students ?? []).map((s) => {
    const classFee = (fees ?? []).find((f) => f.class_id === s.class_id);
    const expectedFee = Number(classFee?.amount ?? 0);
    const totalPaid = (payments ?? [])
      .filter((p) => p.student_id === s.id)
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    return {
      id: s.id,
      studentId: s.student_id,
      firstName: s.first_name,
      lastName: s.last_name,
      className: s.class_id ? classMap.get(s.class_id) ?? 'Unassigned' : 'Unassigned',
      classId: s.class_id,
      expectedFee,
      totalPaid,
      balance: Math.max(0, expectedFee - totalPaid),
    };
  });
}

export async function recordPayment(
  request: RecordPaymentRequest
): Promise<{ success: boolean; paymentId?: string; receiptNumber?: string; error?: string }> {
  if (!request.studentId || request.amount <= 0) {
    return { success: false, error: 'Select a student and enter a valid amount.' };
  }

  const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  let feeId = request.feeId ?? null;
  if (!feeId) {
    const { data: student } = await supabase
      .from('students')
      .select('class_id')
      .eq('id', request.studentId)
      .eq('school_id', request.schoolId)
      .maybeSingle();
    if (student?.class_id) {
      const { data: classFee } = await supabase
        .from('fees')
        .select('id')
        .eq('school_id', request.schoolId)
        .eq('class_id', student.class_id)
        .eq('is_active', true)
        .maybeSingle();
      feeId = classFee?.id ?? null;
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .insert([
      {
        school_id: request.schoolId,
        student_id: request.studentId,
        fee_id: feeId,
        amount: request.amount,
        payment_method: request.paymentMethod,
        payment_reference: request.paymentReference?.trim() || null,
        receipt_number: receiptNumber,
        recorded_by: request.recordedByStaffId ?? null,
        status: 'completed',
        notes: request.notes?.trim() || null,
        paid_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error) {
    console.error('[PAYMENT] Insert failed:', error);
    return { success: false, error: error.message };
  }

  const { scheduleRiskRecalculation } = await import('@/services/riskRecalculate');
  scheduleRiskRecalculation(request.schoolId, request.studentId);

  return { success: true, paymentId: data.id, receiptNumber };
}
