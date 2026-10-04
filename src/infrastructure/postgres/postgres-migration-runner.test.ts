import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, PostgresMigrationRunner } from '@/infrastructure/postgres/postgres-migration-runner';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '@/infrastructure/postgres/test-database';

const SEARCH_TABLES = ['meal', 'menu', 'menu_dish', 'recipe', 'recipe_embedding', 'recipe_ingredient'];

describe.skipIf(!TEST_DATABASE_URL)('PostgresMigrationRunner (Neon test branch)', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await createTestDatabase(TEST_DATABASE_URL!);
  });
  afterEach(async () => {
    await db.drop();
  });

  const tables = async () =>
    (
      await db.pool.query<{ name: string; rls: boolean }>(
        `SELECT c.relname AS name, c.relrowsecurity AS rls
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`,
        [db.schema],
      )
    ).rows;

  it('lists the migration files and creates the six search tables and the record on an empty database', async () => {
    const runner = new PostgresMigrationRunner(db.pool, MIGRATIONS_DIR);

    expect(await runner.available()).toEqual({
      ok: true,
      value: ['001-search-schema.sql', '002-auth-schema.sql'],
    });
    expect(await runner.applied()).toEqual({ ok: true, value: [] });
    expect(await runner.apply('001-search-schema.sql')).toEqual({ ok: true, value: undefined });
    expect((await tables()).map((t) => t.name)).toEqual([...SEARCH_TABLES, 'schema_migration'].sort());
    const vector = await db.pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    expect(vector.rowCount).toBe(1);
  });

  it('enables row-level security on every table it creates', async () => {
    await new PostgresMigrationRunner(db.pool, MIGRATIONS_DIR).apply('001-search-schema.sql');

    const withoutRls = (await tables()).filter((t) => !t.rls).map((t) => t.name);
    expect(withoutRls).toEqual([]);
  });

  it('records an applied migration, so that a second run has nothing pending', async () => {
    const runner = new PostgresMigrationRunner(db.pool, MIGRATIONS_DIR);
    await runner.apply('001-search-schema.sql');

    expect(await runner.applied()).toEqual({ ok: true, value: ['001-search-schema.sql'] });
  });

  it('leaves no trace of a migration that fails half-way', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
    await writeFile(join(dir, '001-broken.sql'), 'CREATE TABLE half_done (id int);\nSELECT * FROM missing_table;\n');
    const runner = new PostgresMigrationRunner(db.pool, dir);
    await runner.applied();

    const result = await runner.apply('001-broken.sql');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.migration).toBe('001-broken.sql');
    expect((await tables()).map((t) => t.name)).toEqual(['schema_migration']);
    expect(await runner.applied()).toEqual({ ok: true, value: [] });
  });
});
