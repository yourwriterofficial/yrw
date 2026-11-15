import crypto from 'crypto';

/**
 * "Continue with Subskription" (OAuth 2.0 authorization code + PKCE). Subskription is the provider;
 * Developa is the client "developa". The client secret lives only in SUBSKRIPTION_CLIENT_SECRET (server env).
 * We read identity, the plan name and the seller flag. Never wallet, orders or bank details.
 */

export const SUBSKRIPTION_AUTHORIZE_URL = process.env.SUBSKRIPTION_AUTHORIZE_URL || 'https://subskription.com.ng/oauth/authorize';
export const SUBSKRIPTION_TOKEN_URL = process.env.SUBSKRIPTION_TOKEN_URL || 'https://subskription-api.chatinent.workers.dev/oauth-token';
export const SUBSKRIPTION_CLIENT_ID = 'developa';

export const subskriptionConfigured = () => !!process.env.SUBSKRIPTION_CLIENT_SECRET;

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function subskriptionAuthorizeUrl(redirectUri: string, state: string, verifier: string) {
  const u = new URL(SUBSKRIPTION_AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', SUBSKRIPTION_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', 'openid profile email plan');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export interface SubskriptionUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string | null;
  subskription_plan?: string | null;
  /** Subskription's final field name; the first draft of the contract called it subskription_plan. */
  subscription_plan?: string | null;
  is_seller?: boolean;
  store_slug?: string | null;
  store_name?: string | null;
}

export async function exchangeSubskriptionCode(code: string, verifier: string, redirectUri: string): Promise<SubskriptionUser> {
  const res = await fetch(SUBSKRIPTION_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Developa/1.0' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: SUBSKRIPTION_CLIENT_ID,
      client_secret: process.env.SUBSKRIPTION_CLIENT_SECRET || '',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.user) throw new Error(json.error_description || json.error || 'Subskription sign-in failed');
  return json.user as SubskriptionUser;
}
