import { betterAuth } from 'better-auth';
import type { AccountCreator, AccountError, NewAccount } from '@/application/ports/account-creator';
import { authOptions, type AuthConfig } from '@/infrastructure/auth/auth-options';
import { err, ok, type Result } from '@/shared/result';

type OpenAuth = ReturnType<typeof openAuth>;

// RFC 5321 caps an address at 254 characters; the library sets no cap.
const MAX_EMAIL_LENGTH = 254;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Creates accounts with trusted server code. It builds the setup whose sign-up is open (MF-20.1 design D1, option c),
 * so only the composition root of the CLI may call it, and no route may ever mount that setup.
 */
export function createAccountCreator(config: AuthConfig): AccountCreator {
  const auth = openAuth(config);
  return { create: (account) => createAccount(auth, account) };
}

function openAuth(config: AuthConfig) {
  return betterAuth(authOptions(config, 'open'));
}

async function createAccount(auth: OpenAuth, account: NewAccount): Promise<Result<{ userId: string }, AccountError>> {
  if (!isStorableEmail(account.email)) return err(invalidInput('email'));
  try {
    if (await emailTaken(auth, account.email)) return err({ kind: 'email-taken' });
    const created = await auth.api.signUpEmail({ body: account });
    return ok({ userId: created.user.id });
  } catch (error) {
    return err(toAccountError(error));
  }
}

// Checked before any query: a null byte makes PostgreSQL fail with a message that names its internals, and the
// library would store a 10 000-character address.
function isStorableEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && !CONTROL_CHARACTERS.test(email);
}

// The library answers a sign-up for an existing email with a generic success, so that a visitor cannot learn which
// emails have an account. The CLI is trusted and needs to know, so it asks first.
async function emailTaken(auth: OpenAuth, email: string): Promise<boolean> {
  const context = await auth.$context;
  return (await context.internalAdapter.findUserByEmail(email.trim().toLowerCase())) !== null;
}

function toAccountError(error: unknown): AccountError {
  switch (codeOf(error)) {
    case 'INVALID_EMAIL':
      return invalidInput('email');
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
      return invalidInput('password');
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return { kind: 'email-taken' };
    case 'VALIDATION_ERROR':
      return validationError(error);
    default:
      return { kind: 'failed', reason: error instanceof Error ? error.message : 'unknown error' };
  }
}

// The body schema rejects a malformed email before the library's own checks run; its message names the field.
function validationError(error: unknown): AccountError {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('[body.email]')) return invalidInput('email');
  if (message.includes('[body.password]')) return invalidInput('password');
  return { kind: 'failed', reason: message || 'invalid input' };
}

function invalidInput(field: 'email' | 'password'): AccountError {
  return { kind: 'invalid-input', field };
}

function codeOf(error: unknown): string | undefined {
  return (error as { body?: { code?: string } } | null)?.body?.code;
}
