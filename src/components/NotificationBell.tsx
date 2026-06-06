import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Bell, Check, Archive, X, Clock, AlertTriangle, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useInAppNotifications } from '@/contexts/InAppNotificationContext';
import type { Notification } from '@/services/notificationService';
import NotificationPreviewModal, { hasNotificationPreview } from '@/components/NotificationPreviewModal';

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<Notification | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    archive,
    loginToasts,
    dismissLoginToast,
    refetch,
  } = useInAppNotifications();

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      await markAsRead(notificationId);
      refetch();
    },
    [markAsRead, refetch]
  );

  const handleArchive = useCallback(
    async (notificationId: string) => {
      await archive(notificationId);
      refetch();
    },
    [archive, refetch]
  );

  const closePanel = useCallback(() => setShowPanel(false), []);

  // Close panel when clicking outside or when focus leaves the notification area
  useEffect(() => {
    if (!showPanel) return;

    const isInside = (target: EventTarget | null) => {
      const node = target as Node | null;
      if (!node) return false;
      return (
        panelRef.current?.contains(node) ||
        bellButtonRef.current?.contains(node) ||
        containerRef.current?.contains(node)
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isInside(e.target)) closePanel();
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (!isInside(e.target)) closePanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPanel, closePanel]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Animated toast bubbles — auto-dismiss after 5s via context */}
      <AnimatePresence>
        {loginToasts.map((notification, index) => (
          <motion.div
            key={`toast-${notification.id}`}
            initial={{ opacity: 0, y: -24, x: 40, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              x: 0,
              scale: 1,
            }}
            exit={{ opacity: 0, y: -16, x: 48, scale: 0.92 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 26,
              delay: index * 0.06,
            }}
            className={`absolute right-0 z-[60] w-80 p-4 rounded-xl shadow-xl border pointer-events-auto ${getPriorityBubbleColor(notification.priority)}`}
            style={{ top: `${3.5 + index * 5.75}rem` }}
          >
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(59,130,246,0)', '0 0 0 6px rgba(59,130,246,0.15)', '0 0 0 0 rgba(59,130,246,0)'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-xl pointer-events-none"
            />
            <div className="flex items-start gap-3 relative">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.5, repeat: 2, repeatDelay: 1 }}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {notification.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {notification.message}
                </p>
                {hasNotificationPreview(notification) && (
                  <p className="text-[11px] text-green-700 dark:text-green-400 mt-1.5">
                    Tap View details to see attendance, grades, or duty records.
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {hasNotificationPreview(notification) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewNotification(notification);
                        dismissLoginToast(notification.id);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Eye className="w-3.5 h-3.5" /> View details
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void handleMarkAsRead(notification.id);
                      dismissLoginToast(notification.id);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mark read
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissLoginToast(notification.id)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissLoginToast(notification.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setShowPanel((open) => !open)}
        className="relative p-2 text-gray-700 dark:text-dark-icon hover:text-gray-900 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-elevated rounded-lg transition-colors"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={showPanel}
      >
        <motion.div
          animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 0] } : {}}
          transition={{ duration: 0.6, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 3 }}
        >
          <Bell size={24} />
        </motion.div>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white dark:bg-dark-card rounded-lg shadow-xl dark:shadow-dark-elevated z-50 flex flex-col border border-border dark:border-dark-border"
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-dark-text">Notifications</h3>
              <button
                type="button"
                onClick={closePanel}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-dark-border">
                  {notifications.map((notification, index) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      index={index}
                      onRead={handleMarkAsRead}
                    onArchive={handleArchive}
                    onNavigate={closePanel}
                    onPreview={(n) => {
                      setPreviewNotification(n);
                      closePanel();
                    }}
                  />
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-border">
              <Link
                to="/notifications"
                onClick={closePanel}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                View all notifications →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationPreviewModal
        notification={previewNotification}
        onClose={() => setPreviewNotification(null)}
      />
    </div>
  );
}

function NotificationRow({
  notification,
  index,
  onRead,
  onArchive,
  onNavigate,
  onPreview,
}: {
  notification: Notification;
  index: number;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigate: () => void;
  onPreview: (n: Notification) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 hover:bg-gray-50 dark:hover:bg-dark-elevated/40 transition-colors ${getPriorityColor(notification.priority)}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-gray-500" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-dark-text text-sm">{notification.title}</h4>
          <p className="text-gray-700 dark:text-dark-muted text-sm mt-1">{notification.message}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <Clock size={14} />
            {formatTime(notification.createdAt)}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => onRead(notification.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:opacity-90"
            >
              <Check size={14} />
              Mark read
            </button>
            <button
              type="button"
              onClick={() => onArchive(notification.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-muted rounded border dark:border-dark-border"
            >
              <Archive size={14} />
              Archive
            </button>
            {hasNotificationPreview(notification) && (
              <button
                type="button"
                onClick={() => onPreview(notification)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Eye size={14} />
                View details
              </button>
            )}
            {notification.actionUrl && !hasNotificationPreview(notification) && (
              <Link
                to={notification.actionUrl}
                onClick={onNavigate}
                className="text-xs text-green-700 dark:text-green-400 hover:underline"
              >
                View
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical':
      return 'border-l-4 border-red-600 bg-red-50 dark:bg-red-900/20';
    case 'high':
      return 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20';
    case 'medium':
      return 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
    default:
      return 'border-l-4 border-gray-300 bg-gray-50 dark:bg-dark-elevated/30 dark:border-dark-border';
  }
}

function getPriorityBubbleColor(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    case 'high':
      return 'bg-orange-50 dark:bg-orange-900/30 border-orange-200';
    default:
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  }
}

function formatTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  } catch {
    return 'Just now';
  }
}
