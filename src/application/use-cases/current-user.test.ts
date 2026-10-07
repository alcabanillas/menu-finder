import { describe, expect, it } from 'vitest';
import type { SessionManager, SignedInUser } from '@/application/ports/session-manager';
import { currentUser } from '@/application/use-cases/current-user';
import { ok } from '@/shared/result';

const sessionsWith = (user: SignedInUser | null): SessionManager => ({
  signIn: async () => ok({ userId: 'unused', name: 'unused', email: 'unused@example.test' }),
  signOut: async () => ({ userId: null }),
  current: async () => user,
});

describe('currentUser', () => {
  it('returns the user of a valid session', async () => {
    const ana = { userId: 'user-1', name: 'Ana', email: 'ana@example.test' };

    await expect(currentUser({ sessions: sessionsWith(ana) })).resolves.toEqual(ana);
  });

  it('returns null when there is no valid session', async () => {
    await expect(currentUser({ sessions: sessionsWith(null) })).resolves.toBeNull();
  });
});
