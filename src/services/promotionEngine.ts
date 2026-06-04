import { supabase } from '@/lib/supabase';
import { PromotionStatus } from '@/types';

/**
 * Student Promotion Engine
 * Handles eligibility checking and automatic promotion/retention
 */

export const promotionEngine = {
    /**
     * Check promotion eligibility for a student
     */
    async checkPromotionEligibility(
        studentId: string,
        sessionId: string,
        fromClassId: string,
        toClassId: string,
        schoolId: string
    ) {
        try {
            // Get promotion rules
            const { data: rules } = await supabase
                .from('promotion_rules')
                .select('*')
                .eq('school_id', schoolId)
                .eq('from_class_id', fromClassId)
                .eq('to_class_id', toClassId)
                .single();

            if (!rules) {
                return {
                    eligible: false,
                    status: 'manual_review' as PromotionStatus,
                    reason: 'No promotion rules defined'
                };
            }

            // Get student academic record
            const { data: academicRecord } = await supabase
                .from('student_academic_records')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .single();

            if (!academicRecord) {
                return {
                    eligible: false,
                    status: 'pending' as PromotionStatus,
                    reason: 'Academic record not found'
                };
            }

            const eligibilityChecks = {
                attendance: (academicRecord.attendance_rate || 0) >= rules.attendance_threshold,
                grades: (academicRecord.average_score || 0) >= rules.grade_threshold,
                behaviour: (academicRecord.behaviour_score || 0) >= rules.behaviour_threshold,
                fees: await this.checkFeesStatus(studentId, sessionId, schoolId)
            };

            // Check if eligible for promotion
            const allChecksPass = Object.values(eligibilityChecks).every(check => check);

            if (allChecksPass) {
                return {
                    eligible: true,
                    status: 'promoted' as PromotionStatus,
                    reason: 'All eligibility criteria met',
                    checks: eligibilityChecks
                };
            }

            // Check if should be retained
            if (!eligibilityChecks.grades && rules.allows_repeat) {
                return {
                    eligible: false,
                    status: 'repeat' as PromotionStatus,
                    reason: 'Failed to meet grade threshold',
                    checks: eligibilityChecks
                };
            }

            // Otherwise manual review required
            return {
                eligible: false,
                status: 'manual_review' as PromotionStatus,
                reason: 'Manual review required',
                checks: eligibilityChecks
            };
        } catch (error) {
            console.error('Error checking promotion eligibility:', error);
            return {
                eligible: false,
                status: 'manual_review' as PromotionStatus,
                reason: 'Error checking eligibility'
            };
        }
    },

    /**
     * Check if student has outstanding fees
     */
    async checkFeesStatus(studentId: string, sessionId: string, schoolId?: string) {
        try {
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('amount_outstanding, paid_in_full')
                .eq('student_id', studentId)
                .eq('session_id', sessionId);

            if (obligations && obligations.length > 0) {
                const hasOutstanding = obligations.some(
                    (o) => !o.paid_in_full && Number(o.amount_outstanding) > 0
                );
                return !hasOutstanding;
            }

            if (!schoolId) return true;

            const { data: student } = await supabase
                .from('students')
                .select('class_id')
                .eq('id', studentId)
                .maybeSingle();
            if (!student?.class_id) return true;

            const [{ data: classFee }, { data: payments }] = await Promise.all([
                supabase
                    .from('fees')
                    .select('amount')
                    .eq('school_id', schoolId)
                    .eq('class_id', student.class_id)
                    .eq('is_active', true)
                    .maybeSingle(),
                supabase
                    .from('payments')
                    .select('amount')
                    .eq('school_id', schoolId)
                    .eq('student_id', studentId)
                    .eq('status', 'completed'),
            ]);
            const expected = Number(classFee?.amount ?? 0);
            if (expected <= 0) return true;
            const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
            return paid >= expected;
        } catch (error) {
            console.error('Error checking fees status:', error);
            return true;
        }
    },

    /**
     * Process promotion for a student
     */
    async promoteStudent(
        studentId: string,
        schoolId: string,
        sessionId: string,
        newClassId: string,
        promotionStatus: PromotionStatus,
        notes?: string,
        approvedBy?: string
    ) {
        try {
            const { error: recordError } = await supabase
                .from('student_academic_records')
                .upsert(
                    {
                        school_id: schoolId,
                        student_id: studentId,
                        session_id: sessionId,
                        class_id: newClassId,
                        promoted: promotionStatus === 'promoted',
                        promotion_status: promotionStatus,
                        promotion_notes: notes,
                        principal_approved: !!approvedBy,
                        approved_by: approvedBy,
                        approved_at: approvedBy ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'student_id,session_id,term_id' }
                );

            if (recordError) throw recordError;

            // Update student's current class
            const { error: updateError } = await supabase
                .from('students')
                .update({ class_id: newClassId })
                .eq('id', studentId);

            if (updateError) throw updateError;

            return { success: true };
        } catch (error) {
            console.error('Error promoting student:', error);
            return { success: false, error };
        }
    },

    /**
     * Batch process promotions for a class
     */
    async processBatchPromotions(
        schoolId: string,
        sessionId: string,
        fromClassId: string,
        toClassId: string
    ) {
        try {
            let promoted = 0;
            let repeated = 0;
            let manualReview = 0;

            // Get all students in current class
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('class_id', fromClassId);

            if (!students) {
                return { promoted, repeated, manualReview, error: 'No students found' };
            }

            // Process each student
            for (const student of students) {
                const eligibility = await this.checkPromotionEligibility(
                    student.id,
                    sessionId,
                    fromClassId,
                    toClassId,
                    schoolId
                );

                const result = await this.promoteStudent(
                    student.id,
                    schoolId,
                    sessionId,
                    eligibility.status === 'promoted' ? toClassId : fromClassId,
                    eligibility.status
                );

                if (result.success) {
                    if (eligibility.status === 'promoted') promoted++;
                    else if (eligibility.status === 'repeat') repeated++;
                    else manualReview++;
                }
            }

            // Log the batch operation
            await supabase.from('session_transitions').insert({
                school_id: schoolId,
                from_session_id: sessionId,
                to_session_id: sessionId,
                students_promoted: promoted,
                students_graduated: 0,
                students_repeated: repeated,
                new_classes_created: 0,
                fees_obligations_created: 0,
                status: 'completed'
            });

            return { promoted, repeated, manualReview, success: true };
        } catch (error) {
            console.error('Error processing batch promotions:', error);
            return { promoted: 0, repeated: 0, manualReview: 0, error };
        }
    },

    /**
     * Create promotion rules for school
     */
    async createPromotionRule(
        schoolId: string,
        fromClassId: string,
        toClassId: string,
        attendanceThreshold: number = 80,
        gradeThreshold: number = 40,
        behaviourThreshold: number = 40
    ) {
        try {
            const { data, error } = await supabase
                .from('promotion_rules')
                .insert({
                    school_id: schoolId,
                    from_class_id: fromClassId,
                    to_class_id: toClassId,
                    attendance_threshold: attendanceThreshold,
                    grade_threshold: gradeThreshold,
                    behaviour_threshold: behaviourThreshold,
                    allows_repeat: true,
                    allows_manual_review: true,
                    requires_principal_approval: false,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating promotion rule:', error);
            return { success: false, error };
        }
    },

    /**
     * Get promotion rules for school
     */
    async getPromotionRules(schoolId: string) {
        try {
            const { data, error } = await supabase
                .from('promotion_rules')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_active', true);

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching promotion rules:', error);
            return { data: null, error };
        }
    }
};
