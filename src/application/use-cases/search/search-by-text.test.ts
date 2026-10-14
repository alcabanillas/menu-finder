import { describe, expect, it } from 'vitest';
import type { SearchFailureEvent } from '@/application/dto/search-failure-event';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { RateLimiter, RateLimitOptions } from '@/application/ports/rate-limiter';
import type { DecomposerFailure, RequestDecomposer } from '@/application/ports/request-decomposer';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import {
  searchByText,
  searchByTextWithinDailyLimit,
  type DailyLimitedSearchDeps,
} from '@/application/use-cases/search/search-by-text';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok, type Result } from '@/shared/result';

const POLLO = { id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: false } as const;

const STRUCTURE: Required<SearchRequestDto> = { constraints: [POLLO], sameDish: [], anyOf: [] };

const CATALOG: WeeklyMenu[] = [
  {
    number: 1,
    meals: [{ day: 'monday', type: 'lunch', dishes: [{ position: 1, name: 'Pollo asado', hasRecipeMark: false, recipeFile: null }] }],
  },
];

/** A decomposer that answers `answer` and counts its calls. */
function fakeDecomposer(answer: Result<unknown, DecomposerFailure>) {
  const calls: string[] = [];
  const decomposer: RequestDecomposer = {
    decompose: async (request) => {
      calls.push(request);
      return answer;
    },
  };
  return { decomposer, calls };
}

/** Search ports over CATALOG that count every call, so a test can assert that nothing reached the database. */
function countingPorts({ menusFailWith }: { menusFailWith?: string } = {}) {
  const calls = { menus: 0, dishText: 0, recipeEmbeddings: 0, embeddings: 0 };
  const deps: FindMenusDeps = {
    menus: {
      list: async () => {
        calls.menus += 1;
        return menusFailWith === undefined ? ok(CATALOG) : err({ kind: 'read-failed', reason: menusFailWith });
      },
    },
    dishText: {
      matches: async (term) => {
        calls.dishText += 1;
        return ok(term === 'pollo' ? [{ menu: 1, day: 'monday', meal: 'lunch', position: 1 }] : []);
      },
    },
    recipeEmbeddings: {
      documents: async () => {
        calls.recipeEmbeddings += 1;
        return ok([]);
      },
      saveAll: async () => {
        calls.recipeEmbeddings += 1;
        return ok(undefined);
      },
      similarities: async () => {
        calls.recipeEmbeddings += 1;
        return ok([]);
      },
    },
    embeddings: {
      model: 'test-model',
      embedDocuments: async () => {
        calls.embeddings += 1;
        return err({ kind: 'embedding-failed', reason: 'not expected' });
      },
      embedQueries: async () => {
        calls.embeddings += 1;
        return err({ kind: 'embedding-failed', reason: 'not expected' });
      },
    },
  };
  return { deps, calls };
}

function totalCalls(calls: ReturnType<typeof countingPorts>['calls']): number {
  return calls.menus + calls.dishText + calls.recipeEmbeddings + calls.embeddings;
}

