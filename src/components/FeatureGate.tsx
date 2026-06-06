import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader, ArrowRight } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { type FeatureKey } from '@/config/planFeatures';

interface Props {
  feature: FeatureKey;
  children: ReactNode;
  /** When true, render nothing instead of an upgrade prompt (useful for nav). */
  silent?: boolean;
  fallback?: ReactNode;
}

/**
 * Gate a page or section behind a plan feature. If the school's plan does not
 * include the feature, an upgrade prompt (or a custom/silent fallback) is shown.
 */
export default function FeatureGate({ feature, children, silent, fallback }: Props) {
  const { loading, hasFeature, plan } = useFeatureAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (hasFeature(feature)) return <>{children}</>;

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
