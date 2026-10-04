import { describe, expect, it } from 'vitest';
import { StdoutAuditLog } from '@/infrastructure/logging/stdout-audit-log';

const AT = new Date('2026-10-04T19:30:00.000Z');

const logged = () => {
  const lines: string[] = [];
  return { log: new StdoutAuditLog((line) => lines.push(line)), lines };
};

describe('StdoutAuditLog', () => {
  it('writes a sign-in as one JSON line with its type, user id and time', () => {
    const { log, lines } = logged();

    log.record({ type: 'sign-in', userId: 'user-1', at: AT });

    expect(lines).toEqual(['{"event":"auth.sign-in","userId":"user-1","at":"2026-10-04T19:30:00.000Z"}\n']);
  });

  it('writes a refused sign-in with its reason and no user', () => {
    const { log, lines } = logged();

    log.record({ type: 'sign-in-refused', reason: 'invalid-input', at: AT });

    expect(JSON.parse(lines[0])).toEqual({ event: 'auth.sign-in-refused', reason: 'invalid-input', at: AT.toISOString() });
  });

  it('writes a sign-out without a session with a null user', () => {
    const { log, lines } = logged();

    log.record({ type: 'sign-out', userId: null, at: AT });

    expect(JSON.parse(lines[0])).toEqual({ event: 'auth.sign-out', userId: null, at: AT.toISOString() });
  });

  it('writes nothing but the fields of the event, even if the caller adds more', () => {
    const { log, lines } = logged();
    const withExtra = { type: 'sign-in', userId: 'user-1', at: AT, email: 'ana@example.test', password: 'secret-pass' };

    log.record(withExtra as Parameters<StdoutAuditLog['record']>[0]);

    expect(lines[0]).not.toContain('ana@example.test');
    expect(lines[0]).not.toContain('secret-pass');
  });
});
