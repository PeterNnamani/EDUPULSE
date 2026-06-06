import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';
import { type FeatureKey } from '@/config/planFeatures';
import { type UserRole } from '@/types';
import { dashboardPathForRole, isRoleAllowed } from '@/config/routeAccess';
import FeatureGate from '@/components/FeatureGate';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  feature?: FeatureKey;
  children: ReactNode;
}

/**
 * Enforces role-based access before rendering a page.
 * Optional feature flag is verified server-side inside FeatureGate.
 */
export default function ProtectedRoute({ allowedRoles, feature, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAppStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isRoleAllowed(user.role, allowedRoles)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  if (feature) {
    return <FeatureGate feature={feature}>{children}</FeatureGate>;
  }

  return <>{children}</>;
}
