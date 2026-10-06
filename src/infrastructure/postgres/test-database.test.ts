import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMigratedTestDatabase,
  dropStaleTestSchemas,
  TEST_DATABASE_URL,
} from '@/infrastructure/postgres/test-database';

// A fixed past instant: schemas of runs in progress carry a current time, so they are always "in the future" of
// this `now` and are never touched by these tests, which run in parallel with the other integration test files.
const BASE_SECONDS = 1_000_000_000;
const HOUR_SECONDS = 3600;
const now = new Date((BASE_SECONDS + 2 * HOUR_SECONDS) * 1000);
// Two hours before `now`, so stale; half an hour before `now`, so fresh.
const OLD_SCHEMA = `test_${BASE_SECONDS}_aaaaaaaaaaaa`;
const FRESH_SCHEMA = `test_${BASE_SECONDS + HOUR_SECONDS + HOUR_SECONDS / 2}_bbbbbbbbbbbb`;
// Old enough to be dropped if the pattern were loose: one hex digit too many, one digit too few, no random part.
const NOT_TEST_SCHEMAS = ['test_notes', `test_${BASE_SECONDS}_aaaaaaaaaaaaa`, 'test_999999999_aaaaaaaaaaaa', `test_${BASE_SECONDS}`];

// Another fixed past instant: only the failing-migration test creates schemas named after it.
const FAILING_RUN_SECONDS = 1_100_000_000;

let connection: Promise<pg.Client> | undefined;

afterAll(async () => {
  await (await connection)?.end();
});

describe.skipIf(!TEST_DATABASE_URL)('dropStaleTestSchemas (Neon test branch)', () => {
  const created: string[] = [];

  afterEach(async () => {
    for (const schema of created.splice(0)) await run(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  });

  it('drops a test schema created more than one hour before now', async () => {
    await createSchema(OLD_SCHEMA);

    await dropStaleTestSchemas(TEST_DATABASE_URL!, now);

    expect(await schemaExists(OLD_SCHEMA)).toBe(false);
  });

  it('keeps a test schema created less than one hour before now', async () => {
    await createSchema(FRESH_SCHEMA);

    await dropStaleTestSchemas(TEST_DATABASE_URL!, now);

    expect(await schemaExists(FRESH_SCHEMA)).toBe(true);
  });

  it('keeps public and schemas that do not match the test pattern exactly, however old they look', async () => {
    for (const schema of NOT_TEST_SCHEMAS) await createSchema(schema);

    await dropStaleTestSchemas(TEST_DATABASE_URL!, now);

    expect(await schemaExists('public')).toBe(true);
    for (const schema of NOT_TEST_SCHEMAS) expect(await schemaExists(schema)).toBe(true);
  });

  async function createSchema(schema: string): Promise<void> {
    await run(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    created.push(schema);
  }
});

describe.skipIf(!TEST_DATABASE_URL)('createMigratedTestDatabase (Neon test branch)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects on an invalid migration and leaves no schema behind', async () => {
    const migrations = await mkdtemp(join(tmpdir(), 'invalid-migrations-'));
    await writeFile(join(migrations, '001-invalid.sql'), 'THIS IS NOT SQL;');
    // A clock of its own, so the schema of this test is told apart from those of parallel test files.
    vi.setSystemTime(new Date(FAILING_RUN_SECONDS * 1000));

    await expect(createMigratedTestDatabase(TEST_DATABASE_URL!, migrations)).rejects.toThrow();

    expect(await schemasStartingWith(`test_${FAILING_RUN_SECONDS}_`)).toEqual([]);
  });
});

async function schemasStartingWith(prefix: string): Promise<string[]> {
  const { rows } = await run('SELECT nspname FROM pg_namespace WHERE nspname LIKE $1', [`${prefix}%`]);
  return rows.map((row) => row.nspname);
}

async function schemaExists(schema: string): Promise<boolean> {
  const { rowCount } = await run('SELECT 1 FROM pg_namespace WHERE nspname = $1', [schema]);
  return rowCount === 1;
}

// One connection for the whole file: a new TLS connection to Neon per query made a test pass 5 s on the CI runner.
async function run(sql: string, params: string[] = []): Promise<pg.QueryResult> {
  connection ??= connect();
  return (await connection).query(sql, params);
}

async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}
