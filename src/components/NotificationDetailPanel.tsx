import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Clock, Archive, CheckCircle2, Bell } from 'lucide-react';
import type { Notification } from '@/services/notificationService';
import { useNotificationPreview } from '@/hooks/useNotificationPreview';
import NotificationPreviewBody from '@/components/NotificationPreviewBody';
import {
  buildNotificationDetailRows,
  formatFullNotificationTime,
  parseMessageDetails,
} from '@/utils/notificationDetailUtils';

interface NotificationDetailPanelProps {
  notification: Notification | null;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  formatTime?: (dateString: string) => string;
  getPriorityColor?: (priority: string) => string;
}

const defaultFormatTime = (dateString: string) => {
  const date = new Date(dateString);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return date.toLocaleDateString();
};

export default function NotificationDetailPanel({
  notification,
  onClose,
  onMarkAsRead,
  onArchive,
  formatTime = defaultFormatTime,
  getPriorityColor,
}: NotificationDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { loading, preview, error, title, message } = useNotificationPreview(
    notification,
    null,
    Boolean(notification)
  );

  useEffect(() => {
    if (!notification) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notification, onClose]);

  const priorityClass =
    getPriorityColor?.(notification?.priority ?? 'low') ??
    'bg-gray-100 text-gray-800 border-gray-300';

  const metaRows = notification ? buildNotificationDetailRows(notification) : [];
  const parsedDetails = notification ? parseMessageDetails(notification.message) : [];
  const hasRichPreview = Boolean(preview && (preview.rows.length > 0 || preview.tableRows?.length));

  return (
    <AnimatePresence>
      {notification && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/25 dark:bg-black/40"
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={notification.title}
            initial={{ opacity: 0, x: 40, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="fixed z-[70] right-3 sm:right-6 top-20 w-[min(100vw-1.5rem,21rem)] pointer-events-auto"
          >
            <div
              className={`relative flex flex-col max-h-[min(72vh,calc(100vh-5.5rem))] rounded-2xl shadow-2xl border overflow-hidden ${getBubbleShellClass(notification.priority)}`}
            >
              <div
                className="absolute -left-2 top-7 w-3.5 h-3.5 rotate-45 border-l border-b border-inherit bg-inherit hidden sm:block"
                aria-hidden
              />

              <div className="px-3.5 py-3 border-b border-black/5 dark:border-white/10 flex items-start gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-full bg-white/80 dark:bg-dark-elevated flex items-center justify-center shrink-0 shadow-sm">
                  <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full border ${priorityClass}`}
                    >
                      {notification.priority}
                    </span>
                    {notification.status === 'unread' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-blue-600 text-white">
                        New
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-dark-text leading-snug">
                    {title}
                  </h2>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-600 dark:text-dark-muted">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span title={formatFullNotificationTime(notification.createdAt)}>
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-dark-muted shrink-0"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto overflow-x-hidden min-h-0 px-3.5 py-3 space-y-2.5">
                <div className="rounded-xl bg-white/75 dark:bg-dark-card/85 border border-white/60 dark:border-dark-border px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted mb-1">
                    Message
                  </p>
                  <p className="text-xs text-gray-800 dark:text-dark-text leading-relaxed whitespace-pre-wrap">
                    {message}
                  </p>
                </div>

                <div className="rounded-xl bg-white/60 dark:bg-dark-card/70 border border-white/50 dark:border-dark-border px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted mb-2">
                    Details
                  </p>
                  <div className="space-y-1.5">
                    {metaRows.map((row) => (
                      <DetailRow key={row.label} label={row.label} value={row.value} />
                    ))}
                    {parsedDetails.map((row) => (
                      <DetailRow key={`parsed-${row.label}`} label={row.label} value={row.value} />
                    ))}
                  </div>
                </div>

                {(loading || preview || error) && (
                  <div className="rounded-xl bg-white/60 dark:bg-dark-card/70 border border-white/50 dark:border-dark-border px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-2">
                      {hasRichPreview ? 'Related records' : 'Activity preview'}
                    </p>
                    <NotificationPreviewBody
                      loading={loading}
                      error={error}
                      preview={preview}
                      onNavigateAway={onClose}
                      emptyHint={loading ? 'Loading related data…' : undefined}
                      variant="bubble"
                      maxTableRows={5}
                    />
                  </div>
                )}
              </div>

              <div className="px-3.5 py-2.5 border-t border-black/5 dark:border-white/10 flex items-center gap-2 shrink-0 bg-white/40 dark:bg-dark-elevated/40">
                {notification.status === 'unread' && onMarkAsRead && (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(notification.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark read
                  </button>
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(notification.id)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-muted hover:opacity-90 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-gray-500 dark:text-dark-muted shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-dark-text font-medium text-right break-words">
        {value}
      </span>
    </div>
  );
}

function getBubbleShellClass(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50';
    case 'high':
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40';
    case 'medium':
      return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30';
    default:
      return 'bg-blue-50 dark:bg-dark-card border-blue-100 dark:border-dark-border';
  }
}
