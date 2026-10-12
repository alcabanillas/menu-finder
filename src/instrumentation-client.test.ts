import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOTHING_FROM_REQUESTS } from '@/app/sentry-data-collection';

vi.mock('@sentry/nextjs', () => ({ init: vi.fn() }));

const DSN = 'https://public@o0.ingest.sentry.io/0';

afterEach(() => {
  vi.mocked(Sentry.init).mockClear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('instrumentation-client', () => {
  it('starts Sentry once with the DSN inlined at build time', async () => {
    const options = await startedOptions();

    expect(Sentry.init).toHaveBeenCalledOnce();
    expect(options.dsn).toBe(DSN);
  });

  it('sends errors only: no traces and no session replay', async () => {
    const options = await startedOptions();

    for (const option of ['tracesSampleRate', 'tracesSampler', 'replaysSessionSampleRate', 'replaysOnErrorSampleRate']) {
      expect(options).not.toHaveProperty(option);
    }
    expect(integrationNames(options)).not.toContainEqual(expect.stringMatching(/replay/i));
  });

  it('collects no request data, with the same rules as the server', async () => {
    const options = await startedOptions();
    // The instance the client loaded: each test reloads the modules, so the one imported at the top is a different copy.
    const { NOTHING_FROM_REQUESTS: shared } = await import('@/app/sentry-data-collection');

    expect(options.dataCollection).toBe(shared);
    expect(options.dataCollection).toEqual(NOTHING_FROM_REQUESTS);
  });
});

/** Loads the client instrumentation with a DSN and returns the options Sentry was started with. */
async function startedOptions(): Promise<Sentry.BrowserOptions> {
  vi.stubEnv('SENTRY_DSN', DSN);
  await import('./instrumentation-client');
  return vi.mocked(Sentry.init).mock.calls[0]![0] as Sentry.BrowserOptions;
}

// The names of the integrations passed explicitly; none means the SDK defaults, which include no replay.
function integrationNames({ integrations }: Sentry.BrowserOptions): string[] {
  return Array.isArray(integrations) ? integrations.map(({ name }) => name) : [];
}
