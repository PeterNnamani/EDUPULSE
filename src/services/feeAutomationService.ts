import { supabase } from '@/lib/supabase';

/**
 * Fee Structure and Automation Service
 * Handles dynamic fee structures and automatic fee obligation generation
 */

export const feeAutomationService = {
    /**
     * Create fee structure for class
     */
    async createFeeStructure(
        schoolId: string,
        classId: string,
        sessionId: string,
        feeTypeId: string,
        amount: number,
        dueMonth?: number,
        dueDate?: number,
        lateFeePercentage: number = 0
    ) {
        try {
            const { data, error } = await supabase
                .from('fee_structures')
                .insert({
                    school_id: schoolId,
                    session_id: sessionId,
                    class_id: classId,
                    fee_type_id: feeTypeId,
                    amount,
                    due_month: dueMonth,
                    due_date: dueDate,
                    late_fee_percentage: lateFeePercentage,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating fee structure:', error);
            return { success: false, error };
        }
    },

    /**
     * Get fee structures for class
     */
    async getFeeStructures(classId: string, sessionId?: string) {
        try {
            let query = supabase
                .from('fee_structures')
                .select('*')
                .eq('class_id', classId);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching fee structures:', error);
            return { data: null, error };
        }
    },

    /**
     * Automatically generate fee obligations for students entering a class
     */
    async generateFeeObligations(
        schoolId: string,
        studentId: string,
        classId: string,
        sessionId: string,
        termId?: string
    ) {
        try {
            // Get fee structures for the class
            const { data: feeStructures } = await this.getFeeStructures(classId, sessionId);

            if (!feeStructures || feeStructures.length === 0) {
                return { success: true, message: 'No fee structures defined' };
            }

            // Check for carry-over balance from previous session
            const { data: previousObligation } = await supabase
                .from('fee_obligations')
                .select('amount_outstanding')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const carryOverBalance = previousObligation?.amount_outstanding || 0;

            // Create fee obligation for each fee structure
            const obligations = feeStructures.map(structure => {
                const baseDueDate = new Date();
                if (structure.due_month) {
                    baseDueDate.setMonth(structure.due_month - 1);
                }
                if (structure.due_date) {
                    baseDueDate.setDate(structure.due_date);
                }

                return {
                    school_id: schoolId,
                    student_id: studentId,
                    fee_structure_id: structure.id,
                    session_id: sessionId,
                    term_id: termId,
                    amount_due: structure.amount,
                    amount_paid: 0,
                    amount_outstanding: structure.amount + (carryOverBalance > 0 ? carryOverBalance : 0),
                    carry_over_balance: carryOverBalance,
                    due_date: baseDueDate.toISOString().split('T')[0],
                    paid_in_full: false
                };
            });

            const { error } = await supabase
                .from('fee_obligations')
                .insert(obligations);

            if (error) throw error;

            return {
                success: true,
                message: `${obligations.length} fee obligations created`,
                obligationsCount: obligations.length
            };
        } catch (error) {
            console.error('Error generating fee obligations:', error);
            return { success: false, error };
        }
    },

    /**
     * Get student's fee obligations
     */
    async getStudentFeeObligations(studentId: string, sessionId?: string) {
        try {
            let query = supabase
                .from('fee_obligations')
                .select('*, fee_structures(amount, fee_types(name))')
                .eq('student_id', studentId);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching fee obligations:', error);
            return { data: null, error };
        }
    },

    /**
     * Calculate outstanding fees for student
     */
    async calculateOutstandingFees(studentId: string) {
        try {
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('amount_outstanding, paid_in_full')
                .eq('student_id', studentId)
                .eq('paid_in_full', false);

            let totalOutstanding = 0;

            if (obligations) {
                totalOutstanding = obligations.reduce((sum, obj) => sum + (obj.amount_outstanding || 0), 0);
            }

            return { totalOutstanding, count: obligations?.length || 0 };
        } catch (error) {
            console.error('Error calculating outstanding fees:', error);
            return { totalOutstanding: 0, count: 0 };
        }
    },

    /**
     * Record payment for fee obligation
     */
    async recordPayment(
        obligationId: string,
        amount: number,
        paymentMethod: string,
        recordedBy?: string
    ) {
        try {
            // Get obligation
            const { data: obligation } = await supabase
                .from('fee_obligations')
                .select('*')
                .eq('id', obligationId)
                .single();

            if (!obligation) {
                return { success: false, error: 'Obligation not found' };
            }

            const newAmountPaid = (obligation.amount_paid || 0) + amount;
            const newAmountOutstanding = Math.max(0, obligation.amount_due - newAmountPaid);
            const paidInFull = newAmountOutstanding === 0;

            // Update obligation
            const { error: updateError } = await supabase
                .from('fee_obligations')
                .update({
                    amount_paid: newAmountPaid,
                    amount_outstanding: newAmountOutstanding,
                    paid_in_full: paidInFull
                })
                .eq('id', obligationId);

            if (updateError) throw updateError;

            // Record payment
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    school_id: obligation.school_id,
                    student_id: obligation.student_id,
                    fee_id: obligation.fee_structure_id,
                    amount,
                    payment_method: paymentMethod,
                    status: 'completed',
                    recorded_by: recordedBy
                })
                .select()
                .single();

            if (paymentError) throw paymentError;

            return { success: true, data: payment };
        } catch (error) {
            console.error('Error recording payment:', error);
            return { success: false, error };
        }
    },

    /**
     * Apply exemption to fee obligation
     */
    async applyExemption(
        obligationId: string,
        reason: string,
        approvedBy: string
    ) {
        try {
            const { error } = await supabase
                .from('fee_obligations')
                .update({
                    exemption_reason: reason,
                    exemption_approved_by: approvedBy,
                    paid_in_full: true,
                    amount_outstanding: 0
                })
                .eq('id', obligationId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error applying exemption:', error);
            return { success: false, error };
        }
    },

    /**
     * Get fee collection report
     */
    async getFeeCollectionReport(schoolId: string, sessionId: string) {
        try {
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('amount_due, amount_paid, amount_outstanding, paid_in_full')
                .eq('school_id', schoolId)
                .eq('session_id', sessionId);

            if (!obligations) {
                return {
                    totalDue: 0,
                    totalPaid: 0,
                    totalOutstanding: 0,
                    collectionRate: 0
                };
            }

            const totalDue = obligations.reduce((sum, obj) => sum + (obj.amount_due || 0), 0);
            const totalPaid = obligations.reduce((sum, obj) => sum + (obj.amount_paid || 0), 0);
            const totalOutstanding = obligations.reduce((sum, obj) => sum + (obj.amount_outstanding || 0), 0);
            const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

            return {
                totalDue,
                totalPaid,
                totalOutstanding,
                collectionRate: parseFloat(collectionRate.toFixed(2)),
                totalStudents: obligations.length
            };
        } catch (error) {
            console.error('Error getting fee collection report:', error);
            return {
                totalDue: 0,
                totalPaid: 0,
                totalOutstanding: 0,
                collectionRate: 0
            };
        }
    }
};
