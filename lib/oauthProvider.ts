import crypto from 'crypto';
import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * Developa as an OAuth 2.0 provider (ECOSYSTEM.md section 2b) for the first-party
 * client "subskription". Codes are single use, valid for five minutes, stored only
 * as SHA-256 hashes, and require PKCE S256 and an exact redirect URI match.
 */

export const PROVIDER_CLIENT_ID = 'subskription';
export const CODE_TTL_MS = 5 * 60_000;

export const REDIRECT_ALLOW_LIST = [
  'https://subskription.com.ng/auth/network/developa',
  'https://www.subskription.com.ng/auth/network/developa',
  'https://subskription.pages.dev/auth/network/developa',
  'http://localhost:5173/auth/network/developa',
  'http://localhost:4173/auth/network/developa',
];

export const isAllowedRedirect = (uri: string) => REDIRECT_ALLOW_LIST.includes(uri);

const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function providerSecret(): string {
  return (process.env.SUBSKRIPTION_PROVIDER_CLIENT_SECRET || '').trim();
}

export function providerConfigured(): boolean {
  return providerSecret().length >= 24;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** A PKCE S256 challenge is 43 base64url characters. */
export const isChallenge = (c: string) => /^[A-Za-z0-9_-]{43}$/.test(c);

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function issueCode(
  userId: string,
  redirectUri: string,
  challenge: string,
  scope?: string | null
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const code = crypto.randomBytes(32).toString('base64url');
  const { error } = await admin.from('oauth_auth_codes').insert({
    code_hash: sha256Hex(code),
    client_id: PROVIDER_CLIENT_ID,
    user_id: userId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    scope: scope || null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  return error ? null : code;
}

/** Atomically marks the code used and returns its record, or null when unknown, used, or expired. */
export async function consumeCode(
  code: string
): Promise<{ user_id: string; redirect_uri: string; code_challenge: string } | null> {
  const admin = getAdminClient();
  if (!admin || !code) return null;
  const { data } = await admin
    .from('oauth_auth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', sha256Hex(code))
    .eq('client_id', PROVIDER_CLIENT_ID)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id, redirect_uri, code_challenge')
    .maybeSingle();
  return (data as { user_id: string; redirect_uri: string; code_challenge: string } | null) ?? null;
}

export const pkceMatches = (verifier: string, challenge: string) =>
  verifier.length >= 43 &&
  verifier.length <= 128 &&
  safeEqual(crypto.createHash('sha256').update(verifier).digest('base64url'), challenge);
