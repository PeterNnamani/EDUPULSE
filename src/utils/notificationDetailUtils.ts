import type { Notification } from '@/services/notificationService';

const TYPE_LABELS: Record<string, string> = {
  attendance_alert: 'Attendance',
  academic_alert: 'Academic',
  behaviour_alert: 'Behaviour',
  assignment_alert: 'Assignment',
  fee_reminder: 'Fee reminder',
  fee_alert: 'Fee alert',
  risk_alert: 'Risk alert',
  intervention_reminder: 'Intervention',
  escalation_alert: 'Escalation',
  teacher_activity: 'Teacher activity',
  arrival_alert: 'Duty arrival',
  departure_alert: 'Duty departure',
  academic_event: 'Academic event',
  system_alert: 'System',
  birthday_greeting: 'Birthday',
  payment_confirmation: 'Payment',
  reconciliation_alert: 'Reconciliation',
  school_message: 'School message',
};

export function formatNotificationType(type: string) {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function formatFullNotificationTime(dateString: string) {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function buildNotificationDetailRows(notification: Notification) {
  const rows: { label: string; value: string }[] = [
    { label: 'Category', value: formatNotificationType(notification.notificationType) },
    { label: 'Priority', value: notification.priority },
    {
      label: 'Status',
      value:
        notification.status === 'unread'
          ? 'Unread'
          : notification.status === 'read'
            ? 'Read'
            : 'Archived',
    },
    { label: 'Received', value: formatFullNotificationTime(notification.createdAt) },
  ];

  if (notification.readAt) {
    rows.push({ label: 'Read at', value: formatFullNotificationTime(notification.readAt) });
  }

  if (notification.recipientRole) {
    rows.push({
      label: 'Recipient role',
      value: notification.recipientRole.charAt(0).toUpperCase() + notification.recipientRole.slice(1),
    });
  }

  return rows;
}

/** Pull structured hints from free-text notification messages. */
export function parseMessageDetails(message: string) {
  const details: { label: string; value: string }[] = [];
  const patterns: { label: string; regex: RegExp }[] = [
    { label: 'Teacher', regex: /(?:teacher|staff)\s+([A-Za-z][\w\s.'-]{1,40})/i },
    { label: 'Class', regex: /\b(?:class|for)\s+([A-Za-z0-9][\w\s.-]{1,30})/i },
    { label: 'Student', regex: /\bstudent\s+([A-Za-z][\w\s.'-]{1,40})/i },
    { label: 'Date', regex: /\b(\d{4}-\d{2}-\d{2})\b/ },
    { label: 'Subject', regex: /\b(?:subject|in)\s+([A-Za-z][\w\s.'-]{2,30})/i },
  ];

  for (const { label, regex } of patterns) {
    const match = message.match(regex);
    if (match?.[1] && !details.some((d) => d.label === label)) {
      details.push({ label, value: match[1].trim() });
    }
  }

  return details;
}
