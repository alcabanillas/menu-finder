import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { MIGRATIONS_DIR, PostgresMigrationRunner } from '@/infrastructure/postgres/postgres-migration-runner';

/**
 * Integration tests run against a Neon branch kept for tests, never `production`
 * (MF-41 design D8), whose direct URL is in `DATABASE_URL_TEST`. Each test
 * file gets its own schema, dropped at the end, so runs do not see each other.
 */
export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

/** Random bytes in each test schema name: 12 hex characters, so parallel test files never share a schema. */
const SCHEMA_SUFFIX_BYTES = 6;

/** `test_<unix seconds>_<12 hex>`: the only names the stale cleanup may drop. */
const TEST_SCHEMA_PATTERN = /^test_\d{10}_[0-9a-f]{12}$/;

/** Far above the longest integration test file, so two runs never drop each other's schemas. */
const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;
const STALE_AFTER_MS = SECONDS_PER_HOUR * MS_PER_SECOND;

if (!TEST_DATABASE_URL) {
  process.stderr.write('DATABASE_URL_TEST is not set: the Postgres integration tests are skipped.\n');
}

export type TestDatabase = { pool: pg.Pool; schema: string; drop: () => Promise<void> };

/** A test database with every migration of `directory` (default `postgres/migrations/`) applied; on failure it drops its schema. */
export async function createMigratedTestDatabase(url: string, directory = MIGRATIONS_DIR): Promise<TestDatabase> {
  const db = await createTestDatabase(url);
  try {
    await applyAll(db.pool, directory);
  } catch (error) {
    await db.drop();
    throw error;
  }
  return db;
}

async function applyAll(pool: pg.Pool, directory: string): Promise<void> {
  const runner = new PostgresMigrationRunner(pool, directory);
  const available = await runner.available();
  if (!available.ok) throw new Error(available.error.reason);
  for (const id of available.value.sort()) {
    const applied = await runner.apply(id);
    if (!applied.ok) throw new Error(applied.error.reason);
  }
}

/** A new empty schema on the test database, with a pool whose search path points to it. */
export async function createTestDatabase(url: string): Promise<TestDatabase> {
  const schema = newSchemaName(new Date());
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  // The schema name is generated here from the clock and random hex, never from input.
  // eslint-disable-next-line sonarjs/sql-queries
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const pool = new pg.Pool({ connectionString: url, max: 2, options: `-c search_path=${schema},public` });
  return {
    pool,
    schema,
    drop: async () => {
      await pool.end();
      const cleanup = new pg.Client({ connectionString: url });
      await cleanup.connect();
      // eslint-disable-next-line sonarjs/sql-queries -- same generated schema name
      await cleanup.query(`DROP SCHEMA ${schema} CASCADE`);
      await cleanup.end();
    },
  };
}

function newSchemaName(now: Date): string {
  const seconds = Math.floor(now.getTime() / MS_PER_SECOND);
  return `test_${seconds}_${randomBytes(SCHEMA_SUFFIX_BYTES).toString('hex')}`;
}

/**
 * Drops the test schemas created more than one hour before `now`, left by runs that were cut short (MF-49 design D5).
 * Only names that match the test pattern exactly can be dropped: `public` and any other schema never do.
 */
export async function dropStaleTestSchemas(url: string, now: Date): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ nspname: string }>('SELECT nspname FROM pg_namespace WHERE nspname ~ $1', [
      TEST_SCHEMA_PATTERN.source,
    ]);
    for (const { nspname } of rows.filter(({ nspname: name }) => isStale(name, now))) {
      // The name matched TEST_SCHEMA_PATTERN, so it is `test_<digits>_<hex>` and cannot carry SQL.
      // eslint-disable-next-line sonarjs/sql-queries
      await client.query(`DROP SCHEMA ${nspname} CASCADE`);
    }
  } finally {
    await client.end();
  }
}

function isStale(schema: string, now: Date): boolean {
  if (!TEST_SCHEMA_PATTERN.test(schema)) return false;
  const createdAt = Number(schema.split('_')[1]) * MS_PER_SECOND;
  return now.getTime() - createdAt > STALE_AFTER_MS;
}
