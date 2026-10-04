import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DishAddress } from '@/application/ports/dish-text-search';
import type { GoldenSets, GradedQuery, QueryType } from '@/application/ports/golden-set-source';
import { evaluateSearch } from '@/application/use-cases/evaluate-search';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok } from '@/shared/result';

// Fictitious dish names: no real data reaches the tests (AGENTS.md, Datos).
const CATALOG: WeeklyMenu[] = [
  menu(1, 'Pollo Tarlan', 'Sopa Vrenna'),
  menu(2, 'Arroz Quelt', 'Merluza Ondor'),
  menu(3, 'Pollo Brisca', 'Crema Ulvane'),
];

const DISH_NAMES = CATALOG.flatMap(({ meals }) => meals.flatMap(({ dishes }) => dishes.map(({ name }) => name)));

const VECTOR_SIZE = 3;

function menu(number: number, lunch: string, dinner: string): WeeklyMenu {
  const dish = (name: string) => ({ position: 1, name, hasRecipeMark: false, recipeFile: null });
  return {
    number,
    meals: [
      { day: 'monday', type: 'lunch', dishes: [dish(lunch)] },
      { day: 'monday', type: 'dinner', dishes: [dish(dinner)] },
    ],
  };
}

function query(id: string, type: QueryType, grades: number[], status: GradedQuery['status'] = 'kept'): GradedQuery {
  return { id, type, status, grades: new Map(grades.map((grade, index) => [index + 1, grade])) };
}

function structure(id: string, ...terms: string[]) {
  const constraints = terms.map((term, index) => ({
    id: `c${index + 1}`,
    type: 'literal' as const,
    term,
    polarity: 'include' as const,
    hard: false,
  }));
  return { id, structure: { constraints, sameDish: [], anyOf: [] } satisfies SearchRequestDto };
}

const GOLDEN_SETS: GoldenSets = {
  queries: [
    query('L01', 'literal', [2, 0, 1]),
    query('L02', 'literal', [0, 2, 0]),
    query('A01', 'attribute', [0, 0, 0]),
    query('X01', 'combined', [2, 2, 2], 'withdrawn'),
  ],
  structures: [structure('L01', 'pollo'), structure('L02', 'merluza'), structure('A01', 'pollo', 'crema')],
};

type FakeOptions = {
  goldenSets?: GoldenSets;
  catalog?: WeeklyMenu[];
  failEmbed?: boolean;
  failList?: boolean;
  noEmbeddings?: boolean;
  shortVectors?: boolean;
};

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

/** Ports over CATALOG that record every call; a query vector carries the index of its term among those embedded. */
function fakePorts({
  goldenSets = GOLDEN_SETS,
  catalog = CATALOG,
  failEmbed = false,
  failList = false,
  noEmbeddings = false,
  shortVectors = false,
}: FakeOptions = {}) {
  const calls = { matches: [] as string[], embedded: [] as string[] };
  const dishes = catalogDishes();
  const deps = {
    goldenSets: { read: async () => ok(goldenSets) },
    menus: {
      saveAll: async () => ok(undefined),
      list: async () => (failList ? err({ kind: 'read-failed' as const, reason: 'connection lost' }) : ok(catalog)),
    },
    dishText: {
      matches: async (term: string) => {
        calls.matches.push(term);
        return ok(dishes.filter(({ name }) => nameHas(name, term)).map(({ address }) => address));
      },
    },
    recipeEmbeddings: {
      documents: async () => ok([]),
      saveAll: async () => ok(undefined),
      similarities: async (_variant: string, [index]: number[]) => {
        if (noEmbeddings) return ok([]);
        const term = calls.embedded[index];
        return ok(dishes.map(({ address, name }) => ({ dish: address, similarity: nameHas(name, term) ? 0.9 : 0.2 })));
      },
    },
    embeddings: {
      model: 'test-model',
      embedDocuments: async () => err({ kind: 'embedding-failed' as const, reason: 'not used' }),
      embedQueries: async (terms: string[]) => {
        if (failEmbed) return err({ kind: 'embedding-failed' as const, reason: 'quota exceeded' });
        const vectors = terms.map((term) => [calls.embedded.push(term) - 1, ...Array(VECTOR_SIZE - 1).fill(0)]);
        return ok(shortVectors ? vectors.slice(1) : vectors);
      },
    },
  };
  return { deps, calls };
}

