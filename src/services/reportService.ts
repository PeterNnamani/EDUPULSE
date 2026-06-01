import { supabase } from '@/lib/supabase';
import { getStudentAttendanceStats } from './attendanceService';
import { getStudentGrades } from './gradeService';
import { getStudentBehaviourStats } from './behaviourService';

export interface StudentReport {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
    attendancePercentage: number;
    averageGrade: number;
    gradeCount: number;
    meritCount: number;
    demeritCount: number;
    behaviourPoints: number;
    riskLevel: string;
    generatedDate: string;
}

export interface ClassReport {
    classId: string;
    className: string;
    totalStudents: number;
    averageAttendance: number;
    averageGrade: number;
    totalMerits: number;
    totalDemerits: number;
    passPercentage: number;
    riskStudents: number;
    generatedDate: string;
}

/**
 * Generate a comprehensive report for a student
 */
export async function generateStudentReport(schoolId: string, studentId: string): Promise<StudentReport | null> {
    try {
        // Get student info
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, first_name, last_name, class_id')
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            console.error('Error fetching student:', studentError);
            return null;
        }

        // Get class info
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('id', student.class_id)
            .single();

        if (classError || !classData) {
            console.error('Error fetching class:', classError);
            return null;
        }

        // Get attendance stats
        const attendanceStats = await getStudentAttendanceStats(schoolId, studentId);

        // Get grades
        const grades = await getStudentGrades(schoolId, studentId);
        const averageGrade =
            grades.length > 0 ? Math.round(grades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / grades.length) : 0;

        // Get behaviour stats
        const behaviourStats = await getStudentBehaviourStats(schoolId, studentId);

        // Determine risk level
        let riskLevel = 'low';
        if (attendanceStats.attendancePercentage < 50) riskLevel = 'critical';
        else if (attendanceStats.attendancePercentage < 70) riskLevel = 'high';
        else if (averageGrade < 40) riskLevel = 'high';
        else if (behaviourStats.netPoints < -20) riskLevel = 'medium';
        else if (attendanceStats.attendancePercentage < 80 || averageGrade < 50) riskLevel = 'medium';

        return {
            studentId,
            studentName: `${student.first_name} ${student.last_name}`,
            classId: classData.id,
            className: classData.name,
            attendancePercentage: attendanceStats.attendancePercentage,
            averageGrade,
            gradeCount: grades.length,
            meritCount: behaviourStats.merits,
            demeritCount: behaviourStats.demerits,
            behaviourPoints: behaviourStats.netPoints,
            riskLevel,
            generatedDate: new Date().toISOString().split('T')[0],
        };
    } catch (error) {
        console.error('Generate student report error:', error);
        return null;
    }
}

/**
 * Generate reports for all students in a class
 */
export async function generateClassStudentReports(
    schoolId: string,
    classId: string
): Promise<StudentReport[]> {
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', classId)
            .eq('status', 'active');

        if (error || !students) {
            console.error('Error fetching students:', error);
            return [];
        }

        const reports: StudentReport[] = [];

        for (const student of students) {
            const report = await generateStudentReport(schoolId, student.id);
            if (report) {
                reports.push(report);
            }
        }

        return reports;
    } catch (error) {
        console.error('Generate class student reports error:', error);
        return [];
    }
}

/**
 * Generate a comprehensive report for a class
 */
