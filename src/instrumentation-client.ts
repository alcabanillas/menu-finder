import * as Sentry from '@sentry/nextjs';
import { cleanTelemetrySpan } from '@/app/sentry-clean-span';
import { NOTHING_FROM_REQUESTS } from '@/app/sentry-data-collection';

// Browser errors and Web Vitals to Sentry: traces enabled for browser without session replay (OPS-observabilidad, MF-67 design D1, D2).
// The DSN is `SENTRY_DSN`, inlined by next.config.ts at build time, the same value the server reads (MF-22.2 design D3).
// Exported hook required by @sentry/nextjs to instrument client-side App Router navigations (MF-67 design D3).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  dataCollection: NOTHING_FROM_REQUESTS,
  tracesSampleRate: 1.0,
  tracePropagationTargets: ['localhost', /^\//],
  beforeSendSpan: cleanTelemetrySpan,
});
