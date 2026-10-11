import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
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

async function header(key: string): Promise<string | undefined> {
  const [rule] = await nextConfig.headers!();
  return rule?.headers.find((entry) => entry.key === key)?.value;
}
