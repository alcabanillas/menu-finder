import { describe, expect, it } from 'vitest';
import type { AuditEvent, AuditLog } from '@/application/ports/audit-log';
import type { SessionManager } from '@/application/ports/session-manager';
import { signOut } from '@/application/use-cases/sign-out';
import { ok } from '@/shared/result';

const fakes = (userId: string | null) => {
  const events: AuditEvent[] = [];
  const sessions: SessionManager = {
    signIn: async () => ok({ userId: 'unused', name: 'unused' }),
    signOut: async () => ({ userId }),
    current: async () => null,
  };
  const auditLog: AuditLog = { record: (event) => events.push(event) };
  return { deps: { sessions, auditLog }, events };
};

describe('signOut', () => {
  it('logs the sign-out with the id of the user whose session was revoked', async () => {
    const { deps, events } = fakes('user-1');

    await signOut(deps);

    expect(events).toEqual([{ type: 'sign-out', userId: 'user-1', at: expect.any(Date) }]);
  });

  it('does not fail and logs no user when there was no session', async () => {
    const { deps, events } = fakes(null);

    await expect(signOut(deps)).resolves.toBeUndefined();
    expect(events).toEqual([{ type: 'sign-out', userId: null, at: expect.any(Date) }]);
  });
});
