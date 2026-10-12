import * as Sentry from '@sentry/nextjs';
import { NOTHING_FROM_REQUESTS } from '@/app/sentry-data-collection';

// Uncaught browser errors to Sentry, errors only: no traces and no session replay (OPS-observabilidad, MF-22.2 design D1).
// The DSN is `SENTRY_DSN`, inlined by next.config.ts at build time, the same value the server reads (design D3).
Sentry.init({ dsn: process.env.SENTRY_DSN, dataCollection: NOTHING_FROM_REQUESTS });
