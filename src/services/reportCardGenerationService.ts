import { supabase } from '@/lib/supabase';
import { positionCalculationService } from './positionCalculationService';
import type { ReportCard } from '@/types';

/**
 * Report Card Generation Service
 * Generates professional report cards that are permanent records
 */

export const reportCardGenerationService = {
    /**
     * Generate report card for a student
     */
    async generateReportCard(
        schoolId: string,
        studentId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{ success: boolean; data?: ReportCard; error?: string }> {
        try {
            // Check if report card already exists (immutable record)
            const existingReport = await this.getReportCard(
                schoolId,
                studentId,
                sessionId,
                termId
            );

            if (existingReport && existingReport.isPublished) {
                return {
                    success: false,
                    error: 'Report card already published and cannot be regenerated',
                };
            }

            // Get student results
            const { data: results } = await supabase
                .from('student_results')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published');

            if (!results || results.length === 0) {
                return {
                    success: false,
                    error: 'No published results found for this student',
                };
            }

            // Calculate summary statistics
            const totalSubjects = results.length;
            const totalMarks = results.reduce((sum, r) => sum + (r.total_score || 0), 0);
            const averageScore = totalMarks / totalSubjects;

            // Get overall grade (grade with highest frequency or best grade)
            const grades = results.map((r) => r.grade);
            const gradeFrequency: { [key: string]: number } = {};
            grades.forEach((g) => {
                gradeFrequency[g] = (gradeFrequency[g] || 0) + 1;
            });

            const overallGrade = Object.keys(gradeFrequency).reduce((a, b) =>
                gradeFrequency[a] > gradeFrequency[b] ? a : b
            );

            // Get class position
            const position = await positionCalculationService.getStudentPosition(
                schoolId,
                studentId,
                classId,
                sessionId,
                termId
            );

            // Get attendance data
            const { data: attendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('student_id', studentId)
                .eq('academic_term_id', termId);

            const attendanceStats = this.calculateAttendanceStats(attendance || []);

            // Get behaviour data
            const { data: behaviour } = await supabase
                .from('behaviour_records')
                .select('behaviour_type')
                .eq('student_id', studentId);

            const behaviourStats = this.calculateBehaviourStats(behaviour || []);

            // Get assignments
            const { data: assignments } = await supabase
                .from('assignments')
                .select('id')
                .eq('class_id', classId)
                .eq('academic_term_id', termId);

            const assignmentStats = await this.calculateAssignmentStats(
                studentId,
                termId,
                assignments?.length || 0
            );

            // Get risk assessment
            const { data: riskData } = await supabase
                .from('risk_assessments')
                .select('risk_level, risk_score')
                .eq('student_id', studentId)
                .eq('academic_term_id', termId)
                .single();

            // Get class teacher comment
            const { data: academicRecord } = await supabase
                .from('student_academic_records')
                .select('promotion_notes')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            // Determine promotion recommendation
            const promotionStatus = await this.determinePromotionStatus(
                schoolId,
                studentId,
                averageScore,
                attendanceStats.percentage,
                behaviourStats.rating
            );

            // Create report card data
            const reportCardData: ReportCard = {
                id: '', // Will be set by Supabase
                schoolId,
                studentId,
                classId,
                sessionId,
                termId,
                totalSubjects,
                totalMarks: Math.round(totalMarks * 100) / 100,
                averageScore: Math.round(averageScore * 100) / 100,
                overallGrade,
                classPosition: position?.position || 0,
                attendanceDaysPresent: attendanceStats.presentDays,
                attendanceDaysAbsent: attendanceStats.absentDays,
                attendancePercentage: Math.round(attendanceStats.percentage * 100) / 100,
                behaviourRating: behaviourStats.rating,
                behaviourMerits: behaviourStats.merits,
                behaviourDemerits: behaviourStats.demerits,
                riskLevel: (riskData?.risk_level || 'low') as any,
                riskScore: riskData?.risk_score,
                assignmentsGiven: assignmentStats.given,
                assignmentsSubmitted: assignmentStats.submitted,
                assignmentsCompletionPercentage: assignmentStats.completionPercentage,
                classTeacherComment: academicRecord?.promotion_notes,
                promotionStatus,
                isPublished: true,
                isLocked: false,
                generatedAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Check if report card exists
            const { data: existingReportCheck } = await supabase
                .from('report_cards')
                .select('id')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            let savedReport;
            let error;

            if (existingReportCheck) {
                // Update existing (only if not published)
                if (existingReport?.isPublished) {
                    return {
                        success: false,
                        error: 'Cannot update published report card',
                    };
                }

                const { data, error: updateError } = await supabase
                    .from('report_cards')
                    .update(reportCardData)
                    .eq('id', existingReportCheck.id)
                    .select()
                    .single();

                savedReport = data;
                error = updateError;
            } else {
                // Create new
                const { data, error: insertError } = await supabase
                    .from('report_cards')
                    .insert([reportCardData])
                    .select()
                    .single();

                savedReport = data;
                error = insertError;
            }

            if (error) throw error;

            return { success: true, data: savedReport };
        } catch (error: any) {
            console.error('Error generating report card:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate report card',
            };
        }
    },

    /**
     * Get existing report card
     */
    async getReportCard(
        schoolId: string,
        studentId: string,
        sessionId: string,
        termId: string
    ): Promise<ReportCard | null> {
        try {
            const { data, error } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching report card:', error);
            return null;
        }
    },

    /**
     * Generate report cards for entire class
     */
    async generateClassReportCards(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{
        success: boolean;
        generatedCount?: number;
        failedCount?: number;
        errors?: string[];
    }> {
        try {
            // Get all students in class
            const { data: students } = await supabase
                .from('student_academic_records')
                .select('student_id')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (!students || students.length === 0) {
                return {
                    success: false,
                    errors: ['No students found in class'],
                };
            }

            const errors: string[] = [];
            let generatedCount = 0;
            let failedCount = 0;

            for (const student of students) {
                try {
                    const result = await this.generateReportCard(
                        schoolId,
                        student.student_id,
                        classId,
                        sessionId,
                        termId
                    );

                    if (result.success) {
                        generatedCount++;
                    } else {
                        failedCount++;
                        errors.push(`${student.student_id}: ${result.error}`);
                    }
                } catch (error: any) {
                    failedCount++;
                    errors.push(`${student.student_id}: ${error.message}`);
                }
            }

            return {
                success: failedCount === 0,
                generatedCount,
                failedCount,
                errors: errors.length > 0 ? errors : undefined,
            };
        } catch (error: any) {
            console.error('Error generating class report cards:', error);
            return {
                success: false,
                errors: [error.message || 'Failed to generate report cards'],
            };
        }
    },

    /**
     * Get report cards for a class
     */
    async getClassReportCards(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ReportCard[]> {
        try {
            const { data, error } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('class_position', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching class report cards:', error);
            return [];
        }
    },

    /**
     * Get student's report card history
     */
    async getStudentReportCardHistory(
        schoolId: string,
        studentId: string
    ): Promise<ReportCard[]> {
        try {
            const { data, error } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .order('session_id', { ascending: false })
                .order('term_id', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching student report history:', error);
            return [];
        }
    },

    /**
     * Calculate attendance statistics
     */
    calculateAttendanceStats(attendance: any[]): {
        presentDays: number;
        absentDays: number;
        lateDays: number;
        percentage: number;
    } {
        let present = 0;
        let absent = 0;
        let late = 0;

        attendance.forEach((record) => {
            if (record.status === 'present') present++;
            else if (record.status === 'absent') absent++;
            else if (record.status === 'late') late++;
        });

        const total = present + absent + late;
        const percentage = total > 0 ? (present / total) * 100 : 0;

        return {
            presentDays: present,
            absentDays: absent,
            lateDays: late,
            percentage,
        };
    },

    /**
     * Calculate behaviour statistics
     */
    calculateBehaviourStats(behaviour: any[]): {
        rating: string;
        merits: number;
        demerits: number;
    } {
        let merits = 0;
        let demerits = 0;

        behaviour.forEach((record) => {
            if (record.behaviour_type === 'merit') merits++;
            else if (record.behaviour_type === 'demerit') demerits++;
        });

        const net = merits - demerits;
        let rating = 'Fair';

        if (net >= 10) rating = 'Excellent';
        else if (net >= 5) rating = 'Good';
        else if (net >= 0) rating = 'Fair';
        else rating = 'Poor';

        return { rating, merits, demerits };
    },

    /**
     * Calculate assignment statistics
     */
    async calculateAssignmentStats(
        studentId: string,
        termId: string,
        totalAssignments: number
    ): Promise<{
        given: number;
        submitted: number;
        completionPercentage: number;
    }> {
        try {
            // Get submitted assignments
            const { data: submissions } = await supabase
                .from('assignment_submissions')
                .select('id')
                .eq('student_id', studentId)
                .eq('status', 'submitted');

            const submitted = submissions?.length || 0;
            const completionPercentage =
                totalAssignments > 0 ? (submitted / totalAssignments) * 100 : 0;

            return {
                given: totalAssignments,
                submitted,
                completionPercentage: Math.round(completionPercentage * 100) / 100,
            };
        } catch (error) {
            console.error('Error calculating assignment stats:', error);
            return {
                given: totalAssignments,
                submitted: 0,
                completionPercentage: 0,
            };
        }
    },

    /**
     * Determine promotion status
     */
    async determinePromotionStatus(
        schoolId: string,
        studentId: string,
        averageScore: number,
        attendance: number,
        behaviour: string
    ): Promise<'promoted' | 'repeat' | 'under_review' | 'graduated'> {
        try {
            // Default logic - can be customized per school
            if (averageScore >= 50 && attendance >= 75 && behaviour !== 'Poor') {
                return 'promoted';
            } else if (averageScore < 40 || attendance < 60) {
                return 'repeat';
            } else {
                return 'under_review';
            }
        } catch (error) {
            console.error('Error determining promotion status:', error);
            return 'under_review';
        }
    },

    /**
     * Lock a report card to prevent future edits
     */
    async lockReportCard(reportCardId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('report_cards')
                .update({ is_locked: true })
                .eq('id', reportCardId);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error locking report card:', error);
            return {
                success: false,
                error: error.message || 'Failed to lock report card',
            };
        }
    },
};
