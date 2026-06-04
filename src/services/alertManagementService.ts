import { supabase } from '@/lib/supabase';
import { notificationService } from './notificationService';

export type AlertType =
    | 'attendance'
    | 'academic_decline'
    | 'missing_assignment'
    | 'behaviour_incident'
    | 'fee_overdue'
    | 'composite_risk'
    | 'critical_incident';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'escalated';

export interface StudentAlert {
    id: string;
    schoolId: string;
    studentId: string;
    alertType: AlertType;
    riskLevel: RiskLevel;
    title: string;
    description: string;
    recommendedAction: string;
    secondaryActions: string[];
    status: AlertStatus;
    assignedCounselorId?: string;
    parentNotified: boolean;
    teacherNotified: boolean;
    counselorNotified: boolean;
    principalNotified: boolean;
    createdAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    resolutionNotes?: string;
}

export interface CreateAlertRequest {
    schoolId: string;
    studentId: string;
    alertType: AlertType;
    riskLevel: RiskLevel;
    title: string;
    description: string;
    recommendedAction: string;
    secondaryActions?: string[];
    relatedRiskScoreId?: string;
}

// ============================================================================
// ALERT MANAGEMENT SERVICE - Alert lifecycle management
// ============================================================================

export const alertManagementService = {
    /**
     * Create a new student alert
     */
    async createAlert(
        request: CreateAlertRequest
    ): Promise<{ success: boolean; alertId?: string; error?: string }> {
        try {
            // Check if alert already exists for this student and type
            const existing = await this.checkExistingAlert(
                request.schoolId,
                request.studentId,
                request.alertType
            );

            if (existing) {
                console.log(`[ALERT] Alert already exists for student ${request.studentId}, type ${request.alertType}`);
                return { success: true, alertId: existing.id };
            }

            // Create the alert
            const { data, error } = await supabase
                .from('student_alerts')
                .insert([
                    {
                        school_id: request.schoolId,
                        student_id: request.studentId,
                        alert_type: request.alertType,
                        risk_level: request.riskLevel,
                        title: request.title,
                        description: request.description,
                        recommended_action: request.recommendedAction,
                        secondary_actions: request.secondaryActions || [],
                        status: 'open',
                        triggered_by: 'system',
                        related_risk_score_id: request.relatedRiskScoreId
                    }
                ])
                .select('id')
                .single();

            if (error) {
                console.error('[ALERT] Error creating alert:', error);
                return { success: false, error: error.message };
            }

            console.log(`[ALERT] Created new alert: ${data.id} for student ${request.studentId}`);

            // Send notifications to relevant parties
            await this.notifyStakeholders(request, data.id);

            return { success: true, alertId: data.id };
        } catch (error) {
            console.error('[ALERT] Error creating alert:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Check if alert already exists
     */
    async checkExistingAlert(
        schoolId: string,
        studentId: string,
        alertType: AlertType
    ): Promise<StudentAlert | null> {
        try {
            const { data } = await supabase
                .from('student_alerts')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .eq('alert_type', alertType)
                .neq('status', 'resolved')
                .single();

            return data ? this.mapAlertData(data) : null;
        } catch (error) {
            return null;
        }
    },

    /**
     * Notify stakeholders about the alert
     */
    async notifyStakeholders(
        request: CreateAlertRequest,
        alertId: string
    ): Promise<void> {
        try {
            // Get student info for notification
            const { data: student } = await supabase
                .from('students')
                .select('first_name, last_name')
                .eq('id', request.studentId)
                .single();

            if (!student) return;

            const studentName = `${student.first_name} ${student.last_name}`;

            // Notify parents
            const parents = await this.getStudentParents(request.studentId);
            for (const parent of parents) {
                await notificationService.sendNotification({
                    schoolId: request.schoolId,
                    recipientId: parent.userId,
                    recipientRole: 'parent',
                    notificationType: 'risk_alert',
                    title: `Alert: ${request.title}`,
                    message: `${studentName}: ${request.description}`,
                    priority: this.mapRiskLevelToPriority(request.riskLevel),
                    relatedStudentId: request.studentId,
                    relatedAlertId: alertId
                });
            }

            // Notify teachers (for attendance, assignment, behaviour alerts)
            if (['attendance', 'missing_assignment', 'behaviour_incident'].includes(request.alertType)) {
                const teachers = await this.getStudentTeachers(request.studentId);
                for (const teacher of teachers) {
                    await notificationService.sendNotification({
                        schoolId: request.schoolId,
                        recipientId: teacher.userId,
                        recipientRole: 'teacher',
                        notificationType: 'risk_alert',
                        title: `Alert: ${request.title}`,
                        message: `${studentName}: ${request.description}`,
                        priority: this.mapRiskLevelToPriority(request.riskLevel),
                        relatedStudentId: request.studentId,
                        relatedAlertId: alertId
                    });
                }
            }

            // Notify counselors (for medium/high/critical risks)
            if (['medium', 'high', 'critical'].includes(request.riskLevel)) {
                const counselors = await this.getSchoolCounselors(request.schoolId);
                for (const counselor of counselors) {
                    await notificationService.sendNotification({
                        schoolId: request.schoolId,
                        recipientId: counselor.userId,
                        recipientRole: 'counselor',
                        notificationType: 'risk_alert',
                        title: `Alert: ${request.title}`,
                        message: `${studentName}: ${request.description}`,
                        priority: this.mapRiskLevelToPriority(request.riskLevel),
                        relatedStudentId: request.studentId,
                        relatedAlertId: alertId
                    });
                }
            }

            // Notify principal (for high/critical risks)
            if (['high', 'critical'].includes(request.riskLevel)) {
                const principals = await this.getSchoolPrincipals(request.schoolId);
                for (const principal of principals) {
                    await notificationService.sendNotification({
                        schoolId: request.schoolId,
                        recipientId: principal.userId,
                        recipientRole: 'principal',
                        notificationType: 'risk_alert',
                        title: `CRITICAL Alert: ${request.title}`,
                        message: `${studentName}: ${request.description}`,
                        priority: 'critical',
                        relatedStudentId: request.studentId,
                        relatedAlertId: alertId
                    });
                }
            }

            // Mark notification status in alert
            await supabase
                .from('student_alerts')
                .update({
                    parent_notified: true,
                    teacher_notified: ['attendance', 'missing_assignment', 'behaviour_incident'].includes(request.alertType),
                    counselor_notified: ['medium', 'high', 'critical'].includes(request.riskLevel),
                    principal_notified: ['high', 'critical'].includes(request.riskLevel)
                })
                .eq('id', alertId);

        } catch (error) {
            console.error('[ALERT] Error notifying stakeholders:', error);
        }
    },

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('student_alerts')
                .update({
                    status: 'acknowledged',
                    acknowledged_at: new Date().toISOString()
                })
                .eq('id', alertId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Update alert status
     */
    async updateAlertStatus(
        alertId: string,
        status: AlertStatus,
        resolutionNotes?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const update: Record<string, any> = { status };

            if (status === 'resolved' && resolutionNotes) {
                update.resolved_at = new Date().toISOString();
                update.resolution_notes = resolutionNotes;
            }

            const { error } = await supabase
                .from('student_alerts')
                .update(update)
                .eq('id', alertId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Assign counselor to an alert
     */
    async assignCounselor(
        alertId: string,
        counselorId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('student_alerts')
                .update({
                    assigned_counselor_id: counselorId
                })
                .eq('id', alertId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Get alerts for a student
     */
    async getStudentAlerts(
        schoolId: string,
        studentId: string,
        options?: {
            status?: AlertStatus;
            limit?: number;
        }
    ): Promise<StudentAlert[]> {
        try {
            let query = supabase
                .from('student_alerts')
                .select('*')
                .eq('school_id', schoolId)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });

            if (options?.status) {
                query = query.eq('status', options.status);
            } else {
                query = query.neq('status', 'resolved');
            }

            if (options?.limit) {
                query = query.limit(options.limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[ALERT] Error fetching alerts:', error);
                return [];
            }

            return data.map(alert => this.mapAlertData(alert));
        } catch (error) {
            console.error('[ALERT] Error fetching alerts:', error);
            return [];
        }
    },

    /**
     * Get high-risk students for school
     */
    async getHighRiskStudents(
        schoolId: string,
        riskLevel: RiskLevel = 'high'
    ): Promise<Array<{ studentId: string; name: string; alertCount: number; criticalAlerts: number }>> {
        try {
            const { data, error } = await supabase
                .from('student_alerts')
                .select('student_id, risk_level')
                .eq('school_id', schoolId)
                .eq('risk_level', riskLevel)
                .neq('status', 'resolved');

            if (error) {
                return [];
            }

            // Group by student and get names
            const studentMap = new Map<string, { alertCount: number; criticalAlerts: number }>();

            for (const alert of data) {
                const count = studentMap.get(alert.student_id) || { alertCount: 0, criticalAlerts: 0 };
                count.alertCount++;
                if (alert.risk_level === 'critical') count.criticalAlerts++;
                studentMap.set(alert.student_id, count);
            }

            const results = [];
            for (const [studentId, counts] of studentMap.entries()) {
                const { data: student } = await supabase
                    .from('students')
                    .select('first_name, last_name')
                    .eq('id', studentId)
                    .single();

                if (student) {
                    results.push({
                        studentId,
                        name: `${student.first_name} ${student.last_name}`,
                        ...counts
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('[ALERT] Error fetching high-risk students:', error);
            return [];
        }
    },

    /**
     * Get open alerts for school
     */
    async getOpenAlerts(schoolId: string): Promise<StudentAlert[]> {
        try {
            const { data, error } = await supabase
                .from('student_alerts')
                .select('*')
                .eq('school_id', schoolId)
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (error) {
                return [];
            }

            return data.map(alert => this.mapAlertData(alert));
        } catch (error) {
            console.error('[ALERT] Error fetching open alerts:', error);
            return [];
        }
    },

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    mapAlertData(data: any): StudentAlert {
        return {
            id: data.id,
            schoolId: data.school_id,
            studentId: data.student_id,
            alertType: data.alert_type,
            riskLevel: data.risk_level,
            title: data.title,
            description: data.description,
            recommendedAction: data.recommended_action,
            secondaryActions: data.secondary_actions || [],
            status: data.status,
            assignedCounselorId: data.assigned_counselor_id,
            parentNotified: data.parent_notified,
            teacherNotified: data.teacher_notified,
            counselorNotified: data.counselor_notified,
            principalNotified: data.principal_notified,
            createdAt: data.created_at,
            acknowledgedAt: data.acknowledged_at,
            resolvedAt: data.resolved_at,
            resolutionNotes: data.resolution_notes
        };
    },

    mapRiskLevelToPriority(riskLevel: RiskLevel): 'low' | 'medium' | 'high' | 'critical' {
        switch (riskLevel) {
            case 'critical':
                return 'critical';
            case 'high':
                return 'high';
            case 'medium':
                return 'medium';
            case 'low':
                return 'low';
            default:
                return 'medium';
        }
    },

    async getStudentParents(studentId: string): Promise<Array<{ userId: string }>> {
        try {
            const { data } = await supabase
                .from('student_parents')
                .select('parent_id')
                .eq('student_id', studentId);

            return (data || []).map((item) => ({ userId: item.parent_id }));
        } catch (error) {
            return [];
        }
    },

    async getStudentTeachers(studentId: string): Promise<Array<{ userId: string }>> {
        try {
            const { data: student } = await supabase
                .from('students')
                .select('class_id, classes(class_teacher_id)')
                .eq('id', studentId)
                .single();

            const teacherId = (student?.classes as { class_teacher_id?: string } | null)?.class_teacher_id;
            return teacherId ? [{ userId: teacherId }] : [];
        } catch (error) {
            return [];
        }
    },

    async getSchoolCounselors(schoolId: string): Promise<Array<{ userId: string }>> {
        try {
            const { data } = await supabase
                .from('staff')
                .select('id')
                .eq('school_id', schoolId)
                .eq('role', 'counselor')
                .eq('is_active', true);

            return data?.map((s) => ({ userId: s.id })) || [];
        } catch (error) {
            return [];
        }
    },

    async getSchoolPrincipals(schoolId: string): Promise<Array<{ userId: string }>> {
        try {
            const { data } = await supabase
                .from('staff')
                .select('id')
                .eq('school_id', schoolId)
                .eq('role', 'principal')
                .eq('is_active', true);

            return data?.map((s) => ({ userId: s.id })) || [];
        } catch (error) {
            return [];
        }
    }
};
