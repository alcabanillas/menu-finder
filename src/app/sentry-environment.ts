type Env = Record<string, string | undefined>;

/**
 * The label Sentry puts on every event, so previews and production do not mix: Vercel's `VERCEL_ENV` tells them apart,
 * while `NODE_ENV` is `production` in both. Never empty. One definition for the server, the browser and the build.
 */
export function sentryEnvironment(env: Env): string {
  return env.VERCEL_ENV || env.NODE_ENV || 'development';
}
