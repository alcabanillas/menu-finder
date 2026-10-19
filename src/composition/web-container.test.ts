import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchFailureEvent } from '@/application/dto/search-failure-event';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import type { DecomposerFailure } from '@/application/ports/request-decomposer';
import type { SearchByTextDeps } from '@/application/use-cases/search/search-by-text';
import { createWebContainer, webContainer } from '@/composition/web-container';
import { err, ok, type Result } from '@/shared/result';

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

  it('reads the selections on the same pool as the sessions, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.weeksToChoose({ userId: 'user-1' });

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

  it('reads the weeks to choose on the same pool, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.weeksToChoose({ userId: 'user-1' });

    expect(result).toEqual({ ok: false, error: { kind: 'failed' } });
    expect(poolSpy).toHaveBeenCalledTimes(1);
  });

  it('chooses a menu on the same pool, and reports an unreachable database as failed', async () => {
    const poolSpy = vi.spyOn(pg, 'Pool');
    const container = createWebContainer(COMPLETE_ENV, noCookies);

    await container.currentUser();
    const result = await container.chooseMenu({ userId: 'user-1', menuNumber: 12, week: 'current' });

    expect(result).toEqual({ ok: false, error: { kind: 'failed' } });
    expect(poolSpy).toHaveBeenCalledTimes(1);
  });

  it('passes the client IP of the request to the sign-in rate limit', async () => {
    const headersWithForwarded = async () => new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' });
    const checked: string[] = [];
    const rateLimiter: RateLimiter = {
      // Blocked, so that the sign-in ends here and never reaches the database.
      check: async (key) => {
        checked.push(key);
        return { allowed: false, remaining: 0, resetAt: new Date(0) };
      },
      hit: async () => ({ allowed: false, remaining: 0, resetAt: new Date(0) }),
      reset: async () => undefined,
    };
    const container = createWebContainer(COMPLETE_ENV, headersWithForwarded, { rateLimiter });

    const result = await container.signIn({ email: 'ana@example.com', password: 'secret-password' });

    expect(result).toEqual({ ok: false, error: { kind: 'rate-limited', resetAt: new Date(0) } });
    expect(checked).toEqual(['login:failed:203.0.113.195:ana@example.com']);
  });
});

const SEARCH_ENV = { ...COMPLETE_ENV, GEMINI_API_KEY: 'AIza-search-key' };
const POLLO = { id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: false };
const STRUCTURE = { rejection: null, constraints: [POLLO], sameDish: [], anyOf: [] };

/** Fake adapters for the search that count every call, and a limiter that allows the first `allowedHits` hits. */
function fakeSearch({
  answer = ok(STRUCTURE),
  allowedHits = 100,
}: { answer?: Result<unknown, DecomposerFailure>; allowedHits?: number } = {}) {
  const calls = { hits: [] as string[], limits: [] as number[], decompose: 0, embed: 0, list: 0, matches: 0 };
  const events: SearchFailureEvent[] = [];
  const rateLimiter: RateLimiter = {
    check: async () => ({ allowed: true, remaining: 1, resetAt: new Date(0) }),
    hit: async (key, { limit }) => {
      calls.hits.push(key);
      calls.limits.push(limit);
      return { allowed: calls.hits.length <= allowedHits, remaining: 0, resetAt: new Date(0) };
    },
    reset: async () => undefined,
  };
  const searchAdapters = (): SearchByTextDeps => ({
    decomposer: {
      decompose: async () => {
        calls.decompose += 1;
        return answer;
      },
    },
    menus: {
      list: async () => {
        calls.list += 1;
        return ok([]);
      },
    },
    dishText: {
      matches: async () => {
        calls.matches += 1;
        return ok([]);
      },
    },
    recipeEmbeddings: {
      documents: async () => ok([]),
      saveAll: async () => ok(undefined),
      similarities: async () => ok([{ dish: { menu: 1, day: 'monday', meal: 'lunch', position: 1 }, similarity: 0.5 }]),
    },
    embeddings: {
      model: 'embedding-model',
      embedDocuments: async () => err({ kind: 'embedding-failed', reason: 'not used' }),
      embedQueries: async (terms) => {
        calls.embed += 1;
        return ok(terms.map(() => [0]));
      },
    },
  });
  const failureReport = { report: (event: SearchFailureEvent) => events.push(event) };
  const seams = { rateLimiter, searchAdapters, failureReport };
  return { seams, calls, events };
}

describe('createWebContainer searchByText', () => {
  it('hits the daily limit before the decomposer, then searches with the semantic strategy', async () => {
    const { seams, calls, events } = fakeSearch();
    const container = createWebContainer(SEARCH_ENV, noCookies, seams);

    const result = await container.searchByText('user-a', 'quiero pollo');

    expect(result.ok).toBe(true);
    // The semantic strategy matches the text too, to tell the literal dishes (MF-61 design D2).
    expect(calls).toMatchObject({ decompose: 1, embed: 1, list: 1, matches: 1 });
    expect(calls.hits).toEqual([expect.stringMatching(/^llm:daily:user-a:\d{4}-\d{2}-\d{2}$/)]);
    expect(events).toEqual([]);
  });

  it('answers llm-limit-reached without calling the model or the search, and reports it once', async () => {
    const { seams, calls, events } = fakeSearch({ allowedHits: 0 });
    const container = createWebContainer(SEARCH_ENV, noCookies, seams);

    const result = await container.searchByText('user-a', 'quiero pollo');

    expect(result).toEqual(err({ kind: 'llm-limit-reached' }));
    expect(calls).toMatchObject({ decompose: 0, embed: 0, list: 0, matches: 0 });
    expect(events).toEqual([{ kind: 'llm-limit-reached', level: 'warning' }]);
  });

  it('reports a decomposer failure once and returns it unchanged', async () => {
    const failure = err({ kind: 'decomposer-failed' as const, reason: 'quota exceeded' });
    const { seams, events } = fakeSearch({ answer: failure });
    const container = createWebContainer(SEARCH_ENV, noCookies, seams);

    const result = await container.searchByText('user-a', 'quiero pollo');

    expect(result).toEqual(failure);
    expect(events).toEqual([expect.objectContaining({ kind: 'decomposer-failed', level: 'error', reason: 'quota exceeded' })]);
  });

  it.each([
    ['2', 2],
    ['250', 250],
    ['0', 100],
    ['-5', 100],
    ['abc', 100],
    ['1.5', 100],
    ['', 100],
    [undefined, 100],
  ])('reads LLM_DAILY_LIMIT %j as a limit of %d searches', async (value, expected) => {
    const { seams, calls } = fakeSearch();
    const container = createWebContainer({ ...SEARCH_ENV, LLM_DAILY_LIMIT: value }, noCookies, seams);

    await container.searchByText('user-a', 'quiero pollo');

    expect(calls.limits).toEqual([expected]);
  });

  it('rejects only the search when GEMINI_API_KEY is missing, naming it, and spends no hit', async () => {
    const { seams, calls } = fakeSearch();
    const container = createWebContainer(COMPLETE_ENV, noCookies, seams);

    const failure = container.searchByText('user-a', 'quiero pollo');

    await expect(failure).rejects.toThrow('Missing environment variables: GEMINI_API_KEY');
    await expect(failure).rejects.not.toThrow(SECRET);
    expect(calls.hits).toEqual([]);
    await expect(container.signIn({})).resolves.toEqual({ ok: false, error: { kind: 'email-required' } });
  });
});

describe('webContainer', () => {
  it('returns the same container every time, so hot reload does not multiply pools', () => {
    expect(webContainer()).toBe(webContainer());
  });
});
