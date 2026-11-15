import { NextResponse, type NextRequest } from 'next/server';
import { randomToken, subskriptionAuthorizeUrl, subskriptionConfigured } from '@/lib/subskription';

export const dynamic = 'force-dynamic';

/** Off to Subskription to sign in, the way "Sign in with Google" works. */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const rawNext = req.nextUrl.searchParams.get('next') || '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\') ? rawNext : '';

  if (!subskriptionConfigured()) {
    return NextResponse.redirect(`${origin}/login?brand=developa&message=${encodeURIComponent('Subskription sign-in is not switched on yet.')}`);
  }

  const state = randomToken(18);
  const verifier = randomToken(48);
  const res = NextResponse.redirect(subskriptionAuthorizeUrl(`${origin}/api/auth/subskription/callback`, state, verifier));
  res.cookies.set('sub_oauth', JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
