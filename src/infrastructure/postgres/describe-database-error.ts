import { redactSecrets } from "@/shared/redact-secrets";

// Postgres error code for a missing table: the schema was never migrated.
const UNDEFINED_TABLE = "42P01";

/** The text of a driver error, safe to print: no credentials, and a hint when the schema is missing. */
export function describeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const hint = code === UNDEFINED_TABLE ? " (run `pnpm ingest migrate` first)" : "";
  return `${redactSecrets(message)}${hint}`;
}
