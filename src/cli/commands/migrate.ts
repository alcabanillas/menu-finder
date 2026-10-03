import type { MigrateError, MigrateSummary } from '@/application/dto/migrate';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type Print = (line: string) => void;

/** `ingest migrate`: applies the pending SQL migrations. Returns the exit code. */
export async function runMigrate({
  migrate,
  print,
}: {
  migrate: () => Promise<Result<MigrateSummary, MigrateError | MissingVariables>>;
  print: Print;
}): Promise<number> {
  const result = await migrate();
  if (result.ok) {
    if (result.value.applied.length === 0) print('No pending migrations.');
    result.value.applied.forEach((id) => print(`Applied ${id}`));
    return 0;
  }
  const error = result.error;
  if (isMissingVariables(error)) {
    missingLines(error).forEach(print);
    return 1;
  }
  error.applied.forEach((id) => print(`Applied ${id}`));
  print(
    redactSecrets(error.migration ? `${error.migration} failed: ${error.reason}` : `Cannot migrate: ${error.reason}`),
  );
  return 1;
}
