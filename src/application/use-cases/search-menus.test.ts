import { describe, expect, it } from 'vitest';
import type { SearchRequestDto, SearchRequestIssue } from '@/application/dto/search-request';
import type { SearchStrategy } from '@/application/dto/search-result';
import type { DishAddress } from '@/application/ports/dish-text-search';
import { parseSearchRequest, searchMenus, type SearchMenusDeps } from '@/application/use-cases/search-menus';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok } from '@/shared/result';

type RawConstraint = Record<string, unknown>;

function constraint(id: string, term: string, overrides: RawConstraint = {}): RawConstraint {
  return { id, type: 'literal', term, polarity: 'include', hard: false, ...overrides };
}

function request(constraints: unknown[], overrides: Record<string, unknown> = {}) {
  return { constraints, sameDish: [], anyOf: [], ...overrides };
}

// The DTO comes from outside and may break its own type, so the tests pass any data through this cast.
function parse(raw: unknown) {
  return parseSearchRequest(raw as SearchRequestDto);
}

function issuesOf(raw: unknown): SearchRequestIssue[] {
  const result = parse(raw);
  if (result.ok) throw new Error('the structure was accepted');
  return result.error.issues;
}

describe('parseSearchRequest', () => {
  describe('accepted structures', () => {
    it('accepts one literal constraint', () => {
      const raw = request([constraint('c1', 'pollo')]);

      const result = parse(raw);

      expect(result).toEqual({ ok: true, value: raw });
    });

    it('accepts a structure without groups', () => {
      const result = parse({ constraints: [constraint('c1', 'pollo')] });

      expect(result).toEqual({ ok: true, value: request([constraint('c1', 'pollo')]) });
    });

    it('accepts the slot, the groups and the limits', () => {
      const twelve = Array.from({ length: 12 }, (_, index) => constraint(`c${index + 1}`, 'x'.repeat(100)));
      const raw = request(twelve, { sameDish: [['c1', 'c2']], anyOf: [['c3', 'c4']] });
      raw.constraints[4] = constraint('c5', 'cena', { slot: 'dinner', hard: true });

      expect(parse(raw).ok).toBe(true);
    });
  });

  describe('terms', () => {
    it('rejects a blank term naming term', () => {
      expect(issuesOf(request([constraint('c1', '   ')]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects an empty term naming term', () => {
      expect(issuesOf(request([constraint('c1', '')]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects a term of 101 characters naming term', () => {
      expect(issuesOf(request([constraint('c1', 'x'.repeat(101))]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });

    it('rejects a term that is not a string naming term', () => {
      expect(issuesOf(request([constraint('c1', 'x', { term: 42 })]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'term' }),
      ]);
    });
  });

  describe('constraints', () => {
    it('rejects 13 constraints naming constraints', () => {
      const thirteen = Array.from({ length: 13 }, (_, index) => constraint(`c${index + 1}`, 'pollo'));

      expect(issuesOf(request(thirteen))).toEqual([expect.objectContaining({ field: 'constraints' })]);
    });

    it('rejects a structure with no constraint naming constraints', () => {
      expect(issuesOf(request([]))).toEqual([expect.objectContaining({ field: 'constraints' })]);
    });

    it('rejects a constraint that is not an object naming constraints and its position', () => {
      expect(issuesOf(request(['pollo']))).toEqual([
        expect.objectContaining({ constraint: '#0', field: 'constraints' }),
      ]);
    });

    it('names a constraint without an id by its position', () => {
      const withoutId = { type: 'literal', term: 'pollo', polarity: 'include', hard: false };

      expect(issuesOf(request([withoutId]))).toEqual([expect.objectContaining({ constraint: '#0', field: 'id' })]);
    });

    it('rejects an unknown key of a constraint naming the key', () => {
      expect(issuesOf(request([constraint('c1', 'pollo', { sql: 'DROP TABLE menu' })]))).toEqual([
        expect.objectContaining({ constraint: 'c1', field: 'sql' }),
      ]);
    });

    it('rejects an unknown key of the structure naming the key', () => {
      expect(issuesOf(request([constraint('c1', 'pollo')], { limit: 50 }))).toEqual([
        expect.objectContaining({ field: 'limit' }),
      ]);
    });

    it('rejects the metadata of a golden-set request, which is not part of a search', () => {
      const raw = request([constraint('c1', 'pollo')], { id: 'A01', text: 'comidas con pollo', origin: 'x' });

      expect(issuesOf(raw)).toEqual([expect.objectContaining({ field: 'id, text, origin' })]);
    });

    it('rejects an unknown type, polarity or slot naming the field', () => {
      const fields = [
        issuesOf(request([constraint('c1', 'pollo', { type: 'regex' })])),
        issuesOf(request([constraint('c1', 'pollo', { polarity: 'maybe' })])),
        issuesOf(request([constraint('c1', 'pollo', { slot: 'breakfast' })])),
      ].map((issues) => issues.map((issue) => issue.field));

      expect(fields).toEqual([['type'], ['polarity'], ['slot']]);
    });

    it.each([null, 'pollo', 42, [], undefined])('rejects %j, which is not a structure', (raw) => {
      expect(issuesOf(raw)).toHaveLength(1);
    });
  });

  describe('rules across constraints and groups', () => {
    it('rejects a well-formed structure that breaks a rule, naming the field', () => {
      const raw = request([constraint('c1', 'pollo'), constraint('c1', 'cerdo')]);

      expect(issuesOf(raw)).toEqual([expect.objectContaining({ constraint: 'c1', field: 'id' })]);
    });

    it('reports every shape problem at once and leaves the rules for a well-formed shape', () => {
      const raw = request([constraint('c1', '   '), constraint('c2', 'b', { sql: 1 })], { sameDish: [['c1', 'c9']] });

      expect(issuesOf(raw).map((issue) => issue.field)).toEqual(['term', 'sql']);
    });
  });
});

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
  const deps: SearchMenusDeps = {
    menus: {
      saveAll: async () => ok(undefined),
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
  return { result: searchMenus(raw as SearchRequestDto, strategy, deps), calls };
}

function lunchDish(name: string) {
  return { day: 'monday', meal: 'lunch', position: 1, name };
}

describe('searchMenus', () => {
  it('rejects an invalid structure before any port call', async () => {
    const { result, calls } = search(request([constraint('c1', '   ')]), 'hybrid');

    expect(await result).toMatchObject({ ok: false, error: { kind: 'invalid-request' } });
    expect(calls).toEqual({ list: 0, matches: [], embedQueries: [], similarities: 0 });
  });

  it('with lexical, matches each term in the database and ranks every menu with its evidence', async () => {
    const { result, calls } = search(request([constraint('c1', 'pollo')]), 'lexical');

    expect(await result).toEqual(
      ok({
        strategy: 'lexical',
        menus: [
          { menu: 1, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Pollo asado') }] },
          { menu: 3, score: 1, evidence: [{ constraints: ['c1'], dish: lunchDish('Arroz con pollo') }] },
          { menu: 2, score: 0, evidence: [{ constraints: ['c1'], dish: lunchDish('Lentejas') }] },
        ],
        tiedWithFirst: 2,
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
      [2, 0],
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