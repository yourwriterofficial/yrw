import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
	console.log('✅ MIDDLEWARE RUNNING – path:', request.nextUrl.pathname);
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // 1. Allow public routes
  const publicPaths = ['/', '/login', '/register', '/auth/callback', '/complete-registration']
  if (publicPaths.includes(path) || path.startsWith('/api/')) {
    return supabaseResponse
  }

  // 2. Protect dashboard and admin routes for logged-out users
  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. ONLY redirect regular users if they try to access /admin
  if (user && user.email?.toLowerCase() !== 'yourwriterofficial@gmail.com' && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard/client', request.url))
  }

  // NOTE: There is no longer any code here that redirects admins away from /dashboard/client
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}