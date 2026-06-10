import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getSchoolSubscriptionStatus, resolvePlanTierFromStatus } from '@/services/subscriptionService';
import {
  getPlanDefinition,
  PLAN_DEFINITIONS,
  type FeatureKey,
  type PlanDefinition,
  type PlanTier,
} from '@/config/planFeatures';

interface FeatureAccess {
  /** True once the live subscription tier has been fetched for this school. */
  resolved: boolean;
  /** True while fetching subscription tier (includes unresolved state). */
  loading: boolean;
  plan: PlanDefinition;
  tier: PlanTier;
  isTrial: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  maxStudents: number;
}

const STARTER_PLAN = PLAN_DEFINITIONS.starter;

// Cache last successful fetch per school (used after resolve, never shown before fetch).
const cache = new Map<string, { tier: PlanTier; isTrial: boolean }>();
const inflight = new Map<string, Promise<{ tier: PlanTier; isTrial: boolean }>>();

async function fetchPlanForSchool(schoolId: string): Promise<{ tier: PlanTier; isTrial: boolean }> {
  const pending = inflight.get(schoolId);
  if (pending) return pending;

  const promise = getSchoolSubscriptionStatus(schoolId)
    .then((status) => {
      const tier = resolvePlanTierFromStatus(status);
      const result = { tier, isTrial: status.isTrial };
      cache.set(schoolId, result);
      return result;
    })
    .catch(() => {
      const fallback = { tier: 'starter' as PlanTier, isTrial: false };
      cache.set(schoolId, fallback);
      return fallback;
    })
    .finally(() => {
      inflight.delete(schoolId);
    });

  inflight.set(schoolId, promise);
  return promise;
}

export function clearFeatureAccessCache(schoolId?: string) {
  if (schoolId) {
    cache.delete(schoolId);
    inflight.delete(schoolId);
  } else {
    cache.clear();
    inflight.clear();
  }
}

/** Clear cache and refetch plan features across the app (e.g. after subscription payment). */
export function refreshFeatureAccess(schoolId?: string) {
  clearFeatureAccessCache(schoolId);
  useAppStore.getState().bumpFeatureAccess();
}

export function useFeatureAccess(): FeatureAccess {
  const { user, featureAccessNonce } = useAppStore();
  const schoolId = user?.schoolId;

  const [state, setState] = useState<{ tier: PlanTier; isTrial: boolean } | null>(null);
  const [loading, setLoading] = useState(!!schoolId);

  useEffect(() => {
    let active = true;

    if (!schoolId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setState(null);

    void fetchPlanForSchool(schoolId).then((result) => {
      if (!active) return;
      setState(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [schoolId, featureAccessNonce]);

  const resolved = !!schoolId && !loading && state !== null;
  const tier = resolved ? state!.tier : 'starter';
  const isTrial = resolved ? state!.isTrial : false;
  const plan = resolved ? getPlanDefinition(tier) : STARTER_PLAN;

  const hasFeature = (feature: FeatureKey): boolean => {
    if (!resolved) return STARTER_PLAN.features[feature];
    return getPlanDefinition(tier).features[feature];
  };

  return {
    resolved,
    loading,
    plan,
    tier,
    isTrial,
    hasFeature,
    maxStudents: plan.maxStudents,
  };
}
