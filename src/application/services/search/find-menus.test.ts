import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchStrategy } from '@/application/dto/search-result';
import type { DishAddress } from '@/application/ports/dish-text-search';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok } from '@/shared/result';

type RawConstraint = Record<string, unknown>;

function constraint(id: string, term: string, overrides: RawConstraint = {}): RawConstraint {
  return { id, type: 'literal', term, polarity: 'include', hard: false, ...overrides };
}

function request(constraints: unknown[], overrides: Record<string, unknown> = {}) {
  return { constraints, sameDish: [], anyOf: [], ...overrides };
}

const CATALOG = [
  menu(1, 'Pollo asado', 'Merluza al horno'),
  menu(2, 'Lentejas', 'Lomo de cerdo'),
  menu(3, 'Arroz con pollo', 'Crema de calabaza'),
];

type FailingPort = 'list' | 'matches' | 'embed' | 'similarities';
/** `similarTo` makes the dishes whose name contains the given text similar to a term, without matching its text. */
type FakeOptions = {
  fail?: FailingPort;
  noEmbeddings?: boolean;
  shortVectors?: boolean;
  similarTo?: Record<string, string>;
  failTerm?: string;
  customSimilarities?: Record<string, Record<string, number>>;
};

function menu(number: number, lunch: string, dinner: string): WeeklyMenu {
  return {
    number,
    meals: [
      { day: 'monday', type: 'lunch', dishes: [menuDish(lunch)] },
      { day: 'monday', type: 'dinner', dishes: [menuDish(dinner)] },
    ],
  };
}

function menuDish(name: string): MenuDish {
  return { position: 1, name, hasRecipeMark: false, recipeFile: null };
}

function catalogDishes(): { address: DishAddress; name: string }[] {
  return CATALOG.flatMap(({ number, meals }) =>
    meals.flatMap(({ day, type, dishes }) =>
      dishes.map(({ position, name }) => ({ address: { menu: number, day, meal: type, position }, name })),
    ),
  );
}

function nameHas(name: string, term: string): boolean {
  return name.toLowerCase().includes(term.toLowerCase());
}

/**
 * Ports over CATALOG that record every call. A dish matches a term when its name contains it; its similarity is 0.9
 * then and 0.2 otherwise, so the rescaled semantic score is 1 or 0. A query vector is the term's position in the
 * terms embedded so far, so the store can tell which term it is about.
 */
function fakePorts({
  fail,
  noEmbeddings = false,
  shortVectors = false,
  similarTo = {},
  failTerm,
  customSimilarities,
}: FakeOptions = {}) {
  const calls = {
    list: 0,
    matches: [] as string[],
    matchCalls: [] as { term: string; options?: { includeIngredientGroups?: boolean } }[],
    embedQueries: [] as string[][],
    similarities: 0,
  };
  const embedded: string[] = [];
  const dishes = catalogDishes();
  const failure = { reason: 'connection lost' };
  const deps: FindMenusDeps = {
    menus: {
      list: async () => {
        calls.list += 1;
        return fail === 'list' ? err({ kind: 'read-failed', ...failure }) : ok(CATALOG);
      },
    },
    dishText: {
      matches: async (term, options) => {
        calls.matches.push(term);
        calls.matchCalls.push({ term, options });
        if (fail === 'matches' || term === failTerm) return err({ kind: 'text-search-failed', ...failure });
        return ok(dishes.filter(({ name }) => nameHas(name, term)).map(({ address }) => address));
      },
    },
    recipeEmbeddings: {
      documents: async () => ok([]),
      saveAll: async () => ok(undefined),
      similarities: async (_variant, [index]) => {
        calls.similarities += 1;
        if (fail === 'similarities') return err({ kind: 'store-failed', ...failure });
        if (noEmbeddings) return ok([]);
        const term = embedded[index];
        if (customSimilarities && customSimilarities[term]) {
          return ok(
            dishes.map(({ address, name }) => ({
              dish: address,
              similarity: customSimilarities[term][name] ?? 0.2,
            })),
          );
        }
        const like = similarTo[term] ?? term;
        return ok(dishes.map(({ address, name }) => ({ dish: address, similarity: nameHas(name, like) ? 0.9 : 0.2 })));
      },
    },
    embeddings: {
      model: 'test-model',
      embedDocuments: async () => err({ kind: 'embedding-failed', reason: 'not used' }),
      embedQueries: async (terms) => {
        calls.embedQueries.push(terms);
        if (fail === 'embed') return err({ kind: 'embedding-failed', ...failure });
        const vectors = terms.map((term) => [embedded.push(term) - 1]);
        return ok(shortVectors ? vectors.slice(1) : vectors);
      },
    },
  };
  return { deps, calls };
}

