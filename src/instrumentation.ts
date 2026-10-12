import * as Sentry from '@sentry/nextjs';
import { NOTHING_FROM_REQUESTS } from '@/app/sentry-data-collection';

/** Server errors to Sentry, errors only: no `tracesSampleRate`, no request data (OPS-observabilidad, MF-40.5). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, dataCollection: NOTHING_FROM_REQUESTS });
}

export const onRequestError = Sentry.captureRequestError;
