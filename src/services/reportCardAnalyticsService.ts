import { supabase } from '@/lib/supabase';
import type { ResultAnalytics, ReportCardSummary } from '@/types';

/**
 * Report Card Analytics Service
 * Provides analytics and insights on class performance
 */

export const reportCardAnalyticsService = {
    /**
     * Generate class summary statistics
     */
    async generateClassSummary(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{ success: boolean; data?: ReportCardSummary; error?: string }> {
        try {
            // Get all report cards for class
            const { data: reportCards } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (!reportCards || reportCards.length === 0) {
                return {
                    success: false,
                    error: 'No report cards found for this class',
                };
            }

            const totalStudents = reportCards.length;
            const totalMarks = reportCards.reduce((sum, rc) => sum + (rc.total_marks || 0), 0);
            const averageClassScore = totalMarks / totalStudents;

            const scores = reportCards.map((rc) => rc.average_score);
            const highestAverage = Math.max(...scores);
            const lowestAverage = Math.min(...scores);

            // Count pass/fail (assuming 50+ is pass)
            const passCount = reportCards.filter((rc) => rc.average_score >= 50).length;
            const failCount = totalStudents - passCount;
            const passRate = (passCount / totalStudents) * 100;

            // Get subject performance
            const { data: results } = await supabase
                .from('student_results')
                .select('subject_id, total_score')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published');

            const subjectAverages: { [key: string]: number } = {};
            const subjectCounts: { [key: string]: number } = {};

            if (results) {
                results.forEach((result) => {
                    const subjectId = result.subject_id;
                    if (!subjectAverages[subjectId]) {
                        subjectAverages[subjectId] = 0;
                        subjectCounts[subjectId] = 0;
                    }
                    subjectAverages[subjectId] += result.total_score || 0;
                    subjectCounts[subjectId]++;
                });

                // Calculate averages
                Object.keys(subjectAverages).forEach((subjectId) => {
                    subjectAverages[subjectId] =
                        Math.round(
                            (subjectAverages[subjectId] / subjectCounts[subjectId]) * 100
                        ) / 100;
                });
            }

            // Find best and worst subjects
            let bestSubject = Object.keys(subjectAverages)[0];
            let worstSubject = Object.keys(subjectAverages)[0];

            Object.keys(subjectAverages).forEach((subjectId) => {
                if (subjectAverages[subjectId] > subjectAverages[bestSubject]) {
                    bestSubject = subjectId;
                }
                if (subjectAverages[subjectId] < subjectAverages[worstSubject]) {
                    worstSubject = subjectId;
                }
            });

            // Get average attendance
            const attendancePercentages = reportCards
                .map((rc) => rc.attendance_percentage)
                .filter((a) => a !== null);
            const classAverageAttendance =
                attendancePercentages.length > 0
                    ? attendancePercentages.reduce((a, b) => a + b, 0) / attendancePercentages.length
                    : 0;

            // Check if summary exists
            const { data: existingSummary } = await supabase
                .from('report_card_summaries')
                .select('id')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            const summaryData: ReportCardSummary = {
                id: existingSummary?.id || '',
                schoolId,
                classId,
                sessionId,
                termId,
                totalStudents,
                averageClassScore: Math.round(averageClassScore * 100) / 100,
                highestAverage,
                lowestAverage,
                passCount,
                failCount,
                passRate: Math.round(passRate * 100) / 100,
                bestPerformingSubjectId: bestSubject,
                worstPerformingSubjectId: worstSubject,
                subjectAverages,
                classAverageAttendance: Math.round(classAverageAttendance * 100) / 100,
                generatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            let savedSummary;
            let error;

            if (existingSummary) {
                const { data, error: updateError } = await supabase
                    .from('report_card_summaries')
                    .update(summaryData)
                    .eq('id', existingSummary.id)
                    .select()
                    .single();

                savedSummary = data;
                error = updateError;
            } else {
                const { data, error: insertError } = await supabase
                    .from('report_card_summaries')
                    .insert([summaryData])
                    .select()
                    .single();

                savedSummary = data;
                error = insertError;
            }

            if (error) throw error;

            return { success: true, data: savedSummary };
        } catch (error: any) {
            console.error('Error generating class summary:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate class summary',
            };
        }
    },

    /**
     * Get comprehensive class analytics
     */
    async getClassAnalytics(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ResultAnalytics | null> {
        try {
            // Get report cards
            const { data: reportCards } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('class_position', { ascending: true });

            if (!reportCards || reportCards.length === 0) {
                return null;
            }

            // Calculate class average
            const scores = reportCards.map((rc) => rc.average_score);
            const classAverage = scores.reduce((a, b) => a + b, 0) / scores.length;

            // Get top performers
            const topPerformers = reportCards.slice(0, 5).map((rc) => ({
                studentId: rc.student_id,
                studentName: '', // Will be fetched separately
                average: rc.average_score,
                position: rc.class_position,
            }));

            // Get bottom performers
            const bottomPerformers = reportCards.slice(-5).map((rc) => ({
                studentId: rc.student_id,
                studentName: '', // Will be fetched separately
                average: rc.average_score,
                position: rc.class_position,
            }));

            // Get subject performance
            const { data: results } = await supabase
                .from('student_results')
                .select('subject_id, total_score, grade')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published');

            const subjectStats: { [key: string]: { total: number; count: number; passes: number } } =
                {};

            if (results) {
                results.forEach((result) => {
                    const subjectId = result.subject_id;
                    if (!subjectStats[subjectId]) {
                        subjectStats[subjectId] = { total: 0, count: 0, passes: 0 };
                    }
                    subjectStats[subjectId].total += result.total_score || 0;
                    subjectStats[subjectId].count++;
                    if (result.grade !== 'F') {
                        subjectStats[subjectId].passes++;
                    }
                });
            }

            const subjectPerformance = Object.keys(subjectStats).map((subjectId) => {
                const stats = subjectStats[subjectId];
                return {
                    subjectId,
                    subjectName: subjectId, // Will be fetched separately
                    average: Math.round((stats.total / stats.count) * 100) / 100,
                    passRate: Math.round((stats.passes / stats.count) * 100),
                };
            });

            // Grade distribution
            const gradeDistribution: { [key: string]: number } = {};
            reportCards.forEach((rc) => {
                if (rc.overall_grade) {
                    gradeDistribution[rc.overall_grade] =
                        (gradeDistribution[rc.overall_grade] || 0) + 1;
                }
            });

            // Pass/fail
            const passCount = reportCards.filter((rc) => rc.average_score >= 50).length;
            const failCount = reportCards.length - passCount;

            // Attendance trends
            const attendancePercentages = reportCards.map((rc) => rc.attendance_percentage || 0);
            const averageAttendance =
                attendancePercentages.reduce((a, b) => a + b, 0) / attendancePercentages.length;
            const highestAttendance = Math.max(...attendancePercentages);
            const lowestAttendance = Math.min(...attendancePercentages);

            return {
                classId,
                sessionId,
                termId,
                classAverage: Math.round(classAverage * 100) / 100,
                topPerformers,
                bottomPerformers,
                subjectPerformance,
                gradeDistribution,
                passFailRate: {
                    passCount,
                    failCount,
                    passRate: Math.round((passCount / reportCards.length) * 100),
                },
                attendanceTrends: {
                    averageAttendance: Math.round(averageAttendance * 100) / 100,
                    highestAttendance,
                    lowestAttendance,
                },
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error getting class analytics:', error);
            return null;
        }
    },

    /**
     * Get subject performance analytics
     */
    async getSubjectAnalytics(
        schoolId: string,
        subjectId: string,
        sessionId: string,
        termId: string
    ): Promise<{
        averageScore: number;
        passRate: number;
        gradeDistribution: { [key: string]: number };
        topStudents: Array<{
            studentId: string;
            score: number;
            grade: string;
        }>;
    } | null> {
        try {
            const { data: results } = await supabase
                .from('student_results')
                .select('*')
                .eq('school_id', schoolId)
                .eq('subject_id', subjectId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published')
                .order('total_score', { ascending: false });

            if (!results || results.length === 0) {
                return null;
            }

            const scores = results.map((r) => r.total_score || 0);
            const averageScore =
                Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;

            const gradeDistribution: { [key: string]: number } = {};
            let passCount = 0;

            results.forEach((result) => {
                if (result.grade) {
                    gradeDistribution[result.grade] = (gradeDistribution[result.grade] || 0) + 1;
                }
                if (result.grade !== 'F') {
                    passCount++;
                }
            });

            const passRate = Math.round((passCount / results.length) * 100);

            const topStudents = results.slice(0, 5).map((r) => ({
                studentId: r.student_id,
                score: r.total_score || 0,
                grade: r.grade,
            }));

            return {
                averageScore,
                passRate,
                gradeDistribution,
                topStudents,
            };
        } catch (error) {
            console.error('Error getting subject analytics:', error);
            return null;
        }
    },

    /**
     * Get student performance trends
     */
    async getStudentTrends(
        schoolId: string,
        studentId: string
    ): Promise<{
        termScores: Array<{
            sessionId: string;
            termId: string;
            averageScore: number;
            trend: 'improving' | 'stable' | 'declining';
        }>;
        overallTrend: 'improving' | 'stable' | 'declining';
    } | null> {
        try {
            const { data: reportCards } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .order('session_id', { ascending: true })
                .order('term_id', { ascending: true });

            if (!reportCards || reportCards.length === 0) {
                return null;
            }

            const termScores = reportCards.map((rc) => ({
                sessionId: rc.session_id,
                termId: rc.term_id,
                averageScore: rc.average_score,
                trend: 'stable' as 'improving' | 'stable' | 'declining',
            }));

            // Calculate trends
            for (let i = 1; i < termScores.length; i++) {
                const current = termScores[i].averageScore;
                const previous = termScores[i - 1].averageScore;

                if (current > previous + 2) {
                    termScores[i].trend = 'improving';
                } else if (current < previous - 2) {
                    termScores[i].trend = 'declining';
                }
            }

            // Overall trend
            let overallTrend: 'improving' | 'stable' | 'declining' = 'stable';
            if (termScores.length >= 2) {
                const first = termScores[0].averageScore;
                const last = termScores[termScores.length - 1].averageScore;

                if (last > first + 2) {
                    overallTrend = 'improving';
                } else if (last < first - 2) {
                    overallTrend = 'declining';
                }
            }

            return {
                termScores,
                overallTrend,
            };
        } catch (error) {
            console.error('Error getting student trends:', error);
            return null;
        }
    },

    /**
     * Get class summary
     */
    async getClassSummary(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ReportCardSummary | null> {
        try {
            const { data, error } = await supabase
                .from('report_card_summaries')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found, generate it
                    const result = await this.generateClassSummary(
                        schoolId,
                        classId,
                        sessionId,
                        termId
                    );
                    return result.data || null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching class summary:', error);
            return null;
        }
    },
};