function search(raw: unknown, strategy: SearchStrategy, options: FakeOptions = {}) {
  const { deps, calls } = fakePorts(options);
  return { result: findMenus(raw as SearchRequestDto, strategy, deps), calls };
}

function lunchDish(name: string) {
  return { day: 'monday', meal: 'lunch', position: 1, name };
}

describe('findMenus', () => {
  it('rejects an invalid structure before any port call', async () => {
    const { result, calls } = search(request([constraint('c1', '   ')]), 'hybrid');

    expect(await result).toMatchObject({ ok: false, error: { kind: 'invalid-request' } });
    expect(calls).toEqual({ list: 0, matches: [], matchCalls: [], embedQueries: [], similarities: 0 });
  });

  it('with lexical, matches each term in the database and ranks the menus that reach 0.6 with their evidence', async () => {
    const { result, calls } = search(request([constraint('c1', 'pollo')]), 'lexical');

    expect(await result).toEqual(
      ok({
        strategy: 'lexical',
        units: [{ kind: 'constraint', constraints: ['c1'] }],
        menus: [
          { menu: 1, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Pollo asado'), match: 'literal' }] },
          { menu: 3, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Arroz con pollo'), match: 'literal' }] },
        ],
        tiedWithFirst: 2,
        ranked: [
          { menu: 1, score: 1 },
          { menu: 3, score: 1 },
        ],
        removedBy: [],
      }),
    );
    expect(calls).toMatchObject({ list: 1, matches: ['pollo'], embedQueries: [], similarities: 0 });
  });

  it('with lexical, ranks the menus even when the embedding service would fail on any call', async () => {
    const { result } = search(request([constraint('c1', 'pollo')]), 'lexical', { fail: 'embed' });

    expect((await result).ok).toBe(true);
  });

  it('with semantic, embeds each distinct term once and matches the text of each distinct term once', async () => {
    const raw = request([
      constraint('c1', 'pollo'),
      constraint('c2', 'pollo', { slot: 'lunch' }),
      constraint('c3', 'cerdo', { type: 'exclusion', polarity: 'exclude' }),
    ]);

    const { result, calls } = search(raw, 'semantic');

    expect((await result).ok).toBe(true);
    expect(calls).toMatchObject({ matches: ['pollo', 'cerdo'], embedQueries: [['pollo']], similarities: 1 });
  });

  it('matches week-wide exclusions with includeIngredientGroups false and other constraints with default', async () => {
    const raw = request([
      constraint('c1', 'pollo'),
      constraint('c2', 'cerdo', { type: 'exclusion', polarity: 'exclude' }),
    ]);

    const { result, calls } = search(raw, 'semantic');

    expect((await result).ok).toBe(true);
    expect(calls.matchCalls).toEqual([
      { term: 'pollo', options: undefined },
      { term: 'cerdo', options: { includeIngredientGroups: false } },
    ]);
  });

  it('with semantic, takes Math.max(semantic, lexical) for a literal constraint', async () => {
    // Menu 1 'Pollo asado' matches text for 'pollo' (lexical = 1), but let its similarity be 0.4 while Menu 3 is 0.8.
    // Without max-pooling, Menu 1's rescaled semantic score would be (0.4 - 0.2) / (0.8 - 0.2) = 0.33 (< 0.6, not ranked).
    // With max-pooling for literal constraint, Menu 1's score is Math.max(0.33, 1) = 1.
    const customSimilarities = {
      pollo: {
        'Pollo asado': 0.4,
        'Arroz con pollo': 0.8,
      },
    };
    const raw = request([constraint('c1', 'pollo', { type: 'literal' })]);

    const result = await search(raw, 'semantic', { customSimilarities }).result;

    expect(result.ok && result.value.menus.find((m) => m.menu === 1)?.score).toBe(1);
  });

  it('with semantic, takes Math.max(semantic, lexical) for a constraint inside sameDish or anyOf', async () => {
    // Menu 1 'Pollo asado' matches text for 'pollo' (lexical = 1).
    // Let 'pollo' have low similarity 0.4 on 'Pollo asado' and high 0.8 on 'Arroz con pollo'.
    // If fuzzy 'pollo' were not maxed to 1, its score on 'Pollo asado' would be 0.33, making sameDish score 0.33 (< 0.6).
    const customSimilarities = {
      pollo: {
        'Pollo asado': 0.4,
        'Arroz con pollo': 0.8,
      },
    };
    const raw = request([constraint('c1', 'pollo', { type: 'fuzzy' }), constraint('c2', 'asado', { type: 'literal' })], {
      sameDish: [['c1', 'c2']],
    });

    const result = await search(raw, 'semantic', { customSimilarities }).result;

    expect(result.ok && result.value.menus.find((m) => m.menu === 1)?.score).toBe(1);
  });

  it('with semantic, keeps semantic score alone for an ungrouped fuzzy constraint', async () => {
    const customSimilarities = {
      pollo: {
        'Pollo asado': 0.5,
        'Arroz con pollo': 0.8,
      },
      merluza: {
        'Merluza al horno': 0.9,
      },
    };
    // Ungrouped fuzzy constraint 'c1' + literal constraint 'c2':
    const raw = request([
      constraint('c1', 'pollo', { type: 'fuzzy' }),
      constraint('c2', 'merluza', { type: 'literal' }),
    ]);

    const result = await search(raw, 'semantic', { customSimilarities }).result;

    // Rescaled score for Menu 1:
    // for 'pollo': min 0.2, max 0.8 -> (0.5 - 0.2) / (0.8 - 0.2) = 0.5.
    // for 'merluza': 1.
    // If c1 keeps semantic score 0.5, mean score for Menu 1 is (0.5 + 1) / 2 = 0.75.
    // If c1 were max-pooled to lexical (1), mean score would be 1.0.
    expect(result.ok && result.value.menus.find((m) => m.menu === 1)?.score).toBe(0.75);
    // But its evidence should still be marked literal because it has text match:
    expect(result.ok && result.value.menus.find((m) => m.menu === 1)?.evidence[0].match).toBe('literal');
  });

  it('ranks menus with their units and filters when constraints are grouped', async () => {
    const raw = request([constraint('c1', 'arroz'), constraint('c2', 'pollo')], { sameDish: [['c1', 'c2']] });

    const result = await search(raw, 'lexical').result;

    expect(result.ok && result.value.menus.map(({ menu }) => menu)).toEqual([3]);
  });

  it('asks to run embed first when no embedding is stored', async () => {
    const result = await search(request([constraint('c1', 'pollo')]), 'semantic', { noEmbeddings: true }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'index-not-loaded', message: expect.stringContaining('embed') } });
  });

  it.each([
    ['list', 'lexical'],
    ['matches', 'lexical'],
    ['matches', 'hybrid'],
    ['matches', 'semantic'],
    ['similarities', 'semantic'],
  ] as const)('ends with an error and no ranking when %s fails', async (fail, strategy) => {
    const result = await search(request([constraint('c1', 'pollo')]), strategy, { fail }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'search-failed', reason: 'connection lost' } });
  });

  it('ends with an error and no ranking when matches fails for a week-wide exclusion', async () => {
    const raw = request([constraint('c1', 'cerdo', { type: 'exclusion', polarity: 'exclude' })]);
    const result = await search(raw, 'semantic', { fail: 'matches' }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'search-failed', reason: 'connection lost' } });
  });

  it('keeps the kind and the reason when the embedding service fails, with no ranking', async () => {
    const result = await search(request([constraint('c1', 'pollo')]), 'semantic', { fail: 'embed' }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'embedding-failed', reason: 'connection lost' } });
  });

  it('ends with an error when the embedding service returns fewer vectors than terms', async () => {
    const result = await search(request([constraint('c1', 'pollo')]), 'semantic', { shortVectors: true }).result;

    expect(result).toMatchObject({ ok: false, error: { kind: 'search-failed' } });
  });

  it('gives the same result for the same search', async () => {
    const raw = request([constraint('c1', 'pollo'), constraint('c2', 'calabaza')]);

    expect(await search(raw, 'hybrid').result).toEqual(await search(raw, 'hybrid').result);
  });
});
