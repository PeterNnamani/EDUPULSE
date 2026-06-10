import { useEffect, useState } from 'react';
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

export function useNotificationPreview(
  notification: Notification | null | undefined,
  directPreview: DirectPreviewInput | null | undefined,
  enabled: boolean
) {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<NotificationPreviewData | null>(null);
  const [error, setError] = useState('');

  const title = directPreview?.title ?? notification?.title ?? 'Notification';
  const message = directPreview?.message ?? notification?.message ?? '';

  useEffect(() => {
    if (!enabled || !user?.schoolId) {
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
          if (!cancelled) setError('');
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
  }, [enabled, notification, directPreview, user?.schoolId]);

  return { loading, preview, error, title, message };
}
