import { describe, expect, it } from 'vitest';
import type { AccountCreator, AccountError, NewAccount } from '@/application/ports/account-creator';
import { createAccount } from '@/application/use-cases/create-account';
import { err, ok, type Result } from '@/shared/result';

const fakeCreator = (result: Result<{ userId: string }, AccountError> = ok({ userId: 'user-1' })) => {
  const received: NewAccount[] = [];
  const accounts: AccountCreator = {
    create: async (account) => {
      received.push(account);
      return result;
    },
  };
  return { accounts, received };
};

describe('createAccount', () => {
  it('gives the account the part of the email before the @ as its name when no name is given', async () => {
    const { accounts, received } = fakeCreator();

    await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass' });

    expect(received).toEqual([{ email: 'ana@example.test', password: 'a-long-enough-pass', name: 'ana' }]);
  });

  it('keeps the name it is given', async () => {
    const { accounts, received } = fakeCreator();

    await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass', name: 'Ana G.' });

    expect(received[0].name).toBe('Ana G.');
  });

  it('treats a blank name as no name', async () => {
    const { accounts, received } = fakeCreator();

    await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass', name: '   ' });

    expect(received[0].name).toBe('ana');
  });

  it('returns the id of the new user', async () => {
    const { accounts } = fakeCreator(ok({ userId: 'user-42' }));

    const result = await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass' });

    expect(result).toEqual(ok({ userId: 'user-42' }));
  });

  it('asks for a password when it is empty, without calling the port', async () => {
    const { accounts, received } = fakeCreator();

    const result = await createAccount({ accounts }, { email: 'ana@example.test', password: '' });

    expect(result).toEqual(err({ kind: 'password-required' }));
    expect(received).toEqual([]);
  });

  it('hides the password if the reason of a failure repeats it', async () => {
    const { accounts } = fakeCreator(err({ kind: 'failed', reason: 'bad body {"password":"a-long-enough-pass"}' }));

    const result = await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass' });

    expect(JSON.stringify(result)).not.toContain('a-long-enough-pass');
    expect(result).toMatchObject({ ok: false, error: { kind: 'failed' } });
  });

  it.each<AccountError>([
    { kind: 'invalid-input', field: 'email' },
    { kind: 'invalid-input', field: 'password' },
    { kind: 'email-taken' },
    { kind: 'failed', reason: 'connection refused' },
  ])('returns the error of the port unchanged: %j', async (error) => {
    const { accounts } = fakeCreator(err(error));

    const result = await createAccount({ accounts }, { email: 'ana@example.test', password: 'a-long-enough-pass' });

    expect(result).toEqual(err(error));
  });
});
