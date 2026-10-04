import { betterAuth } from 'better-auth';
import { authOptions, type AuthConfig } from '@/infrastructure/auth/auth-options';

export type { AuthConfig };

/** The authentication the web uses: email and password, sessions in the database, public sign-up rejected. */
export function createAuth(config: AuthConfig) {
  return betterAuth(authOptions(config, 'closed'));
}
