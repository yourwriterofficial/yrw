import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyReferralIfEligible } from '@/lib/affiliate';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const refCode = requestUrl.searchParams.get('ref');

  // Supabase redirects here with ?error=/?error_description= and NO code when a
  // link has expired or was already used. That case previously fell through to
  // the bare /login redirect at the bottom of this file with no message at all,
  // so the user was bounced to an empty login form with no explanation.
  const errorParam =
    requestUrl.searchParams.get('error_description') ||
    requestUrl.searchParams.get('error');

  if (errorParam) {
    const readable = decodeURIComponent(errorParam).replace(/\+/g, ' ');
    const message = /expired|invalid/i.test(readable)
      ? 'That link has expired or was already used. Please request a new one.'
      : readable;
    const response = NextResponse.redirect(
      `${requestUrl.origin}/login?message=${encodeURIComponent(message)}`
    );
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const isAdminEmail = user.email?.toLowerCase() === 'yourwriterofficial@gmail.com';

        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          is_admin: isAdminEmail,
        });

        if (refCode) {
          await applyReferralIfEligible(admin, { userId: user.id, refCode });
        }

        const redirectUrl = isAdminEmail
          ? `${requestUrl.origin}/admin`
          : next && next.startsWith('/')
            ? `${requestUrl.origin}${next}`
            : `${requestUrl.origin}/dashboard/client?verified=true`;

        const response = NextResponse.redirect(redirectUrl);
        // Prevent CDN caching for secure auth routes
        response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response;
      }
    } else {
      console.error('Auth callback error:', error);
      const response = NextResponse.redirect(
        `${requestUrl.origin}/login?message=Verification link expired or invalid. Please log in or request a new one.`
      );
      response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return response;
    }
  }

  // Reached when there is no code and no error param — e.g. the link was
  // opened twice and the code was already consumed. Say so rather than
  // silently rendering an empty login form.
  const fallbackResponse = NextResponse.redirect(
    `${requestUrl.origin}/login?message=${encodeURIComponent(
      'That sign-in link could not be completed. Please request a new one.'
    )}`
  );
  fallbackResponse.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return fallbackResponse;
}