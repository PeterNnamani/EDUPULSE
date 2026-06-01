import { supabase } from '@/lib/supabase';

/**
 * Report Card Generation Service
 * Generates professional report cards with academic performance
 */

export const reportCardService = {
    /**
     * Generate report card for student in a term
     */
    async generateReportCard(
        studentId: string,
        sessionId: string,
        termId: string
    ) {
        try {
            // Get student info
            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (!student) {
                return { success: false, error: 'Student not found' };
            }

            // Get academic record
            const { data: academicRecord } = await supabase
                .from('student_academic_records')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            // Get grades
            const { data: grades } = await supabase
                .from('grades')
                .select(`
          *,
          subjects(name, code)
        `)
                .eq('student_id', studentId)
                .eq('academic_term_id', termId);

            // Get attendance
            const { data: attendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('student_id', studentId)
                .eq('academic_term_id', termId);

            // Get behaviour records
            const { data: behaviour } = await supabase
                .from('behaviour_records')
                .select('behaviour_type, points, date')
                .eq('student_id', studentId);

            // Get risk assessment
            const { data: riskAssessment } = await supabase
                .from('risk_assessments')
                .select('*')
                .eq('student_id', studentId)
                .eq('academic_term_id', termId)
                .single();

            // Calculate statistics
            const attendanceStats = this.calculateAttendanceStats(attendance || []);
            const behaviourScore = this.calculateBehaviourScore(behaviour || []);
            const classPosition = await this.getClassPosition(studentId, termId);

            // Get teacher and principal comments
            const { data: comments } = await supabase
                .from('grades')
                .select('remarks')
                .eq('student_id', studentId)
                .eq('academic_term_id', termId)
                .limit(1);

            const reportCard = {
                student: {
                    id: student.id,
                    name: `${student.first_name} ${student.middle_name || ''} ${student.last_name}`.trim(),
                    admissionNumber: student.admission_number,
                    class: academicRecord?.class_id,
                    dateOfBirth: student.date_of_birth
                },
                session: sessionId,
                term: termId,
                academicPerformance: {
                    subjects: grades?.map(grade => ({
                        name: grade.subjects?.name,
                        code: grade.subjects?.code,
                        ca1: grades.find(g => g.assessment_type === 'ca1' && g.subject_id === grade.subject_id)?.score,
                        ca2: grades.find(g => g.assessment_type === 'ca2' && g.subject_id === grade.subject_id)?.score,
                        ca3: grades.find(g => g.assessment_type === 'ca3' && g.subject_id === grade.subject_id)?.score,
                        test: grades.find(g => g.assessment_type === 'test' && g.subject_id === grade.subject_id)?.score,
                        exam: grades.find(g => g.assessment_type === 'exam' && g.subject_id === grade.subject_id)?.score,
                        total: grade.score,
                        grade: grade.grade,
                        remarks: grade.remarks
                    })) || [],
                    averageScore: academicRecord?.average_score,
                    totalSubjects: grades?.length || 0,
                    classPosition
                },
                attendance: {
                    presentDays: attendanceStats.presentDays,
                    absentDays: attendanceStats.absentDays,
                    lateDays: attendanceStats.lateDays,
                    totalDays: attendanceStats.totalDays,
                    percentage: attendanceStats.percentage
                },
                behaviour: {
                    score: behaviourScore,
                    merits: behaviour?.filter(b => b.behaviour_type === 'merit').length || 0,
                    demerits: behaviour?.filter(b => b.behaviour_type === 'demerit').length || 0,
                    commendations: behaviour?.filter(b => b.behaviour_type === 'commendation').length || 0
                },
                riskAssessment: {
                    riskScore: riskAssessment?.risk_score,
                    riskLevel: riskAssessment?.risk_level,
                    factors: riskAssessment?.factors,
                    recommendations: riskAssessment?.recommendations
                },
                comments: {
                    teacher: comments?.[0]?.remarks || '',
                    principal: academicRecord?.promotion_notes || ''
                },
                generatedAt: new Date().toISOString()
            };

            return {
                success: true,
                data: reportCard
            };
        } catch (error) {
            console.error('Error generating report card:', error);
            return {
                success: false,
                error
            };
        }
    },

    /**
     * Calculate attendance statistics
     */
    calculateAttendanceStats(attendance: any[]) {
        const stats = {
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            excusedDays: 0,
            totalDays: 0,
            percentage: 0
        };

        if (!attendance || attendance.length === 0) {
            return stats;
        }

        stats.totalDays = attendance.length;
        stats.presentDays = attendance.filter(a => a.status === 'present').length;
        stats.absentDays = attendance.filter(a => a.status === 'absent').length;
        stats.lateDays = attendance.filter(a => a.status === 'late').length;
        stats.excusedDays = attendance.filter(a => a.status === 'excused').length;

        stats.percentage = (stats.presentDays / stats.totalDays) * 100;

        return stats;
    },

    /**
     * Calculate behaviour score
     */
    calculateBehaviourScore(behaviourRecords: any[]): number {
        if (!behaviourRecords || behaviourRecords.length === 0) {
            return 50; // Default neutral score
        }

        let score = 50;

        for (const record of behaviourRecords) {
            if (record.behaviour_type === 'merit' || record.behaviour_type === 'commendation') {
                score += (record.points || 5);
            } else if (record.behaviour_type === 'demerit' || record.behaviour_type === 'warning') {
                score -= (record.points || 5);
            }
        }

        return Math.max(0, Math.min(100, score));
    },

    /**
     * Get class position for student
     */
    async getClassPosition(studentId: string, termId: string): Promise<number> {
        try {
            // Get all grades for this term
            const { data: allGrades } = await supabase
                .from('grades')
                .select('student_id, score')
                .eq('academic_term_id', termId);

            if (!allGrades) return 0;

            // Group by student and calculate average
            const studentAverages = new Map<string, number>();

            for (const grade of allGrades) {
                if (!studentAverages.has(grade.student_id)) {
                    studentAverages.set(grade.student_id, 0);
                }
                const current = studentAverages.get(grade.student_id) || 0;
                studentAverages.set(grade.student_id, current + grade.score);
            }

            // Sort by average score
            const sorted = Array.from(studentAverages.entries())
                .sort((a, b) => b[1] - a[1]);

            // Find position
            const position = sorted.findIndex(entry => entry[0] === studentId) + 1;

            return position || 0;
        } catch (error) {
            console.error('Error getting class position:', error);
            return 0;
        }
    },

    /**
     * Generate report cards for entire class
     */
    async generateClassReportCards(
        classId: string,
        sessionId: string,
        termId: string
    ) {
        try {
            // Get all students in class
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('class_id', classId)
                .eq('status', 'active');

            if (!students) {
                return { success: false, error: 'No students found' };
            }

            const reportCards = [];

            for (const student of students) {
                const result = await this.generateReportCard(
                    student.id,
                    sessionId,
                    termId
                );

                if (result.success && result.data) {
                    reportCards.push(result.data);
                }
            }

            return {
                success: true,
                data: reportCards,
                count: reportCards.length
            };
        } catch (error) {
            console.error('Error generating class report cards:', error);
            return {
                success: false,
                error
            };
        }
    },

    /**
     * Export report card as PDF (placeholder for PDF service)
     */
    async exportReportCardPDF(reportCard: any) {
        try {
            // This would integrate with a PDF generation service
            // For now, return a reference that can be used
            const pdfRef = `${reportCard.student.id}-${reportCard.term}-report.pdf`;

            return {
                success: true,
                pdfRef,
                message: 'Report card ready for PDF export'
            };
        } catch (error) {
            console.error('Error exporting report card:', error);
            return {
                success: false,
                error
            };
        }
    },

    /**
     * Share report card with parent
     */
    async shareReportCardWithParent(
        studentId: string,
        parentId: string,
        reportCardData: any
    ) {
        try {
            // Create notification for parent
            const { error } = await supabase
                .from('notifications')
                .insert({
                    recipient_type: 'parent',
                    recipient_id: parentId,
                    notification_type: 'report_card_available',
                    title: 'Report Card Released',
                    message: `Report card for ${reportCardData.student.name} is now available`,
                    data: {
                        studentId,
                        reportCardData
                    }
                });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error sharing report card:', error);
            return { success: false, error };
        }
    }
};
