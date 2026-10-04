import { getMigrations } from 'better-auth/db/migration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authOptions } from '@/infrastructure/auth/auth-options';
import { configFor } from '@/infrastructure/auth/auth-test-support';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const AUTH_TABLES = ['account', 'session', 'user', 'verification'];

describe.skipIf(!TEST_DATABASE_URL)('authentication schema (Neon test branch)', () => {
  let db: TestDatabase;
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
  });
  afterAll(async () => {
    await db.drop();
  });

  it('creates the user, session, account and verification tables', async () => {
    const names = (await authTables()).map((table) => table.name);

    expect(names).toEqual(AUTH_TABLES);
  });

  it('enables row-level security on every authentication table', async () => {
    const tables = await authTables();

    expect(tables).toEqual(AUTH_TABLES.map((name) => ({ name, rls: true })));
  });

  it('defines no policy on any authentication table, so only the owner role reads or writes', async () => {
    const policies = await db.pool.query('SELECT tablename, policyname FROM pg_policies WHERE schemaname = $1', [
      db.schema,
    ]);

    expect(policies.rows).toEqual([]);
  });

  // Stands in for the library's check at start-up, which is off (design D5). The library's introspection reads every
  // schema of the database, so it can fail while another test file drops its own schema: hence the retry.
  it('matches what the library expects: no table, column or index left to create', { retry: 2 }, async () => {
    const pending = await getMigrations(authOptions(configFor(db.pool), 'closed'));

    expect(pending.toBeCreated).toEqual([]);
    expect(pending.toBeAdded).toEqual([]);
    expect(pending.toBeAddedIndexes).toEqual([]);
  });

  async function authTables() {
    const result = await db.pool.query<{ name: string; rls: boolean }>(
      `SELECT c.relname AS name, c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r' AND c.relname = ANY($2)
        ORDER BY c.relname`,
      [db.schema, AUTH_TABLES],
    );
    return result.rows;
  }
});
