import type { CreateAccountError } from '@/application/use-cases/create-account';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { AccountRequest, MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type Print = (line: string) => void;

type CreateAccountDeps = AccountRequest & {
  createAccount: (request: AccountRequest) => Promise<Result<{ userId: string }, CreateAccountError | MissingVariables>>;
  print: Print;
};

/** `ingest account`: creates an account. Prints the email on success, never the password. Returns the exit code. */
export async function runCreateAccount({ email, name, readPassword, createAccount, print }: CreateAccountDeps): Promise<number> {
  const result = await createAccount({ email, name, readPassword });
  if (result.ok) {
    print(`Created account ${email}`);
    return 0;
  }
  describeError(result.error, email).forEach(print);
  return 1;
}

function describeError(error: CreateAccountError | MissingVariables, email: string): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case 'email-taken':
      return [`The email ${email} already has an account.`];
    case 'invalid-input':
      return [`Invalid ${error.field}.`];
    case 'password-required':
      return ['A password is required: type it at the prompt or pipe it through stdin.'];
    case 'failed':
      return [redactSecrets(`Cannot create the account: ${error.reason}`)];
  }
}
