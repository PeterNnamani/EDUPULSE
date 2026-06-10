import { motion } from 'framer-motion';
import { X, Eye } from 'lucide-react';
import type { Notification } from '@/services/notificationService';
import { useNotificationPreview, type DirectPreviewInput } from '@/hooks/useNotificationPreview';
import NotificationPreviewBody from '@/components/NotificationPreviewBody';

export type { DirectPreviewInput };

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
  const open = Boolean(notification || directPreview);
  const { loading, preview, error, title, message } = useNotificationPreview(
    notification,
    directPreview,
    open
  );

  if (!open) return null;

  const displayError =
    error ||
    (!loading && !preview && !directPreview
      ? 'No detailed preview for this notification. Check Teacher Activity for the full feed.'
      : '');

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
          <NotificationPreviewBody
            loading={loading}
            error={displayError}
            preview={preview}
            onNavigateAway={onClose}
          />
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

export { canPreviewNotification, canPreviewNotification as hasNotificationPreview } from '@/services/notificationPreviewService';
