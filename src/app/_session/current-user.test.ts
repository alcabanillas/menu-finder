import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import { redirectIfSignedIn, requireUser } from '@/app/_session/require-user';
import { sessionUser } from '@/app/_session/session-user';

// React's `cache()` only remembers inside the render of one request. Here it is a memo that `newRequest()` empties, so
// the test can tell whether every reader goes through the one cached function (design D1 of MF-51.2).
const request = vi.hoisted(() => {
  const memos: Map<unknown, Promise<unknown>>[] = [];
  return {
    cache: <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) => {
      const memo = new Map<unknown, Promise<unknown>>();
      memos.push(memo);
      return () => {
        if (!memo.has(0)) memo.set(0, fn(...([] as unknown as Args)));
        return memo.get(0) as Promise<Result>;
      };
    },
    newRequest: () => memos.forEach((memo) => memo.clear()),
  };
});
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: request.cache }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
const container = vi.hoisted(() => ({ currentUser: vi.fn<() => Promise<SignedInUser | null>>() }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => container }));

const ANA: SignedInUser = { userId: 'user-1', name: 'Ana', email: 'ana@example.test' };

describe('the session read of a request', () => {
  beforeEach(() => {
    request.newRequest();
    container.currentUser.mockReset();
    container.currentUser.mockResolvedValue(ANA);
  });

  it('is done once when the layout, the page and the redirect check all ask for the user', async () => {
    await sessionUser();
    await requireUser();
    await sessionUser();

    expect(container.currentUser).toHaveBeenCalledTimes(1);
  });

  it('is shared by requireUser and redirectIfSignedIn', async () => {
    await expect(redirectIfSignedIn()).rejects.toThrow('redirect:/planner');
    await requireUser();

    expect(container.currentUser).toHaveBeenCalledTimes(1);
  });

  it('is done again by the next request', async () => {
    await sessionUser();
    request.newRequest();
    await sessionUser();

    expect(container.currentUser).toHaveBeenCalledTimes(2);
  });
});
