import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import {
  notificationService,
  type Notification,
} from '@/services/notificationService';
import { playLoginNotificationSound, unlockNotificationAudio } from '@/utils/playNotificationSound';

interface InAppNotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  refetch: () => void;
  markAsRead: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  loginToasts: Notification[];
  dismissLoginToast: (id: string) => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextValue | undefined>(
  undefined
);

const SESSION_KEY = 'edupulse-notification-session';

export function InAppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAppStore();
  const queryClient = useQueryClient();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const loginHandledRef = useRef(false);
  const [loginToasts, setLoginToasts] = useState<Notification[]>([]);

  const enabled = isAuthenticated && !!user?.id && !!user?.schoolId;

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['in-app-notifications', user?.id, user?.schoolId, user?.role],
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];
      return notificationService.getNotifications(user.schoolId, user.id, {
        limit: 50,
      });
    },
    refetchInterval: 8000,
    enabled,
  });

  const unreadNotifications = notifications.filter(
    (n) => n.status === 'unread' && !n.readAt && !n.archivedAt
  );

  const { data: counts = { unread: 0, total: 0, archived: 0 } } = useQuery({
    queryKey: ['notification-counts', user?.id, user?.schoolId],
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return { unread: 0, total: 0, archived: 0 };
      return notificationService.getNotificationCounts(user.schoolId, user.id);
    },
    refetchInterval: 8000,
    enabled,
  });

  const handleNewNotifications = useCallback(
    (incoming: Notification[], isInitialLogin = false) => {
      const fresh = incoming.filter((n) => !knownIdsRef.current.has(n.id));
      if (fresh.length === 0) return;

      fresh.forEach((n) => knownIdsRef.current.add(n.id));

      if (isInitialLogin) {
        setLoginToasts((prev) => {
          const merged = [...fresh, ...prev].slice(0, 5);
          return merged;
        });
        playLoginNotificationSound(fresh.length);
      } else {
        playLoginNotificationSound(1);
        setLoginToasts((prev) => [...fresh.slice(0, 2), ...prev].slice(0, 5));
      }
    },
    []
  );

  // Reset when user changes (logout / different account)
  useEffect(() => {
    if (!user?.id) {
      knownIdsRef.current.clear();
      loginHandledRef.current = false;
      setLoginToasts([]);
    }
  }, [user?.id]);

  // On login: load unread, show toasts, play sound
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!loginHandledRef.current) {
      loginHandledRef.current = true;
      sessionStorage.setItem(SESSION_KEY, `${user!.id}:${user!.schoolId}:${Date.now()}`);

      notificationService
        .getNotifications(user!.schoolId, user!.id, { status: 'unread', limit: 50 })
        .then((unread) => {
          const active = unread.filter((n) => n.status === 'unread' && !n.archivedAt);
          active.forEach((n) => knownIdsRef.current.add(n.id));
          if (active.length > 0) {
            handleNewNotifications(active, true);
          } else {
            unlockNotificationAudio();
          }
        });
    }
  }, [enabled, user?.id, user?.schoolId, handleNewNotifications]);

  // Detect new notifications from polling
  useEffect(() => {
    if (!enabled || unreadNotifications.length === 0) return;
    const newOnes = unreadNotifications.filter((n) => !knownIdsRef.current.has(n.id));
    if (newOnes.length > 0 && loginHandledRef.current) {
      handleNewNotifications(newOnes, false);
    }
    unreadNotifications.forEach((n) => knownIdsRef.current.add(n.id));
  }, [unreadNotifications, enabled, handleNewNotifications]);

  // Supabase realtime
  useEffect(() => {
    if (!enabled || !user?.schoolId) return;

    const channel = supabase
      .channel(`notifications:${user.schoolId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `school_id=eq.${user.schoolId}`,
        },
        (payload) => {
          const row = payload.new as {
            recipient_id: string;
            id: string;
          };
          if (row.recipient_id !== user.id) return;
          void queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
          void queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, user?.schoolId, user?.id, queryClient]);

  const markAsRead = useCallback(
    async (id: string) => {
      await notificationService.markAsRead(id);
      await queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
    },
    [queryClient]
  );

  const archive = useCallback(
    async (id: string) => {
      await notificationService.archive(id);
      await queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
    },
    [queryClient]
  );

  const dismissLoginToast = useCallback((id: string) => {
    setLoginToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <InAppNotificationContext.Provider
      value={{
        notifications: unreadNotifications,
        unreadCount: counts.unread,
        isLoading,
        refetch: () => void refetch(),
        markAsRead,
        archive,
        loginToasts,
        dismissLoginToast,
      }}
    >
      {children}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications(): InAppNotificationContextValue {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) {
    throw new Error('useInAppNotifications must be used within InAppNotificationProvider');
  }
  return ctx;
}
