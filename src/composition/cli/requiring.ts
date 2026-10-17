import { err, type Result } from '@/shared/result';

export const DATABASE_URL = 'DATABASE_URL_UNPOOLED';
export const GEMINI_API_KEY = 'GEMINI_API_KEY';
export const BETTER_AUTH_SECRET = 'BETTER_AUTH_SECRET';

/** Environment variables a command needs and that are not set. Checked before connecting to anything. */
export type MissingVariables = { kind: 'missing-variables'; names: string[] };

export type Env = Record<string, string | undefined>;

/** Runs `work` with the values of `names`, or names every unset or empty one and runs nothing. */
export async function requiring<T>(
  env: Env,
  names: string[],
  work: (values: string[]) => Promise<T>,
): Promise<T | Result<never, MissingVariables>> {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) return err({ kind: 'missing-variables', names: missing });
  return work(names.map((name) => env[name]!));
}
