import { createAccount } from '@/application/use-cases/auth/create-account';
import { createAccountCreator } from '@/infrastructure/auth/create-account';
import { BETTER_AUTH_SECRET, DATABASE_URL, requiring, type Env } from './requiring';
import { withPool } from './with-pool';

// The library asks for a base URL when it is built, but only uses it to write email-verification links, and this system
// verifies no email (SEG-sistema-cerrado). The session cookie is signed with the secret, not with the URL, so an account
// created here signs in on the deployed web. The CLI never serves a request, so this is a fixed value, not a variable.
const ACCOUNT_BASE_URL = 'http://localhost:3000';

/** What `ingest account` asks for. The password is read only after the environment is known to be complete. */
export type AccountRequest = { email: string; name?: string; readPassword: () => Promise<string> };

/** Account creation commands wired to the database and auth secret. */
export function accountCommands(env: Env) {
  return {
    createAccount: ({ email, name, readPassword }: AccountRequest) =>
      requiring(env, [DATABASE_URL, BETTER_AUTH_SECRET], async ([url, secret]) => {
        const password = await readPassword();
        return withPool(url, (pool) =>
          createAccount(
            { accounts: createAccountCreator({ pool, secret, baseUrl: ACCOUNT_BASE_URL }) },
            { email, name, password },
          ),
        );
      }),
  };
}
