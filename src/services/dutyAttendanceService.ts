import { supabase } from '@/lib/supabase';
import { notificationTriggerService } from '@/services/notificationTriggerService';
import { getParentIdsForStudent, getStudentDisplayName } from '@/services/notificationDispatchService';

/**
 * TEACHER-ON-DUTY ATTENDANCE SERVICE
 *
 * A second attendance layer separate from classroom attendance. Duty teachers
 * (assigned weekly by admins) record arrival/departure for any student.
 */

export interface DutyRoster {
  id: string;
  school_id: string;
  staff_id: string;
  staff_name: string | null;
  week_start: string;
  week_end: string;
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface DutyAttendanceRow {
  id: string;
  school_id: string;
  student_id: string;
  date: string;
  arrival_time: string | null;
  departure_time: string | null;
  is_late: boolean;
  is_early_departure: boolean;
  visitor_notes: string | null;
  pickup_status: string | null;
  authorized_pickup_person: string | null;
  transport_method: string | null;
  recorded_by: string | null;
}

export interface DutyDashboardMetrics {
  totalStudents: number;
  present: number;
  lateArrivals: number;
  earlyDepartures: number;
  missingPickups: number;
  departed: number;
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const dutyAttendanceService = {
  weekStartFor(dateIso: string): string {
    return mondayOf(dateIso);
  },

  async assignDutyTeachers(
    schoolId: string,
    staffIds: string[],
    weekStart: string,
    assignedBy?: string,
    notes?: string
  ): Promise<{ success: boolean; assigned: number; error?: string }> {
    if (!staffIds.length) return { success: false, assigned: 0, error: 'No staff selected' };
    let assigned = 0;
    for (const staffId of staffIds) {
      const result = await this.assignDutyTeacher(schoolId, staffId, weekStart, assignedBy, notes);
      if (result.success) assigned += 1;
    }
    return { success: assigned > 0, assigned };
  },

  async removeFromRoster(rosterId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('duty_rosters').delete().eq('id', rosterId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async assignDutyTeacher(
    schoolId: string,
    staffId: string,
    weekStart: string,
    assignedBy?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const start = mondayOf(weekStart);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 6);
      const weekEnd = endDate.toISOString().slice(0, 10);

      let staffName: string | null = null;
      const { data: staff } = await supabase
        .from('staff')
        .select('full_name')
        .eq('id', staffId)
        .maybeSingle();
      if (staff) staffName = staff.full_name;

      const { error } = await supabase.from('duty_rosters').upsert(
        [
          {
            school_id: schoolId,
            staff_id: staffId,
            staff_name: staffName,
            week_start: start,
            week_end: weekEnd,
            assigned_by: assignedBy ?? null,
            notes: notes ?? null,
          },
        ],
        { onConflict: 'school_id,staff_id,week_start' }
      );

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to assign duty' };
    }
  },

  async getRosterForWeek(schoolId: string, weekStart: string): Promise<DutyRoster[]> {
    const start = mondayOf(weekStart);
    const { data } = await supabase
      .from('duty_rosters')
      .select('*')
      .eq('school_id', schoolId)
      .eq('week_start', start)
      .order('created_at', { ascending: false });
    return (data ?? []) as DutyRoster[];
  },

  async getAttendanceForDate(schoolId: string, date: string): Promise<DutyAttendanceRow[]> {
    const { data } = await supabase
      .from('duty_attendance')
      .select('*')
      .eq('school_id', schoolId)
      .eq('date', date);
    return (data ?? []) as DutyAttendanceRow[];
  },

  async recordArrival(
    schoolId: string,
    studentId: string,
    date: string,
    arrivalTime: string,
    isLate: boolean,
    visitorNotes?: string,
    recordedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('duty_attendance').upsert(
        [
          {
            school_id: schoolId,
            student_id: studentId,
            date,
            arrival_time: arrivalTime,
            is_late: isLate,
            visitor_notes: visitorNotes ?? null,
            pickup_status: 'pending',
            recorded_by: recordedBy ?? null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'student_id,date' }
      );
      if (error) return { success: false, error: error.message };

      // Notify parents of arrival.
      const [studentName, parentIds] = await Promise.all([
        getStudentDisplayName(studentId),
        getParentIdsForStudent(studentId),
      ]);
      if (parentIds.length) {
        void notificationTriggerService.onStudentArrival(
          schoolId,
          studentId,
          studentName,
          parentIds,
          arrivalTime,
          isLate
        );
      }

      let recorderName: string | null = null;
      if (recordedBy) {
        const { data: staff } = await supabase
          .from('staff')
          .select('full_name, first_name, last_name')
          .eq('id', recordedBy)
          .maybeSingle();
        const builtName = `${staff?.first_name ?? ''} ${staff?.last_name ?? ''}`.trim();
        recorderName = staff?.full_name ?? (builtName || null);
      }

      const { dispatchDutyActivity } = await import('@/services/notificationDispatchService');
      void dispatchDutyActivity(schoolId, studentId, date, 'arrival', recorderName);

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to record arrival' };
    }
  },

  async recordDeparture(
    schoolId: string,
    studentId: string,
    date: string,
    departureTime: string,
    options?: {
      isEarlyDeparture?: boolean;
      pickupStatus?: string;
      authorizedPickupPerson?: string;
      transportMethod?: string;
      recordedBy?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('duty_attendance').upsert(
        [
          {
            school_id: schoolId,
            student_id: studentId,
            date,
            departure_time: departureTime,
            is_early_departure: options?.isEarlyDeparture ?? false,
            pickup_status: options?.pickupStatus ?? 'picked_up',
            authorized_pickup_person: options?.authorizedPickupPerson ?? null,
            transport_method: options?.transportMethod ?? null,
            recorded_by: options?.recordedBy ?? null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'student_id,date' }
      );
      if (error) return { success: false, error: error.message };

      const [studentName, parentIds] = await Promise.all([
        getStudentDisplayName(studentId),
        getParentIdsForStudent(studentId),
      ]);
      if (parentIds.length) {
        void notificationTriggerService.onStudentDeparture(
          schoolId,
          studentId,
          studentName,
          parentIds,
          departureTime,
          options?.authorizedPickupPerson
        );
      }

      let recorderName: string | null = null;
      if (options?.recordedBy) {
        const { data: staff } = await supabase
          .from('staff')
          .select('full_name, first_name, last_name')
          .eq('id', options.recordedBy)
          .maybeSingle();
        const builtName = `${staff?.first_name ?? ''} ${staff?.last_name ?? ''}`.trim();
        recorderName = staff?.full_name ?? (builtName || null);
      }

      const { dispatchDutyActivity } = await import('@/services/notificationDispatchService');
      void dispatchDutyActivity(schoolId, studentId, date, 'departure', recorderName);

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to record departure' };
    }
  },

  async getDashboardMetrics(schoolId: string, date: string): Promise<DutyDashboardMetrics> {
    const [{ count: totalStudents }, rows] = await Promise.all([
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'active'),
      this.getAttendanceForDate(schoolId, date),
    ]);

    const present = rows.filter((r) => !!r.arrival_time).length;
    const lateArrivals = rows.filter((r) => r.is_late).length;
    const earlyDepartures = rows.filter((r) => r.is_early_departure).length;
    const departed = rows.filter((r) => !!r.departure_time).length;
    // Missing pickup: arrived but no departure recorded by end of day.
    const missingPickups = rows.filter((r) => !!r.arrival_time && !r.departure_time).length;

    return {
      totalStudents: totalStudents ?? 0,
      present,
      lateArrivals,
      earlyDepartures,
      missingPickups,
      departed,
    };
  },
};
