import { supabase } from '@/lib/supabase';
import { AlertType } from './alertManagementService';

export type InterventionStatus = 'open' | 'in_progress' | 'on_hold' | 'closed' | 'escalated';
export type InterventionCategory = 'attendance_intervention' | 'academic_intervention' | 'behaviour_intervention' | 'assignment_intervention' | 'fee_intervention' | 'general_counseling';
export type ActivityType = 'counselor_session' | 'parent_meeting' | 'teacher_meeting' | 'student_meeting' | 'follow_up' | 'progress_review' | 'note' | 'action_item';
export type OutcomeResult = 'resolved' | 'improved' | 'stable' | 'worsened' | 'no_change' | 'pending';

export interface InterventionCase {
    id: string;
    schoolId: string;
    studentId: string;
    alertId: string;
    caseTitle: string;
    caseDescription: string;
    caseCategory: InterventionCategory;
    assignedToId: string;
    assignedAt: string;
    status: InterventionStatus;
    priority: 'low' | 'medium' | 'high' | 'critical';
    interventionPlan?: string;
    goals?: string[];
    expectedOutcome?: string;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
    caseOutcome?: OutcomeResult;
    nextReviewDate?: string;
}

export interface InterventionActivity {
    id: string;
    schoolId: string;
    caseId: string;
    activityType: ActivityType;
    activityTitle: string;
    activityDescription: string;
    conductedById: string;
    attendees?: string[];
    scheduledDate?: string;
    activityDate: string;
    durationMinutes?: number;
    observations?: string;
    studentResponse?: string;
    recommendations?: string;
    followUpActions?: string[];
    status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
    completionDate?: string;
    createdAt: string;
}

export interface InterventionRecommendation {
    alertType: AlertType;
    recommendations: string[];
    priority: 'medium' | 'high' | 'critical';
}

// ============================================================================
// INTERVENTION MANAGEMENT SERVICE
// ============================================================================

