import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sentrySearchFailureReport } from '@/infrastructure/sentry/sentry-search-failure-report';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));

beforeEach(() => {
  vi.mocked(Sentry.captureMessage).mockClear();
});

describe('sentrySearchFailureReport', () => {
  it('sends one message for the kind, with the kind, the model and the reason as data and the level', () => {
    sentrySearchFailureReport.report({ kind: 'embedding-failed', level: 'error', model: 'embedding-model', reason: 'quota' });

    expect(Sentry.captureMessage).toHaveBeenCalledExactlyOnceWith('search failure: embedding-failed', {
      level: 'error',
      tags: { failure: 'embedding-failed', model: 'embedding-model' },
      extra: { reason: 'quota' },
    });
  });

  it('leaves out the model and the reason when the failure has none', () => {
    sentrySearchFailureReport.report({ kind: 'llm-limit-reached', level: 'warning' });

    expect(Sentry.captureMessage).toHaveBeenCalledExactlyOnceWith('search failure: llm-limit-reached', {
      level: 'warning',
      tags: { failure: 'llm-limit-reached' },
      extra: {},
    });
  });
});
