import { withContentSecurityPolicy } from '@/app/content-security-policy';

/** The Next.js proxy (formerly middleware): only the entry of the web adapter; the logic is in app/content-security-policy.ts (MF-26). */
export const proxy = withContentSecurityPolicy;

// Read statically by Next.js, so it stays here. Pages only: API routes, static assets, the favicon and next/link
// prefetches are not HTML documents and need no CSP (MF-26 design D1).
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
