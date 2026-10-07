import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import { requireUser } from '@/app/_session/require-user';

// `redirect` of Next.js throws to stop the page; the fake does the same so that nothing after it runs.
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
const container = vi.hoisted(() => ({ currentUser: vi.fn<() => Promise<SignedInUser | null>>() }));
vi.mock('next/navigation', () => navigation);
vi.mock('@/composition/web-container', () => ({ webContainer: () => container }));

describe('requireUser', () => {
  beforeEach(() => {
    navigation.redirect.mockClear();
  });

  it('returns the user of a valid session', async () => {
    container.currentUser.mockResolvedValue({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' });

    await expect(requireUser()).resolves.toEqual({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' });
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it('sends a request with no valid session to /login, before the page goes on', async () => {
    container.currentUser.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow('redirect:/login');
    expect(navigation.redirect).toHaveBeenCalledWith('/login');
  });
});
