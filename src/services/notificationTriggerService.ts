import { notificationService, CreateNotificationRequest, NotificationPriority } from './notificationService';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';

/**
 * NOTIFICATION TRIGGER SERVICE
 * 
 * Centralized service for triggering notifications based on real business events.
 * This service provides reusable functions to send notifications to appropriate users
 * when significant events occur in the system.
 * 
 * Events triggered:
 * - Teacher/Staff assignment to class
 * - Fee reminders and payment alerts
 * - Attendance alerts
 * - Academic risk detection
 * - Assignment creation and due dates
 * - Behavior incidents
 * - Grade/result release
 * - Intervention escalations
 * - Student enrollment/admission
 * - Report card availability
 */

export const notificationTriggerService = {
    /**
     * Trigger notification when a teacher is assigned to a class
     * Recipient: The teacher
     */
    async onTeacherClassAssignment(
        schoolId: string,
        teacherId: string,
        teacherName: string,
        className: string,
        classId: string
    ): Promise<void> {
        try {
            await notificationService.sendNotification({
                schoolId,
                recipientId: teacherId,
                recipientRole: 'teacher' as UserRole,
                notificationType: 'academic_event',
                title: '📚 New Class Assignment',
                message: `You have been assigned to teach ${className}`,
                priority: 'high',
                actionUrl: `/teacher/classes/${classId}`,
                deliveryChannels: ['in_app']
            });
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on teacher assignment:', error);
        }
    },

    /**
     * Trigger fee reminder notifications
     * Recipients: Parents of students with outstanding fees
     */
    async onFeeReminder(
        schoolId: string,
        studentId: string,
        studentName: string,
        parentIds: string[],
        amountDue: number,
        dueDate: string,
        priority: NotificationPriority = 'high'
    ): Promise<void> {
        try {
            const message = `Fee reminder for ${studentName}: ₦${amountDue.toLocaleString()} due by ${dueDate}`;

            // Send to each parent
            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'fee_reminder',
                    title: '💰 School Fee Reminder',
                    message,
                    priority,
                    relatedStudentId: studentId,
                    actionUrl: `/parent/fees`,
                    deliveryChannels: ['in_app', 'email']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on fee reminder:', error);
        }
    },

    /**
     * Trigger attendance alert
     * Recipients: Parents when student has low attendance
     */
    async onAttendanceAlert(
        schoolId: string,
        studentId: string,
        studentName: string,
        parentIds: string[],
        attendancePercentage: number,
        absenceCount: number
    ): Promise<void> {
        try {
            const message = `${studentName} has ${absenceCount} absences (${attendancePercentage}% attendance)`;

            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'attendance_alert',
                    title: '⏰ Low Attendance Alert',
                    message,
                    priority: 'high',
                    relatedStudentId: studentId,
                    actionUrl: `/parent/attendance`,
                    deliveryChannels: ['in_app', 'email']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on attendance alert:', error);
        }
    },

    /**
     * Trigger academic risk alert
     * Recipients: Parents, Counselors, Principal
     */
    async onAcademicRiskDetected(
        schoolId: string,
        studentId: string,
        studentName: string,
        riskLevel: 'medium' | 'high' | 'critical',
        riskFactors: string[],
        parentIds: string[],
        counselorIds: string[],
        principalId: string
    ): Promise<void> {
        try {
            const priority: NotificationPriority = riskLevel === 'critical' ? 'critical' : 'high';
            const factors = riskFactors.join(', ');
            const message = `${studentName} is at ${riskLevel} risk. Factors: ${factors}`;

            // Notify parents
            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'risk_alert',
                    title: `⚠️ Academic Risk Alert - ${riskLevel.toUpperCase()}`,
                    message,
                    priority,
                    relatedStudentId: studentId,
                    actionUrl: `/parent/dashboard`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify counselors
            for (const counselorId of counselorIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: counselorId,
                    recipientRole: 'counselor' as UserRole,
                    notificationType: 'risk_alert',
                    title: `⚠️ Student at Risk - ${studentName}`,
                    message,
                    priority,
                    relatedStudentId: studentId,
                    actionUrl: `/counselor/cases/${studentId}`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify principal
            await notificationService.sendNotification({
                schoolId,
                recipientId: principalId,
                recipientRole: 'principal' as UserRole,
                notificationType: 'risk_alert',
                title: `⚠️ High Risk Student Alert`,
                message,
                priority,
                relatedStudentId: studentId,
                actionUrl: `/principal/risk-dashboard`,
                deliveryChannels: ['in_app']
            });
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on risk detection:', error);
        }
    },

    /**
     * Trigger assignment notification
     * Recipients: Students and Parents when assignment is created/due soon
     */
    async onAssignmentEvent(
        schoolId: string,
        studentIds: string[],
        parentIds: string[],
        assignmentTitle: string,
        assignmentId: string,
        dueDate: string,
        eventType: 'created' | 'due_soon' | 'overdue'
    ): Promise<void> {
        try {
            const titleMap = {
                created: '📝 New Assignment',
                due_soon: '⏱️ Assignment Due Soon',
                overdue: '🚨 Assignment Overdue'
            };

            const messageMap = {
                created: `New assignment: ${assignmentTitle} - Due ${dueDate}`,
                due_soon: `${assignmentTitle} is due ${dueDate}`,
                overdue: `${assignmentTitle} is now overdue`
            };

            const priorityMap = {
                created: 'medium' as NotificationPriority,
                due_soon: 'high' as NotificationPriority,
                overdue: 'critical' as NotificationPriority
            };

            // Notify students
            for (const studentId of studentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: studentId,
                    recipientRole: 'student' as UserRole,
                    notificationType: 'assignment_alert',
                    title: titleMap[eventType],
                    message: messageMap[eventType],
                    priority: priorityMap[eventType],
                    actionUrl: `/student/assignments/${assignmentId}`,
                    deliveryChannels: ['in_app']
                });
            }

            // Notify parents
            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'assignment_alert',
                    title: titleMap[eventType],
                    message: messageMap[eventType],
                    priority: priorityMap[eventType],
                    actionUrl: `/parent/assignments`,
                    deliveryChannels: ['in_app', 'email']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on assignment event:', error);
        }
    },

    /**
     * Trigger behavior incident notification
     * Recipients: Parents, Counselor, Principal
     */
    async onBehaviorIncident(
        schoolId: string,
        studentId: string,
        studentName: string,
        parentIds: string[],
        counselorIds: string[],
        principalId: string,
        incidentDescription: string,
        severity: 'minor' | 'major' | 'critical'
    ): Promise<void> {
        try {
            const priorityMap = {
                minor: 'medium' as NotificationPriority,
                major: 'high' as NotificationPriority,
                critical: 'critical' as NotificationPriority
            };

            const message = `Behavior incident reported: ${incidentDescription}`;

            // Notify parents
            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'behaviour_alert',
                    title: `👤 Behavior Incident - ${studentName}`,
                    message,
                    priority: priorityMap[severity],
                    relatedStudentId: studentId,
                    actionUrl: `/parent/behaviour`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify counselors
            for (const counselorId of counselorIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: counselorId,
                    recipientRole: 'counselor' as UserRole,
                    notificationType: 'behaviour_alert',
                    title: `Behavior Incident: ${studentName}`,
                    message,
                    priority: priorityMap[severity],
                    relatedStudentId: studentId,
                    actionUrl: `/counselor/cases`,
                    deliveryChannels: ['in_app']
                });
            }

            // Notify principal
            if (severity !== 'minor') {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: principalId,
                    recipientRole: 'principal' as UserRole,
                    notificationType: 'behaviour_alert',
                    title: `${severity.toUpperCase()} Behavior Incident`,
                    message,
                    priority: priorityMap[severity],
                    relatedStudentId: studentId,
                    actionUrl: `/principal/behaviour`,
                    deliveryChannels: ['in_app']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on behavior incident:', error);
        }
    },

    /**
     * Trigger report card release notification
     * Recipients: Parents and Students
     */
    async onReportCardRelease(
        schoolId: string,
        studentId: string,
        studentName: string,
        parentIds: string[],
        term: string,
        year: string
    ): Promise<void> {
        try {
            const message = `Report card for ${term} ${year} is now available for ${studentName}`;

            // Notify parents
            for (const parentId of parentIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: parentId,
                    recipientRole: 'parent' as UserRole,
                    notificationType: 'academic_alert',
                    title: `📚 Report Card Released`,
                    message,
                    priority: 'high',
                    relatedStudentId: studentId,
                    actionUrl: `/parent/grades`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify student
            await notificationService.sendNotification({
                schoolId,
                recipientId: studentId,
                recipientRole: 'student' as UserRole,
                notificationType: 'academic_alert',
                title: `📚 Your Report Card is Ready`,
                message,
                priority: 'high',
                actionUrl: `/student/grades`,
                deliveryChannels: ['in_app']
            });
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on report card release:', error);
        }
    },

    /**
     * Trigger grade/result notification
     * Recipients: Teachers (when grades need review), Parents, Students
     */
    async onGradeResultEvent(
        schoolId: string,
        studentId: string,
        studentName: string,
        parentIds: string[],
        teacherId: string,
        subjectName: string,
        grade: string,
        eventType: 'posted' | 'needs_approval' | 'approved'
    ): Promise<void> {
        try {
            if (eventType === 'needs_approval') {
                // Notify teacher to approve grades
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: teacherId,
                    recipientRole: 'teacher' as UserRole,
                    notificationType: 'academic_alert',
                    title: `✅ Grades Ready for Approval`,
                    message: `${subjectName} grades are ready for your review and approval`,
                    priority: 'high',
                    actionUrl: `/teacher/results/approval`,
                    deliveryChannels: ['in_app']
                });
            } else if (eventType === 'approved') {
                // Notify parents and students
                const message = `${subjectName} grade for ${studentName}: ${grade}`;

                for (const parentId of parentIds) {
                    await notificationService.sendNotification({
                        schoolId,
                        recipientId: parentId,
                        recipientRole: 'parent' as UserRole,
                        notificationType: 'academic_alert',
                        title: `📊 New Grade Posted`,
                        message,
                        priority: 'medium',
                        relatedStudentId: studentId,
                        actionUrl: `/parent/grades`,
                        deliveryChannels: ['in_app', 'email']
                    });
                }

                await notificationService.sendNotification({
                    schoolId,
                    recipientId: studentId,
                    recipientRole: 'student' as UserRole,
                    notificationType: 'academic_alert',
                    title: `📊 New Grade Posted`,
                    message,
                    priority: 'medium',
                    actionUrl: `/student/grades`,
                    deliveryChannels: ['in_app']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on grade result event:', error);
        }
    },

    /**
     * Trigger subscription/payment notification
     * Recipients: School Admin, Finance Officer
     */
    async onSubscriptionPaymentEvent(
        schoolId: string,
        adminIds: string[],
        financeOfficerIds: string[],
        eventType: 'due_soon' | 'overdue' | 'renewal_reminder',
        planName: string,
        dueDate: string,
        amount: number
    ): Promise<void> {
        try {
            const titleMap = {
                due_soon: '💳 Subscription Payment Due Soon',
                overdue: '🚨 Subscription Payment Overdue',
                renewal_reminder: '🔄 Subscription Renewal Reminder'
            };

            const message = `${planName} subscription - Amount: ₦${amount.toLocaleString()} - Due: ${dueDate}`;
            const priority = eventType === 'overdue' ? 'critical' : 'high';

            // Notify admins
            for (const adminId of adminIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: adminId,
                    recipientRole: 'admin' as UserRole,
                    notificationType: 'fee_alert',
                    title: titleMap[eventType],
                    message,
                    priority: priority as NotificationPriority,
                    actionUrl: `/admin/subscriptions`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify finance officers
            for (const financeId of financeOfficerIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: financeId,
                    recipientRole: 'finance_officer' as UserRole,
                    notificationType: 'fee_alert',
                    title: titleMap[eventType],
                    message,
                    priority: priority as NotificationPriority,
                    actionUrl: `/admin/subscriptions`,
                    deliveryChannels: ['in_app', 'email']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on subscription payment event:', error);
        }
    },

    /**
     * Trigger intervention/escalation notification
     * Recipients: Counselors, Principal, Admin
     */
    async onInterventionEscalation(
        schoolId: string,
        studentId: string,
        studentName: string,
        counselorIds: string[],
        principalId: string,
        reason: string,
        priority: NotificationPriority
    ): Promise<void> {
        try {
            const message = `Escalation for ${studentName}: ${reason}`;

            // Notify counselors
            for (const counselorId of counselorIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: counselorId,
                    recipientRole: 'counselor' as UserRole,
                    notificationType: 'escalation_alert',
                    title: '🔴 Case Escalation',
                    message,
                    priority,
                    relatedStudentId: studentId,
                    actionUrl: `/counselor/cases/${studentId}`,
                    deliveryChannels: ['in_app', 'email']
                });
            }

            // Notify principal
            await notificationService.sendNotification({
                schoolId,
                recipientId: principalId,
                recipientRole: 'principal' as UserRole,
                notificationType: 'escalation_alert',
                title: '🔴 Critical Case Escalation',
                message,
                priority,
                relatedStudentId: studentId,
                actionUrl: `/principal/risk-dashboard`,
                deliveryChannels: ['in_app', 'email']
            });
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on escalation:', error);
        }
    },

    /**
     * Trigger student admission/enrollment notification
     * Recipients: Teachers (for their classes), Principal, Admin
     */
    async onStudentEnrollment(
        schoolId: string,
        studentName: string,
        classId: string,
        className: string,
        teacherIds: string[],
        principalId: string,
        adminIds: string[]
    ): Promise<void> {
        try {
            // Notify class teachers
            for (const teacherId of teacherIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: teacherId,
                    recipientRole: 'teacher' as UserRole,
                    notificationType: 'academic_event',
                    title: `👤 New Student Enrolled`,
                    message: `${studentName} has been enrolled in ${className}`,
                    priority: 'medium',
                    actionUrl: `/teacher/classes/${classId}`,
                    deliveryChannels: ['in_app']
                });
            }

            // Notify principal
            await notificationService.sendNotification({
                schoolId,
                recipientId: principalId,
                recipientRole: 'principal' as UserRole,
                notificationType: 'academic_event',
                title: `👤 New Student Enrollment`,
                message: `${studentName} has been enrolled in ${className}`,
                priority: 'medium',
                actionUrl: `/principal/students`,
                deliveryChannels: ['in_app']
            });

            // Notify admins
            for (const adminId of adminIds) {
                await notificationService.sendNotification({
                    schoolId,
                    recipientId: adminId,
                    recipientRole: 'admin' as UserRole,
                    notificationType: 'academic_event',
                    title: `👤 Student Admission`,
                    message: `${studentName} enrolled in ${className}`,
                    priority: 'medium',
                    actionUrl: `/admin/students`,
                    deliveryChannels: ['in_app']
                });
            }
        } catch (error) {
            console.error('[NOTIFICATION_TRIGGER] Error on student enrollment:', error);
        }
    }
};
