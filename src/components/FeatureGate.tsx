import { type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader, ArrowRight } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAppStore } from '@/store';
import { schoolHasFeature } from '@/services/subscriptionService';
import { type FeatureKey } from '@/config/planFeatures';

interface Props {
  feature: FeatureKey;
  children: ReactNode;
  /** When true, render nothing instead of an upgrade prompt (useful for nav). */
  silent?: boolean;
  fallback?: ReactNode;
}

/**
 * Gate a page or section behind a plan feature.
 * Verifies entitlement against live subscription data (not client store overrides).
 */
export default function FeatureGate({ feature, children, silent, fallback }: Props) {
  const { user, featureAccessNonce } = useAppStore();
  const { loading, hasFeature, plan } = useFeatureAccess();
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.schoolId) {
      setServerVerified(false);
      return;
    }

    let active = true;
    setServerVerified(null);
    schoolHasFeature(user.schoolId, feature)
      .then((allowed) => {
        if (active) setServerVerified(allowed);
      })
      .catch(() => {
        if (active) setServerVerified(false);
      });

    return () => {
      active = false;
    };
  }, [user?.schoolId, feature, featureAccessNonce]);

  if (loading || serverVerified === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const allowed = hasFeature(feature) && serverVerified;
  if (allowed) return <>{children}</>;

  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex items-center justify-center py-16">
      <div className="card max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-secondary-text" />
        </div>
        <h2 className="text-xl font-bold mb-2">Feature not available on {plan.name}</h2>
        <p className="text-secondary-text mb-6">
          This feature requires a higher plan. Upgrade your subscription to unlock it for your school.
        </p>
        <Link to="/admin/subscriptions" className="btn-primary inline-flex items-center gap-2">
          View plans <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
