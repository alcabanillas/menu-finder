import type { Result } from '@/shared/result';

export type NewAccount = { email: string; password: string; name: string };

/** The display name is for a screen with two accounts on it: 30 characters, and no control characters. */
export const MAX_NAME_LENGTH = 30;

export type AccountField = 'email' | 'password' | 'name';

export type AccountError =
  | { kind: 'invalid-input'; field: AccountField }
  | { kind: 'email-taken' }
  | { kind: 'failed'; reason: string };

/** The accounts of the closed system (SEG-sistema-cerrado): they are created by trusted code, never by a visitor. */
export interface AccountCreator {
  /** Creates one user with a credential account. An email that already has an account is an error and changes nothing. */
  create(account: NewAccount): Promise<Result<{ userId: string }, AccountError>>;
}