export const interventionService = {
    /**
     * Create an intervention case for an alert
     */
    async createInterventionCase(
        schoolId: string,
        studentId: string,
        alertId: string,
        counselorId: string,
        alertType: AlertType,
        riskLevel: 'low' | 'medium' | 'high' | 'critical'
    ): Promise<{ success: boolean; caseId?: string; error?: string }> {
        try {
            // Get student info
            const { data: student } = await supabase
                .from('students')
                .select('first_name, last_name')
                .eq('id', studentId)
                .single();

            if (!student) {
                return { success: false, error: 'Student not found' };
            }

            const studentName = `${student.first_name} ${student.last_name}`;

            // Determine case category and details
            const { category, title, description, plan, goals } =
                this.getInterventionDetails(alertType, riskLevel, studentName);

            // Create the case
            const { data, error } = await supabase
                .from('intervention_cases')
                .insert([
                    {
                        school_id: schoolId,
                        student_id: studentId,
                        alert_id: alertId,
                        case_title: title,
                        case_description: description,
                        case_category: category,
                        assigned_to_id: counselorId,
                        assigned_at: new Date().toISOString(),
                        assigned_by_id: counselorId,
                        status: 'open',
                        priority: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
                        intervention_plan: plan,
                        goals: goals,
                        expected_outcome: this.getExpectedOutcome(alertType)
                    }
                ])
                .select('id')
                .single();

            if (error) {
                console.error('[INTERVENTION] Error creating case:', error);
                return { success: false, error: error.message };
            }

            console.log(`[INTERVENTION] Created case ${data.id} for student ${studentId}`);

            // Send notification to counselor
            await this.notifyCounselor(schoolId, counselorId, studentName, alertType, data.id);

            return { success: true, caseId: data.id };
        } catch (error) {
            console.error('[INTERVENTION] Error creating case:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Get intervention details for specific alert type
     */
    getInterventionDetails(
        alertType: AlertType,
        riskLevel: 'low' | 'medium' | 'high' | 'critical',
        studentName: string
    ): {
        category: InterventionCategory;
        title: string;
        description: string;
        plan: string;
        goals: string[];
    } {
        const details: Record<
            AlertType,
            {
                category: InterventionCategory;
                title: string;
                descriptionTemplate: string;
                planTemplate: string;
                goals: string[];
            }
        > = {
            attendance: {
                category: 'attendance_intervention',
                title: 'Attendance Intervention Case',
                descriptionTemplate: `${studentName} is experiencing attendance issues. Regular attendance is critical for academic success.`,
                planTemplate:
                    '1. Assess barriers to attendance\n2. Develop attendance agreement with student and parent\n3. Monitor weekly attendance\n4. Provide weekly progress updates',
                goals: [
                    'Achieve 90% attendance rate',
                    'Identify and address attendance barriers',
                    'Establish consistent school attendance pattern'
                ]
            },
            academic_decline: {
                category: 'academic_intervention',
                title: 'Academic Decline Intervention Case',
                descriptionTemplate: `${studentName} has experienced a significant decline in academic performance.`,
                planTemplate:
                    '1. Analyze performance decline factors\n2. Meet with student and teachers\n3. Arrange tutoring/extra lessons\n4. Monitor progress bi-weekly',
                goals: [
                    'Stabilize academic performance',
                    'Improve understanding of struggling subjects',
                    'Achieve 75% average or above'
                ]
            },
            missing_assignment: {
                category: 'assignment_intervention',
                title: 'Assignment Completion Intervention',
                descriptionTemplate: `${studentName} is not completing assignments regularly.`,
                planTemplate:
                    '1. Review assignment tracking with student\n2. Implement assignment checklist system\n3. Weekly teacher check-ins\n4. Parent communication plan',
                goals: [
                    'Achieve 80% assignment completion rate',
                    'Develop responsibility and time management',
                    'Improve grades through consistent work'
                ]
            },
            behaviour_incident: {
                category: 'behaviour_intervention',
                title: 'Behaviour Intervention Case',
                descriptionTemplate: `${studentName} has behavioral issues requiring intervention.`,
                planTemplate:
                    '1. Understand triggers and patterns\n2. Develop behavior contract\n3. Implement positive reinforcement\n4. Weekly check-ins',
                goals: [
                    'Reduce behavior incidents',
                    'Develop coping strategies',
                    'Improve classroom conduct'
                ]
            },
            fee_overdue: {
                category: 'fee_intervention',
                title: 'Fee Payment Intervention',
                descriptionTemplate: `${studentName}'s family has outstanding fee obligations.`,
                planTemplate:
                    '1. Meet with parent to understand payment challenges\n2. Establish payment plan\n3. Track payment progress\n4. Document all agreements',
                goals: [
                    'Clear outstanding fees',
                    'Establish sustainable payment plan',
                    'Prevent future defaults'
                ]
            },
            composite_risk: {
                category: 'general_counseling',
                title: 'Comprehensive Support Case',
                descriptionTemplate: `${studentName} requires comprehensive support due to multiple risk factors.`,
                planTemplate:
                    '1. Conduct comprehensive needs assessment\n2. Develop holistic intervention plan\n3. Coordinate with all stakeholders\n4. Regular progress reviews',
                goals: [
                    'Address all identified risk factors',
                    'Improve overall well-being',
                    'Support academic and personal growth'
                ]
            },
            critical_incident: {
                category: 'general_counseling',
                title: 'Critical Incident Response',
                descriptionTemplate: `${studentName} requires immediate intervention for a critical incident.`,
                planTemplate:
                    '1. Immediate safety assessment\n2. Crisis intervention protocols\n3. Parent notification\n4. Referral if needed',
                goals: [
                    'Ensure student safety',
                    'Provide immediate support',
                    'Develop follow-up plan'
                ]
            }
        };

        const detail = details[alertType];
        return {
            ...detail,
            description: detail.descriptionTemplate,
            plan: detail.planTemplate
        };
    },

    /**
     * Get expected outcome for alert type
     */
    getExpectedOutcome(alertType: AlertType): string {
        const outcomes: Record<AlertType, string> = {
            attendance: 'Student achieves 90% attendance and maintains consistent school presence',
            academic_decline: 'Student stabilizes grades and shows improvement in weak subjects',
            missing_assignment: 'Student completes 80% of assignments and improves accountability',
            behaviour_incident: 'Student demonstrates improved behavior and positive classroom conduct',
            fee_overdue: 'Family establishes payment plan and clears outstanding fees',
            composite_risk: 'Student shows improvement across all risk factors',
            critical_incident: 'Immediate crisis resolved and student receives ongoing support'
        };

        return outcomes[alertType];
    },

    /**
     * Log intervention activity
     */
    async logActivity(
        schoolId: string,
        caseId: string,
        userId: string,
        activity: {
            type: ActivityType;
            title: string;
            description: string;
            date: string;
            durationMinutes?: number;
            observations?: string;
            studentResponse?: string;
            recommendations?: string;
            followUpActions?: string[];
        }
    ): Promise<{ success: boolean; activityId?: string; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('intervention_activities')
                .insert([
                    {
                        school_id: schoolId,
                        case_id: caseId,
                        activity_type: activity.type,
                        activity_title: activity.title,
                        activity_description: activity.description,
                        conducted_by_id: userId,
                        activity_date: new Date(activity.date).toISOString(),
                        duration_minutes: activity.durationMinutes,
                        observations: activity.observations,
                        student_response: activity.studentResponse,
                        recommendations: activity.recommendations,
                        follow_up_actions: activity.followUpActions || [],
                        status: 'completed',
                        completion_date: new Date().toISOString()
                    }
                ])
                .select('id')
                .single();

            if (error) {
                console.error('[INTERVENTION] Error logging activity:', error);
                return { success: false, error: error.message };
            }

            console.log(`[INTERVENTION] Logged activity ${data.id} for case ${caseId}`);

            // Update case status
            await supabase
                .from('intervention_cases')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', caseId);

            return { success: true, activityId: data.id };
        } catch (error) {
            console.error('[INTERVENTION] Error logging activity:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Document intervention outcome
     */
    async documentOutcome(
        schoolId: string,
        caseId: string,
        evaluatedById: string,
        outcome: {
            overallOutcome: OutcomeResult;
            attendanceImprovement?: number;
            academicImprovement?: number;
            behaviourImprovement?: string;
            assignmentCompletionImprovement?: number;
            feePaymentProgress?: string;
            notes?: string;
            successFactors?: string[];
            continueIntervention?: boolean;
            nextSteps?: string;
            referralNeeded?: boolean;
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Get case
            const { data: caseData } = await supabase
                .from('intervention_cases')
                .select('*')
                .eq('id', caseId)
                .single();

            if (!caseData) {
                return { success: false, error: 'Case not found' };
            }

            // Calculate duration
            const caseStart = new Date(caseData.created_at);
            const today = new Date();
            const durationDays = Math.floor((today.getTime() - caseStart.getTime()) / (1000 * 60 * 60 * 24));

            // Calculate success rate
            const successRate = this.calculateSuccessRate(outcome);

            // Store outcome
            const { error: outcomeError } = await supabase
                .from('intervention_outcomes')
                .insert([
                    {
                        school_id: schoolId,
                        case_id: caseId,
                        evaluation_date: new Date().toISOString(),
                        evaluated_by_id: evaluatedById,
                        overall_outcome: outcome.overallOutcome,
                        attendance_improvement: outcome.attendanceImprovement,
                        academic_improvement: outcome.academicImprovement,
                        behaviour_improvement: outcome.behaviourImprovement,
                        assignment_completion_improvement: outcome.assignmentCompletionImprovement,
                        fee_payment_progress: outcome.feePaymentProgress,
                        duration_days: durationDays,
                        success_rate: successRate,
                        evaluation_notes: outcome.notes,
                        success_factors: outcome.successFactors || [],
                        continue_intervention: outcome.continueIntervention || false,
                        next_steps: outcome.nextSteps,
                        referral_needed: outcome.referralNeeded || false
                    }
                ]);

            if (outcomeError) {
                console.error('[INTERVENTION] Error storing outcome:', outcomeError);
                return { success: false, error: outcomeError.message };
            }

            // Update case status
            const { error: updateError } = await supabase
                .from('intervention_cases')
                .update({
                    status: outcome.continueIntervention ? 'in_progress' : 'closed',
                    case_outcome: outcome.overallOutcome,
                    closed_at: outcome.continueIntervention ? null : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', caseId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            console.log(`[INTERVENTION] Documented outcome for case ${caseId}: ${outcome.overallOutcome}`);

            return { success: true };
        } catch (error) {
            console.error('[INTERVENTION] Error documenting outcome:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Get recommendations for alert type
     */
    getInterventionRecommendations(alertType: AlertType): InterventionRecommendation {
        const recommendations: Record<AlertType, InterventionRecommendation> = {
            attendance: {
                alertType: 'attendance',
                recommendations: [
                    'Parent contact and discussion of attendance barriers',
                    'Attendance review meeting with student and parents',
                    'Implement attendance monitoring plan',
                    'Consider transportation or health issues',
                    'Establish positive attendance incentives'
                ],
                priority: 'high'
            },
            academic_decline: {
                alertType: 'academic_decline',
                recommendations: [
                    'Extra lessons or tutoring in struggling subjects',
                    'Teacher review and curriculum adjustment',
                    'Parent meeting to discuss performance',
                    'Student assessment for learning difficulties',
                    'Peer mentoring program'
                ],
                priority: 'high'
            },
            missing_assignment: {
                alertType: 'missing_assignment',
                recommendations: [
                    'Teacher follow-up with student',
                    'Parent follow-up regarding home support',
                    'Assignment tracking system implementation',
                    'Review time management skills',
                    'Identify obstacles to completion'
                ],
                priority: 'medium'
            },
            behaviour_incident: {
                alertType: 'behaviour_incident',
                recommendations: [
                    'Counselor session with student',
                    'Behavior contract development',
                    'Identify triggers and develop coping strategies',
                    'Parent conference',
                    'Classroom accommodation if needed'
                ],
                priority: 'high'
            },
            fee_overdue: {
                alertType: 'fee_overdue',
                recommendations: [
                    'Parent contact regarding payment',
                    'Payment plan negotiation',
                    'Fee relief assessment if eligible',
                    'Financial counseling resources',
                    'School support services information'
                ],
                priority: 'medium'
            },
            composite_risk: {
                alertType: 'composite_risk',
                recommendations: [
                    'Comprehensive needs assessment',
                    'Holistic intervention plan development',
                    'Multi-stakeholder coordination',
                    'Regular progress monitoring',
                    'Adjustment of interventions as needed'
                ],
                priority: 'critical'
            },
            critical_incident: {
                alertType: 'critical_incident',
                recommendations: [
                    'Immediate safety assessment',
                    'Crisis intervention protocols',
                    'Parent notification and involvement',
                    'Professional referral if needed',
                    'Follow-up care plan'
                ],
                priority: 'critical'
            }
        };

        return recommendations[alertType];
    },

    /**
     * Get counselor's cases
     */
    async getCounselorCases(
        schoolId: string,
        counselorId: string,
        status?: InterventionStatus
    ): Promise<InterventionCase[]> {
        try {
            let query = supabase
                .from('intervention_cases')
                .select('*')
                .eq('school_id', schoolId)
                .eq('assigned_to_id', counselorId);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                return [];
            }

            return data.map(c => this.mapCaseData(c));
        } catch (error) {
            console.error('[INTERVENTION] Error fetching cases:', error);
            return [];
        }
    },

    /**
     * Get case activities
     */
    async getCaseActivities(schoolId: string, caseId: string): Promise<InterventionActivity[]> {
        try {
            const { data, error } = await supabase
                .from('intervention_activities')
                .select('*')
                .eq('school_id', schoolId)
                .eq('case_id', caseId)
                .order('activity_date', { ascending: false });

            if (error) {
                return [];
            }

            return data.map(a => this.mapActivityData(a));
        } catch (error) {
            console.error('[INTERVENTION] Error fetching activities:', error);
            return [];
        }
    },

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    mapCaseData(data: any): InterventionCase {
        return {
            id: data.id,
            schoolId: data.school_id,
            studentId: data.student_id,
            alertId: data.alert_id,
            caseTitle: data.case_title,
            caseDescription: data.case_description,
            caseCategory: data.case_category,
            assignedToId: data.assigned_to_id,
            assignedAt: data.assigned_at,
            status: data.status,
            priority: data.priority,
            interventionPlan: data.intervention_plan,
            goals: data.goals,
            expectedOutcome: data.expected_outcome,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            closedAt: data.closed_at,
            caseOutcome: data.case_outcome,
            nextReviewDate: data.next_review_date
        };
    },

    mapActivityData(data: any): InterventionActivity {
        return {
            id: data.id,
            schoolId: data.school_id,
            caseId: data.case_id,
            activityType: data.activity_type,
            activityTitle: data.activity_title,
            activityDescription: data.activity_description,
            conductedById: data.conducted_by_id,
            attendees: data.attendees,
            scheduledDate: data.scheduled_date,
            activityDate: data.activity_date,
            durationMinutes: data.duration_minutes,
            observations: data.observations,
            studentResponse: data.student_response,
            recommendations: data.recommendations,
            followUpActions: data.follow_up_actions,
            status: data.status,
            completionDate: data.completion_date,
            createdAt: data.created_at
        };
    },

    calculateSuccessRate(outcome: any): number {
        let successIndicators = 0;
        const totalIndicators = 5;

        if (outcome.attendanceImprovement && outcome.attendanceImprovement > 0) successIndicators++;
        if (outcome.academicImprovement && outcome.academicImprovement > 0) successIndicators++;
        if (outcome.assignmentCompletionImprovement && outcome.assignmentCompletionImprovement > 0)
            successIndicators++;
        if (outcome.overallOutcome === 'resolved' || outcome.overallOutcome === 'improved')
            successIndicators++;
        if (!outcome.referralNeeded) successIndicators++;

        return Math.round((successIndicators / totalIndicators) * 100);
    },

    async notifyCounselor(
        schoolId: string,
        counselorId: string,
        studentName: string,
        alertType: AlertType,
        caseId: string
    ): Promise<void> {
        try {
            // TODO: Send notification to counselor about new case
            console.log(
                `[INTERVENTION] Notifying counselor ${counselorId} about new case for ${studentName} (${alertType})`
            );
        } catch (error) {
            console.error('[INTERVENTION] Error notifying counselor:', error);
        }
    }
};
