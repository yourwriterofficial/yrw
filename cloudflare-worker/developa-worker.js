/**
 * Cloudflare Worker (Workers Pro) for Developa background reconciliation & edge caching.
 * Offloads Paystack 48h pending reconciliation from Vercel Hobby crons.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, worker: 'developa-worker' });
    }
    return new Response('Developa background worker', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    const target = env.RECONCILE_URL || 'https://yourresearchwriter.com.ng/api/developa/reconcile';
    if (!env.CRON_SECRET) return;
    ctx.waitUntil(
      fetch(target, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          'User-Agent': 'Developa-CF-Worker/1.0',
        },
      }).catch(() => {})
    );
  },
};
