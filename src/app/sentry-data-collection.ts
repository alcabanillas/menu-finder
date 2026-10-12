import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';

// Sentry 11 collects bodies, headers, cookies, stack variables and AI inputs by default: any of them can carry the
// text of a request or nutritionist data (SEG-datos-nutricionista), so all are off. One definition for the server and
// the browser, so that a field turned off on one side cannot stay on in the other (MF-22.2 design D2).
export const NOTHING_FROM_REQUESTS = {
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
} satisfies NodeOptions['dataCollection'] & BrowserOptions['dataCollection'];
