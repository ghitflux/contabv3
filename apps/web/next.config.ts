import type { NextConfig } from 'next';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const rawInternalApiUrl = process.env.INTERNAL_API_URL || rawApiUrl;
const normalizedInternalApiUrl = rawInternalApiUrl.endsWith('/')
  ? rawInternalApiUrl.slice(0, -1)
  : rawInternalApiUrl;
const apiTarget = normalizedInternalApiUrl.startsWith('http')
  ? normalizedInternalApiUrl.endsWith('/api/v1')
    ? normalizedInternalApiUrl
    : `${normalizedInternalApiUrl}/api/v1`
  : null;

const nextConfig: NextConfig = {
  // Output standalone para Docker
  output: 'standalone',

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },

  // Images
  images: {
    remotePatterns: [],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [];
  },

  // Rewrites
  async rewrites() {
    if (!apiTarget) {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
