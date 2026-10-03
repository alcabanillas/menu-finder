import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import type { MigrationError, MigrationRunner } from '@/application/ports/migration-runner';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';

/** `postgres/migrations/` at the repository root: SQL, not code of the hexagon (MF-41 design D3). */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../../postgres/migrations', import.meta.url));

// The record of applied migrations, with row-level security like every table of the project.
const RECORD_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migration (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE schema_migration ENABLE ROW LEVEL SECURITY;
`;

/** Applies the SQL files of `postgres/migrations/`, each in its own transaction, and records them in `schema_migration`. */
export class PostgresMigrationRunner implements MigrationRunner {
  constructor(
    private readonly pool: pg.Pool,
    private readonly dir: string,
  ) {}

  async available(): Promise<Result<string[], MigrationError>> {
    try {
      return ok((await readdir(this.dir)).filter((name) => name.endsWith('.sql')));
    } catch (error) {
      return failure(null, error);
    }
  }

  async applied(): Promise<Result<string[], MigrationError>> {
    try {
      await this.pool.query(RECORD_TABLE);
      const { rows } = await this.pool.query<{ id: string }>('SELECT id FROM schema_migration ORDER BY id');
      return ok(rows.map((row) => row.id));
    } catch (error) {
      return failure(null, error);
    }
  }

  async apply(id: string): Promise<Result<void, MigrationError>> {
    let client: pg.PoolClient | undefined;
    try {
      const sql = await readFile(join(this.dir, id), 'utf8');
      client = await this.pool.connect();
      await client.query('BEGIN');
      await client.query(RECORD_TABLE);
      await client.query(sql);
      await client.query('INSERT INTO schema_migration (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      return ok(undefined);
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => undefined);
      return failure(id, error);
    } finally {
      client?.release();
    }
  }
}

function failure(migration: string | null, error: unknown): Result<never, MigrationError> {
  return err({ kind: 'migration-failed', migration, reason: describeDatabaseError(error) });
}
