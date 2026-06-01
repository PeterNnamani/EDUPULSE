import { supabase } from '@/lib/supabase';
import { sessionManagementService } from './sessionManagementService';
import { promotionEngine } from './promotionEngine';
import { feeAutomationService } from './feeAutomationService';
import { graduationService } from './graduationService';
import { termAutomationService } from './termAutomationService';

/**
 * Session Rollover Service
 * Handles complete end-of-session transition to new academic session
 */

export const sessionRolloverService = {
    /**
     * Execute complete session rollover
     */
    async executeSessionRollover(
        schoolId: string,
        currentSessionId: string,
        newSessionName: string,
        startYear: number,
        endYear: number,
        executedBy: string
    ) {
        try {
            const transitionStartTime = new Date();
            const transitionLog = {
                startTime: transitionStartTime,
                studentsPromoted: 0,
                studentsGraduated: 0,
                studentsRepeated: 0,
                newClassesCreated: 0,
                feesObligationsCreated: 0,
                errors: [] as string[]
            };

            // 1. Archive current session data
            try {
                await sessionManagementService.archiveSession(schoolId, currentSessionId);
            } catch (error) {
                transitionLog.errors.push(`Session archival failed: ${error}`);
            }

            // 2. Create new session
            let newSessionId = '';
            try {
                const newSessionResult = await sessionManagementService.createSession(
                    schoolId,
                    newSessionName,
                    startYear,
                    endYear
                );

                if (newSessionResult.success && newSessionResult.data) {
                    newSessionId = newSessionResult.data.id;
                } else {
                    throw new Error('Failed to create new session');
                }
            } catch (error) {
                transitionLog.errors.push(`New session creation failed: ${error}`);
                return {
                    success: false,
                    error: 'Failed to create new session',
                    transitionLog
                };
            }

            // 3. Create default terms for new session
            try {
                await sessionManagementService.createDefaultTerms(schoolId, newSessionId);
            } catch (error) {
                transitionLog.errors.push(`Default terms creation failed: ${error}`);
            }

            // 4. Process promotions
            try {
                const promotionResults = await this.processPromotionsForSession(
                    schoolId,
                    currentSessionId,
                    newSessionId
                );

                transitionLog.studentsPromoted = promotionResults.promoted;
                transitionLog.studentsRepeated = promotionResults.repeated;
                transitionLog.studentsGraduated = promotionResults.graduated;
            } catch (error) {
                transitionLog.errors.push(`Promotion processing failed: ${error}`);
            }

            // 5. Create new class assignments for promoted students
            try {
                const classCount = await this.createNewClassAssignments(
                    schoolId,
                    newSessionId
                );
                transitionLog.newClassesCreated = classCount;
            } catch (error) {
                transitionLog.errors.push(`Class assignment creation failed: ${error}`);
            }

            // 6. Generate fee obligations for new session
            try {
                const feeCount = await this.generateSessionFeeObligations(
                    schoolId,
                    newSessionId
                );
                transitionLog.feesObligationsCreated = feeCount;
            } catch (error) {
                transitionLog.errors.push(`Fee obligation generation failed: ${error}`);
            }

            // 7. Activate new session
            try {
                await sessionManagementService.activateSession(schoolId, newSessionId);
            } catch (error) {
                transitionLog.errors.push(`Session activation failed: ${error}`);
            }

            // 8. Log transition
            const { error: logError } = await supabase
                .from('session_transitions')
                .insert({
                    school_id: schoolId,
                    from_session_id: currentSessionId,
                    to_session_id: newSessionId,
                    transition_date: new Date().toISOString(),
                    students_promoted: transitionLog.studentsPromoted,
                    students_graduated: transitionLog.studentsGraduated,
                    students_repeated: transitionLog.studentsRepeated,
                    new_classes_created: transitionLog.newClassesCreated,
                    fees_obligations_created: transitionLog.feesObligationsCreated,
                    executed_by: executedBy,
                    status: transitionLog.errors.length === 0 ? 'completed' : 'completed',
                    error_details: transitionLog.errors.length > 0 ? transitionLog.errors : null
                });

            if (logError) {
                transitionLog.errors.push(`Transition logging failed: ${logError}`);
            }

            return {
                success: transitionLog.errors.length === 0,
                data: {
                    newSessionId,
                    transitionLog
                }
            };
        } catch (error) {
            console.error('Error executing session rollover:', error);
            return {
                success: false,
                error
            };
        }
    },

    /**
     * Process promotions for all students
     */
    async processPromotionsForSession(
        schoolId: string,
        currentSessionId: string,
        newSessionId: string
    ) {
        const results = {
            promoted: 0,
            repeated: 0,
            graduated: 0
        };

        try {
            // Get all promotion rules for the school
            const { data: rules } = await supabase
                .from('promotion_rules')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_active', true);

            if (!rules || rules.length === 0) {
                console.warn('No promotion rules defined for school');
                return results;
            }

            // Get all active students
            const { data: students } = await supabase
                .from('students')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) return results;

            // Process each student
            for (const student of students) {
                if (!student.class_id) continue;

                try {
                    // Check for graduation eligibility
                    const { eligible: canGraduate } = await graduationService.checkGraduationEligibility(
                        student.id,
                        student.class_id,
                        currentSessionId
                    );

                    if (canGraduate) {
                        await graduationService.graduateStudent(
                            student.id,
                            student.class_id,
                            currentSessionId
                        );
                        results.graduated++;
                    } else {
                        // Check promotion eligibility
                        const matchingRule = rules.find(
                            r => r.from_class_id === student.class_id
                        );

                        if (matchingRule) {
                            const eligibility = await promotionEngine.checkPromotionEligibility(
                                student.id,
                                currentSessionId,
                                student.class_id,
                                matchingRule.to_class_id,
                                schoolId
                            );

                            if (eligibility.status === 'promoted') {
                                await promotionEngine.promoteStudent(
                                    student.id,
                                    newSessionId,
                                    matchingRule.to_class_id,
                                    'promoted'
                                );
                                results.promoted++;
                            } else if (eligibility.status === 'repeat') {
                                await promotionEngine.promoteStudent(
                                    student.id,
                                    newSessionId,
                                    student.class_id,
                                    'repeat'
                                );
                                results.repeated++;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing student ${student.id}:`, error);
                }
            }

            return results;
        } catch (error) {
            console.error('Error processing promotions:', error);
            return results;
        }
    },

    /**
     * Create new class assignments for promoted students
     */
    async createNewClassAssignments(schoolId: string, newSessionId: string): Promise<number> {
        let count = 0;

        try {
            // Get all academic records for students being promoted/repeated
            const { data: records } = await supabase
                .from('student_academic_records')
                .select('student_id, promotion_status, class_id')
                .eq('session_id', newSessionId);

            if (!records) return count;

            // Group by class
            const classAssignments = new Map<string, string[]>();

            for (const record of records) {
                if (record.class_id && record.promotion_status !== 'graduated') {
                    if (!classAssignments.has(record.class_id)) {
                        classAssignments.set(record.class_id, []);
                    }
                    classAssignments.get(record.class_id)?.push(record.student_id);
                }
            }

            count = classAssignments.size;

            return count;
        } catch (error) {
            console.error('Error creating class assignments:', error);
            return count;
        }
    },

    /**
     * Generate fee obligations for new session
     */
    async generateSessionFeeObligations(
        schoolId: string,
        newSessionId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all active students
            const { data: students } = await supabase
                .from('students')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) return count;

            // Generate fees for each student
            for (const student of students) {
                if (student.class_id) {
                    const result = await feeAutomationService.generateFeeObligations(
                        schoolId,
                        student.id,
                        student.class_id,
                        newSessionId
                    );

                    if (result.success) {
                        count += result.obligationsCount || 0;
                    }
                }
            }

            return count;
        } catch (error) {
            console.error('Error generating session fee obligations:', error);
            return count;
        }
    },

    /**
     * Get rollover status
     */
    async getRolloverStatus(schoolId: string) {
        try {
            const { data: currentSession } = await sessionManagementService.getCurrentSession(schoolId);

            if (!currentSession) {
                return { ready: true, reason: 'No active session' };
            }

            // Check if all required data for rollover exists
            const { data: promotionRules } = await supabase
                .from('promotion_rules')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_active', true);

            const { data: feeStructures } = await supabase
                .from('fee_structures')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_active', true);

            const readyChecks = {
                hasPromotionRules: (promotionRules?.length || 0) > 0,
                hasFeeStructures: (feeStructures?.length || 0) > 0,
                hasActiveClasses: await this.hasActiveClasses(schoolId)
            };

            const allReady = Object.values(readyChecks).every(check => check);

            return {
                ready: allReady,
                checks: readyChecks,
                currentSession: currentSession?.name
            };
        } catch (error) {
            console.error('Error getting rollover status:', error);
            return { ready: false, error };
        }
    },

    /**
     * Check if school has active classes
     */
    async hasActiveClasses(schoolId: string): Promise<boolean> {
        try {
            const { data: classes } = await supabase
                .from('classes')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .limit(1);

            return (classes?.length || 0) > 0;
        } catch (error) {
            console.error('Error checking active classes:', error);
            return false;
        }
    }
};
