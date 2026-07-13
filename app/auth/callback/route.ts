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

  const fallbackResponse = NextResponse.redirect(`${requestUrl.origin}/login`);
  fallbackResponse.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return fallbackResponse;
}