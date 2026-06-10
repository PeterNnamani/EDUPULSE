import { supabase } from '@/lib/supabase';
import type { ReportCard } from '@/types';

/**
 * Result Notification Service
 * Handles notifications for report card release and student/parent access
 */

export const resultNotificationService = {
    /**
     * Notify parents when report cards are published
     */
    async notifyParentsOfReportRelease(
        schoolId: string,
        reportCard: ReportCard
    ): Promise<{ success: boolean; notificationCount?: number; error?: string }> {
        try {
            // Get parent links for student
            const { data: parentLinks } = await supabase
                .from('parent_student_linking')
                .select('parent_id')
                .eq('student_id', reportCard.studentId);

            if (!parentLinks || parentLinks.length === 0) {
                return {
                    success: true,
                    notificationCount: 0,
                };
            }

            const parentIds = parentLinks.map((link) => link.parent_id);

            // Get parent details
            const { data: parents } = await supabase
                .from('parents')
                .select('id, user_id, email')
                .in('id', parentIds);

            if (!parents) {
                return {
                    success: false,
                    error: 'Failed to fetch parent details',
                };
            }

            // Create notifications
            const notifications = parentIds.map((parentId) => ({
                school_id: schoolId,
                user_id: parents.find((p) => p.id === parentId)?.user_id,
                type: 'report_card_released' as const,
                title: 'Report Card Available',
                message: `Your child's ${reportCard.termId} report card is now available for viewing`,
                related_entity_id: reportCard.id,
                related_entity_type: 'report_card' as const,
                read: false,
                created_at: new Date().toISOString(),
            }));

            // Insert notifications
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) throw notifyError;

            // TODO: Send email/SMS notifications if configured

            return {
                success: true,
                notificationCount: notifications.length,
            };
        } catch (error: any) {
            console.error('Error notifying parents:', error);
            return {
                success: false,
                error: error.message || 'Failed to send notifications',
            };
        }
    },

    /**
     * Notify student of report release
     */
    async notifyStudentOfReportRelease(
        schoolId: string,
        reportCard: ReportCard
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Get student user ID
            const { data: student } = await supabase
                .from('students')
                .select('user_id')
                .eq('id', reportCard.studentId)
                .single();

            if (!student || !student.user_id) {
                return { success: false, error: 'Student user not found' };
            }

            // Create notification
            const { error } = await supabase.from('notifications').insert([
                {
                    school_id: schoolId,
                    user_id: student.user_id,
                    type: 'report_card_released',
                    title: 'Your Report Card is Ready',
                    message: `Your ${reportCard.termId} report card has been released. You can view it now.`,
                    related_entity_id: reportCard.id,
                    related_entity_type: 'report_card',
                    read: false,
                    created_at: new Date().toISOString(),
                },
            ]);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error notifying student:', error);
            return {
                success: false,
                error: error.message || 'Failed to notify student',
            };
        }
    },

    /**
     * Record parent access to report card
     */
    async recordParentAccess(
        schoolId: string,
        parentId: string,
        studentId: string,
        reportCardId: string,
        downloadedPdf: boolean = false,
        printed: boolean = false
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('parent_report_access')
                .insert([
                    {
                        school_id: schoolId,
                        parent_id: parentId,
                        student_id: studentId,
                        report_card_id: reportCardId,
                        accessed_at: new Date().toISOString(),
                        downloaded_pdf: downloadedPdf,
                        printed,
                    },
                ]);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error recording parent access:', error);
            return {
                success: false,
                error: error.message || 'Failed to record access',
            };
        }
    },

    /**
     * Get parent access statistics
     */
    async getParentAccessStats(
        schoolId: string,
        reportCardId: string
    ): Promise<{
        totalAccesses: number;
        uniqueParents: number;
        downloadCount: number;
        printCount: number;
        lastAccessedAt?: string;
    } | null> {
        try {
            const { data: accesses } = await supabase
                .from('parent_report_access')
                .select('*')
                .eq('school_id', schoolId)
                .eq('report_card_id', reportCardId);

            if (!accesses) {
                return null;
            }

            const uniqueParents = new Set(accesses.map((a) => a.parent_id)).size;
            const downloadCount = accesses.filter((a) => a.downloaded_pdf).length;
            const printCount = accesses.filter((a) => a.printed).length;
            const lastAccess = accesses.sort(
                (a, b) =>
                    new Date(b.accessed_at).getTime() - new Date(a.accessed_at).getTime()
            )[0];

            return {
                totalAccesses: accesses.length,
                uniqueParents,
                downloadCount,
                printCount,
                lastAccessedAt: lastAccess?.accessed_at,
            };
        } catch (error) {
            console.error('Error getting parent access stats:', error);
            return null;
        }
    },

    /**
     * Send batch notifications for class report release
     */
    async notifyClassReportRelease(
        schoolId: string,
        classId: string,
        sessionId: string,
        termId: string
    ): Promise<{ success: boolean; notificationCount?: number; error?: string }> {
        try {
            // Get all report cards for class
            const { data: reportCards } = await supabase
                .from('report_cards')
                .select('*')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('session_id', sessionId)
                .eq('term_id', termId);

            if (!reportCards || reportCards.length === 0) {
                return {
                    success: true,
                    notificationCount: 0,
                };
            }

            let totalNotifications = 0;

            for (const reportCard of reportCards) {
                const result = await this.notifyParentsOfReportRelease(schoolId, reportCard);
                if (result.success && result.notificationCount) {
                    totalNotifications += result.notificationCount;
                }

                // Also notify student
                await this.notifyStudentOfReportRelease(schoolId, reportCard);
            }

            return {
                success: true,
                notificationCount: totalNotifications,
            };
        } catch (error: any) {
            console.error('Error notifying class:', error);
            return {
                success: false,
                error: error.message || 'Failed to send notifications',
            };
        }
    },

    /**
     * Create in-app notification
     */
    async createNotification(
        schoolId: string,
        userId: string,
        title: string,
        message: string,
        type: string = 'info',
        relatedEntityId?: string,
        relatedEntityType?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase.from('notifications').insert([
                {
                    school_id: schoolId,
                    user_id: userId,
                    type,
                    title,
                    message,
                    related_entity_id: relatedEntityId,
                    related_entity_type: relatedEntityType,
                    read: false,
                    created_at: new Date().toISOString(),
                },
            ]);

            if (error) throw error;

            return { success: true };
        } catch (error: any) {
            console.error('Error creating notification:', error);
            return {
                success: false,
                error: error.message || 'Failed to create notification',
            };
        }
    },

    /**
     * Send SMS notification (placeholder for SMS service)
     */
    async sendSmsNotification(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // This would integrate with SMS service like Twilio, Termii, etc.
            // For now, just log it
            console.log(`SMS to ${phoneNumber}: ${message}`);

            return { success: true };
        } catch (error: any) {
            console.error('Error sending SMS:', error);
            return {
                success: false,
                error: error.message || 'Failed to send SMS',
            };
        }
    },

    /**
     * Send email notification (placeholder for email service)
     */
    async sendEmailNotification(
        email: string,
        subject: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // This would integrate with email service like SendGrid, Mailgun, etc.
            // For now, just log it
            console.log(`Email to ${email}: ${subject}`);

            return { success: true };
        } catch (error: any) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message || 'Failed to send email',
            };
        }
    },
};
