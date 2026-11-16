import { timingSafeEqual } from 'crypto';

/**
 * Store addresses like name.developa.me are answered by Cloudflare (which holds the certificate for them) and passed on
 * to the app as developa.me. Cloudflare adds the address the visitor really used in a private header, together with a
 * shared secret. The app trusts that header only when the secret matches, so nobody else can pretend to be a store address.
 */
export function resolveHost(headers: Headers, fallback = ''): string {
  const secret = process.env.DEVELOPA_EDGE_SECRET || '';
  const claimed = (headers.get('x-developa-host') || '').trim().toLowerCase();
  const given = headers.get('x-developa-secret') || '';
  if (
    secret &&
    claimed &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret)) &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.developa\.me$/.test(claimed)
  ) {
    return claimed;
  }
  return headers.get('host') || fallback;
}