describe('searchByText', () => {
  it('searches the menus with the structure the decomposer returned and returns both', async () => {
    const { decomposer } = fakeDecomposer(ok({ rejection: null, ...STRUCTURE }));
    const { deps } = countingPorts();

    const outcome = await searchByText('algo con pollo', 'lexical', { decomposer, ...deps });

    const expected = await findMenus(STRUCTURE, 'lexical', countingPorts().deps);
    expect(expected.ok).toBe(true);
    expect(outcome).toEqual(ok({ structure: STRUCTURE, result: expected.ok ? expected.value : null }));
  });

  it('calls the model exactly once', async () => {
    const { decomposer, calls } = fakeDecomposer(ok({ rejection: null, ...STRUCTURE }));

    await searchByText('algo con pollo', 'lexical', { decomposer, ...countingPorts().deps });

    expect(calls).toEqual(['algo con pollo']);
  });

  it('ranks with the strategy it is given, with no embedding call for lexical', async () => {
    const { decomposer } = fakeDecomposer(ok({ rejection: null, ...STRUCTURE }));
    const { deps, calls } = countingPorts();

    const outcome = await searchByText('algo con pollo', 'lexical', { decomposer, ...deps });

    expect(outcome.ok && outcome.value.result.strategy).toBe('lexical');
    expect(outcome.ok && outcome.value.result.menus.map(({ menu }) => menu)).toEqual([1]);
    expect(calls.embeddings + calls.recipeEmbeddings).toBe(0);
  });

  it('ends with an error and no ranking when the search fails', async () => {
    const { decomposer } = fakeDecomposer(ok({ rejection: null, ...STRUCTURE }));
    const { deps } = countingPorts({ menusFailWith: 'connection lost' });

    const outcome = await searchByText('algo con pollo', 'lexical', { decomposer, ...deps });

    expect(outcome).toEqual(err({ kind: 'search-failed', reason: 'connection lost' }));
  });

  // Every outcome of the decomposer that is not a structure with constraints ends before the search: no request
  // reaches the database or the embedding service (MF-22.1 design D5).
  describe('without a structure to search, nothing reaches the database', () => {
    it('returns a rejection with its category', async () => {
      const { decomposer } = fakeDecomposer(ok({ rejection: 'gibberish', constraints: [], sameDish: [], anyOf: [] }));
      const { deps, calls } = countingPorts();

      const outcome = await searchByText('asdfgh', 'hybrid', { decomposer, ...deps });

      expect(outcome).toEqual(err({ kind: 'rejected', category: 'gibberish' }));
      expect(totalCalls(calls)).toBe(0);
    });

    it('returns an invalid answer naming the term that is not in the request', async () => {
      const salmon = { ...POLLO, term: 'salmón' };
      const { decomposer } = fakeDecomposer(ok({ rejection: null, constraints: [salmon], sameDish: [], anyOf: [] }));
      const { deps, calls } = countingPorts();

      const outcome = await searchByText('algo con pollo', 'hybrid', { decomposer, ...deps });

      expect(outcome).toEqual(
        err({ kind: 'invalid-answer', issues: [{ constraint: 'c1', field: 'term', message: 'the term is not in the request' }] }),
      );
      expect(totalCalls(calls)).toBe(0);
    });

    // The adapter redacts the key from the reason (spec request-decomposer); the use case passes the reason on as it is.
    it('returns the failure of the model', async () => {
      const { decomposer } = fakeDecomposer(err({ kind: 'decomposer-failed', reason: 'timeout after 20 s' }));
      const { deps, calls } = countingPorts();

      const outcome = await searchByText('algo con pollo', 'hybrid', { decomposer, ...deps });

      expect(outcome).toEqual(err({ kind: 'decomposer-failed', reason: 'timeout after 20 s' }));
      expect(totalCalls(calls)).toBe(0);
    });

    it('refuses a request that is too long before calling the model', async () => {
      const { decomposer, calls: modelCalls } = fakeDecomposer(ok({ rejection: null, ...STRUCTURE }));
      const { deps, calls } = countingPorts();

      const outcome = await searchByText('a'.repeat(301), 'hybrid', { decomposer, ...deps });

      expect(outcome).toEqual(err({ kind: 'request-too-long', max: 300 }));
      expect(modelCalls).toEqual([]);
      expect(totalCalls(calls)).toBe(0);
    });

    it('returns nothing-to-search, not a rejection, for a structure with no constraints', async () => {
      const { decomposer } = fakeDecomposer(ok({ rejection: null, constraints: [], sameDish: [], anyOf: [] }));
      const { deps, calls } = countingPorts();

      const outcome = await searchByText('platos para el finde', 'hybrid', { decomposer, ...deps });

      expect(outcome).toEqual(err({ kind: 'nothing-to-search' }));
      expect(totalCalls(calls)).toBe(0);
    });
  });
});

const DAY_SECONDS = 86_400;
const API_KEY = 'AIza-secret-key-1234567890';
const REQUEST = 'quiero menús con pollo sin gluten';

