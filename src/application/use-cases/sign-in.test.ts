import { describe, expect, it } from 'vitest';
import type { AuditEvent, AuditLog } from '@/application/ports/audit-log';
import type { Credentials, SessionManager, SignedInUser, SignInError } from '@/application/ports/session-manager';
import { signIn } from '@/application/use-cases/sign-in';
import { err, ok, type Result } from '@/shared/result';

const PASSWORD = 'a-long-enough-pass';
const ANA: SignedInUser = { userId: 'user-1', name: 'Ana' };

const fakes = (answer: Result<SignedInUser, SignInError> = ok(ANA)) => {
  const sent: Credentials[] = [];
  const events: AuditEvent[] = [];
  const sessions: SessionManager = {
    signIn: async (credentials) => {
      sent.push(credentials);
      return answer;
    },
    signOut: async () => ({ userId: null }),
    current: async () => null,
  };
  const auditLog: AuditLog = { record: (event) => events.push(event) };
  return { deps: { sessions, auditLog }, sent, events };
};

describe('signIn', () => {
  it('returns the user and logs the sign-in with the user id', async () => {
    const { deps, events } = fakes();

    const result = await signIn(deps, { email: 'ana@example.test', password: PASSWORD });

    expect(result).toEqual(ok(ANA));
    expect(events).toEqual([{ type: 'sign-in', userId: 'user-1', at: expect.any(Date) }]);
  });

  it('returns wrong-credentials and logs the refusal when the port refuses them', async () => {
    const { deps, events } = fakes(err({ kind: 'wrong-credentials' }));

    const result = await signIn(deps, { email: 'ana@example.test', password: 'wrong-password' });

    expect(result).toEqual(err({ kind: 'wrong-credentials' }));
    expect(events).toEqual([{ type: 'sign-in-refused', reason: 'wrong-credentials', at: expect.any(Date) }]);
  });

  it('returns failed, without logging a refusal, when the port fails', async () => {
    const { deps, events } = fakes(err({ kind: 'failed', reason: 'connection refused' }));

    const result = await signIn(deps, { email: 'ana@example.test', password: PASSWORD });

    expect(result).toEqual(err({ kind: 'failed' }));
    expect(events).toEqual([]);
  });

  it.each([
    ['an empty email', { email: '', password: PASSWORD }, 'email-required'],
    ['a blank email', { email: '   ', password: PASSWORD }, 'email-required'],
    ['no email field', { password: PASSWORD }, 'email-required'],
    ['an empty password', { email: 'ana@example.test', password: '' }, 'password-required'],
    ['no password field', { email: 'ana@example.test' }, 'password-required'],
  ])('refuses %s without asking the port', async (_case, input, kind) => {
    const { deps, sent } = fakes();

    const result = await signIn(deps, input);

    expect(result).toEqual(err({ kind }));
    expect(sent).toEqual([]);
  });

  it.each([
    ['an email over 254 characters', { email: `${'a'.repeat(250)}@example.test`, password: PASSWORD }],
    ['a password over 128 characters', { email: 'ana@example.test', password: 'p'.repeat(129) }],
    ['a 10 000-character email', { email: 'a'.repeat(10_000), password: PASSWORD }],
    ['a null byte in the email', { email: 'ana\u0000@example.test', password: PASSWORD }],
    ['a null byte in the password', { email: 'ana@example.test', password: 'pass\u0000word-long' }],
    ['an email that is not text', { email: ['ana@example.test'], password: PASSWORD }],
    ['a password that is not text', { email: 'ana@example.test', password: 12_345_678 }],
  ])('answers %s like wrong credentials, logs invalid input and never asks the port', async (_case, input) => {
    const { deps, sent, events } = fakes();

    const result = await signIn(deps, input);

    expect(result).toEqual(err({ kind: 'wrong-credentials' }));
    expect(sent).toEqual([]);
    expect(events).toEqual([{ type: 'sign-in-refused', reason: 'invalid-input', at: expect.any(Date) }]);
  });

  it.each([["' OR 1=1; --"], ['🍅@example.test']])('sends a hostile but well-formed email (%s) to the port', async (email) => {
    const { deps, sent } = fakes(err({ kind: 'wrong-credentials' }));

    const result = await signIn(deps, { email, password: PASSWORD });

    expect(result).toEqual(err({ kind: 'wrong-credentials' }));
    expect(sent).toEqual([{ email, password: PASSWORD }]);
  });

  it('sends the email trimmed and in Unicode NFC', async () => {
    const { deps, sent } = fakes();
    const decomposed = 'josé@example.test';

    await signIn(deps, { email: `  ${decomposed}  `, password: PASSWORD });

    expect(sent[0].email).toBe('josé@example.test');
  });

  it('sends the password as it is, spaces included', async () => {
    const { deps, sent } = fakes();

    await signIn(deps, { email: 'ana@example.test', password: `  ${PASSWORD}  ` });

    expect(sent[0].password).toBe(`  ${PASSWORD}  `);
  });

  it('never puts the email or the password in a logged event', async () => {
    const { deps: okDeps, events: okEvents } = fakes();
    const { deps: refusedDeps, events: refusedEvents } = fakes(err({ kind: 'wrong-credentials' }));

    await signIn(okDeps, { email: 'ana@example.test', password: PASSWORD });
    await signIn(refusedDeps, { email: 'ana@example.test', password: PASSWORD });

    const logged = JSON.stringify([...okEvents, ...refusedEvents]);
    expect(logged).not.toContain('ana@example.test');
    expect(logged).not.toContain(PASSWORD);
  });
});
