import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AccountCreator } from '@/application/ports/account-creator';
import { createAccountCreator } from '@/infrastructure/auth/create-account';
import {
  clearTables,
  configFor,
  countRows,
  PASSWORD,
  seedAccount,
} from '@/infrastructure/auth/auth-test-support';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const EMAIL = 'ana@example.test';
const HOSTILE_VALUES = [
  "' OR 1=1; --",
  'ana😀@example.test',
  'josé@example.test',
  'a\u0000b@example.test',
  `${'a'.repeat(10_000)}@example.test`,
];

describe.skipIf(!TEST_DATABASE_URL)('createAccountCreator (Neon test branch)', () => {
  let db: TestDatabase;
  let accounts: AccountCreator;
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    accounts = createAccountCreator(configFor(db.pool));
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    await clearTables(db.pool);
  });

  const create = (account: { email: string; password: string }) => accounts.create({ ...account, name: 'Ana' });

  it('creates one user and one credential account, and stores a hash, not the password', async () => {
    const created = await create({ email: EMAIL, password: PASSWORD });

    expect(created.ok).toBe(true);
    const rows = await db.pool.query<{ providerId: string; password: string }>(
      'SELECT a."providerId", a."password" FROM "account" a JOIN "user" u ON u."id" = a."userId" WHERE u."email" = $1',
      [EMAIL],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].providerId).toBe('credential');
    expect(rows.rows[0].password).not.toContain(PASSWORD);
    expect(await countRows(db.pool, 'session')).toBe(0);
  });

  it('refuses an email that already has an account and leaves the existing account unchanged', async () => {
    await seedAccount(accounts, EMAIL);
    const before = await passwordHashOf(EMAIL);

    const created = await create({ email: EMAIL, password: 'another-password-123' });

    expect(created).toEqual({ ok: false, error: { kind: 'email-taken' } });
    expect(await passwordHashOf(EMAIL)).toBe(before);
    expect(await countRows(db.pool, 'user')).toBe(1);
  });

  it.each([
    ['a blank email', { email: '   ', password: PASSWORD }, 'email'],
    ['a malformed email', { email: 'not-an-email', password: PASSWORD }, 'email'],
    ['a password of 7 characters', { email: EMAIL, password: 'a'.repeat(7) }, 'password'],
    ['a password of 129 characters', { email: EMAIL, password: 'a'.repeat(129) }, 'password'],
  ])('rejects %s, names the field and adds no row', async (_label, account, field) => {
    const created = await create(account);

    expect(created).toEqual({ ok: false, error: { kind: 'invalid-input', field } });
    expect(await countRows(db.pool, 'user')).toBe(0);
  });

  it.each(HOSTILE_VALUES)('rejects the hostile email %# as invalid and touches no account', async (email) => {
    await seedAccount(accounts, EMAIL);
    const before = await passwordHashOf(EMAIL);

    const created = await create({ email, password: PASSWORD });

    expect(created).toEqual({ ok: false, error: { kind: 'invalid-input', field: 'email' } });
    expect(await passwordHashOf(EMAIL)).toBe(before);
    expect(await countRows(db.pool, 'user')).toBe(1);
  });

  it('does not throw for a password of 10 000 characters, and adds no row', async () => {
    const created = await create({ email: EMAIL, password: 'p'.repeat(10_000) });

    expect(created).toEqual({ ok: false, error: { kind: 'invalid-input', field: 'password' } });
    expect(await countRows(db.pool, 'user')).toBe(0);
  });

  async function passwordHashOf(email: string): Promise<string> {
    const result = await db.pool.query<{ password: string }>(
      'SELECT a."password" FROM "account" a JOIN "user" u ON u."id" = a."userId" WHERE u."email" = $1',
      [email],
    );
    return result.rows[0].password;
  }
});
