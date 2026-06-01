import { useEffect, useCallback } from 'react';

/**
 * Hook for playing notification sounds
 * Plays a pleasant notification tone when needed
 */
export function useNotificationSound() {
    const playSound = useCallback(() => {
        try {
            // Use Web Audio API to play a notification sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            // Create a pleasant notification tone (two ascending beeps)
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.25);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }, []);

    // Request browser notification permission on component mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {
                console.log('Notification permission denied');
            });
        }
    }, []);

    return { playSound };
}
