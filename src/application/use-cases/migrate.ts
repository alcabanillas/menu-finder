import { err, ok, type Result } from '@/shared/result';
import type { MigrateError, MigrateSummary } from '@/application/dto/migrate';
import type { MigrationRunner } from '@/application/ports/migration-runner';

/** `pnpm ingest migrate`: applies the pending migrations in file-name order, stopping at the first failure. */
export async function migrate({ runner }: { runner: MigrationRunner }): Promise<Result<MigrateSummary, MigrateError>> {
  const available = await runner.available();
  if (!available.ok) return err({ ...available.error, applied: [] });
  const done = await runner.applied();
  if (!done.ok) return err({ ...done.error, applied: [] });

  const applied: string[] = [];
  const pending = available.value.filter((id) => !done.value.includes(id)).sort();
  for (const id of pending) {
    const result = await runner.apply(id);
    if (!result.ok) return err({ ...result.error, applied });
    applied.push(id);
  }
  return ok({ applied });
}
