// YourResearchWriter Service Worker — handles Web Push notifications and notification clicks.
const APP_ORIGIN = self.location.origin;

// Bump this whenever icon-192x192.png or badge-96x96.png changes. Android's
// notification renderer appears to cache the decoded icon/badge bitmap by exact
// URL, independent of the image's own HTTP cache-control/ETag — a byte-identical
// server-side fix under the same static path did not show up on a real device
// across multiple deploys. A query-string bump forces it to be treated as a
// distinct resource. (Workbox-based builds get this for free via revision-hashed
// precache entries; this hand-written worker has no build step to do that.)
const ICON_VERSION = 'v3';

self.addEventListener('install', () => self.skipWaiting());

// Take over immediately and drop every Cache Storage entry the previous build
// left behind, so a newly activated worker never serves stale assets.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// Lets the page tell a waiting worker to activate without prompting the user.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push: server-sent notification ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title = data.title || 'YourResearchWriter';
  const options = {
    body: data.body || 'You have a new notification',
    // `icon` is the full-colour artwork shown in the notification body.
    icon: `/icons/icon-192x192.png?${ICON_VERSION}`,
    // `badge` is the small status-bar mark on Android. Android paints it from
    // the ALPHA CHANNEL ONLY — every opaque pixel becomes a flat white. Passing
    // the full-colour square icon here rendered as a featureless white square,
    // so this must stay a transparent-background monochrome glyph.
    badge: `/icons/badge-96x96.png?${ICON_VERSION}`,
    tag: data.tag || 'yrw',
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/dashboard/client' },
    actions: data.url ? [{ action: 'open', title: 'View' }] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch((err) => {
        console.warn('[SW] showNotification failed, retrying with basic options:', err);
        return self.registration.showNotification(title, {
          body: options.body,
          icon: options.icon,
          data: options.data,
        });
      })
  );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/dashboard/client', APP_ORIGIN).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(APP_ORIGIN) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
