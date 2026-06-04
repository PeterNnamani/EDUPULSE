import { supabase } from '@/lib/supabase';
import { notificationService } from './notificationService';

export interface EscalationLevel {
    level: number;
    daysSinceCreation: number;
    notifyRoles: string[];
    description: string;
}

// ============================================================================
// ESCALATION SERVICE - Smart escalation of unresolved alerts
// ============================================================================

export const escalationService = {
    /**
     * Escalation levels based on time
     */
    ESCALATION_LEVELS: [
        {
            level: 1,
            daysSinceCreation: 1,
            notifyRoles: ['parent'],
            description: 'Notify parent'
        },
        {
            level: 2,
            daysSinceCreation: 3,
            notifyRoles: ['parent', 'teacher'],
            description: 'Notify parent and teacher'
        },
        {
            level: 3,
            daysSinceCreation: 7,
            notifyRoles: ['parent', 'counselor'],
            description: 'Notify parent and counselor'
        },
        {
            level: 4,
            daysSinceCreation: 14,
            notifyRoles: ['parent', 'counselor', 'principal'],
            description: 'Notify parent, counselor and principal'
        },
        {
            level: 5,
            daysSinceCreation: 21,
            notifyRoles: ['parent', 'counselor', 'principal', 'admin'],
            description: 'Flag as critical - all stakeholders'
        }
    ] as EscalationLevel[],

    /**
     * Check and process escalations
     * This should be called periodically (e.g., daily via cron job)
     */
    async processEscalations(schoolId: string): Promise<{
        success: boolean;
        escalated: number;
        error?: string;
    }> {
        try {
            // Get all open and unresolved alerts
            const { data: alerts, error: alertError } = await supabase
                .from('student_alerts')
                .select('*')
                .eq('school_id', schoolId)
                .in('status', ['open', 'acknowledged', 'in_progress'])
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

            if (alertError) {
                console.error('[ESCALATION] Error fetching alerts:', alertError);
                return { success: false, escalated: 0, error: alertError.message };
            }

            let escalatedCount = 0;

            for (const alert of alerts || []) {
                const escalated = await this.evaluateAndEscalateAlert(schoolId, alert);
                if (escalated) escalatedCount++;
            }

            console.log(`[ESCALATION] Processed ${escalatedCount} escalations`);

            return { success: true, escalated: escalatedCount };
        } catch (error) {
            console.error('[ESCALATION] Error processing escalations:', error);
            return {
                success: false,
                escalated: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Evaluate single alert and escalate if needed
     */
    async evaluateAndEscalateAlert(schoolId: string, alert: any): Promise<boolean> {
        try {
            const createdDate = new Date(alert.created_at);
            const now = new Date();
            const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            // Get or create escalation tracking record
            let { data: tracking, error: trackingError } = await supabase
                .from('escalation_tracking')
                .select('*')
                .eq('school_id', schoolId)
                .eq('alert_id', alert.id)
                .single();

            if (trackingError && trackingError.code !== 'PGRST116') {
                console.error('[ESCALATION] Error fetching tracking:', trackingError);
                return false;
            }

            if (!tracking) {
                // Create new tracking record
                const { data: newTracking, error: createError } = await supabase
                    .from('escalation_tracking')
                    .insert([
                        {
                            school_id: schoolId,
                            alert_id: alert.id,
                            current_level: 0,
                            escalation_reason: 'Alert created and monitoring started'
                        }
                    ])
                    .select()
                    .single();

                if (createError) {
                    console.error('[ESCALATION] Error creating tracking:', createError);
                    return false;
                }

                tracking = newTracking;
            }

            // Check which escalation level we're at
            let targetLevel = 0;

            for (const level of this.ESCALATION_LEVELS) {
                if (daysSinceCreation >= level.daysSinceCreation) {
                    targetLevel = level.level;
                }
            }

            // If no escalation needed yet
            if (targetLevel === 0) {
                return false;
            }

            // If already escalated to this level or higher
            if (tracking.current_level >= targetLevel) {
                return false;
            }

            // Escalate to target level
            const escalationLevel = this.ESCALATION_LEVELS[targetLevel - 1];

            console.log(
                `[ESCALATION] Escalating alert ${alert.id} from level ${tracking.current_level} to ${targetLevel}`
            );

            // Get student and parent info
            const { data: student } = await supabase
                .from('students')
                .select('first_name, last_name')
                .eq('id', alert.student_id)
                .single();

            const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';

            // Notify based on escalation level
            await this.notifyStakeholders(
                schoolId,
                alert,
                studentName,
                escalationLevel,
                targetLevel
            );

            // Update tracking
            const updatePayload: Record<string, any> = {
                current_level: targetLevel,
                last_escalation_date: new Date().toISOString(),
                escalation_reason: `Auto-escalated: Alert unresolved for ${daysSinceCreation} days`
            };

            // Update level-specific fields
            const levelKey = `level_${targetLevel}`;
            updatePayload[`${levelKey}_date`] = new Date().toISOString();
            updatePayload[`${levelKey}_notified_to`] = escalationLevel.notifyRoles;
            updatePayload[`${levelKey}_completed`] = true;

            // Calculate next escalation date
            if (targetLevel < this.ESCALATION_LEVELS.length) {
                const nextLevel = this.ESCALATION_LEVELS[targetLevel];
                const nextEscalationDate = new Date(createdDate);
                nextEscalationDate.setDate(nextEscalationDate.getDate() + nextLevel.daysSinceCreation);
                updatePayload.next_escalation_date = nextEscalationDate.toISOString();
            } else {
                // All levels escalated - mark as critical
                updatePayload.critical_flag_date = new Date().toISOString();
            }

            const { error: updateError } = await supabase
                .from('escalation_tracking')
                .update(updatePayload)
                .eq('id', tracking.id);

            if (updateError) {
                console.error('[ESCALATION] Error updating tracking:', updateError);
                return false;
            }

            // Update alert status to escalated if reaching final level
            if (targetLevel === this.ESCALATION_LEVELS.length) {
                await supabase
                    .from('student_alerts')
                    .update({ status: 'escalated' })
                    .eq('id', alert.id);
            }

            return true;
        } catch (error) {
            console.error('[ESCALATION] Error evaluating alert:', error);
            return false;
        }
    },

    /**
     * Notify stakeholders based on escalation level
     */
    async notifyStakeholders(
        schoolId: string,
        alert: any,
        studentName: string,
        escalationLevel: EscalationLevel,
        levelNumber: number
    ): Promise<void> {
        try {
            // Get recipients based on role
            const recipients: Record<string, string[]> = {
                parent: await this.getParentIds(alert.student_id),
                teacher: await this.getTeacherIds(alert.student_id),
                counselor: await this.getCounselorIds(schoolId),
                principal: await this.getPrincipalIds(schoolId),
                admin: await this.getAdminIds(schoolId)
            };

            const messageTemplate = `ESCALATION NOTICE (Level ${levelNumber}): Alert for ${studentName} remains unresolved. Alert Type: ${alert.alert_type}. Days Since Alert: ${Math.floor((Date.now() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60 * 24))} days. Immediate action required.`;

            // Notify each role
            for (const role of escalationLevel.notifyRoles) {
                const roleRecipients = recipients[role] || [];

                for (const recipientId of roleRecipients) {
                    await notificationService.sendNotification({
                        schoolId,
                        recipientId,
                        recipientRole: role as any,
                        notificationType: 'escalation_alert',
                        title: `Escalation Level ${levelNumber}: ${alert.title}`,
                        message: messageTemplate,
                        priority: levelNumber >= 4 ? 'critical' : 'high',
                        relatedStudentId: alert.student_id,
                        relatedAlertId: alert.id
                    });
                }
            }
        } catch (error) {
            console.error('[ESCALATION] Error notifying stakeholders:', error);
        }
    },

    /**
     * Get escalation tracking for an alert
     */
    async getEscalationTracking(schoolId: string, alertId: string): Promise<any> {
        try {
            const { data } = await supabase
                .from('escalation_tracking')
                .select('*')
                .eq('school_id', schoolId)
                .eq('alert_id', alertId)
                .single();

            return data;
        } catch (error) {
            return null;
        }
    },

    /**
     * Get high-risk escalation cases (critical flags)
     */
    async getCriticalCases(schoolId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('escalation_tracking')
                .select('alert_id, critical_flag_date, current_level')
                .eq('school_id', schoolId)
                .not('critical_flag_date', 'is', null)
                .order('critical_flag_date', { ascending: false });

            if (error) {
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('[ESCALATION] Error fetching critical cases:', error);
            return [];
        }
    },

    /**
     * Reset escalation for resolved alert
     */
    async resetEscalation(schoolId: string, alertId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('escalation_tracking')
                .update({
                    current_level: 0,
                    last_escalation_date: null,
                    critical_flag_date: null,
                    escalation_reason: 'Alert resolved - escalation reset'
                })
                .eq('school_id', schoolId)
                .eq('alert_id', alertId);

            if (error) {
                return { success: false, error: error.message };
            }

            console.log(`[ESCALATION] Reset escalation for alert ${alertId}`);

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    async getParentIds(studentId: string): Promise<string[]> {
        try {
            const { data } = await supabase
                .from('student_parents')
                .select('parent:parent_id(auth_user_id)')
                .eq('student_id', studentId);

            return (data || [])
                .map((item: any) => item.parent?.auth_user_id)
                .filter((id: any) => id);
        } catch (error) {
            return [];
        }
    },

    async getTeacherIds(studentId: string): Promise<string[]> {
        try {
            const { data: student } = await supabase
                .from('students')
                .select('class_id')
                .eq('id', studentId)
                .single();

            if (!student?.class_id) return [];

            const { data: staffClasses } = await supabase
                .from('staff_classes')
                .select('staff:staff_id(user_id)')
                .eq('class_id', student.class_id);

            return (staffClasses || [])
                .map((item: any) => item.staff?.user_id)
                .filter((id: any) => id);
        } catch (error) {
            return [];
        }
    },

    async getCounselorIds(schoolId: string): Promise<string[]> {
        try {
            const { data } = await supabase
                .from('staff')
                .select('user_id')
                .eq('school_id', schoolId)
                .eq('staff_role', 'counselor');

            return data?.map(s => s.user_id) || [];
        } catch (error) {
            return [];
        }
    },

    async getPrincipalIds(schoolId: string): Promise<string[]> {
        try {
            const { data } = await supabase
                .from('staff')
                .select('user_id')
                .eq('school_id', schoolId)
                .eq('staff_role', 'principal');

            return data?.map(s => s.user_id) || [];
        } catch (error) {
            return [];
        }
    },

    async getAdminIds(schoolId: string): Promise<string[]> {
        try {
            const { data } = await supabase
                .from('auth.users')
                .select('id')
                .eq('raw_user_meta_data->>role', 'admin');

            return data?.map(u => u.id) || [];
        } catch (error) {
            return [];
        }
    }
};
