/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  allowedDevOrigins: ['192.168.1.137', 'localhost'],

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
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://checkout.flutterwave.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.flutterwave.com https://api.resend.com; frame-src https://checkout.flutterwave.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;