import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { dutyAttendanceService } from '@/services/dutyAttendanceService';

/** Whether the signed-in user may see duty attendance UI (roster managers or assigned this week). */
export function useDutyAssignment() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;
  const staffId = user?.id;
  const canManageRoster = user?.role === 'admin' || user?.role === 'principal';
  const [isOnDuty, setIsOnDuty] = useState(canManageRoster);
  const [loading, setLoading] = useState(!canManageRoster);

  useEffect(() => {
    if (!schoolId || !staffId) {
      setIsOnDuty(false);
      setLoading(false);
      return;
    }

    if (canManageRoster) {
      setIsOnDuty(true);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const weekStart = dutyAttendanceService.weekStartFor(new Date().toISOString().slice(0, 10));
    void dutyAttendanceService.isStaffOnDuty(schoolId, staffId, weekStart).then((onDuty) => {
      if (!active) return;
      setIsOnDuty(onDuty);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [schoolId, staffId, canManageRoster]);

  return {
    isOnDuty,
    canManageRoster,
    loading,
    /** Show duty nav, page, and personal duty widgets. */
    showDutyFeatures: canManageRoster || isOnDuty,
  };
}
