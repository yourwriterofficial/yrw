import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
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

  // Allow public routes
  const publicPaths = ['/', '/login', '/register', '/auth/callback', '/complete-registration']
  if (publicPaths.includes(path) || path.startsWith('/api/')) {
    // Add CSP header even for public routes
    const response = NextResponse.next({ request })
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://api.resend.com; frame-src 'self';"
    )
    return response
  }

  // Protect dashboard and admin routes
  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.headers.set('Content-Security-Policy', "default-src 'self' ...; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://api.resend.com;")
    return response
  }

  // Redirect non‑admin users away from /admin
  if (user && user.email?.toLowerCase() !== 'yourwriterofficial@gmail.com' && path.startsWith('/admin')) {
    const response = NextResponse.redirect(new URL('/dashboard/client', request.url))
    response.headers.set('Content-Security-Policy', "default-src 'self' ...; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://api.resend.com;")
    return response
  }

  // For all other authenticated routes, add CSP header
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://api.resend.com; frame-src 'self';"
  )
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}