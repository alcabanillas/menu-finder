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
