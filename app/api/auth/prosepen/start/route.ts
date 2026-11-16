import { NextResponse, type NextRequest } from 'next/server';
import { randomToken, prosepenAuthorizeUrl, prosepenConfigured } from '@/lib/prosepen';

export const dynamic = 'force-dynamic';

/** Off to ProsePen to sign in, the way "Sign in with Google" works. */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const rawNext = req.nextUrl.searchParams.get('next') || '';
  const main = req.nextUrl.searchParams.get('site') === 'main';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\') ? rawNext : '';

  if (!prosepenConfigured()) {
    return NextResponse.redirect(`${origin}/login${main ? '' : '?brand=developa'}${main ? '?' : '&'}message=${encodeURIComponent('ProsePen sign-in is not switched on yet.')}`);
  }

  const state = randomToken(18);
  const verifier = randomToken(48);
  const res = NextResponse.redirect(prosepenAuthorizeUrl(`${origin}/api/auth/prosepen/callback`, state, verifier));
  res.cookies.set('pp_oauth', JSON.stringify({ state, verifier, next, main }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
