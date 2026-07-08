import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Handles server-generated email links (magic link, recovery, invite, etc.)
 * created via supabase.auth.admin.generateLink(). These carry a `token_hash`
 * + `type`, verified here with verifyOtp() — NOT the `code`-based
 * /auth/callback route, which is for client-initiated PKCE flows (login,
 * register) and never receives a usable `code` for admin-generated links.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  const next = requestUrl.searchParams.get('next');

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const isAdminEmail = user.email?.toLowerCase() === 'yourwriterofficial@gmail.com';
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          is_admin: isAdminEmail,
        });
      }

      const redirectUrl = next && next.startsWith('/')
        ? `${requestUrl.origin}${next}`
        : `${requestUrl.origin}/dashboard/client?verified=true`;

      const response = NextResponse.redirect(redirectUrl);
      response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return response;
    }

    console.error('Auth confirm error:', error);
  }

  const response = NextResponse.redirect(
    `${requestUrl.origin}/login?message=Verification link expired or invalid. Please log in or request a new one.`
  );
  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return response;
}
