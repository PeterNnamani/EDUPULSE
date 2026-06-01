import { supabase } from '@/lib/supabase';
import { gradingEngine } from './gradingEngine';
import type { StudentResult } from '@/types';

/**
 * Result Entry Service
 * Teachers enter scores (CA, Test, Exam) and system calculates totals/grades
 */

interface ResultEntryInput {
    studentId: string;
    classId: string;
    subjectId: string;
    sessionId: string;
    termId: string;
    caScore?: number;
    testScore?: number;
    examScore?: number;
    teacherComments?: string;
}

export const resultEntryService = {
    /**
     * Enter/update student result
     */
    async enterResult(
        schoolId: string,
        teacherId: string,
        gradingScaleId: string,
        input: ResultEntryInput
    ): Promise<{ success: boolean; data?: StudentResult; error?: string }> {
        try {
            // Validate scores
            const validation = gradingEngine.validateScores({
                caScore: input.caScore,
                testScore: input.testScore,
                examScore: input.examScore,
            });

            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Calculate total score
            const totalScore = gradingEngine.calculateTotalScore({
                caScore: input.caScore,
                testScore: input.testScore,
                examScore: input.examScore,
            });

            // Assign grade
            const gradeInfo = await gradingEngine.assignGrade(totalScore, gradingScaleId);

            if (!gradeInfo) {
                return { success: false, error: 'Failed to assign grade' };
            }

            // Check if result exists
            const { data: existingResult } = await supabase
                .from('student_results')
                .select('id')
                .eq('school_id', schoolId)
                .eq('student_id', input.studentId)
                .eq('class_id', input.classId)
                .eq('subject_id', input.subjectId)
                .eq('session_id', input.sessionId)
                .eq('term_id', input.termId)
                .single();

            let result;
            let error;

            if (existingResult) {
                // Update existing result
                ({ data: result, error } = await supabase
                    .from('student_results')
                    .update({
                        ca_score: input.caScore ?? null,
                        test_score: input.testScore ?? null,
                        exam_score: input.examScore ?? null,
                        total_score: totalScore,
                        grade: gradeInfo.grade,
                        grade_point: gradeInfo.gradePoint,
                        remark: gradeInfo.remark,
                        teacher_comments: input.teacherComments,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingResult.id)
                    .select()
                    .single());
            } else {
                // Create new result
                ({ data: result, error } = await supabase
                    .from('student_results')
                    .insert([
                        {
                            school_id: schoolId,
                            student_id: input.studentId,
                            class_id: input.classId,
                            subject_id: input.subjectId,
                            session_id: input.sessionId,
                            term_id: input.termId,
                            ca_score: input.caScore ?? null,
                            test_score: input.testScore ?? null,
                            exam_score: input.examScore ?? null,
                            total_score: totalScore,
                            grade: gradeInfo.grade,
                            grade_point: gradeInfo.gradePoint,
                            remark: gradeInfo.remark,
                            grading_scale_id: gradingScaleId,
                            teacher_id: teacherId,
                            approval_status: 'draft',
                            teacher_comments: input.teacherComments,
                        },
                    ])
                    .select()
                    .single());
            }

            if (error) throw error;

            return { success: true, data: result };
        } catch (error: any) {
            console.error('Error entering result:', error);
            return {
                success: false,
                error: error.message || 'Failed to enter result',
            };
        }
    },

    /**
     * Get student results for a term
     */
    async getStudentResults(
        schoolId: string,
        studentId: string,
        sessionId: string,
        termId: string
    ): Promise<StudentResult[]> {
        try {
            const { data, error } = await supabase
                .from('student_results')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching student results:', error);
            return [];
        }
    },

    /**
     * Get class results for a subject
     */
    async getClassSubjectResults(
        schoolId: string,
        classId: string,
        subjectId: string,
        sessionId: string,
        termId: string
    ): Promise<StudentResult[]> {
        try {
            const { data, error } = await supabase
                .from('student_results')
                .select(`
          *,
          student:student_id(id, first_name, middle_name, last_name, admission_number)
        `)
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('subject_id', subjectId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .order('student_id', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching class subject results:', error);
            return [];
        }
    },

    /**
     * Get all subject results for a student
     */
    async getStudentSubjectResults(
        schoolId: string,
        studentId: string,
        subjectId: string
    ): Promise<StudentResult[]> {
        try {
            const { data, error } = await supabase
                .from('student_results')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('subject_id', subjectId)
                .order('session_id', { ascending: false })
                .order('term_id', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching student subject results:', error);
            return [];
        }
    },

    /**
     * Update result score
     */
    async updateResultScore(
        resultId: string,
        input: Partial<ResultEntryInput>,
        gradingScaleId: string
    ): Promise<{ success: boolean; data?: StudentResult; error?: string }> {
        try {
            // Get existing result first
            const { data: existingResult } = await supabase
                .from('student_results')
                .select('*')
                .eq('id', resultId)
                .single();

            if (!existingResult) {
                return { success: false, error: 'Result not found' };
            }

            // Can only edit draft results
            if (existingResult.approval_status !== 'draft') {
                return {
                    success: false,
                    error: 'Cannot edit results that have been submitted or approved',
                };
            }

            // Calculate new total
            const totalScore = gradingEngine.calculateTotalScore({
                caScore: input.caScore ?? existingResult.ca_score,
                testScore: input.testScore ?? existingResult.test_score,
                examScore: input.examScore ?? existingResult.exam_score,
            });

            // Assign new grade
            const gradeInfo = await gradingEngine.assignGrade(totalScore, gradingScaleId);

            if (!gradeInfo) {
                return { success: false, error: 'Failed to assign grade' };
            }

            // Update result
            const { data, error } = await supabase
                .from('student_results')
                .update({
                    ...(input.caScore !== undefined && { ca_score: input.caScore }),
                    ...(input.testScore !== undefined && { test_score: input.testScore }),
                    ...(input.examScore !== undefined && { exam_score: input.examScore }),
                    total_score: totalScore,
                    grade: gradeInfo.grade,
                    grade_point: gradeInfo.gradePoint,
                    remark: gradeInfo.remark,
                    ...(input.teacherComments && { teacher_comments: input.teacherComments }),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', resultId)
                .select()
                .single();

            if (error) throw error;

            return { success: true, data };
        } catch (error: any) {
            console.error('Error updating result score:', error);
            return {
                success: false,
                error: error.message || 'Failed to update result',
            };
        }
    },

    /**
     * Delete a result (only if draft)
     */
    async deleteResult(resultId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Check if result is draft
            const { data: result } = await supabase
                .from('student_results')
                .select('approval_status')
                .eq('id', resultId)
                .single();

            if (!result) {
                return { success: false, error: 'Result not found' };
            }

            if (result.approval_status !== 'draft') {
                return {
                    success: false,
                    error: 'Can only delete draft results',
                };
            }

            const { error } = await supabase
                .from('student_results')
                .delete()
                .eq('id', resultId);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error deleting result:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete result',
            };
        }
    },

    /**
     * Get draft results count for a class
     */
    async getDraftResultsCount(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('student_results')
                .select('id', { count: 'exact', head: true })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'draft');

            if (error) throw error;

            return count || 0;
        } catch (error) {
            console.error('Error getting draft results count:', error);
            return 0;
        }
    },

    /**
     * Batch import results from CSV
     */
    async batchImportResults(
        schoolId: string,
        teacherId: string,
        gradingScaleId: string,
        classId: string,
        sessionId: string,
        termId: string,
        results: ResultEntryInput[]
    ): Promise<{ success: boolean; importedCount: number; failedCount: number; errors: string[] }> {
        const errors: string[] = [];
        let importedCount = 0;
        let failedCount = 0;

        for (const result of results) {
            try {
                const res = await this.enterResult(schoolId, teacherId, gradingScaleId, result);
                if (res.success) {
                    importedCount++;
                } else {
                    failedCount++;
                    errors.push(`${result.studentId}: ${res.error}`);
                }
            } catch (error: any) {
                failedCount++;
                errors.push(`${result.studentId}: ${error.message}`);
            }
        }

        return {
            success: failedCount === 0,
            importedCount,
            failedCount,
            errors,
        };
    },
};
