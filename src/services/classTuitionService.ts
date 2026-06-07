import { supabase } from '@/lib/supabase';
import { feeAssignmentService } from '@/services/feeAssignmentService';

const TUITION_NAME_PATTERNS = ['tuition', 'school fee', 'school fees'];

export function isTuitionFeeTypeName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return TUITION_NAME_PATTERNS.some((p) => n.includes(p));
}

export function isTuitionFeeTypeId(
  feeTypeId: string | null | undefined,
  feeTypes: Array<{ id: string; name: string }>
): boolean {
  if (!feeTypeId) return false;
  const ft = feeTypes.find((t) => t.id === feeTypeId);
  return ft ? isTuitionFeeTypeName(ft.name) : false;
}

/** Upsert the legacy `fees` row used for tuition on class cards and parent fallback. */
export async function syncClassTuitionFee(
  schoolId: string,
  classId: string,
  amount: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('fees')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .maybeSingle();

  if (amount <= 0) {
    if (existing?.id) {
      await supabase
        .from('fees')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return;
  }

  if (existing?.id) {
    await supabase
      .from('fees')
      .update({ amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('fees').insert({
    school_id: schoolId,
    class_id: classId,
    amount,
    currency: 'NGN',
    is_active: true,
  });
}

/** Tuition amount shown on class cards (fees table, synced from Tuition fee structures). */
export async function getClassTuitionAmount(schoolId: string, classId: string): Promise<number> {
  const { data } = await supabase
    .from('fees')
    .select('amount')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .maybeSingle();
  return Number(data?.amount ?? 0);
}

async function resolveTuitionFeeTypeId(schoolId: string): Promise<string | null> {
  const { data: types } = await supabase
    .from('fee_types')
    .select('id, name')
    .eq('school_id', schoolId);

  const match = (types ?? []).find((t) => isTuitionFeeTypeName(t.name));
  return match?.id ?? null;
}

/** Keep Tuition row in fee_structures aligned when tuition is edited on the class form. */
export async function upsertTuitionFeeStructure(
  schoolId: string,
  classId: string,
  amount: number
): Promise<void> {
  const session = await feeAssignmentService.getCurrentSession(schoolId);
  const tuitionTypeId = await resolveTuitionFeeTypeId(schoolId);
  if (!tuitionTypeId) return;

  let query = supabase
    .from('fee_structures')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('fee_type_id', tuitionTypeId)
    .eq('is_active', true);

  if (session?.id) {
    query = query.or(`session_id.eq.${session.id},session_id.is.null`);
  }

  const { data: existing } = await query.maybeSingle();

  if (amount <= 0) {
    if (existing?.id) {
      await supabase
        .from('fee_structures')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return;
  }

  const payload = {
    school_id: schoolId,
    class_id: classId,
    fee_type_id: tuitionTypeId,
    amount,
    session_id: session?.id ?? null,
    description: 'Tuition',
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase.from('fee_structures').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('fee_structures').insert(payload);
  }
}

/** Re-read active Tuition fee_structures and mirror into the class `fees` row. */
export async function refreshClassTuitionFromStructures(
  schoolId: string,
  classId: string
): Promise<void> {
  const tuitionTypeId = await resolveTuitionFeeTypeId(schoolId);
  if (!tuitionTypeId) {
    await syncClassTuitionFee(schoolId, classId, 0);
    return;
  }

  const session = await feeAssignmentService.getCurrentSession(schoolId);
  let query = supabase
    .from('fee_structures')
    .select('amount, session_id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('fee_type_id', tuitionTypeId)
    .eq('is_active', true);

  const { data: rows } = await query;
  const applicable = (rows ?? []).filter(
    (r) => !session?.id || !r.session_id || r.session_id === session.id
  );
  const amount = applicable.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  await syncClassTuitionFee(schoolId, classId, amount);
}

/** Load tuition for many classes in one round-trip. */
export async function getClassTuitionMap(
  schoolId: string,
  classIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!classIds.length) return map;

  const { data } = await supabase
    .from('fees')
    .select('class_id, amount')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('class_id', classIds);

  for (const row of data ?? []) {
    map.set(row.class_id, Number(row.amount ?? 0));
  }
  return map;
}
