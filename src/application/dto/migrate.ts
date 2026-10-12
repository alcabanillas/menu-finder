/** The migrations a run applied, in order. */
export type MigrateSummary = { applied: string[] };

/** The failure, with the migrations applied before it in the same run. */
export type MigrateError = { kind: 'migration-failed'; migration: string | null; reason: string; applied: string[] };
