'use client';

import { useEffect } from 'react';

// Detect new code pushes with build variables or local timestamp fallback
const CURRENT_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '20260715_02';

export default function PWAUpdater() {
  useEffect(() => {
    // 1. Check deployment version to bust stale browser state
    try {
      const storedVersion = localStorage.getItem('yrw_app_version');
      if (storedVersion !== CURRENT_VERSION) {
        // Clear Cache Storage
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach(name => caches.delete(name));
          });
        }
        
        // Remove old cookies, preserving Supabase session and impersonation cookies
        document.cookie.split(';').forEach((cookie) => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          if (
            name &&
            !name.startsWith('sb-') && 
            !name.startsWith('supabase-') && 
            !name.startsWith('impersonate_')
          ) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            
            // Handle root domain cookies if applicable
            const parts = window.location.hostname.split('.');
            if (parts.length > 2) {
              const rootDomain = parts.slice(-2).join('.');
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
            }
          }
        });

        // Clear local storage (keeping theme and Supabase credentials)
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (
            key && 
            !key.startsWith('sb-') && 
            !key.startsWith('supabase-') && 
            key !== 'theme' && 
            !key.startsWith('impersonate_')
          ) {
            localStorage.removeItem(key);
          }
        }
        
        // Wipe sessionStorage completely to clear local JSON caches
        sessionStorage.clear();

        // Lock in the new version to prevent update loops
        localStorage.setItem('yrw_app_version', CURRENT_VERSION);

        // Force reload page to fetch fresh HTML and assets
        window.location.reload();
        return;
      }
    } catch (e) {
      console.warn('Deployment cache busting failed:', e);
    }

    // 2. Service Worker PWA update logic
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then((registration) => {
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
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  }, []);

  return null; // This component renders nothing, just runs the logic
}