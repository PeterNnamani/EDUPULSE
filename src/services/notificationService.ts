import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';

export type NotificationType =
    | 'attendance_alert'
    | 'academic_alert'
    | 'behaviour_alert'
    | 'assignment_alert'
    | 'fee_reminder'
    | 'fee_alert'
    | 'risk_alert'
    | 'intervention_reminder'
    | 'escalation_alert'
    | 'academic_event'
    | 'system_alert';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface CreateNotificationRequest {
    schoolId: string;
    recipientId: string;
    recipientRole: UserRole;
    notificationType: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    actionUrl?: string;
    relatedStudentId?: string;
    relatedAlertId?: string;
    deliveryChannels?: string[];
}

export interface Notification {
    id: string;
    schoolId: string;
    recipientId: string;
    recipientRole: UserRole;
    notificationType: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    status: NotificationStatus;
    actionUrl?: string;
    relatedStudentId?: string;
    relatedAlertId?: string;
    createdAt: string;
    readAt?: string;
    archivedAt?: string;
}

export interface NotificationPreference {
    id: string;
    schoolId: string;
    userId: string;
    userRole: UserRole;
    notificationType: NotificationType;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
}

// ============================================================================
// NOTIFICATION SERVICE - Core notification management
// ============================================================================

export const notificationService = {
    /**
     * Send a notification to a user
     */
    async sendNotification(
        request: CreateNotificationRequest
    ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
        try {
            // Get user preferences
            const preferences = await this.getNotificationPreferences(
                request.schoolId,
                request.recipientId,
                request.notificationType
            );

            const deliveryChannels = request.deliveryChannels ||
                (preferences && [
                    preferences.inAppEnabled && 'in_app',
                    preferences.emailEnabled && 'email',
                    preferences.smsEnabled && 'sms',
                    preferences.whatsappEnabled && 'whatsapp'
                ].filter(Boolean)) || ['in_app'];

            // Always create in-app notification
            const { data, error } = await supabase
                .from('notifications')
                .insert([
                    {
                        school_id: request.schoolId,
                        recipient_id: request.recipientId,
                        recipient_role: request.recipientRole,
                        notification_type: request.notificationType,
                        title: request.title,
                        message: request.message,
                        priority: request.priority,
                        action_url: request.actionUrl,
                        related_student_id: request.relatedStudentId,
                        related_alert_id: request.relatedAlertId,
                        delivery_channels: deliveryChannels
                    }
                ])
                .select('id')
                .single();

            if (error) {
                console.error('[NOTIFICATION] Error creating notification:', error);
                return { success: false, error: error.message };
            }

            // Queue deliveries to other channels (email, SMS, etc.)
            if (deliveryChannels.includes('email')) {
                await this.queueEmailNotification(
                    request.recipientId,
                    request.title,
                    request.message,
                    data.id
                );
            }

            if (deliveryChannels.includes('sms')) {
                await this.queueSmsNotification(
                    request.recipientId,
                    request.message,
                    data.id
                );
            }

            return { success: true, notificationId: data.id };
        } catch (error) {
            console.error('[NOTIFICATION] Error sending notification:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Get user's notification preferences
     */
    async getNotificationPreferences(
        schoolId: string,
        userId: string,
        notificationType: NotificationType
    ): Promise<NotificationPreference | null> {
        try {
            const { data } = await supabase
                .from('notification_preferences')
                .select('*')
                .eq('school_id', schoolId)
                .eq('user_id', userId)
                .eq('notification_type', notificationType)
                .single();

            return data;
        } catch (error) {
            return null;
        }
    },

    /**
     * Set notification preferences for a user
     */
    async setNotificationPreferences(
        schoolId: string,
        userId: string,
        userRole: UserRole,
        notificationType: NotificationType,
        preferences: {
            inAppEnabled?: boolean;
            emailEnabled?: boolean;
            smsEnabled?: boolean;
            whatsappEnabled?: boolean;
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('notification_preferences')
                .upsert([
                    {
                        school_id: schoolId,
                        user_id: userId,
                        user_role: userRole,
                        notification_type: notificationType,
                        in_app_enabled: preferences.inAppEnabled ?? true,
                        email_enabled: preferences.emailEnabled ?? true,
                        sms_enabled: preferences.smsEnabled ?? false,
                        whatsapp_enabled: preferences.whatsappEnabled ?? false
                    }
                ]);

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
     * Get user's notifications
     */
    async getNotifications(
        schoolId: string,
        userId: string,
        options?: {
            status?: NotificationStatus;
            limit?: number;
            offset?: number;
        }
    ): Promise<Notification[]> {
        try {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('school_id', schoolId)
                .eq('recipient_id', userId)
                .order('created_at', { ascending: false });

            if (options?.limit) {
                query = query.limit(options.limit);
            }

            if (options?.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[NOTIFICATION] Error fetching notifications:', error);
                return [];
            }

            let rows = data ?? [];

            if (options?.status === 'unread') {
                rows = rows.filter(
                    (n) =>
                        !n.archived_at &&
                        (n.status === 'unread' || (!n.read_at && n.status !== 'read' && n.status !== 'archived'))
                );
            } else if (options?.status === 'read') {
                rows = rows.filter((n) => n.status === 'read' || !!n.read_at);
            } else if (options?.status === 'archived') {
                rows = rows.filter((n) => n.status === 'archived' || !!n.archived_at);
            } else {
                rows = rows.filter((n) => n.status !== 'archived' && !n.archived_at);
            }

            return rows.map(n => ({
                    id: n.id,
                    schoolId: n.school_id,
                    recipientId: n.recipient_id,
                    recipientRole: n.recipient_role,
                    notificationType: n.notification_type,
                    title: n.title,
                    message: n.message,
                    priority: n.priority,
                    status: n.status || 'unread',
                    actionUrl: n.action_url,
                    relatedStudentId: n.related_student_id,
                    relatedAlertId: n.related_alert_id,
                    createdAt: n.created_at,
                    readAt: n.read_at,
                    archivedAt: n.archived_at
                }));
        } catch (error) {
            console.error('[NOTIFICATION] Error fetching notifications:', error);
            return [];
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({
                    status: 'read',
                    read_at: new Date().toISOString(),
                })
                .eq('id', notificationId);

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
     * Archive notification
     */
    async archive(notificationId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({
                    status: 'archived',
                    archived_at: new Date().toISOString(),
                })
                .eq('id', notificationId);

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
     * Get notification count by status
     */
    async getNotificationCounts(
        schoolId: string,
        userId: string
    ): Promise<{ unread: number; total: number; archived: number }> {
        try {
            // Fetch all notifications without status filtering
            const { count: totalCount, data: notifications } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('school_id', schoolId)
                .eq('recipient_id', userId);

            // Count unread/total locally if status column exists
            let unreadCount = 0;
            let archivedCount = 0;

            if (notifications && Array.isArray(notifications)) {
                unreadCount = notifications.filter(
                    (n) =>
                        !n.archived_at &&
                        n.status !== 'archived' &&
                        (n.status === 'unread' || !n.read_at)
                ).length;
                archivedCount = notifications.filter(
                    (n) => n.archived_at || n.status === 'archived'
                ).length;
            }

            return {
                unread: unreadCount || 0,
                total: (totalCount || 0) - archivedCount,
                archived: archivedCount || 0
            };
        } catch (error) {
            console.error('[NOTIFICATION] Error getting counts:', error);
            return { unread: 0, total: 0, archived: 0 };
        }
    },

    // ============================================================================
    // HELPER METHODS FOR MULTI-CHANNEL DELIVERY
    // ============================================================================

    /**
     * Queue email notification (placeholder - implement with actual email service)
     */
    async queueEmailNotification(
        userId: string,
        title: string,
        message: string,
        notificationId: string
    ): Promise<void> {
        // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
        console.log(`[NOTIFICATION] Queuing email for user ${userId}: ${title}`);
    },

    /**
     * Queue SMS notification (placeholder - implement with actual SMS service)
     */
    async queueSmsNotification(
        userId: string,
        message: string,
        notificationId: string
    ): Promise<void> {
        // TODO: Integrate with SMS service (Twilio, etc.)
        console.log(`[NOTIFICATION] Queuing SMS for user ${userId}: ${message}`);
    }
};
