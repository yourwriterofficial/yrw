import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, overLimit } from '@/lib/rateLimit';
import {
  consumeCode,
  getAdminClient,
  pkceMatches,
  PROVIDER_CLIENT_ID,
  providerConfigured,
  providerSecret,
  safeEqual,
} from '@/lib/oauthProvider';

export const dynamic = 'force-dynamic';

const err = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Server-to-server code exchange for the client "subskription". */
export async function POST(req: NextRequest) {
  if (!providerConfigured()) return err('temporarily_unavailable', 503);
  if (overLimit(`oauth-token:${clientIp(req)}`, 30, 60_000)) return err('rate_limited', 429);

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const s = (k: string) => (typeof b?.[k] === 'string' ? (b[k] as string) : '');
  if (s('grant_type') !== 'authorization_code') return err('unsupported_grant_type');
  if (s('client_id') !== PROVIDER_CLIENT_ID || !safeEqual(s('client_secret'), providerSecret())) {
    return err('invalid_client', 401);
  }

  // Consume first so a wrong verifier or redirect_uri cannot be retried with the same code.
  const rec = await consumeCode(s('code'));
  if (!rec) return err('invalid_grant');
  if (rec.redirect_uri !== s('redirect_uri') || !pkceMatches(s('code_verifier'), rec.code_challenge)) {
    return err('invalid_grant');
  }

  const admin = getAdminClient();
  if (!admin) return err('server_error', 500);

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(rec.user_id);
  const authUser = userData?.user;
  if (userErr || !authUser || !authUser.email) return err('invalid_grant');

  const bannedUntil = (authUser as { banned_until?: string | null }).banned_until;
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) return err('invalid_grant');

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', authUser.id)
    .maybeSingle();

  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  const name =
    (profile?.full_name as string | null) ||
    (typeof meta.full_name === 'string' ? meta.full_name : '') ||
    (typeof meta.name === 'string' ? meta.name : '') ||
    '';
  const picture =
    (profile?.avatar_url as string | null) ||
    (typeof meta.avatar_url === 'string' ? meta.avatar_url : null);

  return NextResponse.json(
    {
      user: {
        sub: authUser.id,
        email: authUser.email,
        email_verified: Boolean(authUser.email_confirmed_at),
        name,
        picture,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
