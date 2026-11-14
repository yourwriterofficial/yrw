// Service worker for developa.me sites: shows order alerts sent by the site.
// It deliberately caches nothing and has no fetch handler.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'New update', {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      tag: data.tag || 'site',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
