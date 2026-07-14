/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  allowedDevOrigins: ['192.168.1.137', 'localhost'],

  // Perf: gzip/brotli compression + modern image formats via sharp (already a dep).
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // "Custom Data & Fieldwork" was renamed to "Statistics, Maths, Financial & Fieldwork"
  // (2026-07-14) — keep old links/bookmarks working.
  async redirects() {
    return [
      { source: '/custom-research', destination: '/statistics-fieldwork', permanent: true },
      { source: '/order/custom', destination: '/order/statistics', permanent: true },
      { source: '/dashboard/client/order/new/custom', destination: '/dashboard/client/order/new/statistics', permanent: true },
    ];
  },

  // Security headers to prevent clickjacking, MIME sniffing, XSS, etc.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            // Keep in sync with the CSP constant in proxy.ts. Both headers
            // are applied, so a mismatch would make the browser enforce the
            // (stricter) intersection — e.g. silently dropping Supabase realtime.
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self'; object-src 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;