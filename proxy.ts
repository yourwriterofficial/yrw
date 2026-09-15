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
  const host = request.headers.get('host') || request.nextUrl.host || ''
  const isDevelopaDomain =
    host.includes('developa.me') ||
    host.includes('developa.local') ||
    request.nextUrl.searchParams.get('brand') === 'developa'

  // Multi-domain routing for developa.me
  if (isDevelopaDomain) {
    // Canonicalize URLs: redirect explicit /developer prefixes to clean developa.me paths
    if (path === '/developer' || path === '/developer/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      const res = NextResponse.redirect(redirectUrl, 308)
      res.headers.set('Content-Security-Policy', CSP)
      return res
    }
    if (path === '/developer/shop' || path === '/developer/shop/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/shop'
      const res = NextResponse.redirect(redirectUrl, 308)
      res.headers.set('Content-Security-Policy', CSP)
      return res
    }
    if (path.startsWith('/developer/scripts/')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/scripts/${path.slice(19)}`
      const res = NextResponse.redirect(redirectUrl, 308)
      res.headers.set('Content-Security-Policy', CSP)
      return res
    }
    if (path === '/order/dev' || path === '/order/dev/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/order'
      const res = NextResponse.redirect(redirectUrl, 308)
      res.headers.set('Content-Security-Policy', CSP)
      return res
    }

    // Rewrite root and clean paths to their respective handler routes
    let rewritePath: string | null = null
    if (path === '/') {
      rewritePath = '/developer'
    } else if (path === '/shop' || path === '/shop/') {
      rewritePath = '/developer/shop'
    } else if (path.startsWith('/scripts/')) {
      rewritePath = `/developer/scripts/${path.slice(9)}`
    } else if (path === '/order' || path === '/order/') {
      rewritePath = '/order/dev'
    }

    if (rewritePath) {
      const url = request.nextUrl.clone()
      url.pathname = rewritePath
      const res = NextResponse.rewrite(url, { request })
      res.headers.set('Content-Security-Policy', CSP)
      res.headers.set('x-brand', 'developa')
      return res
    }
  } else {
    // If on main site and redirection to developa.me is enabled via env var
    const forceDevelopaRedirect = process.env.REDIRECT_TO_DEVELOPA_ME === 'true'
    if (forceDevelopaRedirect && (path === '/developer' || path.startsWith('/developer/'))) {
      const destPath = path.replace(/^\/developer/, '') || '/'
      const redirectUrl = new URL(`https://developa.me${destPath}`, request.url)
      const res = NextResponse.redirect(redirectUrl, 301)
      res.headers.set('Content-Security-Policy', CSP)
      return res
    }
  }

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

  // Redirect non-admin users away from /admin. Source of truth is profiles.is_admin —
  // the same flag the admin UI (and RLS via is_admin()) already use — not a hardcoded
  // email, so any account the admin panel promotes to admin actually gets edge access.
  if (user && path.startsWith('/admin')) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      const response = NextResponse.redirect(new URL('/dashboard/client', request.url))
      response.headers.set('Content-Security-Policy', CSP)
      return response
    }
  }

  supabaseResponse.headers.set('Content-Security-Policy', CSP)
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
