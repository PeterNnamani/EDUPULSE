import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, UserX, AlertTriangle, Loader, RefreshCw, Eye } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  teacherActivityService,
  TeacherActivityRow,
  TeacherSummary,
} from '@/services/teacherActivityService';
import {
  buildPreviewParamsFromActivityRow,
  canPreviewActivityRow,
} from '@/services/notificationPreviewService';
import NotificationPreviewModal from '@/components/NotificationPreviewModal';

const ACTION_LABELS: Record<string, string> = {
  attendance_submitted: 'submitted attendance',
  results_uploaded: 'uploaded results',
  grade_recorded: 'recorded a grade',
  assignment_created: 'created an assignment',
  behaviour_recorded: 'recorded behaviour',
  intervention_created: 'created an intervention',
  parent_communication: 'contacted a parent',
  login: 'logged in',
  logout: 'logged out',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TeacherActivityPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<TeacherActivityRow[]>([]);
  const [weekly, setWeekly] = useState<TeacherSummary[]>([]);
  const [inactive, setInactive] = useState<Array<{ staffId: string; staffName: string }>>([]);
  const [missing, setMissing] = useState<
    Array<{ classId: string; className: string; teacherName: string }>
  >([]);
  const [previewRow, setPreviewRow] = useState<TeacherActivityRow | null>(null);

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [t, w, i, m] = await Promise.all([
      teacherActivityService.getDailyActivity(schoolId),
      teacherActivityService.getWeeklySummary(schoolId),
      teacherActivityService.getInactiveTeachers(schoolId, 7),
      teacherActivityService.getMissingAttendanceToday(schoolId),
    ]);
    setToday(t);
    setWeekly(w);
    setInactive(i);
    setMissing(m);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-secondary-text">Loading teacher activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teacher Activity</h1>
          <p className="text-secondary-text">
            Live feed of what your staff are doing. Click <strong>View details</strong> on any row
            to preview attendance, grades, assignments, or behaviour records.
          </p>
        </div>
        <button onClick={() => void load()} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most active */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold">Most Active (7 days)</h2>
          </div>
          {weekly.length === 0 ? (
            <p className="text-sm text-secondary-text">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {weekly.slice(0, 5).map((t) => (
                <li key={t.staffId} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.staffName}</span>
                  <span className="text-sm text-secondary-text">{t.count} actions</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Inactive */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold">Inactive Teachers (7 days)</h2>
          </div>
          {inactive.length === 0 ? (
            <p className="text-sm text-secondary-text">All teachers have been active.</p>
          ) : (
            <ul className="space-y-3">
              {inactive.map((t) => (
                <li key={t.staffId} className="text-sm font-medium">
                  {t.staffName || 'Unknown'}
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Missing tasks */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold">Missing Attendance Today</h2>
          </div>
          {missing.length === 0 ? (
            <p className="text-sm text-secondary-text">All classes have marked attendance.</p>
          ) : (
            <ul className="space-y-3">
              {missing.map((m) => (
                <li key={m.classId} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{m.className}</span>
                  <span className="text-xs text-secondary-text">{m.teacherName}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>

      {/* Today's feed */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5" />
          <h2 className="font-semibold">Today's Activity ({today.length})</h2>
        </div>
        {today.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="w-10 h-10 text-secondary-text mx-auto mb-2 opacity-50" />
            <p className="text-secondary-text">No activity recorded today yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border dark:divide-gray-800">
            {today.map((row) => (
              <li key={row.id} className="py-3 flex items-center justify-between gap-3">
                <span className="text-sm">
                  <span className="font-medium">{row.staff_name || 'A staff member'}</span>{' '}
                  {ACTION_LABELS[row.action] || row.action}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {canPreviewActivityRow(row) && (
                    <button
                      type="button"
                      onClick={() => setPreviewRow(row)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View details
                    </button>
                  )}
                  <span className="text-xs text-secondary-text whitespace-nowrap">
                    {timeAgo(row.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <NotificationPreviewModal
        directPreview={
          previewRow
            ? {
                title: `${previewRow.staff_name || 'Staff'} — ${ACTION_LABELS[previewRow.action] || previewRow.action}`,
                message: `Recorded ${timeAgo(previewRow.created_at)}`,
                params: buildPreviewParamsFromActivityRow(previewRow),
              }
            : null
        }
        onClose={() => setPreviewRow(null)}
      />
    </div>
  );
}
