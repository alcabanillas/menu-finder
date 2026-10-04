import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccountCreator } from '@/application/ports/account-creator';
import { createAccountCreator } from '@/infrastructure/auth/create-account';
import { createAuth } from '@/infrastructure/auth/create-auth';
import {
  clearTables,
  configFor,
  countRows,
  seedAccount,
  sessionCookie,
  setCookieOf,
  signIn,
  signOut,
  signUp,
} from '@/infrastructure/auth/auth-test-support';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const EMAIL = 'ana@example.test';
const DAY_SECONDS = 24 * 60 * 60;
const HOSTILE_VALUES = [
  "' OR 1=1; --",
  'ana😀@example.test',
  'josé@example.test',
  'a\u0000b@example.test',
  'a'.repeat(10_000),
];

describe.skipIf(!TEST_DATABASE_URL)('createAuth (Neon test branch)', () => {
  let db: TestDatabase;
  let auth: ReturnType<typeof createAuth>;
  let accounts: AccountCreator;
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    auth = createAuth(configFor(db.pool));
    accounts = createAccountCreator(configFor(db.pool));
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    await clearTables(db.pool);
  });

  describe('closed sign-up', () => {
    it('rejects a sign-up request and adds no user, account or session', async () => {
      const response = await signUp(auth, EMAIL);

      expect(response.status).toBe(400);
      expect(await rowCounts()).toEqual({ user: 0, account: 0, session: 0 });
    });

    it('rejects the email of an existing account exactly as it rejects a new email', async () => {
      await seedAccount(accounts, EMAIL);

      const existing = await signUp(auth, EMAIL);
      const fresh = await signUp(auth, 'new@example.test');

      expect(existing.status).toBe(fresh.status);
      expect(await existing.text()).toBe(await fresh.text());
      expect(await countRows(db.pool, 'user')).toBe(1);
    });
  });

  describe('sign-in', () => {
    beforeEach(async () => {
      await seedAccount(accounts, EMAIL);
    });

    it('starts a session and sets an HttpOnly cookie for correct credentials', async () => {
      const response = await signIn(auth, EMAIL);

      expect(response.status).toBe(200);
      expect(setCookieOf(response).toLowerCase()).toContain('httponly');
      expect(await countRows(db.pool, 'session')).toBe(1);
    });

    it('rejects a wrong password and starts no session', async () => {
      const response = await signIn(auth, EMAIL, 'a-wrong-password');

      expect(response.status).toBe(401);
      expect(await countRows(db.pool, 'session')).toBe(0);
    });

    it('answers an unknown email with the same status and body as a wrong password', async () => {
      const wrongPassword = await signIn(auth, EMAIL, 'a-wrong-password');
      const unknownEmail = await signIn(auth, 'nobody@example.test');

      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(await unknownEmail.text()).toBe(await wrongPassword.text());
    });

    it.each(HOSTILE_VALUES)('rejects the hostile email %# without a server error or any change', async (email) => {
      const before = await rowCounts();

      const response = await signIn(auth, email);

      expect([400, 401]).toContain(response.status);
      expect(await rowCounts()).toEqual(before);
    });

    it('rejects a hostile password without a server error or any change', async () => {
      const before = await rowCounts();

      const response = await signIn(auth, EMAIL, "' OR 1=1; -- 😀\u0000" + 'p'.repeat(10_000));

      expect([400, 401]).toContain(response.status);
      expect(await rowCounts()).toEqual(before);
    });
  });

  describe('session', () => {
    let cookie: string;
    beforeEach(async () => {
      await seedAccount(accounts, EMAIL);
      cookie = sessionCookie(await signIn(auth, EMAIL));
    });

    it('is written with the SEG-auth lifetime: 7 days, renewed after 1 day', () => {
      expect(auth.options.session).toMatchObject({ expiresIn: 7 * DAY_SECONDS, updateAge: DAY_SECONDS });
    });

    it('does not check the tables on every start: auth-schema.test.ts does it once, in the test suite', () => {
      expect(auth.options.advanced?.database?.validateSchema).toBe(false);
    });

    it('is no session once it has expired', async () => {
      await setSessionExpiry(daysFromNow(0, -1));

      expect(await sessionFor(cookie)).toBeNull();
    });

    it('is renewed by 7 days when used more than 1 day after its last renewal', async () => {
      await setSessionExpiry(daysFromNow(5));

      expect(await sessionFor(cookie)).not.toBeNull();

      const remaining = await secondsUntilExpiry();
      expect(remaining).toBeGreaterThan(7 * DAY_SECONDS - 60);
    });

    it('is not renewed when used within a day of its last renewal', async () => {
      await setSessionExpiry(daysFromNow(7, 0, -1));
      const before = await expiryOf();

      expect(await sessionFor(cookie)).not.toBeNull();

      expect(await expiryOf()).toBe(before);
    });

    it('is revoked in the database on sign-out, and its cookie stops working', async () => {
      await signOut(auth, cookie);

      expect(await countRows(db.pool, 'session')).toBe(0);
      expect(await sessionFor(cookie)).toBeNull();
    });
  });

  describe('cookie and secret', () => {
    let cookie: string;
    beforeEach(async () => {
      await seedAccount(accounts, EMAIL);
      cookie = sessionCookie(await signIn(auth, EMAIL));
    });

    it('treats a cookie whose value was changed as no session', async () => {
      const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('A') ? 'B' : 'A'}`;

      expect(await sessionFor(tampered)).toBeNull();
    });

    it('treats a cookie issued under another secret as no session', async () => {
      const other = createAuth(configFor(db.pool, 'another-secret-with-at-least-32-characters-9876'));
      const foreign = sessionCookie(await signIn(other, EMAIL));

      expect(await sessionFor(foreign)).toBeNull();
    });

    it.each([
      ['missing', ''],
      ['shorter than 32 characters', 'short-secret'],
    ])('fails to set up when the secret is %s, naming the variable and not echoing the value', (_label, secret) => {
      const message = errorMessageOf(() => createAuth(configFor(db.pool, secret)));

      expect(message).toMatch(/BETTER_AUTH_SECRET/);
      if (secret) expect(message).not.toContain(secret);
    });
  });

  function errorMessageOf(work: () => unknown): string {
    try {
      work();
    } catch (error) {
      return (error as Error).message;
    }
    return 'did not throw';
  }

  async function rowCounts() {
    return {
      user: await countRows(db.pool, 'user'),
      account: await countRows(db.pool, 'account'),
      session: await countRows(db.pool, 'session'),
    };
  }

  function sessionFor(cookie: string) {
    return auth.api.getSession({ headers: new Headers({ cookie }) });
  }

  // Times come from this process, never from the database clock: the library compares with the application's clock.
  async function setSessionExpiry(expiresAt: Date) {
    await db.pool.query('UPDATE "session" SET "expiresAt" = $1', [expiresAt]);
  }

  function daysFromNow(days: number, seconds = 0, hours = 0): Date {
    return new Date(Date.now() + days * DAY_SECONDS * 1000 + seconds * 1000 + hours * 3600 * 1000);
  }

  async function expiryOf(): Promise<string> {
    const result = await db.pool.query<{ expiresAt: Date }>('SELECT "expiresAt" FROM "session"');
    return result.rows[0].expiresAt.toISOString();
  }

  async function secondsUntilExpiry(): Promise<number> {
    const result = await db.pool.query<{ expiresAt: Date }>('SELECT "expiresAt" FROM "session"');
    return (result.rows[0].expiresAt.getTime() - Date.now()) / 1000;
  }
});
