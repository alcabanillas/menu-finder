import type { NextConfig } from 'next';
import { version } from './package.json';

// Every path, pages, API routes and static assets alike (safety-first §2.4). The Content-Security-Policy is not here:
// its nonce changes on every request, so `src/proxy.ts` sets it (MF-26 design D1, D2).
const ALL_ROUTES = '/:path*';

const nextConfig: NextConfig = {
  // The version of package.json, inlined at build time; only server code reads it (MF-26 design D6).
  env: { APP_VERSION: version },
  poweredByHeader: false,
  headers: async () => [{ source: ALL_ROUTES, headers: fixedSecurityHeaders() }],
};

export default nextConfig;

function fixedSecurityHeaders() {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}
