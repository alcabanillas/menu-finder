import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DecomposerFailure, RequestDecomposer } from '@/application/ports/request-decomposer';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import { searchByText } from '@/application/use-cases/search/search-by-text';
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
