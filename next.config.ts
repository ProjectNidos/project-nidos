import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
// HSTS only for the real https site: on http://localhost it would pin every local port to https.
const https = (process.env.SITE_URL ?? 'https://projectnidos.eu').startsWith('https://');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: __dirname },
  // The Content-Security-Policy is per-request (nonce), set in src/proxy.ts.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/media/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
      },
    ];
  },
  // Old static-site addresses keep working for bookmarks and search results.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/index-en.html', destination: '/en', permanent: true },
      { source: '/index-lv.html', destination: '/', permanent: true },
      { source: '/nidos/privacy.html', destination: '/en/privacy', permanent: true },
      { source: '/nidos/gdpr.html', destination: '/en/privacy', permanent: true },
      { source: '/nidos/cookie-policy.html', destination: '/en/privacy', permanent: true },
      { source: '/nidos/:page*', destination: '/', permanent: true },
      { source: '/login.html', destination: '/admin/login', permanent: true },
      { source: '/admin.html', destination: '/admin', permanent: true },
      { source: '/crm.html', destination: '/admin', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
