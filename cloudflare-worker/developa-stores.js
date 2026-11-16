/**
 * Cloudflare Worker "developa-stores" (free plan), route *.developa.me/*.
 *
 * 1. fetch: store addresses (name.developa.me) are answered here and passed on to developa.me with the address the
 *    visitor really used in the x-developa-host header. A Cloudflare request-header rule adds the shared secret
 *    (x-developa-secret) that the app checks (see lib/edgeHost.ts).
 * 2. scheduled: every 10 minutes it calls the app's two timers, so scheduled announcements go out on time and pending
 *    Paystack payments are re-checked. Needs the Worker secret CRON_SECRET (same value as the app's CRON_SECRET).
 *    Cron trigger: every 10 minutes ("star-slash-10 * * * *").
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.set('x-developa-host', url.hostname);
    url.hostname = 'developa.me';
    return fetch(new Request(url, { method: request.method, headers, body: request.body, redirect: 'manual' }));
  },

  async scheduled(_event, env, ctx) {
    if (!env.CRON_SECRET) return;
    const call = (path) =>
      fetch('https://developa.me' + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.CRON_SECRET, 'User-Agent': 'Developa-CF-Timer/1.0' },
      }).catch(() => {});
    ctx.waitUntil(Promise.all([call('/api/developa/announcements/run'), call('/api/developa/reconcile')]));
  },
};
