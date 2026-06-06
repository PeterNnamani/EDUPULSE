import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getSchoolSubscriptionStatus } from '@/services/subscriptionService';
import {
  getPlanDefinition,
  normalizePlan,
  type FeatureKey,
  type PlanDefinition,
  type PlanTier,
} from '@/config/planFeatures';

interface FeatureAccess {
  loading: boolean;
  plan: PlanDefinition;
  tier: PlanTier;
  isTrial: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  maxStudents: number;
}

// Simple module-level cache so nav + multiple gates don't refetch repeatedly.
const cache = new Map<string, { tier: PlanTier; isTrial: boolean }>();

export function clearFeatureAccessCache(schoolId?: string) {
  if (schoolId) cache.delete(schoolId);
  else cache.clear();
}

/** Clear cache and refetch plan features across the app (e.g. after subscription payment). */
export function refreshFeatureAccess(schoolId?: string) {
  clearFeatureAccessCache(schoolId);
  useAppStore.getState().bumpFeatureAccess();
}

export function useFeatureAccess(): FeatureAccess {
  const { user, activePlanTier, featureAccessNonce, setActivePlanTier } = useAppStore();
  const schoolId = user?.schoolId;

  const [state, setState] = useState<{ tier: PlanTier; isTrial: boolean } | null>(
    schoolId ? cache.get(schoolId) ?? null : null
  );
  const [loading, setLoading] = useState(!state && !activePlanTier);

  useEffect(() => {
    let active = true;
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cached = cache.get(schoolId);
    if (cached) {
      setState(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    getSchoolSubscriptionStatus(schoolId)
      .then((status) => {
        if (!active) return;
        let tier: PlanTier;
        if (status.activePlan) {
          tier = normalizePlan(status.activePlan);
        } else if (status.isTrial && !status.isExpired) {
          tier = 'enterprise_plus';
        } else {
          tier = 'starter';
        }
        const resolved = { tier, isTrial: status.isTrial };
        cache.set(schoolId, resolved);
        setState(resolved);
        setActivePlanTier(null);
      })
      .catch(() => {
        if (active) setState({ tier: 'starter', isTrial: false });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [schoolId, featureAccessNonce, setActivePlanTier]);

  const fetchedTier = state?.tier ?? 'starter';
  const tier = activePlanTier ?? fetchedTier;
  const isTrial = activePlanTier ? false : (state?.isTrial ?? false);
  const plan = getPlanDefinition(tier);

  return {
    loading: loading && !activePlanTier,
    plan,
    tier,
    isTrial,
    hasFeature: (feature: FeatureKey) => plan.features[feature],
    maxStudents: plan.maxStudents,
  };
}
