import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig, { sentryBuildOptions } from './next.config';
import { version } from './package.json';

const ALL_ROUTES = '/:path*';

describe('fixed security headers', () => {
  it('apply to every route', async () => {
    const rules = await nextConfig.headers!();

    expect(rules.map((rule) => rule.source)).toEqual([ALL_ROUTES]);
  });

  it('forbid content type sniffing', async () => {
    expect(await header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('forbid framing', async () => {
    expect(await header('X-Frame-Options')).toBe('DENY');
  });

  it('set a strict referrer policy', async () => {
    expect(await header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('disable camera, microphone and geolocation', async () => {
    const policy = await header('Permissions-Policy');

    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
    expect(policy).toContain('geolocation=()');
  });

  it('leave the Content-Security-Policy to the proxy, which needs a nonce per request', async () => {
    expect(await header('Content-Security-Policy')).toBeUndefined();
  });
});

describe('version and framework disclosure', () => {
  it('builds in the version declared in package.json', () => {
    expect(nextConfig.env?.APP_VERSION).toBe(version);
  });

  it('does not announce the framework in an X-Powered-By header', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

// The browser reads the DSN inlined at build time, the same SENTRY_DSN the server reads (MF-22.2 design D3).
describe('browser error reporting', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('builds the DSN into the browser bundle', async () => {
    const dsn = 'https://public@o0.ingest.sentry.io/0';
    vi.stubEnv('SENTRY_DSN', dsn);
    vi.resetModules();

    const { default: config } = await import('./next.config');

    expect(config.env?.SENTRY_DSN).toBe(dsn);
  });
});

// Source maps only where they can be uploaded, and never served (MF-22.2 design D5).
describe('sentryBuildOptions', () => {
  it('uploads the source maps and deletes them afterwards when there is a token', () => {
    const options = sentryBuildOptions({ SENTRY_AUTH_TOKEN: 'sntrys_test' });

    expect(options.sourcemaps).toEqual({ deleteSourcemapsAfterUpload: true });
  });

  it.each([{}, { SENTRY_AUTH_TOKEN: '' }])('generates no source maps without a token (%j)', (env) => {
    expect(sentryBuildOptions(env).sourcemaps).toEqual({ disable: true });
  });

  // `silent` also drops the errors of the upload, so a failed upload left no trace in the build log (design D5).
  it('shows the errors of the source map upload in the build log', () => {
    expect(sentryBuildOptions({ SENTRY_AUTH_TOKEN: 'sntrys_test' })).not.toHaveProperty('silent');
  });

  it('sends no telemetry of its own to Sentry', () => {
    expect(sentryBuildOptions({}).telemetry).toBe(false);
  });
});

async function header(key: string): Promise<string | undefined> {
  const [rule] = await nextConfig.headers!();
  return rule?.headers.find((entry) => entry.key === key)?.value;
}
