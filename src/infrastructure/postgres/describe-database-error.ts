import { redactSecrets } from '@/shared/redact-secrets';

// Postgres error code for a missing table: the schema was never migrated.
const UNDEFINED_TABLE = '42P01';
// Postgres error code for foreign key violation: referenced row is missing.
const FOREIGN_KEY_VIOLATION = '23503';

/** The text of a driver error, safe to print: no credentials, and a hint when the schema is missing. */
export function describeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  const detail = typeof error === 'object' && error !== null ? (error as { detail?: unknown }).detail : undefined;

  if (code === FOREIGN_KEY_VIOLATION && typeof detail === 'string') {
    const match = detail.match(/Key \(menu_number\)=\((\d+)\)/);
    if (match) {
      return `Menu ${match[1]} is not in the database (run \`pnpm ingest menu\` first)`;
    }
  }

  const hint = code === UNDEFINED_TABLE ? ' (run `pnpm ingest migrate` first)' : '';
  return `${redactSecrets(message)}${hint}`;
}
