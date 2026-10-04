import type pg from 'pg';
import type { createAccountCreator } from '@/infrastructure/auth/create-account';
import type { AuthConfig } from '@/infrastructure/auth/create-auth';

/** Shared by the authentication tests: the requests a browser would send, and the state they leave in the tables. */

// The address the authentication believes it is served from.
const BASE_URL = 'http://localhost:3000';
// A secret of the length the setup demands.
const SECRET = 'test-secret-with-at-least-32-characters-long-0123456789';
/** The password of every seeded account: a test value, not a credential. */
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
export const PASSWORD = 'correct-horse-battery';

/** The setup settings for a test pool; the secret can be replaced to build a second, foreign setup. */
export function configFor(pool: pg.Pool, secret = SECRET): AuthConfig {
  return { pool, secret, baseUrl: BASE_URL };
}

type Handler = { handler: (request: Request) => Promise<Response> };

/** A public sign-up request. */
export function signUp(auth: Handler, email: string, password = PASSWORD): Promise<Response> {
  return post(auth, '/api/auth/sign-up/email', { email, password, name: 'Test User' });
}

/** A sign-in request. */
export function signIn(auth: Handler, email: string, password = PASSWORD): Promise<Response> {
  return post(auth, '/api/auth/sign-in/email', { email, password });
}

/** A sign-out request carrying the session cookie. */
export function signOut(auth: Handler, cookie: string): Promise<Response> {
  return post(auth, '/api/auth/sign-out', {}, cookie);
}

/** `name=value` of the session cookie in a response, ready to send back in a `Cookie` header. */
export function sessionCookie(response: Response): string {
  const [setCookie] = response.headers.getSetCookie();
  return setCookie.split(';')[0];
}

/** The raw `Set-Cookie` header of a response, to read its attributes. */
export function setCookieOf(response: Response): string {
  return response.headers.getSetCookie()[0] ?? '';
}

export type AccountCreator = ReturnType<typeof createAccountCreator>;

/** Creates an account the way the CLI will, so that tests start from a real one. Build the creator once per file. */
export async function seedAccount(create: AccountCreator, email: string, password = PASSWORD): Promise<void> {
  const created = await create({ email, password, name: 'Test User' });
  if (!created.ok) throw new Error(`could not seed ${email}: ${JSON.stringify(created.error)}`);
}

/** How many rows an authentication table holds. */
export async function countRows(pool: pg.Pool, table: 'user' | 'session' | 'account'): Promise<number> {
  const result = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`);
  return result.rows[0].n;
}

/** Removes every user and, by cascade, their accounts and sessions. */
export async function clearTables(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE "user" CASCADE');
}

async function post(auth: Handler, path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json', origin: BASE_URL };
  if (cookie) headers.cookie = cookie;
  return auth.handler(new Request(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }));
}
