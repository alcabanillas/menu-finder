import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeContent } from '@/domain/recipe/recipe';
import { err, ok, type Result } from '@/shared/result';
import type { DocumentSource, MenuFolder, SourceError, SourceRecipe } from '@/application/ports/document-source';
import type { RepositoryError } from '@/application/ports/repository-error';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { ingestRecipes } from '@/application/use-cases/ingest-recipes';

const content: RecipeContent = {
  title: 'Guiso de prueba',
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [
    { name: 'Garbanzo', householdMeasure: null, quantity: 100, unit: 'g', optional: false },
    { name: 'Sal', householdMeasure: 'al gusto', quantity: 1, unit: 'g', optional: true },
  ],
  preparation: ['Cocer.', 'Servir.'],
};

type FakeFile = SourceRecipe | { error: SourceError };
const recipe = (changes: Partial<RecipeContent> = {}, anomalies: SourceRecipe['anomalies'] = []): FakeFile => ({
  content: { ...content, ...changes },
  anomalies,
});
const failing = (error: SourceError): FakeFile => ({ error });

const folder = (number: number): MenuFolder => ({ number, name: `Menu ${number}` });

const fakeSource = (menus: Record<number, Record<string, FakeFile>>) => {
  const reads: string[] = [];
  const source: DocumentSource = {
    listMenuFolders: async () => ok(Object.keys(menus).map((key) => folder(Number(key)))),
    readMenu: async () => {
      throw new Error('not expected');
    },
    listRecipeFiles: async ({ number }) => Object.keys(menus[number]),
    readRecipe: async ({ number }, file) => {
      reads.push(`${number}/${file}`);
      const entry = menus[number][file];
      return 'error' in entry ? err(entry.error) : ok(entry);
    },
    readShoppingList: async () => {
      throw new Error('not expected');
    },
  };
  return { source, reads };
};

const fakeRepository = (result: Result<void, RepositoryError> = ok(undefined)) => {
  const saved: Recipe[][] = [];
  const repository: Pick<RecipeRepository, 'saveAll'> = {
    saveAll: async (recipes) => {
      saved.push(recipes);
      return result;
    },
  };
  return { repository, saved };
};

const run = async (menus: Record<number, Record<string, FakeFile>>, repository = fakeRepository().repository) => {
  const result = await ingestRecipes({ source: fakeSource(menus).source, recipes: repository });
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
};

