'use client';

import { useEffect } from 'react';

// Identifies the deployment. Injected at build time by next.config.mjs, so it
// changes on every deploy — that's what makes the cache purge below fire once
// per release instead of relying on a hand-bumped constant.
const CURRENT_VERSION =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  'dev';

// Keys that survive the purge: without these the user is silently logged out.
const isProtectedKey = (name: string) =>
  name.startsWith('sb-') ||
  name.startsWith('supabase-') ||
  name.startsWith('impersonate_') ||
  name === 'theme' ||
  name === 'yrw_app_version';

export default function PWAUpdater() {
  useEffect(() => {
    let cancelled = false;

    // 1. Check deployment version to bust stale browser state
    const bustStaleState = async () => {
      const storedVersion = localStorage.getItem('yrw_app_version');
      if (storedVersion === CURRENT_VERSION) return false;

      // Await the purge: reloading before it settles was leaving old entries
      // behind, which is exactly the stale-asset symptom this is meant to fix.
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }

      // Remove old cookies, preserving Supabase session and impersonation cookies
      document.cookie.split(';').forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        if (name && !isProtectedKey(name)) {
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
        if (key && !isProtectedKey(key)) {
          localStorage.removeItem(key);
        }
      }

      // Wipe sessionStorage completely to clear local JSON caches
      sessionStorage.clear();

      // Lock in the new version BEFORE reloading — otherwise the fresh page
      // sees the old value again and reloads forever.
      localStorage.setItem('yrw_app_version', CURRENT_VERSION);

      // Force reload page to fetch fresh HTML and assets
      window.location.reload();
      return true;
    };

    // 2. Service Worker PWA update logic
    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;

      // Reload once when a new worker takes control, so the page and the
      // worker that serves it always come from the same deployment.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      // Activate a new build straight away instead of prompting — the old
      // confirm() let users decline and stay pinned to a stale deployment.
      const promote = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage('SKIP_WAITING');
          }
        });
      };

      promote(registration.waiting);
      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage('SKIP_WAITING');
      }
      registration.addEventListener('updatefound', () => promote(registration.installing));

      // Long-lived PWA sessions never re-run this effect, so poll for new
      // deployments and check again whenever the app is refocused.
      const check = () => registration.update().catch(() => {});
      const interval = window.setInterval(check, 60 * 1000);
      window.addEventListener('focus', check);

      return () => {
        window.clearInterval(interval);
        window.removeEventListener('focus', check);
      };
    };

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        if (await bustStaleState()) return; // reloading; don't register mid-flight
      } catch (e) {
        console.warn('Deployment cache busting failed:', e);
      }
      if (cancelled) return;
      try {
        cleanup = await registerServiceWorker();
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null; // This component renders nothing, just runs the logic
}