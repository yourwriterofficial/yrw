import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Single canonical Content-Security-Policy. The browser is only ever asked to
// talk to our own origin and Supabase (REST + realtime websockets). Paystack,
// Resend and email are all called server-side, so they are intentionally absent
// from connect-src. Keep this in sync with next.config.mjs.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

const ADMIN_EMAIL = 'yourwriterofficial@gmail.com'

export default async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
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

  const path = request.nextUrl.pathname

  // Only /dashboard and /admin actually consult the auth session below — every
  // other route (marketing/service pages, catalogs, order forms, API routes)
  // used to fall through to a blocking supabase.auth.getUser() network call on
  // every single request regardless, adding real latency to pages that never
  // even looked at the result. Skip the check entirely unless it's needed.
  const needsAuthCheck = path.startsWith('/dashboard') || path.startsWith('/admin')
  if (!needsAuthCheck) {
    const response = NextResponse.next({ request })
    response.headers.set('Content-Security-Policy', CSP)
    return response
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard and admin routes
  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.headers.set('Content-Security-Policy', CSP)
    return response
  }

  // Redirect non-admin users away from /admin
  if (user && user.email?.toLowerCase() !== ADMIN_EMAIL && path.startsWith('/admin')) {
    const response = NextResponse.redirect(new URL('/dashboard/client', request.url))
    response.headers.set('Content-Security-Policy', CSP)
    return response
  }

  supabaseResponse.headers.set('Content-Security-Policy', CSP)
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
