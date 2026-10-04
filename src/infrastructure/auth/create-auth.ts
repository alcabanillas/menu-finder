import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { authOptions, type AuthConfig } from '@/infrastructure/auth/auth-options';

export type { AuthConfig };

/** The authentication the web uses: email and password, sessions in the database, public sign-up rejected. */
export function createAuth(config: AuthConfig) {
  // nextCookies lets the server actions set and clear the session cookie (MF-20.3 design D1); it must be the last plugin.
  return betterAuth({ ...authOptions(config, 'closed'), plugins: [nextCookies()] });
}
