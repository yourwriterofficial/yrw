import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fetch the newly logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // --- MASTER ADMIN OVERRIDE ---
        const isAdminEmail = user.email?.toLowerCase() === 'yourwriterofficial@gmail.com';

        // Secure their profile in the database
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          is_admin: isAdminEmail,
        });

        // Route admins to the admin panel, route clients to the client dashboard
        if (isAdminEmail) {
          return NextResponse.redirect(`${requestUrl.origin}/admin`);
        } else {
          return NextResponse.redirect(`${requestUrl.origin}/dashboard/client?verified=true`);
        }
      }
    } else {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?message=Verification link expired or invalid. Please log in or request a new one.`
      );
    }
  }

  // Fallback redirect
  return NextResponse.redirect(`${requestUrl.origin}/dashboard/client`);
}