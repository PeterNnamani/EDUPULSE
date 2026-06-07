import { supabase } from '@/lib/supabase';
import { notificationTriggerService } from './notificationTriggerService';
import { withTimeout } from '@/utils/withTimeout';
import {
  normalizePlan,
  getPlanDefinition,
  planTierRank,
  type FeatureKey,
  type PlanTier,
  PLAN_DEFINITIONS,
} from '@/config/planFeatures';

type SubscriptionRow = {
  id?: string;
  plan: string;
  end_date: string;
  status: string;
  created_at?: string;
  amount?: number;
};

export type ActivePaidPlan = {
  tier: PlanTier;
  plan: string;
  endDate: string;
  daysRemaining: number;
};

export interface SchoolSubscriptionStatus {
  schoolId: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended';
  trialEndsAt: string | null;
  daysRemaining: number;
  isTrial: boolean;
  isExpired: boolean;
  /** Highest-tier plan currently in effect (features follow this). */
  activePlan: string | null;
  activeEndDate: string | null;
  /** All paid plans still within their paid period. */
  activePaidPlans: ActivePaidPlan[];
  label: string;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSubscriptionCurrent(sub: Pick<SubscriptionRow, 'end_date' | 'status'>, now = new Date()): boolean {
  if (sub.status !== 'active') return false;
  return endOfDay(sub.end_date) >= now;
}

function daysUntil(dateStr: string, now = new Date()): number {
  return Math.max(0, Math.ceil((endOfDay(dateStr).getTime() - now.getTime()) / 86400000));
}

function filterCurrentSubscriptions(subs: SubscriptionRow[] | null | undefined): SubscriptionRow[] {
  const now = new Date();
  return (subs ?? []).filter((sub) => isSubscriptionCurrent(sub, now));
}

/** Pick the effective plan: highest tier among subscriptions still in their paid window. */
export function pickBestActiveSubscription(
  subs: SubscriptionRow[] | null | undefined
): SubscriptionRow | null {
  const current = filterCurrentSubscriptions(subs);
  if (!current.length) return null;
  return current.reduce((best, row) => {
    const bestRank = planTierRank(best.plan);
    const rowRank = planTierRank(row.plan);
    if (rowRank !== bestRank) return rowRank > bestRank ? row : best;

    const bestEnd = endOfDay(best.end_date).getTime();
    const rowEnd = endOfDay(row.end_date).getTime();
    if (rowEnd !== bestEnd) return rowEnd > bestEnd ? row : best;

    const bestCreated = new Date(best.created_at ?? 0).getTime();
    const rowCreated = new Date(row.created_at ?? 0).getTime();
    return rowCreated > bestCreated ? row : best;
  });
}

/** One slot per tier — longest end date wins when the same plan was paid more than once. */
export function buildActivePaidPlanSlots(subs: SubscriptionRow[] | null | undefined): ActivePaidPlan[] {
  const now = new Date();
  const byTier = new Map<PlanTier, ActivePaidPlan>();

  for (const sub of filterCurrentSubscriptions(subs)) {
    const tier = normalizePlan(sub.plan);
    const slot: ActivePaidPlan = {
      tier,
      plan: sub.plan,
      endDate: sub.end_date,
      daysRemaining: daysUntil(sub.end_date, now),
    };
    const existing = byTier.get(tier);
    if (!existing || endOfDay(slot.endDate) > endOfDay(existing.endDate)) {
      byTier.set(tier, slot);
    }
  }

  return Array.from(byTier.values()).sort((a, b) => planTierRank(b.tier) - planTierRank(a.tier));
}

/** Mark individual subscriptions past end_date as expired; keep others active. */
export async function expireEndedSubscriptions(schoolId: string): Promise<void> {
  const now = new Date();
  const { data: activeSubs, error: activeSubsError } = await supabase
    .from('subscriptions')
    .select('id, end_date')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  if (activeSubsError) {
    console.error('[subscription] Failed to load active subscriptions:', activeSubsError);
    return;
  }

  const endedIds = (activeSubs ?? [])
    .filter((sub) => endOfDay(sub.end_date) < now)
    .map((sub) => sub.id);

  if (endedIds.length > 0) {
    const { error: expireError } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .in('id', endedIds);

    if (expireError) {
      console.error('[subscription] Failed to expire subscriptions:', expireError);
      return;
    }
  }

  const { data: stillActive, error: stillActiveError } = await supabase
    .from('subscriptions')
    .select('id, plan, end_date, status')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  if (stillActiveError) {
    console.error('[subscription] Failed to reload active subscriptions:', stillActiveError);
    return;
  }

  const hasCurrent = filterCurrentSubscriptions(stillActive).length > 0;
  const nextStatus = hasCurrent ? 'active' : 'expired';

  const { error: schoolUpdateError } = await supabase
    .from('schools')
    .update({ subscription_status: nextStatus, updated_at: now.toISOString() })
    .eq('id', schoolId);

  if (schoolUpdateError) {
    console.error('[subscription] Failed to update school subscription status:', schoolUpdateError);
  }
}

export async function getSchoolSubscriptionStatus(schoolId: string): Promise<SchoolSubscriptionStatus> {
  try {
    await withTimeout(expireEndedSubscriptions(schoolId), 12_000, 'Subscription check timed out');
  } catch (error) {
    console.warn('[subscription] Skipping expiry sync:', error);
  }

  const { data: school } = await supabase
    .from('schools')
    .select('id, subscription_status, trial_ends_at')
    .eq('id', schoolId)
    .maybeSingle();

  const { data: activeSubs } = await supabase
    .from('subscriptions')
    .select('id, plan, end_date, status, created_at')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  const activePaidPlans = buildActivePaidPlanSlots(activeSubs);
  const activeSub = pickBestActiveSubscription(activeSubs);

  const now = new Date();
  const trialEnds = school?.trial_ends_at ? new Date(school.trial_ends_at) : null;
  const subEnd = activeSub?.end_date ? endOfDay(activeSub.end_date) : null;

  let daysRemaining = 0;
  let label = 'No active subscription';
  const status = (school?.subscription_status as SchoolSubscriptionStatus['subscriptionStatus']) ?? 'trial';
  const isTrial = activePaidPlans.length === 0 && (status === 'trial' || !!trialEnds);
  const deadline = isTrial ? trialEnds : subEnd;

  if (deadline) {
    daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86400000));
    if (isTrial) {
      label =
        daysRemaining === 0
          ? 'Trial ends today'
          : `Trial — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else if (activeSub) {
      const tier = normalizePlan(activeSub.plan);
      const planName = PLAN_DEFINITIONS[tier].name;
      if (activePaidPlans.length > 1) {
        const others = activePaidPlans
          .filter((p) => p.tier !== tier)
          .map((p) => PLAN_DEFINITIONS[p.tier].name)
          .join(', ');
        label = `${planName} in effect — also active: ${others}`;
      } else {
        label = `${planName} plan — active until ${deadline.toLocaleDateString()}`;
      }
    }
  }

  const isExpired =
    status === 'expired' ||
    status === 'suspended' ||
    (isTrial && trialEnds && trialEnds < now) ||
    (activePaidPlans.length === 0 && !isTrial && status !== 'trial');

  return {
    schoolId,
    subscriptionStatus: isExpired ? 'expired' : activePaidPlans.length > 0 || isTrial ? status : 'expired',
    trialEndsAt: school?.trial_ends_at ?? null,
    daysRemaining,
    isTrial,
    isExpired,
    activePlan: activeSub?.plan ?? null,
    activeEndDate: activeSub?.end_date ?? null,
    activePaidPlans,
    label,
  };
}

/** Resolve effective plan tier from subscription status (server source of truth). */
export function resolvePlanTierFromStatus(status: SchoolSubscriptionStatus): PlanTier {
  if (status.activePlan) {
    return normalizePlan(status.activePlan);
  }
  if (status.isTrial && !status.isExpired) {
    return 'enterprise_plus';
  }
  return 'starter';
}

/** Verify a feature against live subscription data — used by FeatureGate. */
export async function schoolHasFeature(schoolId: string, feature: FeatureKey): Promise<boolean> {
  const status = await getSchoolSubscriptionStatus(schoolId);
  const tier = resolvePlanTierFromStatus(status);
  return getPlanDefinition(tier).features[feature];
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
  await expireEndedSubscriptions(schoolId);
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

    if (trialEnd < now && status.activePaidPlans.length === 0) {
      await supabase
        .from('schools')
        .update({ subscription_status: 'expired', updated_at: now.toISOString() })
        .eq('id', schoolId);
    }
  }

  if (status.activePlan && status.activeEndDate) {
    const end = endOfDay(status.activeEndDate);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

    if (daysLeft <= 14 && daysLeft >= 0) {
      const eventType = daysLeft <= 0 ? 'overdue' : daysLeft <= 7 ? 'renewal_reminder' : 'due_soon';
      if (await shouldSendReminder(schoolId, `sub_${eventType}`)) {
        const { data: activeSubs } = await supabase
          .from('subscriptions')
          .select('amount, plan, end_date, created_at, status')
          .eq('school_id', schoolId)
          .eq('status', 'active');

        const sub = pickBestActiveSubscription(activeSubs);

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
