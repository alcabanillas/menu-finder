import { randomBytes } from "node:crypto";
import pg from "pg";
import { MIGRATIONS_DIR, PostgresMigrationRunner } from "@/infrastructure/postgres/postgres-migration-runner";

/**
 * Integration tests run against a temporary Neon branch, never `production`
 * (MF-41 design D8), whose direct URL is in `DATABASE_URL_TEST`. Each test
 * file gets its own schema, dropped at the end, so runs do not see each other.
 */
export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

if (!TEST_DATABASE_URL) {
  process.stderr.write("DATABASE_URL_TEST is not set: the Postgres integration tests are skipped.\n");
}

export type TestDatabase = { pool: pg.Pool; schema: string; drop: () => Promise<void> };

/** A test database with every migration of `postgres/migrations/` applied. */
export async function createMigratedTestDatabase(url: string): Promise<TestDatabase> {
  const db = await createTestDatabase(url);
  const runner = new PostgresMigrationRunner(db.pool, MIGRATIONS_DIR);
  const available = await runner.available();
  if (!available.ok) throw new Error(available.error.reason);
  for (const id of available.value.sort()) {
    const applied = await runner.apply(id);
    if (!applied.ok) throw new Error(applied.error.reason);
  }
  return db;
}

export async function createTestDatabase(url: string): Promise<TestDatabase> {
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  // The schema name is generated here from random hex, never from input.
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
