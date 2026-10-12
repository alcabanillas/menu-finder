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
type FakeOptions = { fail?: FailingPort; noEmbeddings?: boolean; shortVectors?: boolean };

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
function fakePorts({ fail, noEmbeddings = false, shortVectors = false }: FakeOptions = {}) {
  const calls = { list: 0, matches: [] as string[], embedQueries: [] as string[][], similarities: 0 };
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
      matches: async (term) => {
        calls.matches.push(term);
        if (fail === 'matches') return err({ kind: 'text-search-failed', ...failure });
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
        return ok(dishes.map(({ address, name }) => ({ dish: address, similarity: nameHas(name, term) ? 0.9 : 0.2 })));
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
    expect(calls).toEqual({ list: 0, matches: [], embedQueries: [], similarities: 0 });
  });

  it('with lexical, matches each term in the database and ranks the menus that reach 0.6 with their evidence', async () => {
    const { result, calls } = search(request([constraint('c1', 'pollo')]), 'lexical');

    expect(await result).toEqual(
      ok({
        strategy: 'lexical',
        menus: [
          { menu: 1, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Pollo asado') }] },
          { menu: 3, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Arroz con pollo') }] },
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

  it('with semantic, embeds each distinct term once and never matches text', async () => {
    const raw = request([
      constraint('c1', 'pollo'),
      constraint('c2', 'pollo', { slot: 'lunch' }),
      constraint('c3', 'cerdo', { type: 'exclusion', polarity: 'exclude' }),
    ]);

    const { result, calls } = search(raw, 'semantic');

    expect((await result).ok).toBe(true);
    expect(calls).toMatchObject({ matches: [], embedQueries: [['pollo', 'cerdo']], similarities: 2 });
  });

  it('with hybrid, uses the text match and the embeddings', async () => {
    const { result, calls } = search(request([constraint('c1', 'pollo')]), 'hybrid');

    const ranking = await result;

    expect(ranking.ok && ranking.value.menus.map(({ menu, score }) => [menu, score])).toEqual([
      [1, 1],
      [3, 1],
    ]);
    expect(calls).toMatchObject({ matches: ['pollo'], embedQueries: [['pollo']], similarities: 1 });
  });

  it('applies the hard constraints and gives no evidence for a week-wide exclusion', async () => {
    const raw = request([
      constraint('c1', 'pollo', { hard: true }),
      constraint('c2', 'cerdo', { type: 'exclusion', polarity: 'exclude' }),
    ]);

    const result = await search(raw, 'lexical').result;

    expect(result).toMatchObject({
      ok: true,
      value: {
        menus: [
          { menu: 1, evidence: [{ constraints: ['c1'] }, { constraints: ['c2'], dish: null }] },
          { menu: 3 },
        ],
        removedBy: [{ constraints: ['c1'], menusRemoved: 1 }],
      },
    });
  });

  it('asks to run embed first when no embedding is stored', async () => {
    const result = await search(request([constraint('c1', 'pollo')]), 'semantic', { noEmbeddings: true }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'index-not-loaded', message: expect.stringContaining('embed') } });
  });

  it.each([
    ['list', 'lexical'],
    ['matches', 'lexical'],
    ['matches', 'hybrid'],
    ['embed', 'semantic'],
    ['similarities', 'semantic'],
  ] as const)('ends with an error and no ranking when %s fails', async (fail, strategy) => {
    const result = await search(request([constraint('c1', 'pollo')]), strategy, { fail }).result;

    expect(result).toEqual({ ok: false, error: { kind: 'search-failed', reason: 'connection lost' } });
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