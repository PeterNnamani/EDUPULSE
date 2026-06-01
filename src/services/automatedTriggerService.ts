import { riskDetectionService } from './riskDetectionService';
import { escalationService } from './escalationService';
import { supabase } from '@/lib/supabase';

// ============================================================================
// AUTOMATED RISK DETECTION TRIGGER SERVICE
// ============================================================================

export const automatedTriggerService = {
    /**
     * Scan all students and calculate risk scores
     * This should be called periodically (e.g., daily via Supabase scheduled function)
     */
    async runDailyRiskAssessment(schoolId: string): Promise<{
        success: boolean;
        processed: number;
        alerts: number;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting daily risk assessment for school ${schoolId}`);

            // Get all active students
            const { data: students, error: studentError } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active')
                .limit(1000);

            if (studentError) {
                console.error('[AUTO_TRIGGER] Error fetching students:', studentError);
                return { success: false, processed: 0, alerts: 0, error: studentError.message };
            }

            if (!students || students.length === 0) {
                return { success: true, processed: 0, alerts: 0 };
            }

            // Get current session
            const { data: session } = await supabase
                .from('academic_sessions')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .single();

            if (!session) {
                console.error('[AUTO_TRIGGER] No active session found');
                return { success: false, processed: 0, alerts: 0, error: 'No active session' };
            }

            // Get current term
            const { data: term } = await supabase
                .from('academic_terms')
                .select('id')
                .eq('session_id', session.id)
                .eq('is_active', true)
                .single();

            let alertCount = 0;

            // Calculate risk for each student
            for (const student of students) {
                try {
                    const riskScore = await riskDetectionService.calculateStudentRiskScore(
                        schoolId,
                        student.id,
                        session.id,
                        term?.id
                    );

                    if (riskScore) {
                        alertCount++;
                    }
                } catch (error) {
                    console.error(`[AUTO_TRIGGER] Error processing student ${student.id}:`, error);
                }
            }

            console.log(`[AUTO_TRIGGER] Processed ${students.length} students, created ${alertCount} risk assessments`);

            return { success: true, processed: students.length, alerts: alertCount };
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running risk assessment:', error);
            return {
                success: false,
                processed: 0,
                alerts: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Process escalations for all unresolved alerts
     */
    async runEscalationCheck(schoolId: string): Promise<{
        success: boolean;
        escalated: number;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting escalation check for school ${schoolId}`);

            const result = await escalationService.processEscalations(schoolId);

            return result;
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running escalation check:', error);
            return {
                success: false,
                escalated: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Check for attendance patterns and create alerts
     */
    async runAttendanceMonitoring(schoolId: string): Promise<{
        success: boolean;
        processed: number;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting attendance monitoring for school ${schoolId}`);

            // Get all active students
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) {
                return { success: true, processed: 0 };
            }

            let processedCount = 0;

            for (const student of students) {
                try {
                    // Get recent attendance
                    const { data: attendance } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('school_id', schoolId)
                        .eq('student_id', student.id)
                        .order('date', { ascending: false })
                        .limit(30);

                    if (!attendance || attendance.length === 0) continue;

                    // Check for consecutive absences
                    let consecutiveAbsences = 0;
                    for (const record of attendance) {
                        if (record.status === 'absent') {
                            consecutiveAbsences++;
                        } else {
                            break;
                        }
                    }

                    // Trigger alerts based on consecutive absences
                    if (consecutiveAbsences >= 3) {
                        const { alertManagementService } = await import('./alertManagementService');

                        await alertManagementService.createAlert({
                            schoolId,
                            studentId: student.id,
                            alertType: 'attendance',
                            riskLevel: consecutiveAbsences >= 7 ? 'high' : 'medium',
                            title: `Attendance Concern: ${consecutiveAbsences} consecutive absences`,
                            description: `Student has been absent for ${consecutiveAbsences} consecutive days.`,
                            recommendedAction: 'Contact parent to understand absence reasons and plan return'
                        });

                        processedCount++;
                    }
                } catch (error) {
                    console.error(`[AUTO_TRIGGER] Error processing attendance for student ${student.id}:`, error);
                }
            }

            console.log(`[AUTO_TRIGGER] Attendance monitoring completed: ${processedCount} alerts created`);

            return { success: true, processed: processedCount };
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running attendance monitoring:', error);
            return {
                success: false,
                processed: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Check for fee payment deadlines
     */
    async runFeeMonitoring(schoolId: string): Promise<{
        success: boolean;
        processed: number;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting fee monitoring for school ${schoolId}`);

            // Get all pending fee obligations
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('*')
                .eq('school_id', schoolId)
                .eq('status', 'pending');

            if (!obligations) {
                return { success: true, processed: 0 };
            }

            let processedCount = 0;
            const today = new Date();

            for (const obligation of obligations) {
                try {
                    const dueDate = new Date(obligation.due_date);
                    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysOverdue <= 0) {
                        // Due soon
                        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysUntilDue <= 7 && daysUntilDue > 0) {
                            // Create reminder notification
                            const { notificationService } = await import('./notificationService');

                            // Get parent
                            const { data: parents } = await supabase
                                .from('student_parents')
                                .select('parent_id')
                                .eq('student_id', obligation.student_id)
                                .limit(1);

                            if (parents && parents.length > 0) {
                                // Create reminders for each parent
                                processedCount++;
                            }
                        }
                    } else if (daysOverdue > 0) {
                        // Overdue - create alert
                        const { alertManagementService } = await import('./alertManagementService');

                        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
                        if (daysOverdue >= 90) riskLevel = 'critical';
                        else if (daysOverdue >= 60) riskLevel = 'high';
                        else if (daysOverdue >= 30) riskLevel = 'medium';

                        await alertManagementService.createAlert({
                            schoolId,
                            studentId: obligation.student_id,
                            alertType: 'fee_overdue',
                            riskLevel,
                            title: `Fee Overdue: ${daysOverdue} days`,
                            description: `Payment of ${obligation.amount} is ${daysOverdue} days overdue (Due: ${obligation.due_date})`,
                            recommendedAction: 'Contact parent regarding payment and discuss payment plan if needed'
                        });

                        processedCount++;
                    }
                } catch (error) {
                    console.error(`[AUTO_TRIGGER] Error processing obligation:`, error);
                }
            }

            console.log(`[AUTO_TRIGGER] Fee monitoring completed: ${processedCount} processed`);

            return { success: true, processed: processedCount };
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running fee monitoring:', error);
            return {
                success: false,
                processed: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Monitor academic performance for declines
     */
    async runAcademicMonitoring(schoolId: string): Promise<{
        success: boolean;
        processed: number;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting academic monitoring for school ${schoolId}`);

            // Get all active students
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) {
                return { success: true, processed: 0 };
            }

            let processedCount = 0;

            for (const student of students) {
                try {
                    // Get current term results
                    const { data: results } = await supabase
                        .from('results')
                        .select('score')
                        .eq('school_id', schoolId)
                        .eq('student_id', student.id)
                        .order('created_at', { ascending: false })
                        .limit(100);

                    if (!results || results.length === 0) continue;

                    const currentAverage =
                        results.reduce((sum, r) => sum + (r.score || 0), 0) / Math.min(results.length, 10);

                    // Get previous academic record
                    const { data: previousRecords } = await supabase
                        .from('student_academic_records')
                        .select('average_score')
                        .eq('school_id', schoolId)
                        .eq('student_id', student.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (previousRecords && previousRecords.length > 0) {
                        const previousAverage = previousRecords[0].average_score;
                        const percentageChange = ((previousAverage - currentAverage) / previousAverage) * 100;

                        if (percentageChange >= 10) {
                            const { alertManagementService } = await import('./alertManagementService');

                            let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
                            if (percentageChange >= 20) riskLevel = 'critical';
                            else if (percentageChange >= 15) riskLevel = 'high';

                            await alertManagementService.createAlert({
                                schoolId,
                                studentId: student.id,
                                alertType: 'academic_decline',
                                riskLevel,
                                title: `Academic Decline: ${percentageChange.toFixed(1)}% drop`,
                                description: `Average score declined from ${previousAverage.toFixed(1)} to ${currentAverage.toFixed(1)}.`,
                                recommendedAction: 'Schedule parent and teacher meeting to discuss academic support'
                            });

                            processedCount++;
                        }
                    }
                } catch (error) {
                    console.error(`[AUTO_TRIGGER] Error processing academic data for student ${student.id}:`, error);
                }
            }

            console.log(`[AUTO_TRIGGER] Academic monitoring completed: ${processedCount} alerts created`);

            return { success: true, processed: processedCount };
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running academic monitoring:', error);
            return {
                success: false,
                processed: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Run all automated checks
     */
    async runAllAutoChecks(schoolId: string): Promise<{
        success: boolean;
        results: Record<string, any>;
        error?: string;
    }> {
        try {
            console.log(`[AUTO_TRIGGER] Starting all automated checks for school ${schoolId}`);

            const results: Record<string, any> = {};

            // Run risk assessment
            results.riskAssessment = await this.runDailyRiskAssessment(schoolId);

            // Run escalation check
            results.escalation = await this.runEscalationCheck(schoolId);

            // Run attendance monitoring
            results.attendance = await this.runAttendanceMonitoring(schoolId);

            // Run fee monitoring
            results.fees = await this.runFeeMonitoring(schoolId);

            // Run academic monitoring
            results.academic = await this.runAcademicMonitoring(schoolId);

            console.log(`[AUTO_TRIGGER] All automated checks completed for school ${schoolId}`);

            return { success: true, results };
        } catch (error) {
            console.error('[AUTO_TRIGGER] Error running all automated checks:', error);
            return {
                success: false,
                results: {},
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
};
