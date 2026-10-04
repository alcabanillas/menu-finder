import { describe, expect, it } from 'vitest';
import type { SessionManager, SignedInUser } from '@/application/ports/session-manager';
import { currentUser } from '@/application/use-cases/current-user';
import { ok } from '@/shared/result';

const sessionsWith = (user: SignedInUser | null): SessionManager => ({
  signIn: async () => ok({ userId: 'unused', name: 'unused' }),
  signOut: async () => ({ userId: null }),
  current: async () => user,
});

describe('currentUser', () => {
  it('returns the user of a valid session', async () => {
    await expect(currentUser({ sessions: sessionsWith({ userId: 'user-1', name: 'Ana' }) })).resolves.toEqual({
      userId: 'user-1',
      name: 'Ana',
    });
  });

  it('returns null when there is no valid session', async () => {
    await expect(currentUser({ sessions: sessionsWith(null) })).resolves.toBeNull();
  });
});
