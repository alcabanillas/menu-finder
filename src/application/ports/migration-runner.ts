import type { Result } from '@/shared/result';

/** `migration` is `null` when the failure is not about one migration (listing, connecting). */
export type MigrationError = { kind: 'migration-failed'; migration: string | null; reason: string };

/** The SQL migrations in `postgres/migrations/` and the record of the ones applied to the database. */
export interface MigrationRunner {
  /** Migration ids (file names), in any order. */
  available(): Promise<Result<string[], MigrationError>>;
  applied(): Promise<Result<string[], MigrationError>>;
  /** Applies one migration and records it, in one transaction. */
  apply(id: string): Promise<Result<void, MigrationError>>;
}
