'use client';

import { useEffect } from 'react';

export default function PWAUpdater() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (confirm("A new version of YourResearchWriter is available. Update now?")) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });
    }
  }, []);

  return null; // This component renders nothing, just runs the logic
}