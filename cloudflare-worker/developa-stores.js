/**
 * Cloudflare Worker "developa-stores" (free plan), route *.developa.me/*.
 *
 * 1. fetch: store addresses (name.developa.me) are answered here and passed on to developa.me with the address the
 *    visitor really used in the x-developa-host header. A Cloudflare request-header rule adds the shared secret
 *    (x-developa-secret) that the app checks (see lib/edgeHost.ts).
 * 2. scheduled: every 10 minutes it calls the app's two timers, so scheduled announcements go out on time and pending
 *    Paystack payments are re-checked. Needs the Worker secret CRON_SECRET (same value as the app's CRON_SECRET).
 *    At 02:00 to 02:09 UTC it also calls /api/developa/backup, the nightly encrypted backup to private Google Drive.
 *    Cron trigger: every 10 minutes ("star-slash-10 * * * *").
 */
// Subdomains that are not stores (same list as RESERVED_FORUM_SLUGS in lib/forums.ts). They keep going through the app as before.
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'auth', 'shop', 'forum', 'forums', 'mail', 'cdn', 'static', 'assets', 'staging', 'dev', 'developa', 'support', 'billing', 'docs', 'status', 'blog', 'help', 'dashboard', 'login', 'register', 'order', 'scripts', 'developer', 'projects', 'create']);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.set('x-developa-host', url.hostname);
    // A store's front page is asked for by its own path, so every store has its own copy in the app's page cache and one
    // store's page can never be handed to another. Everything else (and every other kind of request) is passed on unchanged.
    const sub = url.hostname.endsWith('.developa.me') ? url.hostname.slice(0, -'.developa.me'.length) : '';
    const isStoreName = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(sub);
    // A name that could never be a store gets a plain 404 here, so it can never end up in the page cache under another address.
    if (sub && !RESERVED.has(sub) && !isStoreName) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD') && isStoreName && !RESERVED.has(sub)) {
      url.pathname = '/forums/' + sub;
    }
    url.hostname = 'developa.me';
    return fetch(new Request(url, { method: request.method, headers, body: request.body, redirect: 'manual' }));
  },

  async scheduled(event, env, ctx) {
    if (!env.CRON_SECRET) return;
    const call = (path) =>
      fetch('https://developa.me' + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.CRON_SECRET, 'User-Agent': 'Developa-CF-Timer/1.0' },
      }).catch(() => {});
    const jobs = [call('/api/developa/announcements/run'), call('/api/developa/reconcile')];
    const t = new Date(event.scheduledTime);
    if (t.getUTCHours() === 2 && t.getUTCMinutes() < 10) jobs.push(call('/api/developa/backup'));
    ctx.waitUntil(Promise.all(jobs));
  },
};
