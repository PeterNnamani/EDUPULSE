import { supabase } from '@/lib/supabase';
import { alertManagementService, AlertType } from './alertManagementService';
import { getCurrentSession, getCurrentTerm } from '@/utils/calendarUtils';

export interface RiskAssessment {
    studentId: string;
    attendanceRisk: number;
    academicRisk: number;
    assignmentRisk: number;
    behaviourRisk: number;
    feeRisk: number;
    overallRisk: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
}

export interface RiskScore {
    id: string;
    schoolId: string;
    studentId: string;
    sessionId: string;
    termId?: string;
    attendanceRisk: number;
    academicRisk: number;
    assignmentRisk: number;
    behaviourRisk: number;
    feeRisk: number;
    overallRisk: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    lastCalculated: string;
}

// ============================================================================
// RISK DETECTION SERVICE
// ============================================================================

export const riskDetectionService = {
    // Risk weights (in percentage)
    WEIGHTS: {
        attendance: 0.30,
        academic: 0.30,
        assignment: 0.15,
        behaviour: 0.15,
        fee: 0.10
    },

    /**
     * Calculate comprehensive risk score for a student
     */
    async calculateStudentRiskScore(
        schoolId: string,
        studentId: string,
        sessionId: string,
        termId?: string
    ): Promise<RiskScore | null> {
        try {
            // Calculate individual risk factors
            const assessment = await this.performRiskAssessment(
                schoolId,
                studentId,
                sessionId,
                termId
            );

            // Store risk score in database
            const { data, error } = await supabase
                .from('risk_scores')
                .upsert(
                    {
                        school_id: schoolId,
                        student_id: studentId,
                        session_id: sessionId,
                        term_id: termId ?? null,
                        attendance_risk: assessment.attendanceRisk,
                        academic_risk: assessment.academicRisk,
                        assignment_risk: assessment.assignmentRisk,
                        behaviour_risk: assessment.behaviourRisk,
                        fee_risk: assessment.feeRisk,
                        overall_risk: assessment.overallRisk,
                        risk_level: assessment.riskLevel,
                        calculation_method: 'weighted_average',
                        factors_considered: assessment.factors,
                        last_calculated: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'school_id,student_id,session_id,term_id' }
                )
                .select()
                .single();

            if (error) {
                console.error('[RISK_DETECTION] Error storing risk score:', error);
                return null;
            }

            console.log(`[RISK_DETECTION] Calculated risk score for student ${studentId}: ${assessment.overallRisk} (${assessment.riskLevel})`);

            await this.triggerAlerts(schoolId, studentId, assessment, data.id);

            await supabase
                .from('students')
                .update({
                    risk_level: assessment.riskLevel,
                    risk_score: assessment.overallRisk,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', studentId)
                .eq('school_id', schoolId);

            return this.mapRiskScoreData(data);
        } catch (error) {
            console.error('[RISK_DETECTION] Error calculating risk score:', error);
            return null;
        }
    },

    /**
     * Perform comprehensive risk assessment
     */
    async performRiskAssessment(
        schoolId: string,
        studentId: string,
        sessionId: string,
        termId?: string
    ): Promise<RiskAssessment> {
        const factors: string[] = [];

        // Calculate individual risks
        const attendanceRisk = await this.assessAttendanceRisk(schoolId, studentId, termId);
        if (attendanceRisk > 0) factors.push(`Attendance at risk: ${attendanceRisk}%`);

        const academicRisk = await this.assessAcademicRisk(schoolId, studentId, termId);
        if (academicRisk > 0) factors.push(`Academic performance at risk: ${academicRisk}%`);

        const assignmentRisk = await this.assessAssignmentRisk(schoolId, studentId, termId);
        if (assignmentRisk > 0) factors.push(`Assignment completion at risk: ${assignmentRisk}%`);

        const behaviourRisk = await this.assessBehaviourRisk(schoolId, studentId);
        if (behaviourRisk > 0) factors.push(`Behaviour concerns: ${behaviourRisk}%`);

        const feeRisk = await this.assessFeeRisk(schoolId, studentId);
        if (feeRisk > 0) factors.push(`Fee payment issues: ${feeRisk}%`);

        // Calculate weighted overall risk
        const overallRisk =
            attendanceRisk * this.WEIGHTS.attendance +
            academicRisk * this.WEIGHTS.academic +
            assignmentRisk * this.WEIGHTS.assignment +
            behaviourRisk * this.WEIGHTS.behaviour +
            feeRisk * this.WEIGHTS.fee;

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        if (overallRisk >= 90) riskLevel = 'critical';
        else if (overallRisk >= 70) riskLevel = 'high';
        else if (overallRisk >= 40) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
            studentId,
            attendanceRisk,
            academicRisk,
            assignmentRisk,
            behaviourRisk,
            feeRisk,
            overallRisk: Math.round(overallRisk),
            riskLevel,
            factors
        };
    },

    /**
     * Assess attendance risk (0-100 scale)
     */
    async assessAttendanceRisk(
        schoolId: string,
        studentId: string,
        termId?: string
    ): Promise<number> {
        try {
            // Get attendance records
            let query = supabase
                .from('attendance')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId);

            if (termId) {
                query = query.eq('academic_term_id', termId);
            }

            const { data: records } = await query;

            if (!records || records.length === 0) {
                return 0;
            }

            const totalDays = records.length;
            const presentDays = records.filter(r => r.status === 'present').length;
            const attendanceRate = (presentDays / totalDays) * 100;

            // Check consecutive absences
            const consecutiveAbsences = this.getConsecutiveAbsences(records);

            let risk = 0;

            // Attendance percentage risk
            if (attendanceRate >= 90) {
                risk = 0;
            } else if (attendanceRate >= 80) {
                risk = 20; // Medium
            } else {
                risk = 80; // High
            }

            // Consecutive absence multiplier
            if (consecutiveAbsences >= 10) {
                risk = Math.max(risk, 100); // Critical
            } else if (consecutiveAbsences >= 7) {
                risk = Math.max(risk, 90);
            } else if (consecutiveAbsences >= 5) {
                risk = Math.max(risk, 70);
            } else if (consecutiveAbsences >= 3) {
                risk = Math.max(risk, 50);
            }

            return Math.min(risk, 100);
        } catch (error) {
            console.error('[RISK_DETECTION] Error assessing attendance:', error);
            return 0;
        }
    },

    /**
     * Assess academic risk (0-100 scale)
     */
    async assessAcademicRisk(
        schoolId: string,
        studentId: string,
        termId?: string
    ): Promise<number> {
        try {
            let query = supabase
                .from('grades')
                .select('score, max_score')
                .eq('school_id', schoolId)
                .eq('student_id', studentId);

            if (termId) {
                query = query.eq('academic_term_id', termId);
            }

            const { data: gradeRows } = await query;

            if (!gradeRows || gradeRows.length === 0) {
                return 0;
            }

            const currentAverage =
                gradeRows.reduce((sum, g) => {
                    const max = g.max_score && g.max_score > 0 ? g.max_score : 100;
                    return sum + ((g.score || 0) / max) * 100;
                }, 0) / gradeRows.length;

            // Get previous term results for comparison
            const { data: previousResults } = await supabase
                .from('student_academic_records')
                .select('average_score')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!previousResults || previousResults.length === 0) {
                // No previous data, assess based on absolute score
                if (currentAverage >= 70) return 0;
                if (currentAverage >= 50) return 40; // Medium
                return 80; // High
            }

            const previousAverage = previousResults[0].average_score;
            const percentageChange = ((previousAverage - currentAverage) / previousAverage) * 100;

            let risk = 0;

            if (percentageChange >= 20) {
                risk = 90; // Critical decline
            } else if (percentageChange >= 15) {
                risk = 75; // High decline
            } else if (percentageChange >= 10) {
                risk = 50; // Medium decline
            } else if (currentAverage < 50) {
                risk = 70; // Low absolute score
            }

            return Math.min(risk, 100);
        } catch (error) {
            console.error('[RISK_DETECTION] Error assessing academic risk:', error);
            return 0;
        }
    },

    /**
     * Assess assignment risk (0-100 scale)
     */
    async assessAssignmentRisk(
        schoolId: string,
        studentId: string,
        termId?: string
    ): Promise<number> {
        try {
            // Get assignments for student's class
            const { data: student } = await supabase
                .from('students')
                .select('class_id')
                .eq('id', studentId)
                .single();

            if (!student?.class_id) return 0;

            let query = supabase
                .from('assignments')
                .select('id')
                .eq('school_id', schoolId)
                .eq('class_id', student.class_id);

            if (termId) {
                query = query.eq('academic_term_id', termId);
            }

            const { data: assignments } = await query;

            if (!assignments || assignments.length === 0) {
                return 0;
            }

            // Get student's submissions
            const { data: submissions } = await supabase
                .from('assignment_submissions')
                .select('assignment_id')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .in('status', ['submitted', 'graded', 'late']);

            const submissionCount = submissions?.length || 0;
            const completionRate = (submissionCount / assignments.length) * 100;

            let risk = 0;

            if (completionRate >= 80) {
                risk = 0;
            } else if (completionRate >= 60) {
                risk = 40; // Medium
            } else if (completionRate >= 40) {
                risk = 70; // High
            } else {
                risk = 95; // Critical
            }

            return risk;
        } catch (error) {
            console.error('[RISK_DETECTION] Error assessing assignment risk:', error);
            return 0;
        }
    },

    /**
     * Assess behaviour risk (0-100 scale)
     */
    async assessBehaviourRisk(
        schoolId: string,
        studentId: string
    ): Promise<number> {
        try {
            // Get behaviour records in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: incidents } = await supabase
                .from('behaviour_records')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

            if (!incidents || incidents.length === 0) {
                return 0;
            }

            const demeritCount = incidents.filter(i => i.behaviour_type === 'demerit').length;
            const warningCount = incidents.filter(i => i.behaviour_type === 'warning').length;
            const suspensionCount = incidents.filter(i => i.behaviour_type === 'suspension').length;
            const expulsionCount = incidents.filter(i => i.behaviour_type === 'expulsion').length;

            let risk = 0;

            // Calculate risk based on incident types
            risk += demeritCount * 5; // 5% per demerit
            risk += warningCount * 15; // 15% per warning
            risk += suspensionCount * 40; // 40% per suspension
            risk += expulsionCount * 100; // 100% if expulsion

            // Multiple incidents increase risk
            if (incidents.length >= 5) {
                risk = Math.max(risk, 80);
            } else if (incidents.length >= 3) {
                risk = Math.max(risk, 50);
            }

            return Math.min(risk, 100);
        } catch (error) {
            console.error('[RISK_DETECTION] Error assessing behaviour risk:', error);
            return 0;
        }
    },

    /**
     * Assess fee/payment risk (0-100 scale)
     */
    async assessFeeRisk(
        schoolId: string,
        studentId: string
    ): Promise<number> {
        try {
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('due_date, status')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('status', 'pending');

            let maxDaysOverdue = 0;
            if (obligations?.length) {
                const today = new Date();
                for (const obligation of obligations) {
                    if (!obligation.due_date) continue;
                    const daysOverdue = Math.floor(
                        (today.getTime() - new Date(obligation.due_date).getTime()) / 86400000
                    );
                    if (daysOverdue > maxDaysOverdue) maxDaysOverdue = daysOverdue;
                }
            } else {
                const { data: student } = await supabase
                    .from('students')
                    .select('class_id')
                    .eq('id', studentId)
                    .single();

                const { data: classFee } = student?.class_id
                    ? await supabase
                          .from('fees')
                          .select('amount, due_date')
                          .eq('school_id', schoolId)
                          .eq('class_id', student.class_id)
                          .eq('is_active', true)
                          .maybeSingle()
                    : { data: null };

                const { data: paid } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('school_id', schoolId)
                    .eq('student_id', studentId)
                    .eq('status', 'completed');

                const expected = Number(classFee?.amount ?? 0);
                const paidTotal = (paid ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
                const balance = expected - paidTotal;

                if (expected > 0 && balance > 0) {
                    const ratio = balance / expected;
                    if (ratio >= 0.9) return 90;
                    if (ratio >= 0.5) return 60;
                    if (ratio >= 0.25) return 35;
                    return 15;
                }
                return 0;
            }

            if (maxDaysOverdue >= 90) return 95;
            if (maxDaysOverdue >= 60) return 80;
            if (maxDaysOverdue >= 30) return 50;
            if (maxDaysOverdue >= 7) return 25;
            return 0;
        } catch (error) {
            console.error('[RISK_DETECTION] Error assessing fee risk:', error);
            return 0;
        }
    },

    /**
     * Trigger alerts based on risk assessment
     */
    async triggerAlerts(
        schoolId: string,
        studentId: string,
        assessment: RiskAssessment,
        riskScoreId: string
    ): Promise<void> {
        try {
            // Check each risk factor and create alerts
            const alertsToCreate: Array<{
                type: AlertType;
                riskLevel: 'low' | 'medium' | 'high' | 'critical';
                title: string;
                description: string;
                action: string;
            }> = [];

            // Attendance alerts
            if (assessment.attendanceRisk >= 50) {
                alertsToCreate.push({
                    type: 'attendance',
                    riskLevel: assessment.attendanceRisk >= 80 ? 'high' : 'medium',
                    title: 'Attendance Concern',
                    description: `Student's attendance risk level is ${assessment.attendanceRisk}%`,
                    action: 'Review attendance records and contact parent'
                });
            }

            // Academic decline alerts
            if (assessment.academicRisk >= 50) {
                alertsToCreate.push({
                    type: 'academic_decline',
                    riskLevel: assessment.academicRisk >= 80 ? 'high' : 'medium',
                    title: 'Academic Decline',
                    description: `Student's academic risk level is ${assessment.academicRisk}%`,
                    action: 'Schedule parent and teacher meeting'
                });
            }

            // Assignment alerts
            if (assessment.assignmentRisk >= 40) {
                alertsToCreate.push({
                    type: 'missing_assignment',
                    riskLevel: assessment.assignmentRisk >= 70 ? 'high' : 'medium',
                    title: 'Assignment Completion Issue',
                    description: `Student's assignment completion risk is ${assessment.assignmentRisk}%`,
                    action: 'Follow up with student and teacher'
                });
            }

            // Behaviour alerts
            if (assessment.behaviourRisk >= 50) {
                alertsToCreate.push({
                    type: 'behaviour_incident',
                    riskLevel: assessment.behaviourRisk >= 80 ? 'high' : 'medium',
                    title: 'Behaviour Concern',
                    description: `Student's behaviour risk level is ${assessment.behaviourRisk}%`,
                    action: 'Schedule counselor session'
                });
            }

            // Fee alerts
            if (assessment.feeRisk >= 25) {
                alertsToCreate.push({
                    type: 'fee_overdue',
                    riskLevel: assessment.feeRisk >= 80 ? 'high' : 'medium',
                    title: 'Outstanding Fees',
                    description: `Student's fee risk level is ${assessment.feeRisk}%`,
                    action: 'Send fee reminder to parent'
                });
            }

            // Composite risk alert
            if (assessment.overallRisk >= 70) {
                alertsToCreate.push({
                    type: 'composite_risk',
                    riskLevel: assessment.riskLevel,
                    title: `Comprehensive Risk Alert - ${assessment.riskLevel}`,
                    description: `Student has overall risk score of ${assessment.overallRisk}/100 (${assessment.riskLevel}). Contributing factors: ${assessment.factors.join(', ')}`,
                    action: 'Create intervention case and assign counselor'
                });
            }

            // Create alerts
            for (const alert of alertsToCreate) {
                await alertManagementService.createAlert({
                    schoolId,
                    studentId,
                    alertType: alert.type,
                    riskLevel: alert.riskLevel,
                    title: alert.title,
                    description: alert.description,
                    recommendedAction: alert.action,
                    relatedRiskScoreId: riskScoreId
                });
            }
        } catch (error) {
            console.error('[RISK_DETECTION] Error triggering alerts:', error);
        }
    },

    /**
     * Get consecutive absences count
     */
    getConsecutiveAbsences(records: any[]): number {
        // Sort by date
        const sorted = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let maxConsecutive = 0;
        let currentConsecutive = 0;

        for (const record of sorted) {
            if (record.status === 'absent') {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }

        return maxConsecutive;
    },

    /**
     * Map risk score database data
     */
    mapRiskScoreData(data: any): RiskScore {
        return {
            id: data.id,
            schoolId: data.school_id,
            studentId: data.student_id,
            sessionId: data.session_id,
            termId: data.term_id,
            attendanceRisk: data.attendance_risk,
            academicRisk: data.academic_risk,
            assignmentRisk: data.assignment_risk,
            behaviourRisk: data.behaviour_risk,
            feeRisk: data.fee_risk,
            overallRisk: data.overall_risk,
            riskLevel: data.risk_level,
            lastCalculated: data.last_calculated
        };
    },

    /**
     * Get current risk score for a student
     */
    async getStudentRiskScore(
        schoolId: string,
        studentId: string
    ): Promise<RiskScore | null> {
        try {
            const { data, error } = await supabase
                .from('risk_scores')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                return null;
            }

            return this.mapRiskScoreData(data);
        } catch (error) {
            return null;
        }
    },

    /**
     * Get all high-risk students in school
     */
    async recalculateForStudent(schoolId: string, studentId: string): Promise<RiskScore | null> {
        const session = await getCurrentSession(schoolId);
        if (!session) {
            console.warn('[RISK_DETECTION] No active session for school', schoolId);
            return null;
        }
        const term = await getCurrentTerm(schoolId);
        return this.calculateStudentRiskScore(schoolId, studentId, session.id, term?.id);
    },

    async recalculateSchool(schoolId: string): Promise<{ processed: number; errors: number }> {
        const { data: students } = await supabase
            .from('students')
            .select('id')
            .eq('school_id', schoolId)
            .eq('status', 'active');

        let processed = 0;
        let errors = 0;
        for (const s of students ?? []) {
            const result = await this.recalculateForStudent(schoolId, s.id);
            if (result) processed++;
            else errors++;
        }
        return { processed, errors };
    },

    async getHighRiskStudents(
        schoolId: string,
        riskLevel: 'medium' | 'high' | 'critical' = 'high'
    ): Promise<RiskScore[]> {
        try {
            const levels =
                riskLevel === 'high' ? ['high', 'critical'] : riskLevel === 'medium' ? ['medium', 'high', 'critical'] : [riskLevel];

            const { data, error } = await supabase
                .from('risk_scores')
                .select('*')
                .eq('school_id', schoolId)
                .in('risk_level', levels)
                .order('overall_risk', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                return [];
            }

            return data.map(d => this.mapRiskScoreData(d));
        } catch (error) {
            return [];
        }
    }
};
