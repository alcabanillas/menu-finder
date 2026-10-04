import type { BetterAuthOptions } from 'better-auth';
import type pg from 'pg';

export type AuthConfig = { pool: pg.Pool; secret: string; baseUrl: string };

/** Whether the public sign-up endpoint answers (`open`) or is rejected (`closed`). */
export type SignUp = 'open' | 'closed';

const MIN_SECRET_LENGTH = 32;
const DAY_SECONDS = 86_400;
const SESSION_LIFETIME_DAYS = 7;
// SEG-auth: 7 days, renewed when used more than 1 day after the last renewal. Written out, although they are
// the library's defaults, so that a test pins them and a library upgrade cannot change them silently.
const SESSION_LIFETIME_SECONDS = SESSION_LIFETIME_DAYS * DAY_SECONDS;
const SESSION_RENEWAL_SECONDS = DAY_SECONDS;
const MIN_PASSWORD_LENGTH = 8;
// The cap matters: hashing a very long password is a cheap way to burn CPU.
const MAX_PASSWORD_LENGTH = 128;

/** The settings both setups share. Throws, without naming the value, when the secret is missing or too short. */
export function authOptions(config: AuthConfig, signUp: SignUp): BetterAuthOptions {
  assertSecret(config.secret);
  return {
    database: config.pool,
    secret: config.secret,
    baseURL: config.baseUrl,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: signUp === 'closed',
      autoSignIn: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },
    session: { expiresIn: SESSION_LIFETIME_SECONDS, updateAge: SESSION_RENEWAL_SECONDS },
    // The tables come from our migration and auth-schema.test.ts compares them with the library. The start-up check
    // would read the whole catalogue on every cold start, and fails when another schema is dropped meanwhile.
    advanced: { database: { validateSchema: false } },
  };
}

function assertSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters`);
  }
}
