import { supabase } from '@/lib/supabase';
import type { ClassPosition } from '@/types';

/**
 * Position Calculation Service
 * Calculates class positions based on average scores
 * Handles ties correctly (1st, 1st, 3rd format)
 */

export const positionCalculationService = {
    /**
     * Calculate class positions for a term
     */
    async calculateClassPositions(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{ success: boolean; positionsCount?: number; error?: string }> {
        try {
            // Get all students in class for the term
            const { data: classRecords, error: recordsError } = await supabase
                .from('student_academic_records')
                .select('id, student_id')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (recordsError) throw recordsError;

            if (!classRecords || classRecords.length === 0) {
                return {
                    success: false,
                    error: 'No students found in class for this term',
                };
            }

            // Get average score for each student
            const studentAverages: Array<{
                studentId: string;
                average: number;
            }> = [];

            for (const record of classRecords) {
                const { data: results, error: resultsError } = await supabase
                    .from('student_results')
                    .select('total_score')
                    .eq('school_id', schoolId)
                    .eq('student_id', record.student_id)
                    .eq('class_id', classId)
                    .eq('session_id', sessionId)
                    .eq('term_id', termId)
                    .eq('approval_status', 'published');

                if (resultsError) throw resultsError;

                if (results && results.length > 0) {
                    const totalMarks = results.reduce((sum, r) => sum + (r.total_score || 0), 0);
                    const average = totalMarks / results.length;
                    studentAverages.push({
                        studentId: record.student_id,
                        average,
                    });
                }
            }

            // Sort by average (descending)
            studentAverages.sort((a, b) => b.average - a.average);

            // Assign positions with tie handling (1, 1, 3 format)
            const positions: Array<{
                student_id: string;
                position: number;
                average_score: number;
            }> = [];

            let currentPosition = 1;
            let previousAverage: number | null = null;

            for (let i = 0; i < studentAverages.length; i++) {
                const current = studentAverages[i];

                // If score is different from previous, update position
                if (previousAverage !== null && current.average !== previousAverage) {
                    currentPosition = i + 1;
                }

                positions.push({
                    student_id: current.studentId,
                    position: currentPosition,
                    average_score: current.average,
                });

                previousAverage = current.average;
            }

            // Delete existing positions for this class/term
            await supabase
                .from('class_positions')
                .delete()
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            // Insert new positions
            const { error: insertError } = await supabase
                .from('class_positions')
                .insert(
                    positions.map((pos) => ({
                        school_id: schoolId,
                        student_id: pos.student_id,
                        class_id: classId,
                        session_id: sessionId,
                        term_id: termId,
                        average_score: pos.average_score,
                        position: pos.position,
                        total_students: studentAverages.length,
                        calculated_at: new Date().toISOString(),
                    }))
                );

            if (insertError) throw insertError;

            return {
                success: true,
                positionsCount: positions.length,
            };
        } catch (error: any) {
            console.error('Error calculating class positions:', error);
            return {
                success: false,
                error: error.message || 'Failed to calculate positions',
            };
        }
    },

    /**
     * Get student's position in class
     */
    async getStudentPosition(
        schoolId: string,
        studentId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ClassPosition | null> {
        try {
            const { data, error } = await supabase
                .from('class_positions')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('class_id', classId)
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
            console.error('Error fetching student position:', error);
            return null;
        }
    },

    /**
     * Get all positions for a class
     */
    async getClassPositions(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ClassPosition[]> {
        try {
            const { data, error } = await supabase
                .from('class_positions')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('position', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching class positions:', error);
            return [];
        }
    },

    /**
     * Get top performers in class
     */
    async getTopPerformers(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        limit: number = 5
    ): Promise<
        Array<{
            studentId: string;
            studentName: string;
            position: number;
            averageScore: number;
        }>
    > {
        try {
            const { data, error } = await supabase
                .from('class_positions')
                .select(`
          *,
          student:student_id(id, first_name, middle_name, last_name)
        `)
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('position', { ascending: true })
                .limit(limit);

            if (error) throw error;

            return (
                data?.map((pos) => ({
                    studentId: pos.student_id,
                    studentName: `${pos.student?.first_name || ''} ${pos.student?.middle_name || ''} ${pos.student?.last_name || ''}`.trim(),
                    position: pos.position,
                    averageScore: pos.average_score,
                })) || []
            );
        } catch (error) {
            console.error('Error fetching top performers:', error);
            return [];
        }
    },

    /**
     * Get students at risk (bottom performers)
     */
    async getAtRiskStudents(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        limit: number = 5
    ): Promise<
        Array<{
            studentId: string;
            studentName: string;
            position: number;
            averageScore: number;
        }>
    > {
        try {
            // Get total students first
            const { data: allPositions } = await supabase
                .from('class_positions')
                .select('position')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('position', { ascending: false })
                .limit(1);

            if (!allPositions || allPositions.length === 0) {
                return [];
            }

            const maxPosition = allPositions[0].position;
            const bottomThreshold = Math.max(1, maxPosition - limit + 1);

            const { data, error } = await supabase
                .from('class_positions')
                .select(`
          *,
          student:student_id(id, first_name, middle_name, last_name)
        `)
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .gte('position', bottomThreshold)
                .order('position', { ascending: false });

            if (error) throw error;

            return (
                data?.map((pos) => ({
                    studentId: pos.student_id,
                    studentName: `${pos.student?.first_name || ''} ${pos.student?.middle_name || ''} ${pos.student?.last_name || ''}`.trim(),
                    position: pos.position,
                    averageScore: pos.average_score,
                })) || []
            );
        } catch (error) {
            console.error('Error fetching at-risk students:', error);
            return [];
        }
    },

    /**
     * Format position display (1st, 2nd, 3rd, 4th, etc.)
     */
    formatPosition(position: number): string {
        if (position === 1) return '1st';
        if (position === 2) return '2nd';
        if (position === 3) return '3rd';
        return `${position}th`;
    },

    /**
     * Get position rank statistics
     */
    async getPositionStats(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{
        totalStudents: number;
        averagePosition: number;
        medianPosition: number;
    } | null> {
        try {
            const positions = await this.getClassPositions(
                schoolId,
                classId,
                sessionId,
                termId
            );

            if (positions.length === 0) {
                return null;
            }

            const positionValues = positions.map((p) => p.position);
            const sum = positionValues.reduce((a, b) => a + b, 0);
            const average = sum / positionValues.length;

            const sorted = [...positionValues].sort((a, b) => a - b);
            const median =
                sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)];

            return {
                totalStudents: positions.length,
                averagePosition: Math.round(average * 100) / 100,
                medianPosition: median,
            };
        } catch (error) {
            console.error('Error calculating position stats:', error);
            return null;
        }
    },
};
