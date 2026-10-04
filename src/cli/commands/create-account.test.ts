import { describe, expect, it } from 'vitest';
import type { CreateAccountError } from '@/application/use-cases/create-account';
import { runCreateAccount } from '@/cli/commands/create-account';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const EMAIL = 'ana@example.test';
const PASSWORD = 'a-long-enough-pass';
const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

type Outcome = Result<{ userId: string }, CreateAccountError | MissingVariables>;

const createWith = async (outcome: Outcome, name?: string) => {
  const lines: string[] = [];
  const requests: { email: string; name?: string }[] = [];
  const code = await runCreateAccount({
    email: EMAIL,
    name,
    readPassword: async () => PASSWORD,
    createAccount: async ({ email, name }) => {
      requests.push({ email, name });
      return outcome;
    },
    print: (line) => lines.push(line),
  });
  return { code, text: lines.join('\n'), requests };
};

describe('runCreateAccount', () => {
  it('prints the email of the new account and exits with 0', async () => {
    const { code, text } = await createWith(ok({ userId: 'user-1' }));

    expect(code).toBe(0);
    expect(text).toBe(`Created account ${EMAIL}`);
  });

  it('passes the email and the name it was given', async () => {
    const { requests } = await createWith(ok({ userId: 'user-1' }), 'Ana G.');

    expect(requests).toEqual([{ email: EMAIL, name: 'Ana G.' }]);
  });

  it('says that the email already has an account', async () => {
    const { code, text } = await createWith(err({ kind: 'email-taken' }));

    expect(code).toBe(1);
    expect(text).toContain(`${EMAIL} already has an account`);
  });

  it.each(['email', 'password'] as const)('names the invalid %s', async (field) => {
    const { code, text } = await createWith(err({ kind: 'invalid-input', field }));

    expect(code).toBe(1);
    expect(text).toContain(`Invalid ${field}`);
  });

  it('asks for a password when there is none', async () => {
    const { code, text } = await createWith(err({ kind: 'password-required' }));

    expect(code).toBe(1);
    expect(text).toContain('A password is required');
  });

  it('reports a failure and hides credentials in its reason', async () => {
    const { code, text } = await createWith(err({ kind: 'failed', reason: `cannot reach ${URL_WITH_PASSWORD}` }));

    expect(code).toBe(1);
    expect(text).toContain('Cannot create the account: cannot reach');
    expect(text).not.toContain('s3cr3t');
  });

  it('names a missing variable', async () => {
    const { code, text } = await createWith(err({ kind: 'missing-variables', names: ['BETTER_AUTH_SECRET'] }));

    expect(code).toBe(1);
    expect(text).toContain('BETTER_AUTH_SECRET');
  });

  it.each<Outcome>([
    ok({ userId: 'user-1' }),
    err({ kind: 'email-taken' }),
    err({ kind: 'invalid-input', field: 'password' }),
    err({ kind: 'password-required' }),
  ])('never prints the password: %j', async (outcome) => {
    const { text } = await createWith(outcome);

    expect(text).not.toContain(PASSWORD);
  });
});
