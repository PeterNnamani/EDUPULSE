import { supabase } from '@/lib/supabase';
import type { GradingScale, GradeRangeRule, StudentResult } from '@/types';

/**
 * Grading Engine Service
 * Handles automatic grade calculation and grading scale management
 */

interface ScoreCalculationInput {
    caScore?: number;
    testScore?: number;
    examScore?: number;
}

export const gradingEngine = {
    /**
     * Calculate total score from component scores
     */
    calculateTotalScore(input: ScoreCalculationInput): number {
        let total = 0;
        if (input.caScore !== undefined && input.caScore !== null) total += input.caScore;
        if (input.testScore !== undefined && input.testScore !== null) total += input.testScore;
        if (input.examScore !== undefined && input.examScore !== null) total += input.examScore;
        return total;
    },

    /**
     * Get the default grading scale for a school
     */
    async getDefaultGradingScale(schoolId: string): Promise<GradingScale | null> {
        try {
            const { data, error } = await supabase
                .from('grading_scales')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_default', true)
                .eq('is_active', true)
                .single();

            if (error) {
                console.error('Error fetching default grading scale:', error);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Error in getDefaultGradingScale:', error);
            return null;
        }
    },

    /**
     * Get all grading scales for a school
     */
    async getGradingScales(schoolId: string): Promise<GradingScale[]> {
        try {
            const { data, error } = await supabase
                .from('grading_scales')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .order('is_default', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching grading scales:', error);
            return [];
        }
    },

    /**
     * Get grade ranges for a grading scale
     */
    async getGradeRanges(gradingScaleId: string): Promise<GradeRangeRule[]> {
        try {
            const { data, error } = await supabase
                .from('grade_range_rules')
                .select('*')
                .eq('grading_scale_id', gradingScaleId)
                .order('max_score', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching grade ranges:', error);
            return [];
        }
    },

    /**
     * Assign grade based on score and grading scale
     */
    async assignGrade(
        totalScore: number,
        gradingScaleId: string
    ): Promise<{
        grade: string;
        gradePoint: number;
        remark: string;
    } | null> {
        try {
            const gradeRanges = await this.getGradeRanges(gradingScaleId);

            if (!gradeRanges.length) {
                console.error('No grade ranges found for grading scale');
                return null;
            }

            // Find the matching grade range
            const matchingRange = gradeRanges.find(
                (range) => totalScore >= range.min_score && totalScore <= range.max_score
            );

            if (!matchingRange) {
                console.error(`No grade range matches score: ${totalScore}`);
                return null;
            }

            return {
                grade: matchingRange.grade_letter,
                gradePoint: matchingRange.grade_point,
                remark: matchingRange.remark,
            };
        } catch (error) {
            console.error('Error assigning grade:', error);
            return null;
        }
    },

    /**
     * Create a new grading scale for a school
     */
    async createGradingScale(
        schoolId: string,
        scaleName: string,
        description?: string,
        isDefault: boolean = false
    ): Promise<{ success: boolean; data?: GradingScale; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('grading_scales')
                .insert([
                    {
                        school_id: schoolId,
                        scale_name: scaleName,
                        is_default: isDefault,
                        is_active: true,
                        description,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error: any) {
            console.error('Error creating grading scale:', error);
            return {
                success: false,
                error: error.message || 'Failed to create grading scale',
            };
        }
    },

    /**
     * Add grade range rule to a grading scale
     */
    async addGradeRange(
        gradingScaleId: string,
        minScore: number,
        maxScore: number,
        gradeLetter: string,
        gradePoint: number,
        remark: string,
        description?: string
    ): Promise<{ success: boolean; data?: GradeRangeRule; error?: string }> {
        try {
            if (minScore < 0 || maxScore > 100 || minScore > maxScore) {
                return {
                    success: false,
                    error: 'Invalid score range (0-100, min <= max)',
                };
            }

            const { data, error } = await supabase
                .from('grade_range_rules')
                .insert([
                    {
                        grading_scale_id: gradingScaleId,
                        min_score: minScore,
                        max_score: maxScore,
                        grade_letter: gradeLetter,
                        grade_point: gradePoint,
                        remark,
                        description,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error: any) {
            console.error('Error adding grade range:', error);
            return {
                success: false,
                error: error.message || 'Failed to add grade range',
            };
        }
    },

    /**
     * Update grade range rule
     */
    async updateGradeRange(
        gradeRangeId: string,
        updates: Partial<GradeRangeRule>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('grade_range_rules')
                .update({
                    ...(updates.minScore !== undefined && { min_score: updates.minScore }),
                    ...(updates.maxScore !== undefined && { max_score: updates.maxScore }),
                    ...(updates.gradeLetter && { grade_letter: updates.gradeLetter }),
                    ...(updates.gradePoint !== undefined && { grade_point: updates.gradePoint }),
                    ...(updates.remark && { remark: updates.remark }),
                    ...(updates.description !== undefined && { description: updates.description }),
                })
                .eq('id', gradeRangeId);

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error updating grade range:', error);
            return {
                success: false,
                error: error.message || 'Failed to update grade range',
            };
        }
    },

    /**
     * Delete grade range rule
     */
    async deleteGradeRange(gradeRangeId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('grade_range_rules')
                .delete()
                .eq('id', gradeRangeId);

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting grade range:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete grade range',
            };
        }
    },

    /**
     * Calculate class average
     */
    async getClassAverage(
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<number | null> {
        try {
            const { data, error } = await supabase
                .from('student_results')
                .select('total_score')
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published');

            if (error) throw error;

            if (!data || data.length === 0) return null;

            const total = data.reduce((sum, result) => sum + (result.total_score || 0), 0);
            return total / data.length;
        } catch (error) {
            console.error('Error calculating class average:', error);
            return null;
        }
    },

    /**
     * Get grade statistics for a class
     */
    async getClassGradeStats(
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{ [key: string]: number } | null> {
        try {
            const { data, error } = await supabase
                .from('student_results')
                .select('grade')
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'published');

            if (error) throw error;

            if (!data) return null;

            const stats: { [key: string]: number } = {};
            data.forEach((result) => {
                if (result.grade) {
                    stats[result.grade] = (stats[result.grade] || 0) + 1;
                }
            });

            return stats;
        } catch (error) {
            console.error('Error getting grade statistics:', error);
            return null;
        }
    },

    /**
     * Check if scores are valid
     */
    validateScores(input: ScoreCalculationInput): { valid: boolean; error?: string } {
        const scores = [input.caScore, input.testScore, input.examScore];

        for (const score of scores) {
            if (score !== undefined && score !== null) {
                if (typeof score !== 'number' || score < 0 || score > 100) {
                    return {
                        valid: false,
                        error: 'All scores must be numbers between 0 and 100',
                    };
                }
            }
        }

        return { valid: true };
    },
};
