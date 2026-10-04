import { describe, expect, it } from 'vitest';
import type {
  DocumentSource,
  MenuFolder,
  ShoppingListAnomaly,
  SourceError,
  SourceShoppingList,
} from '@/application/ports/document-source';
import type { RepositoryError } from '@/application/ports/repository-error';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import type { ShoppingItem, ShoppingList } from '@/domain/shopping/shopping-list';
import { err, ok, type Result } from '@/shared/result';
import { ingestShoppingLists } from '@/application/use-cases/ingest-shopping-lists';

const sampleItem: ShoppingItem = {
  category: 'Cárnicos y derivados',
  name: 'Pollo (pechuga)',
  quantity: 240,
  unit: 'g',
  optional: false,
};

type FakeListResponse = SourceShoppingList | { error: SourceError };

const validList = (changes: Partial<SourceShoppingList> = {}): FakeListResponse => ({
  pages: 1,
  items: [sampleItem],
  anomalies: [],
  ...changes,
});

const failing = (error: SourceError): FakeListResponse => ({ error });

const folder = (number: number): MenuFolder => ({ number, name: `Menu ${number}` });

const fakeSource = (menus: Record<number, FakeListResponse>) => {
  const reads: number[] = [];
  const source: DocumentSource = {
    listMenuFolders: async () => ok(Object.keys(menus).map((key) => folder(Number(key)))),
    readMenu: async () => {
      throw new Error('not expected');
    },
    listRecipeFiles: async () => {
      throw new Error('not expected');
    },
    readRecipe: async () => {
      throw new Error('not expected');
    },
    readShoppingList: async ({ number }) => {
      reads.push(number);
      const entry = menus[number];
      return 'error' in entry ? err(entry.error) : ok(entry);
    },
  };
  return { source, reads };
};

const fakeRepository = (result: Result<void, RepositoryError> = ok(undefined)) => {
  const saved: ShoppingList[][] = [];
  const repository: ShoppingListRepository = {
    saveAll: async (lists) => {
      saved.push(lists);
      return result;
    },
  };
  return { repository, saved };
};

describe('ingestShoppingLists', () => {
  it('reads the menus in numeric order', async () => {
    const { source, reads } = fakeSource({ 10: validList(), 2: validList() });

    await ingestShoppingLists({ source, shoppingLists: fakeRepository().repository });

    expect(reads).toEqual([2, 10]);
  });

  it('Missing list: records failure and continues with other menus', async () => {
    const { repository, saved } = fakeRepository();
    const missingError: SourceError = { kind: 'missing-file', file: 'Lista_de_la_compra.pdf' };
    const { source } = fakeSource({ 3: failing(missingError), 4: validList() });

    const result = await ingestShoppingLists({ source, shoppingLists: repository });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failures).toEqual([{ menu: 3, error: missingError }]);
      expect(saved).toEqual([[{ menuNumber: 4, items: [sampleItem] }]]);
    }
  });

  it('Unreadable PDF: failure recorded and others go on', async () => {
    const { repository, saved } = fakeRepository();
    const unreadableError: SourceError = { kind: 'unreadable-document', reason: 'damaged file' };
    const { source } = fakeSource({ 1: failing(unreadableError), 2: validList() });

    const result = await ingestShoppingLists({ source, shoppingLists: repository });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failures).toEqual([{ menu: 1, error: unreadableError }]);
      expect(saved).toEqual([[{ menuNumber: 2, items: [sampleItem] }]]);
    }
  });

  it('List without items: records failure and does not save the empty list', async () => {
    const { repository, saved } = fakeRepository();
    const { source } = fakeSource({
      1: validList({ items: [] }),
      2: validList(),
    });

    const result = await ingestShoppingLists({ source, shoppingLists: repository });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failures).toEqual([{ menu: 1, error: { kind: 'empty-list' } }]);
      expect(saved).toEqual([[{ menuNumber: 2, items: [sampleItem] }]]);
    }
  });

  it('no list could be read, nothing saved', async () => {
    const { repository, saved } = fakeRepository();
    const error: SourceError = { kind: 'missing-file', file: 'Lista_de_la_compra.pdf' };
    const { source } = fakeSource({
      1: failing(error),
      2: validList({ items: [] }),
    });

    const result = await ingestShoppingLists({ source, shoppingLists: repository });

    expect(result).toEqual(
      err({
        kind: 'no-list-parsed',
        failures: [
          { menu: 1, error },
          { menu: 2, error: { kind: 'empty-list' } },
        ],
      }),
    );
    expect(saved).toEqual([]);
  });

  it('fails without saving when the source directory is unavailable', async () => {
    const { repository, saved } = fakeRepository();
    const source: DocumentSource = {
      ...fakeSource({}).source,
      listMenuFolders: async () => err({ kind: 'missing-raw-directory', path: 'raw' }),
    };

    const result = await ingestShoppingLists({ source, shoppingLists: repository });

    expect(result).toEqual(
      err({ kind: 'source-unavailable', error: { kind: 'missing-raw-directory', path: 'raw' } }),
    );
    expect(saved).toEqual([]);
  });

  it('fails when repository saveAll fails', async () => {
    const saveError: RepositoryError = { kind: 'write-failed', reason: 'db error' };
    const { source } = fakeSource({ 1: validList() });

    const result = await ingestShoppingLists({
      source,
      shoppingLists: fakeRepository(err(saveError)).repository,
    });

    expect(result).toEqual(err({ kind: 'save-failed', error: saveError }));
  });

  it('reports anomalies with their menu number', async () => {
    const anomaly: ShoppingListAnomaly = { kind: 'unrecognized-line', text: 'bad line' };
    const { source } = fakeSource({
      2: validList({ anomalies: [anomaly] }),
    });

    const result = await ingestShoppingLists({ source, shoppingLists: fakeRepository().repository });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anomalies).toEqual([{ menu: 2, anomaly }]);
    }
  });

  it('computes totals correctly across multiple menus', async () => {
    const { source } = fakeSource({
      1: validList({
        pages: 1,
        items: [
          sampleItem,
          { category: 'Especias', name: 'Sal', quantity: null, unit: null, optional: true },
        ],
      }),
      2: validList({
        pages: 2,
        items: [
          { category: 'Frutas', name: 'Manzana', quantity: 2, unit: null, optional: false },
        ],
      }),
    });

    const result = await ingestShoppingLists({ source, shoppingLists: fakeRepository().repository });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.perMenu).toEqual([
        { menu: 1, pages: 1, items: 2 },
        { menu: 2, pages: 2, items: 1 },
      ]);
      expect(result.value.totals).toEqual({
        listsRead: 2,
        listsWithMultiplePages: 1,
        items: 3,
        optionalItems: 1,
        itemsWithoutQuantity: 1,
      });
    }
  });
});
