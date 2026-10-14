import * as Sentry from '@sentry/nextjs';
import type { SearchFailureReport } from '@/application/ports/search-failure-report';

/**
 * Sends one failure of a web search to Sentry. A failed outcome is a value, not an `Error`, so it goes as a message:
 * a stack trace of this function would say nothing about the fault. Tags group and filter; the reason is data.
 */
export const sentrySearchFailureReport: SearchFailureReport = {
  report({ kind, level, model, reason }) {
    Sentry.captureMessage(`search failure: ${kind}`, {
      level,
      tags: { failure: kind, ...(model && { model }) },
      extra: { ...(reason && { reason }) },
    });
  },
};
