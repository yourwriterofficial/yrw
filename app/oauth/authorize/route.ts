import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedRedirect, isChallenge, issueCode, PROVIDER_CLIENT_ID, providerConfigured } from '@/lib/oauthProvider';

export const dynamic = 'force-dynamic';

const plain = (msg: string, status = 400) =>
  new NextResponse(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

/** Authorize for the first-party client "subskription". Signed-in users are sent straight back with a code. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const redirectUri = p.get('redirect_uri') || '';
  if (p.get('client_id') !== PROVIDER_CLIENT_ID || !isAllowedRedirect(redirectUri)) {
    return plain('Unknown client or redirect address.');
  }
  if (!providerConfigured()) {
    return plain('Sign-in for this app is not switched on yet.', 503);
  }

  const back = (params: Record<string, string>) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const state = p.get('state');
    if (state) u.searchParams.set('state', state);
    const res = NextResponse.redirect(u.toString());
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (p.get('response_type') !== 'code') return back({ error: 'unsupported_response_type' });
  const challenge = p.get('code_challenge') || '';
  if (p.get('code_challenge_method') !== 'S256' || !isChallenge(challenge)) return back({ error: 'invalid_request' });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const here = `/oauth/authorize${req.nextUrl.search}`;
    const res = NextResponse.redirect(`${req.nextUrl.origin}/login?brand=developa&next=${encodeURIComponent(here)}`);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const code = await issueCode(user.id, redirectUri, challenge, p.get('scope'));
  if (!code) return back({ error: 'server_error' });
  return back({ code });
}
