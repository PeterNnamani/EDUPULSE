import { supabase } from '@/lib/supabase';
import { positionCalculationService } from './positionCalculationService';
import type { ResultApproval } from '@/types';

/**
 * Result Approval Service
 * Manages the approval workflow: Draft → Submitted → Approved → Published
 */

export const resultApprovalService = {
    /**
     * Get approval status for a class term
     */
    async getApprovalStatus(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ResultApproval | null> {
        try {
            const { data, error } = await supabase
                .from('result_approvals')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found - create initial draft
                    const approval = await this.createApprovalRecord(
                        schoolId,
                        classId,
                        sessionId,
                        termId
                    );
                    return approval;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error fetching approval status:', error);
            return null;
        }
    },

    /**
     * Create approval record
     */
    async createApprovalRecord(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<ResultApproval | null> {
        try {
            const { data, error } = await supabase
                .from('result_approvals')
                .insert([
                    {
                        school_id: schoolId,
                        class_id: classId,
                        session_id: sessionId,
                        term_id: termId,
                        current_status: 'draft',
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error creating approval record:', error);
            return null;
        }
    },

    /**
     * Submit results for class teacher review
     */
    async submitResults(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        submittedBy: string,
        classTeacherComment?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Check all results are complete (have scores)
            const { data: incompleteResults } = await supabase
                .from('student_results')
                .select('id')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .where(
                    'ca_score IS NULL OR test_score IS NULL OR exam_score IS NULL'
                );

            if (incompleteResults && incompleteResults.length > 0) {
                return {
                    success: false,
                    error: `${incompleteResults.length} results are incomplete. All scores must be entered.`,
                };
            }

            // Update all results to submitted
            const { error: updateError } = await supabase
                .from('student_results')
                .update({
                    approval_status: 'submitted',
                    submitted_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'draft');

            if (updateError) throw updateError;

            // Update approval status
            const { error: approvalError } = await supabase
                .from('result_approvals')
                .update({
                    current_status: 'submitted',
                    submitted_by: submittedBy,
                    class_teacher_comment: classTeacherComment,
                    submitted_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (approvalError) throw approvalError;

            return { success: true };
        } catch (error: any) {
            console.error('Error submitting results:', error);
            return {
                success: false,
                error: error.message || 'Failed to submit results',
            };
        }
    },

    /**
     * Principal approves results
     */
    async approveResults(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        approvedBy: string,
        principalComment?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Update all results to approved
            const { error: updateError } = await supabase
                .from('student_results')
                .update({
                    approval_status: 'approved',
                    approved_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .in('approval_status', ['submitted', 'draft']);

            if (updateError) throw updateError;

            // Update approval status
            const { error: approvalError } = await supabase
                .from('result_approvals')
                .update({
                    current_status: 'approved',
                    approved_by: approvedBy,
                    principal_comment: principalComment,
                    approved_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (approvalError) throw approvalError;

            return { success: true };
        } catch (error: any) {
            console.error('Error approving results:', error);
            return {
                success: false,
                error: error.message || 'Failed to approve results',
            };
        }
    },

    /**
     * Reject results and send back for revision
     */
    async rejectResults(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        rejectionReason: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Update all results back to draft
            const { error: updateError } = await supabase
                .from('student_results')
                .update({
                    approval_status: 'draft',
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .in('approval_status', ['submitted', 'approved']);

            if (updateError) throw updateError;

            // Update approval status
            const { error: approvalError } = await supabase
                .from('result_approvals')
                .update({
                    current_status: 'rejected',
                    rejection_reason: rejectionReason,
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (approvalError) throw approvalError;

            return { success: true };
        } catch (error: any) {
            console.error('Error rejecting results:', error);
            return {
                success: false,
                error: error.message || 'Failed to reject results',
            };
        }
    },

    /**
     * Publish results (final step, creates report cards)
     */
    async publishResults(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string,
        publishedBy: string
    ): Promise<{ success: boolean; reportsCreated?: number; error?: string }> {
        try {
            // Check approval status
            const approval = await this.getApprovalStatus(
                schoolId,
                classId,
                sessionId,
                termId
            );

            if (!approval || approval.current_status !== 'approved') {
                return {
                    success: false,
                    error: 'Results must be approved before publishing',
                };
            }

            // Update results to published
            const { error: updateError } = await supabase
                .from('student_results')
                .update({
                    approval_status: 'published',
                    published_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .eq('approval_status', 'approved');

            if (updateError) throw updateError;

            // Calculate positions
            await positionCalculationService.calculateClassPositions(
                schoolId,
                classId,
                sessionId,
                termId
            );

            // Update approval status
            const { error: approvalError } = await supabase
                .from('result_approvals')
                .update({
                    current_status: 'published',
                    published_by: publishedBy,
                    published_at: new Date().toISOString(),
                })
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (approvalError) throw approvalError;

            // TODO: Create report cards
            // TODO: Send notifications to parents

            return {
                success: true,
                reportsCreated: 0, // Will be updated when report card generation is implemented
            };
        } catch (error: any) {
            console.error('Error publishing results:', error);
            return {
                success: false,
                error: error.message || 'Failed to publish results',
            };
        }
    },

    /**
     * Get approval progress for a class
     */
    async getApprovalProgress(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{
        draftCount: number;
        submittedCount: number;
        approvedCount: number;
        publishedCount: number;
        totalResults: number;
        progressPercentage: number;
    } | null> {
        try {
            const { data: results } = await supabase
                .from('student_results')
                .select('approval_status')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (!results || results.length === 0) {
                return null;
            }

            const draftCount = results.filter((r) => r.approval_status === 'draft').length;
            const submittedCount = results.filter((r) => r.approval_status === 'submitted').length;
            const approvedCount = results.filter((r) => r.approval_status === 'approved').length;
            const publishedCount = results.filter((r) => r.approval_status === 'published').length;

            const publishedAndApprovedCount = publishedCount + approvedCount;
            const progressPercentage = Math.round(
                ((publishedAndApprovedCount) / results.length) * 100
            );

            return {
                draftCount,
                submittedCount,
                approvedCount,
                publishedCount,
                totalResults: results.length,
                progressPercentage,
            };
        } catch (error) {
            console.error('Error getting approval progress:', error);
            return null;
        }
    },

    /**
     * Check if class is ready for publishing
     */
    async isReadyForPublishing(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{
        isReady: boolean;
        reasons: string[];
    }> {
        try {
            const approval = await this.getApprovalStatus(
                schoolId,
                classId,
                sessionId,
                termId
            );

            const reasons: string[] = [];

            if (!approval) {
                reasons.push('No approval record found');
                return { isReady: false, reasons };
            }

            if (approval.current_status !== 'approved') {
                reasons.push(`Current status is ${approval.current_status}, must be approved`);
            }

            // Check for incomplete results
            const { data: incompleteResults } = await supabase
                .from('student_results')
                .select('id')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .where(
                    'ca_score IS NULL OR test_score IS NULL OR exam_score IS NULL'
                );

            if (incompleteResults && incompleteResults.length > 0) {
                reasons.push(`${incompleteResults.length} results are incomplete`);
            }

            // Check for missing positions
            const positions = await positionCalculationService.getClassPositions(
                schoolId,
                classId,
                sessionId,
                termId
            );

            if (positions.length === 0) {
                reasons.push('Class positions not calculated');
            }

            return {
                isReady: reasons.length === 0,
                reasons,
            };
        } catch (error) {
            console.error('Error checking if ready for publishing:', error);
            return {
                isReady: false,
                reasons: ['Error checking readiness'],
            };
        }
    },
};
