import * as Sentry from '@sentry/nextjs';

/** Server errors to Sentry, errors only: no `tracesSampleRate`, no request data (OPS-observabilidad, MF-40.5). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, dataCollection: NOTHING_FROM_REQUESTS });
}

// Sentry 11 collects bodies, headers, cookies, stack variables and AI inputs by default: any of them can carry the
// text of a request or nutritionist data (SEG-datos-nutricionista), so all are off.
const NOTHING_FROM_REQUESTS = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies Sentry.NodeOptions['dataCollection'];

export const onRequestError = Sentry.captureRequestError;
