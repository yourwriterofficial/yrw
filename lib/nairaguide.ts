import crypto from 'crypto';

/**
 * "Login/Sign-in with your Nairaguide account" (OAuth 2.0 + PKCE). One codebase serves two brands, so each
 * brand is its own Nairaguide client: yourresearchwriter (secret NAIRAGUIDE_CLIENT_SECRET_YOURRESEARCHWRITER)
 * and developa (NAIRAGUIDE_CLIENT_SECRET_DEVELOPA). NAIRAGUIDE_URL overrides https://nairaguide.com.
 */

export const NAIRAGUIDE_URL = (process.env.NAIRAGUIDE_URL || 'https://nairaguide.com').replace(/\/$/, '');

/** Picked by host: each Nairaguide client only accepts its own domain's callback URL. */
export function nairaguideClient(host: string) {
  const developa = host.includes('developa.me');
  const id = developa ? 'developa' : 'yourresearchwriter';
  return { id, secret: process.env[`NAIRAGUIDE_CLIENT_SECRET_${id.toUpperCase()}`] || '' };
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function authorizeUrl(clientId: string, redirectUri: string, state: string, verifier: string) {
  const u = new URL(`${NAIRAGUIDE_URL}/oauth/authorize`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export interface NairaguideUser {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string | null;
  email?: string;
  email_verified?: boolean;
}

export async function exchangeCode(client: { id: string; secret: string }, code: string, verifier: string, redirectUri: string): Promise<NairaguideUser> {
  const res = await fetch(`${NAIRAGUIDE_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'YourResearchWriter/1.0' },
    body: JSON.stringify({ grant_type: 'authorization_code', client_id: client.id, client_secret: client.secret, code, code_verifier: verifier, redirect_uri: redirectUri }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.user) throw new Error(json.error_description || json.error || 'Nairaguide sign-in failed');
  return json.user as NairaguideUser;
}
