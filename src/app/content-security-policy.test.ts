import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withContentSecurityPolicy } from '@/app/content-security-policy';

const CSP = 'content-security-policy';
// How NextResponse.next() carries the request headers it forwards to the page (next/server, `handleMiddlewareField`).
const FORWARDED_CSP = `x-middleware-request-${CSP}`;

const page = () => new NextRequest('https://menu-finder.test/planner');
const policy = () => withContentSecurityPolicy(page()).headers.get(CSP) ?? '';

describe('withContentSecurityPolicy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the browser the same policy it gives the page, so Next.js stamps the nonce on its scripts', () => {
    const response = withContentSecurityPolicy(page());

    expect(response.headers.get(CSP)).toBeTruthy();
    expect(response.headers.get(FORWARDED_CSP)).toBe(response.headers.get(CSP));
  });

  it('uses a fresh nonce on every request', () => {
    const first = nonceOf(policy());

    expect(first).toBeTruthy();
    expect(first).not.toBe(nonceOf(policy()));
  });

  it('keeps the request headers it does not touch', () => {
    const request = page();
    request.headers.set('accept-language', 'es');

    expect(withContentSecurityPolicy(request).headers.get('x-middleware-request-accept-language')).toBe('es');
  });

  it('only allows what comes from the app itself by default, and forbids objects and framing', () => {
    const csp = policy();

    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
  });

  it('runs only the scripts that carry the nonce, never inline scripts without it', () => {
    const csp = policy();
    const scripts = directive(csp, 'script-src');

    expect(scripts).toContain(`'nonce-${nonceOf(csp)}'`);
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
  });

  it('keeps inline styles, which a nonce cannot cover in style attributes', () => {
    expect(directive(policy(), 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('does not allow eval in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(directive(policy(), 'script-src')).not.toContain("'unsafe-eval'");
  });

  it('allows eval in development, where React needs it for debugging', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(directive(policy(), 'script-src')).toContain("'unsafe-eval'");
  });

  // The browser sends its errors to Sentry, and only to the exact ingest host of the project (MF-22.2 design D4).
  describe('connect-src', () => {
    const DSN = 'https://public@o123.ingest.de.sentry.io/456';

    it('allows the exact ingest host of the DSN', () => {
      vi.stubEnv('SENTRY_DSN', DSN);

      expect(directive(policy(), 'connect-src')).toBe("connect-src 'self' https://o123.ingest.de.sentry.io");
    });

    it("keeps 'self', so the app can still talk to itself", () => {
      vi.stubEnv('SENTRY_DSN', DSN);

      expect(directive(policy(), 'connect-src')?.split(' ')).toContain("'self'");
    });

    it('never adds a wildcard', () => {
      vi.stubEnv('SENTRY_DSN', DSN);

      expect(policy()).not.toContain('*');
    });

    it('keeps the public key and the project id of the DSN out of the header', () => {
      vi.stubEnv('SENTRY_DSN', DSN);

      expect(policy()).not.toContain('public');
      expect(policy()).not.toContain('456');
    });

    it('adds no connect-src without a DSN, and leaves the rest of the policy as it was', () => {
      vi.stubEnv('SENTRY_DSN', '');
      const csp = policy();

      expect(directive(csp, 'connect-src')).toBeUndefined();
      expect(csp.split(';').map((part) => part.trim().split(' ')[0])).toEqual([
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'object-src',
        'base-uri',
        'form-action',
        'frame-ancestors',
      ]);
    });

    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- an http DSN on purpose: the policy must refuse it
    it.each(['not a url', 'http://public@o123.ingest.de.sentry.io/456', 'javascript:alert(1)'])(
      'adds no connect-src for the invalid DSN %j',
      (dsn) => {
        vi.stubEnv('SENTRY_DSN', dsn);

        expect(directive(policy(), 'connect-src')).toBeUndefined();
      },
    );

    it('cannot be given another directive through the DSN', () => {
      vi.stubEnv('SENTRY_DSN', `${DSN}; script-src *`);
      const csp = policy();

      expect(csp).not.toContain('script-src *');
      expect(csp.split(';').filter((part) => part.trim().startsWith('script-src '))).toHaveLength(1);
    });
  });
});
function directive(csp: string, name: string): string | undefined {
  return csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
}

function nonceOf(csp: string): string | undefined {
  return csp.match(/'nonce-([^']+)'/)?.[1];
}
