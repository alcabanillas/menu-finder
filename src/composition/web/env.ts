export type Env = Record<string, string | undefined>;

// The pooled URL: on Vercel there is no long-lived process (ADR-001 §5).
const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const;
// Needed by the search only: login and the menus work without it (design D6).
const GEMINI_API_KEY = 'GEMINI_API_KEY';

/** The variables every use case needs, in the order of `REQUIRED`; a missing one is named, never its value. */
export function requireAll(env: Env): string[] {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return REQUIRED.map((name) => env[name]!);
}

/** The key of the search only: a missing one fails the search and nothing else. */
export function requireApiKey(env: Env): string {
  const apiKey = env[GEMINI_API_KEY];
  if (!apiKey) throw new Error(`Missing environment variables: ${GEMINI_API_KEY}`);
  return apiKey;
}
