import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Loader, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { dutyAttendanceService, type DutyRoster } from '@/services/dutyAttendanceService';

interface OnDutyWidgetProps {
  schoolId: string;
}

export default function OnDutyWidget({ schoolId }: OnDutyWidgetProps) {
  const [roster, setRoster] = useState<DutyRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = dutyAttendanceService.weekStartFor(today);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    dutyAttendanceService.getRosterForWeek(schoolId, weekStart).then((rows) => {
      setRoster(rows);
      setLoading(false);
    });
  }, [schoolId, weekStart]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">Teachers on Duty</h3>
        </div>
        <Link
          to="/duty-attendance"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
        >
          View duty <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <p className="text-xs text-secondary-text mb-3">
        Week of {new Date(weekStart).toLocaleDateString()}
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader className="w-5 h-5 animate-spin" />
        </div>
      ) : roster.length === 0 ? (
        <p className="text-sm text-secondary-text py-4 text-center">
          No duty teachers assigned this week
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roster.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/25 text-sm font-medium text-blue-800 dark:text-blue-200"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {r.staff_name || 'Staff'}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
