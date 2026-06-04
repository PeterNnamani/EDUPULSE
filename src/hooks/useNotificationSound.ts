import { useEffect, useCallback } from 'react';
import { playNotificationSound, unlockNotificationAudio } from '@/utils/playNotificationSound';

/**
 * Hook for playing notification sounds (Web Audio chime).
 */
export function useNotificationSound() {
    const playSound = useCallback(() => {
        playNotificationSound();
    }, []);

    useEffect(() => {
        unlockNotificationAudio();
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    return { playSound };
}
