import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { unlockAudio } from './lib/alert';
import { requestPersistence } from './lib/store';
import './styles.css';

// Offline support: the service worker precaches the app and updates itself.
registerSW({ immediate: true });

// Ask the browser to keep our IndexedDB data (best effort).
void requestPersistence();

// Timer beeps need audio unlocked by a user gesture (iOS).
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