export async function generateClassReport(schoolId: string, classId: string): Promise<ClassReport | null> {
    try {
        // Get class info
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('id', classId)
            .single();

        if (classError || !classData) {
            console.error('Error fetching class:', classError);
            return null;
        }

        // Get all students
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', classId)
            .eq('status', 'active');

        if (studentError || !students) {
            console.error('Error fetching students:', studentError);
            return null;
        }

        const totalStudents = students.length;

        // Calculate attendance average
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('class_id', classId);

        const studentAttendanceMap: { [key: string]: number } = {};
        const attendanceRecords = attendanceData || [];

        for (const record of attendanceRecords) {
            if (!studentAttendanceMap[record.student_id]) {
                studentAttendanceMap[record.student_id] = 0;
            }
            if (record.status === 'present') {
                studentAttendanceMap[record.student_id]++;
            }
        }

        const totalPresent = Object.values(studentAttendanceMap).reduce((a, b) => a + b, 0);
        const totalAttendanceRecords = attendanceRecords.length;
        const averageAttendance =
            totalAttendanceRecords > 0 ? Math.round((totalPresent / totalAttendanceRecords) * 100) : 0;

        // Calculate average grade
        const { data: gradeData } = await supabase
            .from('grades')
            .select('score, max_score')
            .eq('class_id', classId);

        const grades = gradeData || [];
        let averageGrade = 0;
        let passCount = 0;

        if (grades.length > 0) {
            const scores = grades.map((g: any) => (g.score / g.max_score) * 100);
            averageGrade = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
            passCount = scores.filter((s: number) => s >= 50).length;
        }

        const passPercentage = grades.length > 0 ? Math.round((passCount / grades.length) * 100) : 0;

        // Calculate behaviour totals
        const { data: behaviourData } = await supabase
            .from('behaviour_records')
            .select('behaviour_type')
            .eq('class_id', classId);

        const behaviourRecords = behaviourData || [];
        const totalMerits = behaviourRecords.filter((b: any) => b.behaviour_type === 'merit').length;
        const totalDemerits = behaviourRecords.filter((b: any) => b.behaviour_type === 'demerit').length;

        // Count at-risk students
        const { data: riskData } = await supabase
            .from('risk_assessments')
            .select('student_id')
            .eq('class_id', classId)
            .in('risk_level', ['high', 'critical']);

        const riskStudents = new Set(riskData?.map((r: any) => r.student_id)).size || 0;

        return {
            classId,
            className: classData.name,
            totalStudents,
            averageAttendance,
            averageGrade,
            totalMerits,
            totalDemerits,
            passPercentage,
            riskStudents,
            generatedDate: new Date().toISOString().split('T')[0],
        };
    } catch (error) {
        console.error('Generate class report error:', error);
        return null;
    }
}

/**
 * Export student report to CSV format
 */
export function studentReportToCSV(report: StudentReport): string {
    const lines = [
        'Student Report',
        `Generated: ${report.generatedDate}`,
        '',
        `Student Name,${report.studentName}`,
        `Student ID,${report.studentId}`,
        `Class,${report.className}`,
        '',
        'Academic Performance',
        `Attendance Percentage,${report.attendancePercentage}%`,
        `Average Grade,${report.averageGrade}%`,
        `Grades Recorded,${report.gradeCount}`,
        '',
        'Behaviour',
        `Merits,${report.meritCount}`,
        `Demerits,${report.demeritCount}`,
        `Net Points,${report.behaviourPoints}`,
        '',
        `Risk Level,${report.riskLevel}`,
    ];

    return lines.join('\n');
}

/**
 * Export class report to CSV format
 */
export function classReportToCSV(report: ClassReport): string {
    const lines = [
        'Class Report',
        `Generated: ${report.generatedDate}`,
        '',
        `Class Name,${report.className}`,
        `Total Students,${report.totalStudents}`,
        '',
        'Class Performance',
        `Average Attendance,${report.averageAttendance}%`,
        `Average Grade,${report.averageGrade}%`,
        `Pass Percentage,${report.passPercentage}%`,
        '',
        'Behaviour',
        `Total Merits,${report.totalMerits}`,
        `Total Demerits,${report.totalDemerits}`,
        '',
        `Students at Risk,${report.riskStudents}`,
    ];

    return lines.join('\n');
}

/**
 * Download report as PDF (placeholder for actual PDF generation)
 */
export async function downloadReportAsPDF(
    type: 'student' | 'class',
    data: StudentReport | ClassReport
): Promise<{ success: boolean; error?: string }> {
    try {
        // This would integrate with a PDF library like jsPDF
        // For now, we'll just export as CSV
        const csv = type === 'student' ? studentReportToCSV(data as StudentReport) : classReportToCSV(data as ClassReport);

        const element = document.createElement('a');
        element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
        element.setAttribute('download', `${type}-report-${new Date().getTime()}.csv`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        return { success: true };
    } catch (error) {
        console.error('Download report error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to download report',
        };
    }
}
