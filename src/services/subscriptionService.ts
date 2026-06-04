import { supabase } from '@/lib/supabase';
import { notificationTriggerService } from './notificationTriggerService';

export interface SchoolSubscriptionStatus {
  schoolId: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended';
  trialEndsAt: string | null;
  daysRemaining: number;
  isTrial: boolean;
  isExpired: boolean;
  activePlan: string | null;
  activeEndDate: string | null;
  label: string;
}

export async function getSchoolSubscriptionStatus(schoolId: string): Promise<SchoolSubscriptionStatus> {
  const { data: school } = await supabase
    .from('schools')
    .select('id, subscription_status, trial_ends_at')
    .eq('id', schoolId)
    .maybeSingle();

  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('plan, end_date, status')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const trialEnds = school?.trial_ends_at ? new Date(school.trial_ends_at) : null;
  const subEnd = activeSub?.end_date ? new Date(activeSub.end_date) : null;

  let daysRemaining = 0;
  let label = 'Active subscription';
  const status = (school?.subscription_status as SchoolSubscriptionStatus['subscriptionStatus']) ?? 'trial';
  const isTrial = !activeSub && (status === 'trial' || !!trialEnds);
  const deadline = isTrial ? trialEnds : subEnd;

  if (deadline) {
    daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86400000));
    if (isTrial) {
      label =
        daysRemaining === 0
          ? 'Trial ends today'
          : `Trial — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else if (activeSub) {
      label = `${activeSub.plan} plan — renews/ends ${deadline.toLocaleDateString()}`;
    }
  }

  const isExpired =
    status === 'expired' ||
    status === 'suspended' ||
    (isTrial && trialEnds && trialEnds < now && !activeSub) ||
    (!!subEnd && subEnd < now && !isTrial);

  return {
    schoolId,
    subscriptionStatus: isExpired ? 'expired' : status,
    trialEndsAt: school?.trial_ends_at ?? null,
    daysRemaining,
    isTrial,
    isExpired,
    activePlan: activeSub?.plan ?? null,
    activeEndDate: activeSub?.end_date ?? null,
    label,
  };
}

async function getAdminStaffIds(schoolId: string): Promise<string[]> {
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'admin')
    .eq('is_active', true);
  return (data ?? []).map((s) => s.id);
}

async function shouldSendReminder(
  schoolId: string,
  reminderType: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('subscription_reminder_log')
    .select('id')
    .eq('school_id', schoolId)
    .eq('reminder_type', reminderType)
    .eq('reminder_date', today)
    .maybeSingle();
  return !data;
}

async function markReminderSent(schoolId: string, reminderType: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('subscription_reminder_log').upsert(
    { school_id: schoolId, reminder_type: reminderType, reminder_date: today },
    { onConflict: 'school_id,reminder_type,reminder_date' }
  );
}

/** Run on admin login / periodic — trial ending, subscription ending, overdue. */
export async function runSubscriptionDeadlineChecks(schoolId: string): Promise<void> {
  const status = await getSchoolSubscriptionStatus(schoolId);
  const adminIds = await getAdminStaffIds(schoolId);
  if (adminIds.length === 0) return;

  const now = new Date();

  if (status.isTrial && status.trialEndsAt) {
    const trialEnd = new Date(status.trialEndsAt);
    const daysLeft = status.daysRemaining;

    if (daysLeft <= 7 && daysLeft >= 0) {
      const type = daysLeft === 0 ? 'overdue' : 'due_soon';
      if (await shouldSendReminder(schoolId, `trial_${type}`)) {
        await notificationTriggerService.onSubscriptionPaymentEvent(
          schoolId,
          adminIds,
          [],
          type === 'overdue' ? 'overdue' : 'due_soon',
          'Free trial',
          trialEnd.toLocaleDateString(),
          0
        );
        await markReminderSent(schoolId, `trial_${type}`);
      }
    }

    if (trialEnd < now && status.subscriptionStatus !== 'active') {
      await supabase
        .from('schools')
        .update({ subscription_status: 'expired', updated_at: now.toISOString() })
        .eq('id', schoolId);
    }
  }

  if (status.activePlan && status.activeEndDate) {
    const end = new Date(status.activeEndDate);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

    if (daysLeft <= 14 && daysLeft >= 0) {
      const eventType = daysLeft <= 0 ? 'overdue' : daysLeft <= 7 ? 'renewal_reminder' : 'due_soon';
      if (await shouldSendReminder(schoolId, `sub_${eventType}`)) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('amount, plan')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        await notificationTriggerService.onSubscriptionPaymentEvent(
          schoolId,
          adminIds,
          [],
          eventType,
          sub?.plan ?? status.activePlan,
          end.toLocaleDateString(),
          Number(sub?.amount ?? 0)
        );
        await markReminderSent(schoolId, `sub_${eventType}`);
      }
    }

    if (end < now) {
      await supabase
        .from('subscriptions')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('school_id', schoolId)
        .eq('status', 'active');

      await supabase
        .from('schools')
        .update({ subscription_status: 'expired', updated_at: now.toISOString() })
        .eq('id', schoolId);
    }
  }
}

export async function notifySubscriptionActivated(
  schoolId: string,
  planName: string,
  amount: number
): Promise<void> {
  const { notificationService } = await import('./notificationService');
  const adminIds = await getAdminStaffIds(schoolId);
  for (const adminId of adminIds) {
    await notificationService.sendNotification({
      schoolId,
      recipientId: adminId,
      recipientRole: 'admin',
      notificationType: 'fee_alert',
      title: 'Subscription activated',
      message: `${planName} plan is now active. Amount paid: ₦${amount.toLocaleString()}.`,
      priority: 'high',
      actionUrl: '/admin/subscriptions',
      deliveryChannels: ['in_app'],
    });
  }
}
