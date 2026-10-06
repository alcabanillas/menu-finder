import { execSync } from 'node:child_process';
import { e2eEnvironment, readEnvFile, testDatabaseUrl } from './e2e-environment';

type Variables = Record<string, string | undefined>;
type Run = (command: string, env: NodeJS.ProcessEnv) => void;

/**
 * Playwright global setup (MF-49 design D3): applies the pending migrations to the test database before the run,
 * the same locally and in CI. Without `DATABASE_URL_TEST` it does nothing, so no other database is ever migrated.
 */
export default function globalSetup(): void {
  migrateTestDatabase(process.env, readEnvFile(), runInheritingOutput);
}

/** Runs `pnpm ingest migrate` with the test database as both connections, if there is one. */
export function migrateTestDatabase(processEnv: Variables, envFile: Variables, run: Run): void {
  if (!testDatabaseUrl(processEnv, envFile)) return;
  run('pnpm ingest migrate', { ...process.env, ...e2eEnvironment(processEnv, envFile) });
}

function runInheritingOutput(command: string, env: NodeJS.ProcessEnv): void {
  execSync(command, { env, stdio: 'inherit' });
}
