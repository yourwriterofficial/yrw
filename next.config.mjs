/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabling Turbopack explicitly during build to prevent the conflict
  // We will keep it enabled only for local dev if you prefer speed
  experimental: {
    // Leave this empty to ensure standard Webpack build
  },
  allowedDevOrigins: ['192.168.1.137', 'localhost'],
};

export default nextConfig;