import { createHash } from 'crypto';

/**
 * Tells the team by email when the server hits an unexpected error, so a failure after launch is noticed even when
 * nobody is looking at the logs. Rules that keep it useful and safe:
 *  - the same problem is reported at most once every 20 minutes, and at most 6 emails an hour per server instance;
 *  - expected "errors" (not found, redirects, cancelled requests) are ignored;
 *  - only the message, the page address and the method are sent: never headers, cookies or request bodies.
 * It never throws, and it never waits on the page being served.
 */

const seen = new Map<string, number>();
const sentAt: number[] = [];
const REPEAT_MS = 20 * 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_PER_HOUR = 6;

const EXPECTED = /NEXT_NOT_FOUND|NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|AbortError|aborted|ECONNRESET|socket hang up|BAILOUT_TO_CLIENT_SIDE_RENDERING|DYNAMIC_SERVER_USAGE/i;

export async function reportServerError(
  err: unknown,
  request: { path?: string; method?: string } | undefined,
  context?: { routePath?: string; routeType?: string }
) {
  try {
    const e = err as { message?: string; digest?: string; stack?: string } | undefined;
    const message = String(e?.message || err || 'Unknown error').slice(0, 300);
    if (EXPECTED.test(message) || EXPECTED.test(String(e?.digest || ''))) return;
    if (process.env.NODE_ENV !== 'production' && !process.env.ERROR_ALERTS_IN_DEV) return;

    const path = String(request?.path || context?.routePath || '').split('?')[0].slice(0, 200);
    const key = createHash('sha1').update(`${message}|${context?.routePath || path}`).digest('hex');
    const now = Date.now();
    if (now - (seen.get(key) || 0) < REPEAT_MS) return;
    while (sentAt.length && now - sentAt[0] > HOUR_MS) sentAt.shift();
    if (sentAt.length >= MAX_PER_HOUR) return;
    seen.set(key, now);
    sentAt.push(now);
    if (seen.size > 500) seen.clear();

    const to = process.env.ERROR_ALERT_TO || 'support@developa.me';
    const { sendSystemEmail } = await import('./emailService');
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const stack = String(e?.stack || '').split('\n').slice(0, 6).join('\n');
    await sendSystemEmail({
      to,
      subject: `[Developa error] ${message.slice(0, 90)}`,
      html:
        `<h2>Something failed on the server</h2>` +
        `<p><strong>${esc(message)}</strong></p>` +
        `<p>Page: <code>${esc(request?.method || 'GET')} ${esc(path || '(unknown)')}</code><br>` +
        `Kind: ${esc(String(context?.routeType || 'unknown'))}${e?.digest ? ` · reference ${esc(String(e.digest))}` : ''}</p>` +
        (stack ? `<pre style="font-size:12px;white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px">${esc(stack)}</pre>` : '') +
        `<p style="font-size:12px;color:#64748b">Sent once per problem every 20 minutes. Full details are in the Vercel logs for this time.</p>`,
    });
  } catch {
    // Reporting must never break anything.
  }
}
