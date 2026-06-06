import { supabase } from '@/lib/supabase';

/**
 * AUDIT SERVICE
 *
 * Centralized audit logging for every critical action in EduPulse.
 * Writes to the `audit_logs` table (school-scoped). Calls are fire-and-forget
 * and never throw, so audit failures cannot break business flows.
 */

export type AuditAction =
  | 'payment_recorded'
  | 'payment_confirmed'
  | 'fee_changed'
  | 'fee_structure_changed'
  | 'student_promoted'
  | 'student_graduated'
  | 'student_transferred'
  | 'student_class_changed'
  | 'attendance_edited'
  | 'result_uploaded'
  | 'grade_recorded'
  | 'subscription_changed'
  | 'virtual_account_created'
  | 'reconciliation_run'
  | string;

export interface AuditLogInput {
  schoolId: string;
  userId?: string | null;
  userType?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export interface AuditLogRow {
  id: string;
  school_id: string;
  user_id: string | null;
  user_type: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function getUserAgent(): string | null {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent : null;
  } catch {
    return null;
  }
}

export const auditService = {
  /**
   * Persist an audit log entry. Best-effort: errors are swallowed and logged.
   */
  async logAudit(input: AuditLogInput): Promise<void> {
    try {
      if (!input.schoolId) return;

      const { error } = await supabase.from('audit_logs').insert([
        {
          school_id: input.schoolId,
          user_id: input.userId ?? null,
          user_type: input.userType ?? null,
          action: input.action,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          old_values: input.oldValues ?? null,
          new_values: input.newValues ?? null,
          user_agent: getUserAgent(),
        },
      ]);

      if (error) {
        console.warn('[AUDIT] Failed to write audit log:', error.message);
      }
    } catch (err) {
      console.warn('[AUDIT] Unexpected audit error:', err);
    }
  },

  /**
   * Fetch recent audit logs for a school, newest first.
   */
  async getAuditLogs(
    schoolId: string,
    options?: { action?: string; entityType?: string; limit?: number }
  ): Promise<AuditLogRow[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 100);

      if (options?.action) query = query.eq('action', options.action);
      if (options?.entityType) query = query.eq('entity_type', options.entityType);

      const { data, error } = await query;
      if (error) {
        console.error('[AUDIT] Failed to fetch audit logs:', error.message);
        return [];
      }
      return (data ?? []) as AuditLogRow[];
    } catch (err) {
      console.error('[AUDIT] Unexpected fetch error:', err);
      return [];
    }
  },
};
