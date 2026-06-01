import { supabase } from '@/lib/supabase';

export interface BehaviourRecord {
    id: string;
    student_id: string;
    student_name: string;
    date: string;
    behaviour_type: 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion';
    category?: string;
    description: string;
    points: number;
    action_taken?: string;
    staff_name?: string;
}

export interface StudentBehaviourStats {
    studentId: string;
    studentName: string;
    merits: number;
    demerits: number;
    warnings: number;
    commendations: number;
    netPoints: number;
}

/**
 * Record a behaviour incident for a student
 */
export async function recordBehaviour(
    schoolId: string,
    studentId: string,
    classId: string,
    behaviourType: 'merit' | 'demerit' | 'warning' | 'commendation' | 'suspension' | 'expulsion',
    description: string,
    category?: string,
    points?: number,
    actionTaken?: string,
    staffId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!description || description.trim().length === 0) {
            return { success: false, error: 'Description is required' };
        }

        // Calculate points
        let calculatedPoints = points || 0;
        if (!points) {
            switch (behaviourType) {
                case 'merit':
                    calculatedPoints = 5;
                    break;
                case 'commendation':
                    calculatedPoints = 10;
                    break;
                case 'demerit':
                    calculatedPoints = -5;
                    break;
                case 'warning':
                    calculatedPoints = -10;
                    break;
                case 'suspension':
                    calculatedPoints = -25;
                    break;
                case 'expulsion':
                    calculatedPoints = -100;
                    break;
            }
        }

        const { error } = await supabase
            .from('behaviour_records')
            .insert([
                {
                    school_id: schoolId,
                    student_id: studentId,
                    class_id: classId,
                    behaviour_type: behaviourType,
                    category: category || null,
                    description,
                    points: calculatedPoints,
                    action_taken: actionTaken || null,
                    staff_id: staffId || null,
                    date: new Date().toISOString().split('T')[0],
                },
            ]);

        if (error) {
            console.error('Error recording behaviour:', error);
            return { success: false, error: error.message || 'Failed to record behaviour' };
        }

        console.log('[BEHAVIOUR_RECORDED]', studentId, behaviourType, 'points', calculatedPoints);
        return { success: true };
    } catch (error) {
        console.error('Record behaviour error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record behaviour',
        };
    }
}

/**
 * Get behaviour records for a student
 */
export async function getStudentBehaviour(
    schoolId: string,
    studentId: string,
    limit?: number
): Promise<BehaviourRecord[]> {
    try {
        let query = supabase
            .from('behaviour_records')
            .select(`
                id,
                student_id,
                date,
                behaviour_type,
                category,
                description,
                points,
                action_taken,
                students(first_name, last_name),
                staff(full_name)
            `)
            .eq('school_id', schoolId)
            .eq('student_id', studentId)
            .order('date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching student behaviour:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            student_id: record.student_id,
            student_name: `${record.students?.first_name} ${record.students?.last_name}`,
            date: record.date,
            behaviour_type: record.behaviour_type,
            category: record.category,
            description: record.description,
            points: record.points,
            action_taken: record.action_taken,
            staff_name: record.staff?.full_name,
        }));
    } catch (error) {
        console.error('Get student behaviour error:', error);
        return [];
    }
}

/**
 * Get behaviour records for a class
 */
export async function getClassBehaviour(classId: string, limit?: number): Promise<BehaviourRecord[]> {
    try {
        let query = supabase
            .from('behaviour_records')
            .select(`
                id,
                student_id,
                date,
                behaviour_type,
                category,
                description,
                points,
                action_taken,
                students(first_name, last_name),
                staff(full_name)
            `)
            .eq('class_id', classId)
            .order('date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching class behaviour:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            student_id: record.student_id,
            student_name: `${record.students?.first_name} ${record.students?.last_name}`,
            date: record.date,
            behaviour_type: record.behaviour_type,
            category: record.category,
            description: record.description,
            points: record.points,
            action_taken: record.action_taken,
            staff_name: record.staff?.full_name,
        }));
    } catch (error) {
        console.error('Get class behaviour error:', error);
        return [];
    }
}

/**
 * Get behaviour statistics for a student
 */
export async function getStudentBehaviourStats(
    schoolId: string,
    studentId: string
): Promise<StudentBehaviourStats> {
    try {
        const { data, error } = await supabase
            .from('behaviour_records')
            .select('behaviour_type, points')
            .eq('school_id', schoolId)
            .eq('student_id', studentId);

        if (error) {
            console.error('Error fetching behaviour stats:', error);
            return {
                studentId,
                studentName: '',
                merits: 0,
                demerits: 0,
                warnings: 0,
                commendations: 0,
                netPoints: 0,
            };
        }

        const records = data || [];
        const merits = records.filter((r: any) => r.behaviour_type === 'merit').length;
        const demerits = records.filter((r: any) => r.behaviour_type === 'demerit').length;
        const warnings = records.filter((r: any) => r.behaviour_type === 'warning').length;
        const commendations = records.filter((r: any) => r.behaviour_type === 'commendation').length;
        const netPoints = records.reduce((sum: number, r: any) => sum + (r.points || 0), 0);

        // Get student name
        const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', studentId)
            .single();

        return {
            studentId,
            studentName: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
            merits,
            demerits,
            warnings,
            commendations,
            netPoints,
        };
    } catch (error) {
        console.error('Get behaviour stats error:', error);
        return {
            studentId,
            studentName: '',
            merits: 0,
            demerits: 0,
            warnings: 0,
            commendations: 0,
            netPoints: 0,
        };
    }
}

/**
 * Get behaviour statistics for all students in a class
 */
export async function getClassBehaviourStats(classId: string): Promise<StudentBehaviourStats[]> {
    try {
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('class_id', classId);

        if (studentError || !students) {
            console.error('Error fetching students:', studentError);
            return [];
        }

        const stats: StudentBehaviourStats[] = [];

        for (const student of students) {
            const studentStats = await getStudentBehaviourStats('', student.id);
            studentStats.studentName = `${student.first_name} ${student.last_name}`;
            stats.push(studentStats);
        }

        // Sort by net points descending
        return stats.sort((a, b) => b.netPoints - a.netPoints);
    } catch (error) {
        console.error('Get class behaviour stats error:', error);
        return [];
    }
}

/**
 * Get students requiring intervention (based on behaviour)
 */
export async function getStudentsNeedingIntervention(
    classId: string,
    negativePointsThreshold: number = -20
): Promise<StudentBehaviourStats[]> {
    try {
        const allStats = await getClassBehaviourStats(classId);
        return allStats.filter((stat) => stat.netPoints <= negativePointsThreshold);
    } catch (error) {
        console.error('Get students needing intervention error:', error);
        return [];
    }
}