/** A limiter that records every hit and allows the first `allowedHits` of them. */
function fakeLimiter(allowedHits: number) {
  const hits: { key: string; options: RateLimitOptions }[] = [];
  const rateLimiter: RateLimiter = {
    check: async () => {
      throw new Error('the daily limit never only checks');
    },
    hit: async (key, options) => {
      hits.push({ key, options });
      return { allowed: hits.length <= allowedHits, remaining: 0, resetAt: new Date(0) };
    },
    reset: async () => {
      throw new Error('the daily limit never resets');
    },
  };
  return { rateLimiter, hits };
}

/** The web's dependencies over the counting ports, with a limiter, a fixed instant and a report that keeps events. */
function webDeps({
  answer = ok({ rejection: null, ...STRUCTURE }),
  allowedHits = 100,
  at = '2026-10-13T10:00:00Z',
  ports = countingPorts(),
}: {
  answer?: Result<unknown, DecomposerFailure>;
  allowedHits?: number;
  at?: string;
  ports?: ReturnType<typeof countingPorts>;
} = {}) {
  const { decomposer, calls: modelCalls } = fakeDecomposer(answer);
  const { rateLimiter, hits } = fakeLimiter(allowedHits);
  const events: SearchFailureEvent[] = [];
  const deps: DailyLimitedSearchDeps = {
    decomposer,
    ...ports.deps,
    rateLimiter,
    failureReport: { report: (event) => events.push(event) },
    now: () => new Date(at),
    dailyLimit: 100,
    decomposerModel: 'decomposer-model',
    secrets: [API_KEY],
  };
  return { deps, hits, events, modelCalls, calls: ports.calls };
}

