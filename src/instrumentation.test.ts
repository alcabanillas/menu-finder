import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestError, register } from './instrumentation';

vi.mock('@sentry/nextjs', () => ({ init: vi.fn(), captureRequestError: vi.fn() }));

const DSN = 'https://public@o0.ingest.sentry.io/0';

afterEach(() => {
  vi.mocked(Sentry.init).mockClear();
  vi.unstubAllEnvs();
});

describe('register', () => {
  it('starts Sentry once with the DSN in the Node.js runtime', async () => {
    const options = await startedOptions();

    expect(Sentry.init).toHaveBeenCalledOnce();
    expect(options.dsn).toBe(DSN);
  });

  it('does not start Sentry in the edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await register();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('sends errors only, never traces', async () => {
    const options = await startedOptions();

    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('tracesSampler');
  });

  it('collects no request data', async () => {
    const options = await startedOptions();

    expect(options.dataCollection).toEqual({
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
    });
  });
});

describe('onRequestError', () => {
  it('reports uncaught request errors to Sentry', () => {
    expect(onRequestError).toBe(Sentry.captureRequestError);
  });
});

/** Runs `register` in the Node.js runtime with a DSN and returns the options Sentry was started with. */
async function startedOptions(): Promise<Sentry.NodeOptions> {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('SENTRY_DSN', DSN);
  await register();
  return vi.mocked(Sentry.init).mock.calls[0]![0] as Sentry.NodeOptions;
}
