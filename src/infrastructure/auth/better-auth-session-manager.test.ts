import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountCreator } from '@/application/ports/account-creator';
import { BetterAuthSessionManager } from '@/infrastructure/auth/better-auth-session-manager';
import { createAccountCreator } from '@/infrastructure/auth/create-account';
import { createAuth } from '@/infrastructure/auth/create-auth';
import { clearTables, configFor, countRows, PASSWORD, seedAccount } from '@/infrastructure/auth/auth-test-support';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

// The cookies of one browser. `next/headers` is replaced by this jar: the adapter reads the request from it, and the
// library's `nextCookies` plugin writes the response cookies into it, as a server action would.
const jar = vi.hoisted(() => {
  const cookies = new Map<string, { value: string; httpOnly: boolean }>();
  const nextHeaders = {
    headers: async () => new Headers({ cookie: [...cookies].map(([name, { value }]) => `${name}=${value}`).join('; ') }),
    cookies: async () => ({
      set: (name: string, value: string, options: { maxAge?: number; httpOnly?: boolean } = {}) => {
        if (options.maxAge === 0 || value === '') cookies.delete(name);
        else cookies.set(name, { value, httpOnly: options.httpOnly ?? false });
      },
    }),
  };
  return { cookies, nextHeaders };
});
vi.mock('next/headers', () => jar.nextHeaders);
vi.mock('next/headers.js', () => jar.nextHeaders);

const EMAIL = 'ana@example.test';
const SESSION_COOKIE = 'better-auth.session_token';

describe.skipIf(!TEST_DATABASE_URL)('BetterAuthSessionManager (Neon test branch)', () => {
  let db: TestDatabase;
  let sessions: BetterAuthSessionManager;
  let accounts: AccountCreator;
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    sessions = new BetterAuthSessionManager(createAuth(configFor(db.pool)), jar.nextHeaders.headers);
    accounts = createAccountCreator(configFor(db.pool));
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    jar.cookies.clear();
    await clearTables(db.pool);
    await seedAccount(accounts, EMAIL);
  });

  describe('signIn', () => {
    it('starts a session, sets an HttpOnly session cookie and returns the user', async () => {
      const result = await sessions.signIn({ email: EMAIL, password: PASSWORD });

      expect(result).toEqual({ ok: true, value: { userId: expect.any(String), name: 'Test User' } });
      expect(jar.cookies.get(SESSION_COOKIE)?.httpOnly).toBe(true);
      expect(await countRows(db.pool, 'session')).toBe(1);
    });

    it.each([
      ['a wrong password', EMAIL, 'a-wrong-password'],
      ['an unknown email', 'nobody@example.test', PASSWORD],
      ['a malformed email', "' OR 1=1; --", PASSWORD],
    ])('refuses %s as wrong credentials and starts no session', async (_case, email, password) => {
      const result = await sessions.signIn({ email, password });

      expect(result).toEqual({ ok: false, error: { kind: 'wrong-credentials' } });
      expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
      expect(await countRows(db.pool, 'session')).toBe(0);
    });
  });

  describe('current', () => {
    it('returns the user of a valid session', async () => {
      await sessions.signIn({ email: EMAIL, password: PASSWORD });

      await expect(sessions.current()).resolves.toEqual({ userId: expect.any(String), name: 'Test User' });
    });

    it('returns null without a cookie', async () => {
      await expect(sessions.current()).resolves.toBeNull();
    });

    it('returns null for a modified cookie', async () => {
      await sessions.signIn({ email: EMAIL, password: PASSWORD });
      const cookie = jar.cookies.get(SESSION_COOKIE)!;
      const forged = tamperFirstCharacter(cookie.value);
      jar.cookies.set(SESSION_COOKIE, { ...cookie, value: forged });

      expect(forged).not.toBe(cookie.value);
      await expect(sessions.current()).resolves.toBeNull();
    });

    it('returns null for an expired session', async () => {
      await sessions.signIn({ email: EMAIL, password: PASSWORD });
      await db.pool.query('UPDATE "session" SET "expiresAt" = now() - interval \'1 minute\'');

      await expect(sessions.current()).resolves.toBeNull();
    });

    it('returns null for a session that was signed out', async () => {
      await sessions.signIn({ email: EMAIL, password: PASSWORD });
      const oldCookie = jar.cookies.get(SESSION_COOKIE)!;
      await sessions.signOut();
      jar.cookies.set(SESSION_COOKIE, oldCookie);

      await expect(sessions.current()).resolves.toBeNull();
    });
  });

  describe('signOut', () => {
    it('deletes the session row, clears the cookie and returns the user id', async () => {
      const signedIn = await sessions.signIn({ email: EMAIL, password: PASSWORD });

      const result = await sessions.signOut();

      expect(result).toEqual({ userId: signedIn.ok ? signedIn.value.userId : 'unreachable' });
      expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
      expect(await countRows(db.pool, 'session')).toBe(0);
    });

    it('returns no user and does not fail without a cookie', async () => {
      await expect(sessions.signOut()).resolves.toEqual({ userId: null });
    });
  });
});

// Always a different first character: replacing it with a fixed one did nothing when the random token already began
// with it (about 1 run in 62), and the test then saw a valid session.
function tamperFirstCharacter(value: string): string {
  return `${value.startsWith('x') ? 'y' : 'x'}${value.slice(1)}`;
}
