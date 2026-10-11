import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIResponse } from '@playwright/test';
import { version } from '../package.json';

// Specs security-headers and app-shell (MF-26), checked on the real responses of `pnpm build && pnpm start`, as
// safety-first §2.4 asks. None of these reaches the database: there is no session.

const FIXED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
const SHOWN_VERSION = `Versión v${version}`;
const STATIC_DIR = join(process.cwd(), '.next', 'static');

for (const path of ['/', '/login']) {
  test.describe(`the page ${path}, without a session`, () => {
    test('carries the fixed headers and no X-Powered-By', async ({ request }) => {
      const response = await request.get(path);

      expectFixedHeaders(response);
      expect(response.headers()['x-powered-by']).toBeUndefined();
    });

    test('carries a CSP that runs only the scripts with its nonce', async ({ request }) => {
      const csp = (await request.get(path)).headers()['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(scriptSources(csp)).not.toContain("'unsafe-inline'");
      expect(scriptSources(csp)).not.toContain("'unsafe-eval'");
    });

    test('stamps the nonce of its CSP on the scripts of the page, and uses a new one on the next request', async ({ request }) => {
      const first = await request.get(path);
      const nonce = nonceOf(first.headers()['content-security-policy']);

      expect(await first.text()).toContain(`nonce="${nonce}"`);
      expect(nonceOf((await request.get(path)).headers()['content-security-policy'])).not.toBe(nonce);
    });

    test('does not contain the version of the app', async ({ request }) => {
      expect(await (await request.get(path)).text()).not.toContain(SHOWN_VERSION);
    });
  });
}

test('a static asset carries the fixed headers and no CSP', async ({ request }) => {
  const html = await (await request.get('/login')).text();
  const asset = html.match(/\/_next\/static\/[^"]+\.js/)![0];

  const response = await request.get(asset);

  expect(response.ok()).toBe(true);
  expectFixedHeaders(response);
  expect(response.headers()['content-security-policy']).toBeUndefined();
});

test('a request under /api carries the fixed headers and no CSP', async ({ request }) => {
  const response = await request.get('/api/anything');

  expectFixedHeaders(response);
  expect(response.headers()['content-security-policy']).toBeUndefined();
});

test('no public script bundle contains the version of the app', () => {
  const bundles = filesUnder(STATIC_DIR).filter((file) => file.endsWith('.js'));

  expect(bundles.length).toBeGreaterThan(0);
  expect(bundles.filter((file) => readFileSync(file, 'utf8').includes(`"${version}"`))).toEqual([]);
});

function expectFixedHeaders(response: APIResponse) {
  const headers = response.headers();
  for (const [name, value] of Object.entries(FIXED_HEADERS)) expect(headers[name], name).toBe(value);
}

function scriptSources(csp: string | undefined): string | undefined {
  return csp?.split(';').find((directive) => directive.trim().startsWith('script-src'));
}

function nonceOf(csp: string | undefined): string | undefined {
  return csp?.match(/'nonce-([^']+)'/)?.[1];
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
