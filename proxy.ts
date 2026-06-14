import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // ✅ Use getUser() – not getClaims()
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // ✅ Allow public routes and API routes
  const publicPaths = ['/', '/login', '/register', '/auth/callback', '/complete-registration']
  if (publicPaths.includes(path) || path.startsWith('/api/')) {
    return supabaseResponse
  }

  // Protect dashboard and admin routes
  if ((path.startsWith('/dashboard') || path.startsWith('/admin')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect admin users to /admin if they land on /dashboard
  if (user && user.email?.toLowerCase() === 'yourwriterofficial@gmail.com' && !path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Redirect regular users to /dashboard/client if they land on /admin
  if (user && user.email?.toLowerCase() !== 'yourwriterofficial@gmail.com' && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard/client', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}