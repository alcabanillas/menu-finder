import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCliContainer } from '@/composition/cli-container';
import { createAuth } from '@/infrastructure/auth/create-auth';
import { createMigratedTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '@/infrastructure/postgres/test-database';

// Test values, not credentials: the secret has the length the setup demands.
const SECRET = 'test-secret-with-at-least-32-characters-long-0123456789';
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
const PASSWORD = 'correct-horse-battery';
const EMAIL = 'ana@example.test';
const HOSTILE_EMAILS = ["' OR 1=1; --", 'ana😀@example.test', 'a\u0000b@example.test', `${'a'.repeat(10_000)}@example.test`];

const HOSTILE_NAMES = ["' OR 1=1; --", 'Ana😀', 'a\u0000b', 'a'.repeat(10_000), '<script>alert(1)</script>'];

describe.skipIf(!TEST_DATABASE_URL)('ingest account through the CLI container (Neon test branch)', () => {
  let db: TestDatabase;
  let create: (email: string, password?: string, name?: string) => ReturnType<ReturnType<typeof createCliContainer>['createAccount']>;
  let web: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    const container = createCliContainer({ DATABASE_URL_UNPOOLED: urlInSchema(TEST_DATABASE_URL!, db.schema), BETTER_AUTH_SECRET: SECRET });
    create = (email, password = PASSWORD, name) => container.createAccount({ email, name, readPassword: async () => password });
    web = createAuth({ pool: db.pool, secret: SECRET, baseUrl: 'http://localhost:3000' });
  });
  afterAll(async () => {
    await db.drop();
  });
  beforeEach(async () => {
    await db.pool.query('TRUNCATE "user" CASCADE');
  });

  const signIn = (email: string, password: string) => web.api.signInEmail({ body: { email, password } });
  const count = async (table: 'user' | 'account' | 'session') =>
    (await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;

  it('creates an account that signs in on the closed setup the web uses', async () => {
    const created = await create(EMAIL);

    expect(created.ok).toBe(true);
    expect((await signIn(EMAIL, PASSWORD)).token).toBeTruthy();
    expect(await count('session')).toBe(1);
  });

  it('names the account after the email when no name is given', async () => {
    await create(EMAIL);

    const { rows } = await db.pool.query<{ name: string }>('SELECT name FROM "user"');
    expect(rows).toEqual([{ name: 'ana' }]);
  });

  it('keeps the name it is given', async () => {
    await create(EMAIL, PASSWORD, 'Ana G.');

    const { rows } = await db.pool.query<{ name: string }>('SELECT name FROM "user"');
    expect(rows).toEqual([{ name: 'Ana G.' }]);
  });

  it('rejects a second account for the same email and keeps the first password', async () => {
    await create(EMAIL);

    const again = await create(EMAIL, 'another-password-123');

    expect(again).toEqual({ ok: false, error: { kind: 'email-taken' } });
    expect((await signIn(EMAIL, PASSWORD)).token).toBeTruthy();
    await expect(signIn(EMAIL, 'another-password-123')).rejects.toThrow();
    expect(await count('user')).toBe(1);
  });

  it('refuses an empty password and adds no row', async () => {
    expect(await create(EMAIL, '')).toEqual({ ok: false, error: { kind: 'password-required' } });
    expect(await count('user')).toBe(0);
  });

  it.each(HOSTILE_NAMES)('answers a hostile name with a result, not an error, and keeps what it stores sane: %#', async (name) => {
    const result = await create(EMAIL, PASSWORD, name);

    expect(await count('user')).toBe(result.ok ? 1 : 0);
    expect(JSON.stringify(result)).not.toMatch(/invalid byte|unterminated|syntax error|\bpg_|relation "/i);
  });

  it.each(HOSTILE_EMAILS)('answers a hostile email with a result, not an error, and changes nothing else: %#', async (email) => {
    const result = await create(email);

    expect(await count('user')).toBe(result.ok ? 1 : 0);
    expect(await count('account')).toBe(result.ok ? 1 : 0);
  });
});

// The container opens its own pool from a URL; `options` gives it the same search path as the pool of the test schema.
function urlInSchema(url: string, schema: string): string {
  const withOptions = new URL(url);
  withOptions.searchParams.set('options', `-c search_path=${schema},public`);
  return withOptions.toString();
}
