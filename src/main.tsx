import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Preload notification audio for faster playback
const preloadAudio = () => {
  try {
    const notificationAudio = new Audio('/sounds/notification.mp3');
    notificationAudio.preload = 'auto';

    console.log('[main] Notification audio queued for preload');
  } catch (error) {
    console.warn('[main] Audio preload failed:', error);
  }
};

// Start preloading audio immediately
preloadAudio();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
