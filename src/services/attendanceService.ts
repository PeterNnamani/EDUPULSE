import { supabase } from '@/lib/supabase';

export interface AttendanceRecord {
    id: string;
    student_id: string;
    student_name: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remarks?: string;
}

export interface AttendanceStats {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    excusedDays: number;
    attendancePercentage: number;
}

/**
 * Record attendance for a student on a specific date
 */
export async function recordAttendance(
    schoolId: string,
    classId: string,
    studentId: string,
    date: string,
    status: 'present' | 'absent' | 'late' | 'excused',
    remarks?: string,
    markedById?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if attendance already exists for this student on this date
        const { data: existing, error: checkError } = await supabase
            .from('attendance')
            .select('id')
            .eq('student_id', studentId)
            .eq('date', date)
            .eq('school_id', schoolId)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking attendance:', checkError);
            return { success: false, error: 'Failed to check attendance' };
        }

        if (existing) {
            // Update existing attendance
            const { error: updateError } = await supabase
                .from('attendance')
                .update({
                    status,
                    remarks: remarks || null,
                    marked_by: markedById || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (updateError) {
                console.error('Error updating attendance:', updateError);
                return { success: false, error: updateError.message || 'Failed to update attendance' };
            }

            console.log('[ATTENDANCE_UPDATED]', studentId, 'on', date, 'to', status);
            return { success: true };
        } else {
            // Create new attendance record
            const { error: insertError } = await supabase
                .from('attendance')
                .insert([
                    {
                        school_id: schoolId,
                        student_id: studentId,
                        class_id: classId,
                        date,
                        status,
                        remarks: remarks || null,
                        marked_by: markedById || null,
                    },
                ]);

            if (insertError) {
                console.error('Error creating attendance:', insertError);
                return { success: false, error: insertError.message || 'Failed to record attendance' };
            }

            console.log('[ATTENDANCE_RECORDED]', studentId, 'on', date, 'as', status);
            return { success: true };
        }
    } catch (error) {
        console.error('Record attendance error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record attendance',
        };
    }
}

/**
 * Record attendance for entire class at once
 */
export async function recordClassAttendance(
    schoolId: string,
    classId: string,
    attendanceData: Array<{
        studentId: string;
        status: 'present' | 'absent' | 'late' | 'excused';
        remarks?: string;
    }>,
    date: string,
    markedById?: string
): Promise<{ success: boolean; error?: string; recorded?: number }> {
    try {
        const records = attendanceData.map((record) => ({
            school_id: schoolId,
            student_id: record.studentId,
            class_id: classId,
            date,
            status: record.status,
            remarks: record.remarks || null,
            marked_by: markedById || null,
        }));

        // Delete existing attendance for this class and date
        const { error: deleteError } = await supabase
            .from('attendance')
            .delete()
            .eq('class_id', classId)
            .eq('date', date)
            .eq('school_id', schoolId);

        if (deleteError && deleteError.code !== 'PGRST116') {
            console.error('Error deleting old attendance:', deleteError);
        }

        // Insert new attendance records
        const { error: insertError } = await supabase
            .from('attendance')
            .insert(records);

        if (insertError) {
            console.error('Error recording class attendance:', insertError);
            return { success: false, error: insertError.message || 'Failed to record class attendance' };
        }

        console.log('[CLASS_ATTENDANCE_RECORDED]', classId, 'on', date, 'for', records.length, 'students');
        return { success: true, recorded: records.length };
    } catch (error) {
        console.error('Record class attendance error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record class attendance',
        };
    }
}

/**
 * Get attendance records for a student
 */
export async function getStudentAttendance(
    schoolId: string,
    studentId: string
): Promise<AttendanceRecord[]> {
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                id,
                student_id,
                date,
                status,
                remarks,
                students(first_name, last_name)
            `)
            .eq('school_id', schoolId)
            .eq('student_id', studentId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching student attendance:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            student_id: record.student_id,
            student_name: `${record.students?.first_name} ${record.students?.last_name}`,
            date: record.date,
            status: record.status,
            remarks: record.remarks,
        }));
    } catch (error) {
        console.error('Get student attendance error:', error);
        return [];
    }
}

/**
 * Get attendance for a class on a specific date
 */
export async function getClassAttendanceForDate(
    classId: string,
    date: string
): Promise<AttendanceRecord[]> {
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                id,
                student_id,
                date,
                status,
                remarks,
                students(first_name, last_name)
            `)
            .eq('class_id', classId)
            .eq('date', date)
            .order('students(last_name)', { ascending: true });

        if (error) {
            console.error('Error fetching class attendance:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            student_id: record.student_id,
            student_name: `${record.students?.first_name} ${record.students?.last_name}`,
            date: record.date,
            status: record.status,
            remarks: record.remarks,
        }));
    } catch (error) {
        console.error('Get class attendance error:', error);
        return [];
    }
}

/**
 * Get attendance statistics for a student
 */
export async function getStudentAttendanceStats(
    schoolId: string,
    studentId: string
): Promise<AttendanceStats> {
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select('status')
            .eq('school_id', schoolId)
            .eq('student_id', studentId);

        if (error) {
            console.error('Error fetching attendance stats:', error);
            return {
                totalDays: 0,
                presentDays: 0,
                absentDays: 0,
                lateDays: 0,
                excusedDays: 0,
                attendancePercentage: 0,
            };
        }

        const records = data || [];
        const presentDays = records.filter((r: any) => r.status === 'present').length;
        const absentDays = records.filter((r: any) => r.status === 'absent').length;
        const lateDays = records.filter((r: any) => r.status === 'late').length;
        const excusedDays = records.filter((r: any) => r.status === 'excused').length;
        const totalDays = records.length;

        return {
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            excusedDays,
            attendancePercentage: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
        };
    } catch (error) {
        console.error('Get attendance stats error:', error);
        return {
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            excusedDays: 0,
            attendancePercentage: 0,
        };
    }
}

/**
 * Get attendance summary for a class
 */
export async function getClassAttendanceSummary(classId: string): Promise<{
    [studentId: string]: AttendanceStats;
}> {
    try {
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', classId);

        if (studentError || !students) {
            console.error('Error fetching students:', studentError);
            return {};
        }

        const summary: { [studentId: string]: AttendanceStats } = {};

        for (const student of students) {
            const stats = await getStudentAttendanceStats('', student.id);
            summary[student.id] = stats;
        }

        return summary;
    } catch (error) {
        console.error('Get class attendance summary error:', error);
        return {};
    }
}
