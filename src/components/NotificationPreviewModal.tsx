import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  loadNotificationPreview,
  resolvePreviewParams,
  type NotificationPreviewData,
} from '@/services/notificationPreviewService';
import type { Notification } from '@/services/notificationService';

export interface DirectPreviewInput {
  title: string;
  message: string;
  params: URLSearchParams;
}

interface NotificationPreviewModalProps {
  notification?: Notification | null;
  directPreview?: DirectPreviewInput | null;
  onClose: () => void;
}

export default function NotificationPreviewModal({
  notification = null,
  directPreview = null,
  onClose,
}: NotificationPreviewModalProps) {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<NotificationPreviewData | null>(null);
  const [error, setError] = useState('');

  const open = Boolean(notification || directPreview);
  const title = directPreview?.title ?? notification?.title ?? 'Activity preview';
  const message = directPreview?.message ?? notification?.message ?? '';

  useEffect(() => {
    if (!open || !user?.schoolId) {
      setPreview(null);
      setError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setPreview(null);

      try {
        const params = directPreview
          ? directPreview.params
          : notification
            ? await resolvePreviewParams(user.schoolId, notification)
            : null;

        if (!params) {
          if (!cancelled) {
            setError(
              'No detailed preview for this notification. Check Teacher Activity for the full feed.'
            );
          }
          return;
        }

        const data = await loadNotificationPreview(user.schoolId, params);
        if (cancelled) return;
        if (!data) setError('Could not load preview data.');
        else setPreview(data);
      } catch {
        if (!cancelled) setError('Failed to load preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, notification, directPreview, user?.schoolId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-dark-bg rounded-2xl shadow-xl flex flex-col"
      >
        <div className="p-5 border-b border-border dark:border-gray-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
              <Eye className="w-4 h-4" />
              Activity preview
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
            {message && <p className="text-sm text-secondary-text mt-1">{message}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-secondary-bg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-7 h-7 animate-spin" />
            </div>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Link
                to="/admin/teacher-activity"
                onClick={onClose}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Teacher Activity page →
              </Link>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base">{preview.title}</h3>
                {preview.summary && (
                  <p className="text-sm text-secondary-text mt-1">{preview.summary}</p>
                )}
              </div>

              {preview.rows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {preview.rows.map((row) => (
                    <div
                      key={row.label}
                      className="p-3 rounded-lg bg-secondary-bg dark:bg-dark-card"
                    >
                      <p className="text-xs text-secondary-text">{row.label}</p>
                      <p className="text-sm font-medium mt-0.5 break-words">{row.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {preview.tableHeaders && preview.tableRows && preview.tableRows.length > 0 && (
                <div className="overflow-x-auto border border-border dark:border-gray-800 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary-bg dark:bg-dark-card">
                        {preview.tableHeaders.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.tableRows.map((row, i) => (
                        <tr key={i} className="border-t border-border dark:border-gray-800">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2">
                              {preview.tableStatusColumn === j ? (
                                <AttendanceStatusBadge status={cell} />
                              ) : (
                                <span className={j === 1 ? 'font-medium' : ''}>{cell}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.type === 'attendance_submitted' &&
                (!preview.tableRows || preview.tableRows.length === 0) && (
                  <p className="text-sm text-secondary-text">
                    No students were found for this class on the selected date.
                  </p>
                )}
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-border dark:border-gray-800 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AttendanceStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    present: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    absent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'not marked': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const className =
    styles[normalized] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
}

export { canPreviewNotification, canPreviewNotification as hasNotificationPreview } from '@/services/notificationPreviewService';
