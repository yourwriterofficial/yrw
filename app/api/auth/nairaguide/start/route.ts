import { NextResponse, type NextRequest } from 'next/server';
import { authorizeUrl, nairaguideClient, randomToken } from '@/lib/nairaguide';

export const dynamic = 'force-dynamic';

/** Off to Nairaguide to sign in, the way "Sign in with Google" works. */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const brand = req.nextUrl.searchParams.get('brand');
  const rawNext = req.nextUrl.searchParams.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';
  const client = nairaguideClient(req.nextUrl.host);
  const state = randomToken(18);
  const verifier = randomToken(48);
  const res = NextResponse.redirect(authorizeUrl(client.id, `${origin}/api/auth/nairaguide/callback`, state, verifier));
  res.cookies.set('ng_oauth', JSON.stringify({ state, verifier, next, brand: brand === 'developa' ? 'developa' : '' }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
