import type { NextConfig } from 'next';
import { withSentryConfig, type SentryBuildOptions } from '@sentry/nextjs/config';
import { version } from './package.json';
import { sentryEnvironment } from './src/app/sentry-environment';

// Every path, pages, API routes and static assets alike (safety-first §2.4). The Content-Security-Policy is not here:
// its nonce changes on every request, so `src/proxy.ts` sets it (MF-26 design D1, D2).
const ALL_ROUTES = '/:path*';

type Env = Record<string, string | undefined>;

const nextConfig: NextConfig = {
  env: {
    // The version of package.json, inlined at build time; only server code reads it (MF-26 design D6).
    APP_VERSION: version,
    // The DSN for the browser, the same SENTRY_DSN the server reads: public by design (MF-22.2 design D3).
    SENTRY_DSN: process.env.SENTRY_DSN ?? '',
    // The label of the build (production, preview), the one the server computes from the same variables.
    SENTRY_ENVIRONMENT: sentryEnvironment(process.env),
  },
  poweredByHeader: false,
  headers: async () => [{ source: ALL_ROUTES, headers: fixedSecurityHeaders() }],
};

export default withSentryConfig(nextConfig, sentryBuildOptions(process.env));

/**
 * The Sentry build plugin reads SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT itself; an organisation token carries
 * the org. Source maps only where they can be uploaded: Sentry deletes the maps it uploaded, so a build without a token
 * must generate none, or they would be served. The logs stay on: `silent` also drops the errors of the upload
 * (MF-22.2 design D5).
 */
export function sentryBuildOptions(env: Env): SentryBuildOptions {
  return {
    sourcemaps: env.SENTRY_AUTH_TOKEN ? { deleteSourcemapsAfterUpload: true } : { disable: true },
    telemetry: false,
  };
}

function fixedSecurityHeaders() {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}
