let audioContext: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

/** Call after user gesture (login click) so autoplay is allowed. */
export function unlockNotificationAudio(): void {
  try {
    const ctx = getContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    unlocked = true;
  } catch {
    /* ignore */
  }
}

/**
 * Pleasant two-tone notification chime (no external file required).
 */
export function playNotificationSound(volume = 0.35): void {
  try {
    const ctx = getContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const t = ctx.currentTime;
    playTone(880, t, 0.12);
    playTone(1174, t + 0.14, 0.15);
  } catch (e) {
    console.warn('[NotificationSound] Web Audio failed:', e);
  }
}

/** Play once per batch on login (slightly longer pattern). */
export function playLoginNotificationSound(count: number): void {
  unlockNotificationAudio();
  playNotificationSound(0.4);
  if (count > 1) {
    setTimeout(() => playNotificationSound(0.3), 280);
  }
  if (count > 3) {
    setTimeout(() => playNotificationSound(0.25), 560);
  }
}

export function isNotificationAudioUnlocked(): boolean {
  return unlocked;
}
