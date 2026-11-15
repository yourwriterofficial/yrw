import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extractDevelopaSubdomain, isCreateSubdomain, RESERVED_FORUM_SLUGS } from '@/lib/forums'
import { lookupCustomDomainSlug } from '@/lib/customDomainCache'

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
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
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
  const forumSubdomain = extractDevelopaSubdomain(host)
  const isCreatePortal = isCreateSubdomain(host)
  const isDevelopaDomain =
    host.includes('developa.me') ||
    host.includes('developa.local') ||
    request.nextUrl.searchParams.get('brand') === 'developa'

  const bypassPrefixes = ['/api/', '/oauth/', '/_next/', '/auth/', '/login', '/register', '/dashboard', '/admin', '/forums/']
  const shouldBypass = bypassPrefixes.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix))

  // Portal routing: create.developa.me -> /create
  if (isCreatePortal && !shouldBypass) {
    const url = request.nextUrl.clone()
    url.pathname = path === '/' ? '/create' : `/create${path}`
    const res = NextResponse.rewrite(url, { request })
    res.headers.set('Content-Security-Policy', CSP)
    res.headers.set('x-brand', 'developa')
    return res
  }

  // Custom domain routing: mystore.com -> /forums/[slug]
  if (!isDevelopaDomain && !shouldBypass) {
    const customSlug = await lookupCustomDomainSlug(host)
    if (customSlug) {
      const url = request.nextUrl.clone()
      url.pathname = path === '/' ? `/forums/${customSlug}` : `/forums/${customSlug}${path}`
      const res = NextResponse.rewrite(url, { request })
      res.headers.set('Content-Security-Policy', CSP)
      res.headers.set('x-brand', 'developa')
      res.headers.set('x-forum-slug', customSlug)
      return res
    }
  }

  // Subdomain-hosted user forums: [name].developa.me -> /forums/[name]
  if (forumSubdomain && !RESERVED_FORUM_SLUGS.has(forumSubdomain)) {
    if (!shouldBypass) {
      const url = request.nextUrl.clone()
      url.pathname = path === '/' ? `/forums/${forumSubdomain}` : `/forums/${forumSubdomain}${path}`
      const res = NextResponse.rewrite(url, { request })
      res.headers.set('Content-Security-Policy', CSP)
      res.headers.set('x-brand', 'developa')
      res.headers.set('x-forum-slug', forumSubdomain)
      return res
    }
  }

  // Multi-domain routing for developa.me
  if (isDevelopaDomain && !forumSubdomain) {
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

    // Rewrite root and clean paths to their respective handler routes
    let rewritePath: string | null = null
    if (path === '/') {
      rewritePath = '/developer'
    } else if (path === '/shop' || path === '/shop/') {
      rewritePath = '/developer/shop'
    } else if (path.startsWith('/scripts/')) {
      rewritePath = `/developer/scripts/${path.slice(9)}`
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
    const loginUrl = new URL('/login', request.url)
    if (isDevelopaDomain || isCreatePortal || Boolean(forumSubdomain)) {
      loginUrl.searchParams.set('brand', 'developa')
    }
    const response = NextResponse.redirect(loginUrl)
    response.headers.set('Content-Security-Policy', CSP)
    return response
  }

  // Isolate Developa site owners from YourResearchWriter's shared /dashboard and /admin routes:
  // non-platform-admin users on Developa domains are routed to /create (their own sites hub).
  if (user && (path.startsWith('/admin') || (path.startsWith('/dashboard') && (isDevelopaDomain || isCreatePortal || Boolean(forumSubdomain))))) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      const dest = (isDevelopaDomain || isCreatePortal || Boolean(forumSubdomain)) ? '/create' : '/dashboard/client'
      const response = NextResponse.redirect(new URL(dest, request.url))
      response.headers.set('Content-Security-Policy', CSP)
      return response
    }
    // Platform admins opening plain /admin on a Developa host land on the Developa platform admin,
    // not YourResearchWriter's orders/quotes dashboard (that one stays on the main domain's /admin).
    if ((isDevelopaDomain || isCreatePortal) && (path === '/admin' || path === '/admin/')) {
      const response = NextResponse.redirect(new URL('/admin/developa-sites', request.url))
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
