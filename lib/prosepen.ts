import crypto from 'crypto';

/**
 * "Continue with ProsePen" (OAuth 2.0 authorization code + PKCE). ProsePen is the provider; Developa is the client "developa".
 * The client secret lives only in PROSEPEN_CLIENT_SECRET (server env). We read identity and the plan name, nothing else.
 */

export const PROSEPEN_AUTHORIZE_URL = process.env.PROSEPEN_AUTHORIZE_URL || 'https://prosepen.com.ng/oauth/authorize';
export const PROSEPEN_TOKEN_URL = process.env.PROSEPEN_TOKEN_URL || 'https://prosepen.com.ng/api/oauth/token';
export const PROSEPEN_CLIENT_ID = 'developa';

export const prosepenConfigured = () => (process.env.PROSEPEN_CLIENT_SECRET || '').length >= 24;

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function prosepenAuthorizeUrl(redirectUri: string, state: string, verifier: string) {
  const u = new URL(PROSEPEN_AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', PROSEPEN_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export interface ProsepenUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string | null;
  prosepen_tier?: string | null;
}

export async function exchangeProsepenCode(code: string, verifier: string, redirectUri: string): Promise<ProsepenUser> {
  const res = await fetch(PROSEPEN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Developa/1.0' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: PROSEPEN_CLIENT_ID,
      client_secret: process.env.PROSEPEN_CLIENT_SECRET || '',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.user) throw new Error(json.error_description || json.error || 'ProsePen sign-in failed');
  return json.user as ProsepenUser;
}
