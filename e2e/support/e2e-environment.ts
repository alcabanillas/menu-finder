import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

type Variables = Record<string, string | undefined>;

/** The end-to-end run's own port: never 3000, where a `pnpm dev` pointing to the app database may be open (MF-49 design D2). */
export const E2E_PORT = 3100;

/** The same placeholder CI used before: a host that never resolves, so a missing test database cannot reach a real one. */
const UNREACHABLE_DATABASE = 'postgresql://e2e:e2e@unreachable.invalid:5432/none';

export type E2eEnvironment = { DATABASE_URL: string; DATABASE_URL_UNPOOLED: string; BETTER_AUTH_URL: string };

/**
 * The variables the end-to-end server and the CLI get (MF-49 design D1): both database variables are the test
 * database, or an unreachable host without one. The app's `DATABASE_URL` of the env file is never read.
 */
export function e2eEnvironment(processEnv: Variables, envFile: Variables): E2eEnvironment {
  const url = testDatabaseUrl(processEnv, envFile) ?? UNREACHABLE_DATABASE;
  return { DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, BETTER_AUTH_URL: `http://localhost:${E2E_PORT}` };
}

/** `DATABASE_URL_TEST` from the process, else from the env file; undefined when neither has a value. */
export function testDatabaseUrl(processEnv: Variables, envFile: Variables): string | undefined {
  return processEnv.DATABASE_URL_TEST || envFile.DATABASE_URL_TEST || undefined;
}

/** The environment of this process, with `DATABASE_URL_TEST` from `.env.local` as the fallback. */
export function currentE2eEnvironment(): E2eEnvironment {
  return e2eEnvironment(process.env, readEnvFile());
}

/** Only `DATABASE_URL_TEST` is taken from `.env.local`: never the app database URL or any key. */
export function readEnvFile(): Variables {
  // Playwright and Vitest both run from the repository root; Playwright loads this file as CommonJS (no import.meta).
  const file = join(process.cwd(), '.env.local');
  if (!existsSync(file)) return {};
  return { DATABASE_URL_TEST: parseEnv(readFileSync(file, 'utf8')).DATABASE_URL_TEST };
}