async function evaluate(options: FakeOptions = {}) {
  const { deps, calls } = fakePorts(options);
  return { result: await evaluateSearch(deps), calls };
}

async function report(options: FakeOptions = {}) {
  const { result } = await evaluate(options);
  if (!result.ok) throw new Error(`the evaluation failed: ${JSON.stringify(result.error)}`);
  return result.value.report;
}

describe('evaluateSearch', () => {
  it('evaluates every kept query with the three strategies and ignores a withdrawn one', async () => {
    const { queries } = await report();

    expect(queries.map(({ id, strategy }) => `${id}/${strategy}`)).toEqual([
      'L01/lexical',
      'L01/semantic',
      'L01/hybrid',
      'L02/lexical',
      'L02/semantic',
      'L02/hybrid',
      'A01/lexical',
      'A01/semantic',
      'A01/hybrid',
    ]);
  });

  it('scores each query with nDCG@5 and hit@5 against its grades', async () => {
    const { queries } = await report();

    // "pollo" ranks menus 1 and 3, tied: both positions get the mean grade 1.5 against the ideal 2, 1.
    const l01 = queries.find(({ id, strategy }) => id === 'L01' && strategy === 'lexical');
    const ideal = 2 + 1 / Math.log2(3);
    expect(l01).toEqual({
      id: 'L01',
      type: 'literal',
      strategy: 'lexical',
      ndcg: (1.5 + 1.5 / Math.log2(3)) / ideal,
      hit: 1,
      empty: false,
    });
  });

  it('leaves a query whose grades are all 0 out of the means and lists it', async () => {
    const { withoutRelevant, cells } = await report();

    expect(withoutRelevant).toEqual(['A01']);
    expect(cells.find(({ type, strategy }) => type === 'attribute' && strategy === 'lexical')).toMatchObject({
      ndcg: null,
      ndcgQueries: 0,
    });
  });

  it('gives one cell per query type found and one overall, for each strategy, with its counts', async () => {
    const { cells } = await report();

    expect(cells.map(({ type, strategy }) => `${type}/${strategy}`)).toEqual([
      'literal/lexical',
      'literal/semantic',
      'literal/hybrid',
      'attribute/lexical',
      'attribute/semantic',
      'attribute/hybrid',
      'overall/lexical',
      'overall/semantic',
      'overall/hybrid',
    ]);
    expect(cells.find(({ type, strategy }) => type === 'overall' && strategy === 'lexical')).toMatchObject({
      ndcgQueries: 2,
      hitQueries: 2,
    });
  });

  it('marks an empty ranking and scores it 0', async () => {
    const goldenSets: GoldenSets = {
      queries: [query('L09', 'literal', [2, 0, 0])],
      structures: [structure('L09', 'garbanzo')],
    };

    const { queries } = await report({ goldenSets });

    expect(queries.find(({ strategy }) => strategy === 'lexical')).toMatchObject({ ndcg: 0, hit: 0, empty: true });
  });

  it('records the parameters of the run', async () => {
    const { parameters } = await report();

    expect(parameters).toEqual({
      embeddingModel: 'test-model',
      dimensions: VECTOR_SIZE,
      hybridWeight: 0.5,
      matchThreshold: { lexical: 0.5, semantic: 0.5, hybrid: 0.75 },
      minMenuScore: 0.6,
    });
  });

  it('embeds each distinct term once in the whole run', async () => {
    const { calls } = await evaluate();

    expect(calls.embedded).toEqual(['pollo', 'merluza', 'crema']);
  });

  it('holds ids and numbers in the report, and no dish name of the data', async () => {
    const text = JSON.stringify(await report());

    for (const name of DISH_NAMES) expect(text).not.toContain(name);
  });

  it('gives the details of every search for the console, apart from the report', async () => {
    const { result } = await evaluate();

    expect(result.ok && result.value.details.map(({ id, result: { strategy } }) => `${id}/${strategy}`)).toHaveLength(9);
  });

  it('gives the same report for the same data and the same embeddings', async () => {
    expect(await report()).toEqual(await report());
  });

  it('stops naming the id when a kept query has no structure, before any search', async () => {
    const goldenSets = { ...GOLDEN_SETS, structures: GOLDEN_SETS.structures.slice(1) };

    const { result, calls } = await evaluate({ goldenSets });

    expect(result).toEqual(err({ kind: 'invalid-input', id: 'L01', problem: expect.stringContaining('no structure') }));
    expect(calls).toEqual({ matches: [], embedded: [] });
  });

  it('stops naming the id and the field when a structure is not a valid search, before any search', async () => {
    const goldenSets = { ...GOLDEN_SETS, structures: [...GOLDEN_SETS.structures.slice(1), structure('L01', '   ')] };

    const { result, calls } = await evaluate({ goldenSets });

    expect(result).toEqual(err({ kind: 'invalid-input', id: 'L01', problem: expect.stringContaining('c1.term') }));
    expect(calls).toEqual({ matches: [], embedded: [] });
  });

  it('names the field of a problem of the whole structure', async () => {
    const empty = { id: 'L01', structure: { constraints: [], sameDish: [], anyOf: [] } };
    const goldenSets = { ...GOLDEN_SETS, structures: [...GOLDEN_SETS.structures.slice(1), empty] };

    const { result } = await evaluate({ goldenSets });

    expect(result).toEqual(err({ kind: 'invalid-input', id: 'L01', problem: expect.stringContaining('constraints') }));
  });

  it('stops naming the id and the menus when a kept query lacks the grade of a loaded menu', async () => {
    const goldenSets = { ...GOLDEN_SETS, queries: [query('L01', 'literal', [2, 0])] };

    const { result } = await evaluate({ goldenSets });

    expect(result).toEqual(err({ kind: 'invalid-input', id: 'L01', problem: expect.stringContaining('menu 3') }));
  });

  it('asks to load the menus when the database has none', async () => {
    const { result } = await evaluate({ catalog: [] });

    expect(result).toEqual(err({ kind: 'index-not-loaded', message: expect.stringContaining('pnpm ingest menu') }));
  });

  it('passes on a golden set that cannot be read', async () => {
    const { deps } = fakePorts();
    const failure = { kind: 'golden-set-invalid' as const, file: 'evals/retrieval/golden-set.json', reason: 'not JSON' };

    const result = await evaluateSearch({ ...deps, goldenSets: { read: async () => err(failure) } });

    expect(result).toEqual(err(failure));
  });

  it('stops naming the query when a search fails, with no report', async () => {
    const { result } = await evaluate({ failEmbed: true });

    expect(result).toEqual(err({ kind: 'search-failed', id: 'L01', reason: 'quota exceeded' }));
  });

  it('stops when the menus cannot be read, with no report', async () => {
    const { result } = await evaluate({ failList: true });

    expect(result).toEqual(err({ kind: 'search-failed', reason: 'connection lost' }));
  });

  it('asks to run embed first when no embedding is stored', async () => {
    const { result } = await evaluate({ noEmbeddings: true });

    expect(result).toEqual(err({ kind: 'index-not-loaded', message: expect.stringContaining('embed') }));
  });

  it('stops when the embedding service returns fewer vectors than terms', async () => {
    const { result } = await evaluate({ shortVectors: true });

    expect(result).toMatchObject(err({ kind: 'search-failed', id: 'L01' }));
  });

  it('gives an empty report with no vector size when no query is kept', async () => {
    const goldenSets = { queries: [query('X01', 'combined', [2, 2, 2], 'withdrawn')], structures: [] };

    const { parameters, queries } = await report({ goldenSets });

    expect(queries).toEqual([]);
    expect(parameters.dimensions).toBe(0);
  });
});