describe('searchByTextWithinDailyLimit', () => {
  describe('the daily limit', () => {
    it('records one hit on the bucket of the UTC day and runs the search under the limit', async () => {
      const { deps, hits, events } = webDeps();

      const outcome = await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(outcome.ok).toBe(true);
      expect(hits).toEqual([{ key: 'llm:daily:2026-10-13', options: { limit: 100, windowSeconds: DAY_SECONDS } }]);
      expect(events).toEqual([]);
    });

    it('answers llm-limit-reached with no call to the model or the search, and reports it as a warning', async () => {
      const { deps, events, modelCalls, calls } = webDeps({ allowedHits: 0 });

      const outcome = await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(outcome).toEqual(err({ kind: 'llm-limit-reached' }));
      expect(modelCalls).toEqual([]);
      expect(totalCalls(calls)).toBe(0);
      expect(events).toEqual([{ kind: 'llm-limit-reached', level: 'warning' }]);
    });

    it('rolls over at midnight UTC: the days before and after it have different buckets', async () => {
      const before = webDeps({ at: '2026-10-13T23:59:00Z' });
      const after = webDeps({ at: '2026-10-14T00:01:00Z' });

      await searchByTextWithinDailyLimit(REQUEST, 'lexical', before.deps);
      await searchByTextWithinDailyLimit(REQUEST, 'lexical', after.deps);

      expect([...before.hits, ...after.hits].map(({ key }) => key)).toEqual([
        'llm:daily:2026-10-13',
        'llm:daily:2026-10-14',
      ]);
    });

    it('passes the configured limit to the limiter', async () => {
      const { deps, hits } = webDeps();

      await searchByTextWithinDailyLimit(REQUEST, 'lexical', { ...deps, dailyLimit: 2 });

      expect(hits[0].options.limit).toBe(2);
    });

    it('with a limit of 2, lets two searches of the day run and stops the third', async () => {
      const { deps, modelCalls } = webDeps();
      const counted: string[] = [];
      const rateLimiter: RateLimiter = {
        ...deps.rateLimiter,
        hit: async (key, { limit }) => {
          counted.push(key);
          return { allowed: counted.length <= limit, remaining: 0, resetAt: new Date(0) };
        },
      };
      const limited = { ...deps, rateLimiter, dailyLimit: 2 };

      const outcomes = [
        await searchByTextWithinDailyLimit(REQUEST, 'lexical', limited),
        await searchByTextWithinDailyLimit(REQUEST, 'lexical', limited),
        await searchByTextWithinDailyLimit(REQUEST, 'lexical', limited),
      ];

      expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, false]);
      expect(outcomes[2]).toEqual(err({ kind: 'llm-limit-reached' }));
      expect(modelCalls).toHaveLength(2);
    });
  });

  describe('an invalid request is not counted', () => {
    it.each([
      ['only spaces', '   ', { kind: 'request-too-short' }],
      ['301 characters', 'a'.repeat(301), { kind: 'request-too-long', max: 300 }],
    ])('refuses a request of %s with no hit and no call to the model', async (_name, request, error) => {
      const { deps, hits, modelCalls } = webDeps();

      const outcome = await searchByTextWithinDailyLimit(request, 'lexical', deps);

      expect(outcome).toEqual(err(error));
      expect(hits).toEqual([]);
      expect(modelCalls).toEqual([]);
    });
  });

  describe('the failure report', () => {
    it('reports a decomposer failure with the decomposer model and returns it unchanged', async () => {
      const failure = err({ kind: 'decomposer-failed' as const, reason: 'quota exceeded' });
      const { deps, events } = webDeps({ answer: failure });

      const outcome = await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(outcome).toEqual(failure);
      expect(events).toEqual([
        { kind: 'decomposer-failed', level: 'error', model: 'decomposer-model', reason: 'quota exceeded' },
      ]);
    });

    it('reports an embedding failure with the embedding model', async () => {
      const { deps, events } = webDeps();

      await searchByTextWithinDailyLimit(REQUEST, 'semantic', deps);

      expect(events).toEqual([{ kind: 'embedding-failed', level: 'error', model: 'test-model', reason: 'not expected' }]);
    });

    it('reports a database failure with no model', async () => {
      const { deps, events } = webDeps({ ports: countingPorts({ menusFailWith: 'connection lost' }) });

      await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(events).toEqual([{ kind: 'search-failed', level: 'error', reason: 'connection lost' }]);
    });

    it('reports an index that is not loaded, with no model and no reason', async () => {
      const ports = countingPorts();
      ports.deps.embeddings.embedQueries = async (terms) => ok(terms.map(() => [0]));
      const { deps, events } = webDeps({ ports });

      await searchByTextWithinDailyLimit(REQUEST, 'semantic', deps);

      expect(events).toEqual([{ kind: 'index-not-loaded', level: 'error' }]);
    });

    it('removes the secrets and the request from the reason', async () => {
      const reason = `invalid key ${API_KEY} for prompt "${REQUEST}"`;
      const { deps, events } = webDeps({ answer: err({ kind: 'decomposer-failed', reason }) });

      await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(events[0].reason).toBe('invalid key *** for prompt "***"');
    });

    it.each<[string, Result<unknown, DecomposerFailure>, string]>([
      ['rejected', ok({ rejection: 'gibberish', constraints: [], sameDish: [], anyOf: [] }), REQUEST],
      ['invalid-answer', ok({ rejection: null, constraints: [{ ...POLLO, term: 'salmón' }], sameDish: [], anyOf: [] }), REQUEST],
      ['nothing-to-search', ok({ rejection: null, constraints: [], sameDish: [], anyOf: [] }), REQUEST],
      ['request-too-short', ok({ rejection: null, ...STRUCTURE }), '   '],
      ['request-too-long', ok({ rejection: null, ...STRUCTURE }), 'a'.repeat(301)],
    ])('does not report the user outcome %s', async (kind, answer, request) => {
      const { deps, events } = webDeps({ answer });

      const outcome = await searchByTextWithinDailyLimit(request, 'lexical', deps);

      expect(outcome.ok || outcome.error.kind).toBe(kind);
      expect(events).toEqual([]);
    });

    it('does not report a successful search', async () => {
      const { deps, events } = webDeps();

      const outcome = await searchByTextWithinDailyLimit(REQUEST, 'lexical', deps);

      expect(outcome.ok).toBe(true);
      expect(events).toEqual([]);
    });
  });
});
