import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebContainer, webContainer } from '@/composition/web-container';

// A host that does not exist: a query would fail with a network error, so a passing test shows none was made.
const UNREACHABLE = 'postgresql://user:password@unreachable.invalid/db';
const SECRET = 'a-secret-value-with-at-least-32-characters';
const COMPLETE_ENV = { DATABASE_URL: UNREACHABLE, BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://localhost:3000' };
const noCookies = async () => new Headers();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createWebContainer', () => {
  it('builds without reading the environment, so importing it never throws', () => {
    expect(() => createWebContainer({}, noCookies)).not.toThrow();
  });

  it('names every missing variable at the first call, without any value', async () => {
    const container = createWebContainer({ BETTER_AUTH_SECRET: SECRET }, noCookies);

    const failure = container.currentUser();

    await expect(failure).rejects.toThrow('DATABASE_URL, BETTER_AUTH_URL');
    await expect(failure).rejects.not.toThrow(SECRET);
  });

  it('treats an empty variable as missing', async () => {
    const container = createWebContainer({ ...COMPLETE_ENV, BETTER_AUTH_SECRET: '' }, noCookies);

    await expect(container.currentUser()).rejects.toThrow('BETTER_AUTH_SECRET');
  });

  it('answers no user without a cookie, and builds one pool for every call', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await expect(container.currentUser()).resolves.toBeNull();
    await expect(container.currentUser()).resolves.toBeNull();

    expect(poolSpy).toHaveBeenCalledTimes(1);
  });

  it('refuses an invalid menu number before reaching the database', async () => {
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await expect(container.selectMenu({ userId: 'user-1', menuNumber: '12abc' })).resolves.toEqual({
      ok: false,
      error: { kind: 'invalid-menu' },
    });
  });

  it('reads the selections on the same pool as the sessions, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.currentSelections({ userId: 'user-1' });

    expect(result).toEqual({ ok: false, error: { kind: 'failed' } });
    expect(poolSpy).toHaveBeenCalledTimes(1);
  });

  it('reads the menus for a random choice on the same pool, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.selectRandomMenu({ userId: 'user-1' });

    expect(result).toEqual({ ok: false, error: { kind: 'failed' } });
    expect(poolSpy).toHaveBeenCalledTimes(1);
  });

  it('reads the active menu on the same pool, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.activeMenu({ userId: 'user-1' });

    expect(result).toEqual({ ok: false, error: { kind: 'failed' } });
    expect(poolSpy).toHaveBeenCalledTimes(1);
  });
});

describe('webContainer', () => {
  it('returns the same container every time, so hot reload does not multiply pools', () => {
    expect(webContainer()).toBe(webContainer());
  });
});
