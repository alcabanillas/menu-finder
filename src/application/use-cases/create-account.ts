import type { AccountCreator, AccountError } from '@/application/ports/account-creator';
import { err, type Result } from '@/shared/result';

export type CreateAccountInput = { email: string; password: string; name?: string };

/** `password-required` is the only error that does not come from the port: nothing was sent to it. */
export type CreateAccountError = AccountError | { kind: 'password-required' };

/** `pnpm ingest account`: creates an account. Without a name, the account takes the part of the email before the `@`. */
export async function createAccount(
  { accounts }: { accounts: AccountCreator },
  { email, password, name }: CreateAccountInput,
): Promise<Result<{ userId: string }, CreateAccountError>> {
  if (password === '') return err({ kind: 'password-required' });
  const created = await accounts.create({ email, password, name: name?.trim() || localPart(email) });
  return created.ok ? created : err(withoutPassword(created.error, password));
}

function localPart(email: string): string {
  return email.split('@')[0];
}

// A failure message may repeat the request it rejected; the password must not reach any output.
function withoutPassword(error: AccountError, password: string): AccountError {
  return error.kind === 'failed' ? { kind: 'failed', reason: error.reason.replaceAll(password, '[hidden]') } : error;
}
