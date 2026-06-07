import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { dashboardPathForRole } from '@/config/routeAccess';
import { useDutyAssignment } from '@/hooks/useDutyAssignment';

/** Blocks duty attendance unless the user manages rosters or is assigned this week. */
export default function DutyRouteGuard({ children }: { children: ReactNode }) {
  const { user } = useAppStore();
  const { showDutyFeatures, loading } = useDutyAssignment();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader className="w-8 h-8 animate-spin text-secondary-text" />
      </div>
    );
  }

  if (!showDutyFeatures) {
    return <Navigate to={dashboardPathForRole(user?.role)} replace />;
  }

  return <>{children}</>;
}
