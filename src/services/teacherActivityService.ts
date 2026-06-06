import { supabase } from '@/lib/supabase';

/**
 * TEACHER ACTIVITY SERVICE
 *
 * Records and reports on teacher actions across the system. Logging is
 * fire-and-forget (never throws). Reads power the admin/principal activity feed.
 */

export type TeacherActivityAction =
  | 'attendance_submitted'
  | 'results_uploaded'
  | 'grade_recorded'
  | 'assignment_created'
  | 'behaviour_recorded'
  | 'intervention_created'
  | 'parent_communication'
  | 'login'
  | 'logout'
  | string;

export function isStaffSessionActivity(action: string): boolean {
  return action === 'login' || action === 'logout';
}

export interface LogActivityInput {
  schoolId: string;
  staffId?: string | null;
  staffName?: string | null;
  action: TeacherActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  relatedStudentId?: string | null;
  relatedClassId?: string | null;
  details?: Record<string, unknown>;
}

export interface TeacherActivityRow {
  id: string;
  school_id: string;
  staff_id: string | null;
  staff_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  related_student_id: string | null;
  related_class_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface TeacherSummary {
  staffId: string;
  staffName: string;
  count: number;
  lastActiveAt: string | null;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const teacherActivityService = {
  async logActivity(input: LogActivityInput): Promise<void> {
    try {
      if (!input.schoolId) return;

      // Resolve a display name when only the staff id is provided.
      let staffName = input.staffName ?? null;
      if (!staffName && input.staffId) {
        const { data } = await supabase
          .from('staff')
          .select('first_name, last_name')
          .eq('id', input.staffId)
          .maybeSingle();
        if (data) staffName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
      }

      const { error } = await supabase.from('teacher_activity_logs').insert([
        {
          school_id: input.schoolId,
          staff_id: input.staffId ?? null,
          staff_name: staffName,
          action: input.action,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          related_student_id: input.relatedStudentId ?? null,
          related_class_id: input.relatedClassId ?? null,
          details: input.details ?? {},
        },
      ]);

      if (error) {
        console.warn('[TEACHER_ACTIVITY] insert failed:', error.message);
        return;
      }

      if (isStaffSessionActivity(input.action)) return;

      const { dispatchTeacherActivity } = await import('@/services/notificationDispatchService');
      void dispatchTeacherActivity(input.schoolId, staffName, input.action, {
        details: input.details ?? undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        relatedClassId: input.relatedClassId,
        relatedStudentId: input.relatedStudentId,
      });
    } catch (err) {
      console.warn('[TEACHER_ACTIVITY] unexpected error:', err);
    }
  },

  async getActivity(
    schoolId: string,
    options?: { staffId?: string; since?: string; limit?: number }
  ): Promise<TeacherActivityRow[]> {
    try {
      let query = supabase
        .from('teacher_activity_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 200);

      if (options?.staffId) query = query.eq('staff_id', options.staffId);
      if (options?.since) query = query.gte('created_at', options.since);

      const { data, error } = await query;
      if (error) {
        console.error('[TEACHER_ACTIVITY] fetch failed:', error.message);
        return [];
      }
      return (data ?? []).filter((row) => !isStaffSessionActivity(row.action)) as TeacherActivityRow[];
    } catch (err) {
      console.error('[TEACHER_ACTIVITY] unexpected fetch error:', err);
      return [];
    }
  },

  async getDailyActivity(schoolId: string): Promise<TeacherActivityRow[]> {
    return this.getActivity(schoolId, { since: startOfTodayIso() });
  },

  async getWeeklySummary(schoolId: string): Promise<TeacherSummary[]> {
    const rows = await this.getActivity(schoolId, { since: daysAgoIso(7), limit: 1000 });
    return this.summarizeByStaff(rows);
  },

  summarizeByStaff(rows: TeacherActivityRow[]): TeacherSummary[] {
    const map = new Map<string, TeacherSummary>();
    for (const r of rows) {
      if (!r.staff_id) continue;
      const existing = map.get(r.staff_id);
      if (existing) {
        existing.count += 1;
        if (!existing.lastActiveAt || r.created_at > existing.lastActiveAt) {
          existing.lastActiveAt = r.created_at;
        }
      } else {
        map.set(r.staff_id, {
          staffId: r.staff_id,
          staffName: r.staff_name ?? 'Unknown',
          count: 1,
          lastActiveAt: r.created_at,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  },

  /**
   * Most active teachers over the last 7 days.
   */
  async getMostActive(schoolId: string, limit = 5): Promise<TeacherSummary[]> {
    const summary = await this.getWeeklySummary(schoolId);
    return summary.slice(0, limit);
  },

  /**
   * Active staff (teachers) who have logged NO activity in the last `days` days.
   */
  async getInactiveTeachers(schoolId: string, days = 7): Promise<Array<{ staffId: string; staffName: string }>> {
    const [{ data: staff }, activeRows] = await Promise.all([
      supabase
        .from('staff')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .eq('is_active', true),
      this.getActivity(schoolId, { since: daysAgoIso(days), limit: 1000 }),
    ]);

    const activeIds = new Set(activeRows.map((r) => r.staff_id).filter(Boolean));
    return (staff ?? [])
      .filter((s) => !activeIds.has(s.id))
      .map((s) => ({ staffId: s.id, staffName: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() }));
  },

  /**
   * Teachers assigned to a class who have NOT submitted attendance today (missing task).
   */
  async getMissingAttendanceToday(
    schoolId: string
  ): Promise<Array<{ classId: string; className: string; teacherId: string | null; teacherName: string }>> {
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: classes }, { data: attendance }] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, class_teacher_id, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true),
      supabase.from('attendance').select('class_id').eq('school_id', schoolId).eq('date', today),
    ]);

    const markedClasses = new Set((attendance ?? []).map((a) => a.class_id));
    const teacherIds = [...new Set((classes ?? []).map((c) => c.class_teacher_id).filter(Boolean))] as string[];

    const teacherNameMap = new Map<string, string>();
    if (teacherIds.length) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .in('id', teacherIds);
      (staff ?? []).forEach((s) =>
        teacherNameMap.set(s.id, `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim())
      );
    }

    return (classes ?? [])
      .filter((c) => !markedClasses.has(c.id))
      .map((c) => ({
        classId: c.id,
        className: c.name,
        teacherId: c.class_teacher_id ?? null,
        teacherName: c.class_teacher_id ? teacherNameMap.get(c.class_teacher_id) ?? 'Unassigned' : 'Unassigned',
      }));
  },
};
