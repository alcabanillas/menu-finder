import { NextResponse, type NextRequest } from 'next/server';

const CSP = 'Content-Security-Policy';

/**
 * Lets the request through with a Content-Security-Policy whose nonce is new for this request (MF-26 design D2). The
 * policy goes on the request, where Next.js reads the nonce while rendering and stamps it on its own scripts, and on
 * the response, where the browser enforces it.
 */
export function withContentSecurityPolicy(request: NextRequest): NextResponse {
  const policy = contentSecurityPolicy(newNonce(), process.env.NODE_ENV);
  const response = NextResponse.next({ request: { headers: withPolicy(request.headers, policy) } });
  response.headers.set(CSP, policy);
  return response;
}

// Unpredictable and unique per request: a nonce an attacker could guess would let an injected script run.
function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

// Only the scripts that carry the nonce run, and `'strict-dynamic'` lets them load the chunks they need. Styles keep
// `'unsafe-inline'`: a nonce does not cover `style` attributes.
function contentSecurityPolicy(nonce: string, nodeEnv: string | undefined): string {
  return [
    "default-src 'self'",
    scriptSources(nonce, nodeEnv === 'development'),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// React needs `eval` only in development, for debugging.
function scriptSources(nonce: string, isDevelopment: boolean): string {
  const evalInDevelopment = isDevelopment ? " 'unsafe-eval'" : '';
  return `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalInDevelopment}`;
}

function withPolicy(headers: Headers, policy: string): Headers {
  const forwarded = new Headers(headers);
  forwarded.set(CSP, policy);
  return forwarded;
}
