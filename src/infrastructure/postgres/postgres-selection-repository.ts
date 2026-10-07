import type pg from 'pg';
import type { RepositoryReadError } from '@/application/ports/repository-error';
import type {
  MenuChoice,
  SelectionRepository,
  SelectionWriteError,
} from '@/application/ports/selection-repository';
import type { LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { inTransaction } from '@/infrastructure/postgres/transaction';

// Postgres error code for a foreign key violation; the key to menu is deferred, so it comes at COMMIT.
const FOREIGN_KEY_VIOLATION = '23503';

// `starts_on::text` keeps the date a `YYYY-MM-DD` string: `pg` would turn a `date` into a `Date` at local midnight.
const LIST_FROM = `
  SELECT id, menu_number, starts_on::text AS starts_on
  FROM selection
  WHERE user_id = $1 AND starts_on >= $2::date
  ORDER BY starts_on`;

const DELETE_SAME_START = 'DELETE FROM selection WHERE user_id = $1 AND starts_on = $2::date';

const INSERT_SELECTION = `
  INSERT INTO selection (user_id, menu_number, starts_on)
  VALUES ($1, $2, $3::date)
  RETURNING id, menu_number, starts_on::text AS starts_on`;

type SelectionRow = { id: string; menu_number: number; starts_on: string };

/** The users' menu selections in Postgres. Every query filters by the user, since there are no RLS policies yet. */
export class PostgresSelectionRepository implements SelectionRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** The user's selections starting on `from` or later, ordered by start date. */
  async listFrom(userId: string, from: LocalDate): Promise<Result<Selection[], RepositoryReadError>> {
    try {
      const { rows } = await this.pool.query<SelectionRow>(LIST_FROM, [userId, from]);
      return ok(rows.map(toSelection));
    } catch (error) {
      return err({ kind: 'read-failed', reason: describeDatabaseError(error) });
    }
  }

  /** Deletes the user's selection of the same start date and inserts the new one, in one transaction (design D4). */
  async replace(userId: string, choice: MenuChoice): Promise<Result<Selection, SelectionWriteError>> {
    try {
      const row = await inTransaction(this.pool, (client) => deleteAndInsert(client, userId, choice));
      return ok(toSelection(row));
    } catch (error) {
      return err(toWriteError(error));
    }
  }
}

async function deleteAndInsert(client: pg.PoolClient, userId: string, choice: MenuChoice): Promise<SelectionRow> {
  await client.query(DELETE_SAME_START, [userId, choice.startsOn]);
  const { rows } = await client.query<SelectionRow>(INSERT_SELECTION, [userId, choice.menuNumber, choice.startsOn]);
  return rows[0];
}

function toSelection(row: SelectionRow): Selection {
  return { id: row.id, menuNumber: row.menu_number, startsOn: row.starts_on as LocalDate };
}

function toWriteError(error: unknown): SelectionWriteError {
  if (isForeignKeyViolation(error)) return { kind: 'unknown-menu' };
  return { kind: 'write-failed', reason: describeDatabaseError(error) };
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === FOREIGN_KEY_VIOLATION;
}