describe('ingestRecipes', () => {
  it('reads the menus in numeric order and the files in name order', async () => {
    const { source, reads } = fakeSource({ 10: { B: recipe(), A: recipe() }, 2: { C: recipe() } });

    await ingestRecipes({ source, recipes: fakeRepository().repository });

    expect(reads).toEqual(['2/C', '10/A', '10/B']);
  });

  it('saves one recipe per file, from the highest menu', async () => {
    const { repository, saved } = fakeRepository();

    await run({ 3: { Guiso: recipe({ title: 'Viejo' }) }, 12: { Guiso: recipe() } }, repository);

    expect(saved).toEqual([[{ file: 'Guiso', sourceMenu: 12, ...content }]]);
  });

  it('records a failed file with its menu and cause, and saves the others', async () => {
    const { repository, saved } = fakeRepository();
    const missing: SourceError = { kind: 'missing-section', section: 'ingredients' };

    const summary = await run({ 5: { Crema: failing(missing), Guiso: recipe() } }, repository);

    expect(summary.failures).toEqual([{ menu: 5, file: 'Crema', error: missing }]);
    expect(saved[0].map((saved) => saved.file)).toEqual(['Guiso']);
  });

  it('does not let a failed version win', async () => {
    const { repository, saved } = fakeRepository();

    const summary = await run(
      { 3: { Guiso: recipe() }, 12: { Guiso: failing({ kind: 'unreadable-document', reason: 'bad' }) } },
      repository,
    );

    expect(saved[0][0].sourceMenu).toBe(3);
    expect(summary.failures).toHaveLength(1);
  });

  it('reports layout and content anomalies with their menu and file', async () => {
    const summary = await run({
      15: { Tostada: recipe({ preparation: [] }, [{ kind: 'missing-closing-line' }]) },
    });

    expect(summary.anomalies).toEqual([
      { menu: 15, file: 'Tostada', anomaly: { kind: 'missing-closing-line' } },
      { menu: 15, file: 'Tostada', anomaly: { kind: 'empty-preparation' } },
    ]);
  });

  it('fails without saving when the raw directory is missing', async () => {
    const { repository, saved } = fakeRepository();
    const source: DocumentSource = {
      ...fakeSource({}).source,
      listMenuFolders: async () => err({ kind: 'missing-raw-directory', path: 'raw' }),
    };

    expect(await ingestRecipes({ source, recipes: repository })).toEqual(
      err({ kind: 'source-unavailable', error: { kind: 'missing-raw-directory', path: 'raw' } }),
    );
    expect(saved).toEqual([]);
  });

  it('fails without saving when no recipe could be parsed', async () => {
    const { repository, saved } = fakeRepository();
    const error: SourceError = { kind: 'unreadable-document', reason: 'bad' };

    const result = await ingestRecipes({
      source: fakeSource({ 1: { Guiso: failing(error) }, 2: {} }).source,
      recipes: repository,
    });

    expect(result).toEqual(err({ kind: 'no-recipe-parsed', failures: [{ menu: 1, file: 'Guiso', error }] }));
    expect(saved).toEqual([]);
  });

  it('fails when the recipes cannot be saved', async () => {
    const failure: RepositoryError = { kind: 'write-failed', reason: 'disk full' };

    const result = await ingestRecipes({
      source: fakeSource({ 1: { Guiso: recipe() } }).source,
      recipes: fakeRepository(err(failure)).repository,
    });

    expect(result).toEqual(err({ kind: 'save-failed', error: failure }));
  });

  it('counts the files found and parsed per menu', async () => {
    const summary = await run({
      1: { Guiso: recipe(), Crema: failing({ kind: 'unreadable-document', reason: 'bad' }) },
      2: { Guiso: recipe() },
    });

    expect(summary.perMenu).toEqual([
      { menu: 1, files: 2, parsed: 1 },
      { menu: 2, files: 1, parsed: 1 },
    ]);
  });

  it('reports the divergent files', async () => {
    const summary = await run({ 3: { Guiso: recipe({ title: 'Viejo' }) }, 12: { Guiso: recipe() } });

    expect(summary.divergent).toEqual([{ file: 'Guiso', keptMenu: 12, differingMenus: [3], fields: ['title'] }]);
  });

  it('computes the totals, with the content figures over the saved recipes', async () => {
    const summary = await run({
      1: {
        Guiso: recipe({ title: 'Viejo' }),
        Arroz: recipe({
          times: { ...content.times, total: null },
          preparation: [],
          ingredients: [
            { name: 'garbanzo', householdMeasure: 'una pizca', quantity: null, unit: null, optional: false },
          ],
        }),
        Crema: failing({ kind: 'unreadable-document', reason: 'bad' }),
      },
      2: { Guiso: recipe(), Tortilla: recipe() },
      3: { Tortilla: recipe() },
    });

    expect(summary.totals).toEqual({
      filesFound: 6,
      filesParsed: 5,
      distinctFiles: 3,
      repeatedFiles: 2,
      divergentFiles: 1,
      divergentByField: { title: 1, times: 0, ingredients: 0, preparation: 0 },
      withTotalTime: 2,
      withPreparation: 2,
      paragraphs: 4,
      ingredients: 5,
      ingredientsWithQuantity: 4,
      optionalIngredients: 2,
      distinctIngredientNames: 2,
      ingredientsByUnit: { g: 4, none: 1 },
    });
  });
});
