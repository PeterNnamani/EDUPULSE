import { useCallback } from 'react';

type SoundType = 'intro' | 'notification';

interface SoundOptions {
    volume?: number;
    loop?: boolean;
}

export const useSound = () => {
    const playSound = useCallback((soundType: SoundType, options: SoundOptions = {}) => {
        try {
            const { volume = 1, loop = false } = options;

            if (soundType === 'notification') {
                import('@/utils/playNotificationSound').then(({ playNotificationSound }) => {
                    playNotificationSound(volume);
                });
                return;
            }

            const soundMap: Record<SoundType, string> = {
                intro: '/sounds/intro.mp3',
                notification: '/sounds/notification.mp3',
            };

            const audioPath = soundMap[soundType];
            if (!audioPath) {
                console.warn(`[useSound] Unknown sound type: ${soundType}`);
                return;
            }

            const audio = new Audio(audioPath);
            audio.volume = Math.min(Math.max(volume, 0), 1); // Clamp between 0-1
            audio.loop = loop;

            // Add event listeners for debugging
            audio.addEventListener('loadstart', () => {
                console.log(`[useSound] Loading ${soundType}`);
            });

            audio.addEventListener('canplay', () => {
                console.log(`[useSound] Ready to play ${soundType}`);
            });

            audio.addEventListener('ended', () => {
                console.log(`[useSound] Finished playing ${soundType}`);
            });

            audio.addEventListener('error', (error) => {
                console.error(`[useSound] Error loading ${soundType}:`, error);
            });

            // Play the sound with error handling
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log(`[useSound] Playing ${soundType}`);
                    })
                    .catch((error: any) => {
                        console.warn(`[useSound] Failed to play ${soundType}:`, error.message);
                        // If it's a NotAllowedError, suggest user interaction
                        if (error.name === 'NotAllowedError') {
                            console.info('[useSound] Autoplay blocked - interact with page first');
                        }
                    });
            }

            return audio;
        } catch (error) {
            console.error(`[useSound] Error playing sound:`, error);
        }
    }, []);

    const stopSound = useCallback((audio: HTMLAudioElement) => {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }, []);

    return { playSound, stopSound };
};
