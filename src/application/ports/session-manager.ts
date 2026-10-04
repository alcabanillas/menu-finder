import type { SignedInUser } from '@/application/dto/signed-in-user';
import type { Result } from '@/shared/result';

export type { SignedInUser };

/** The limits of the accounts (MF-20.1 D6): longer values cannot belong to any account, so they are not sent on. */
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PASSWORD_LENGTH = 128;

export type Credentials = { email: string; password: string };

export type SignInError = { kind: 'wrong-credentials' } | { kind: 'failed'; reason: string };

/** The session of the current request: signing in sets it, signing out revokes it, and every page can read it. */
export interface SessionManager {
  /** Starts a session when the credentials match an account. An unknown email and a wrong password fail alike. */
  signIn(credentials: Credentials): Promise<Result<SignedInUser, SignInError>>;
  /** Revokes the current session, if any, and returns the id of the user it belonged to. */
  signOut(): Promise<{ userId: string | null }>;
  /** The user of a valid session, or `null` when there is none (missing, expired, revoked or forged). */
  current(): Promise<SignedInUser | null>;
}
