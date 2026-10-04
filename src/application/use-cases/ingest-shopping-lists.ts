import type {
  IngestShoppingListsError,
  IngestShoppingListsSummary,
  IngestShoppingListsTotals,
  MenuShoppingListCount,
  ShoppingListAnomalyRow,
  ShoppingListFailure,
} from '@/application/dto/ingest-shopping-lists';
import type { DocumentSource, MenuFolder } from '@/application/ports/document-source';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import type { ShoppingList } from '@/domain/shopping/shopping-list';
import { err, ok, type Result } from '@/shared/result';

export type IngestShoppingListsDeps = {
  source: DocumentSource;
  shoppingLists: ShoppingListRepository;
};

type ReadResult = {
  listsToSave: ShoppingList[];
  perMenu: MenuShoppingListCount[];
  failures: ShoppingListFailure[];
  anomalies: ShoppingListAnomalyRow[];
};

/**
 * Reads every shopping list file of every menu in numeric order and saves them.
 * A menu that fails is recorded and the others go on. Nothing is saved when no
 * list could be read.
 */
export async function ingestShoppingLists({
  source,
  shoppingLists,
}: IngestShoppingListsDeps): Promise<Result<IngestShoppingListsSummary, IngestShoppingListsError>> {
  const folders = await source.listMenuFolders();
  if (!folders.ok) {
    return err({ kind: 'source-unavailable', error: folders.error });
  }

  const { listsToSave, perMenu, failures, anomalies } = await readAllShoppingLists(
    source,
    folders.value,
  );
  if (listsToSave.length === 0) {
    return err({ kind: 'no-list-parsed', failures });
  }

  const saved = await shoppingLists.saveAll(listsToSave);
  if (!saved.ok) {
    return err({ kind: 'save-failed', error: saved.error });
  }

  return ok({
    perMenu,
    failures,
    anomalies,
    totals: computeTotals(listsToSave, perMenu),
  });
}

async function readAllShoppingLists(
  source: DocumentSource,
  folders: MenuFolder[],
): Promise<ReadResult> {
  const sortedFolders = [...folders].sort((a, b) => a.number - b.number);
  const result: ReadResult = {
    listsToSave: [],
    perMenu: [],
    failures: [],
    anomalies: [],
  };

  for (const folder of sortedFolders) {
    await readSingleShoppingList(source, folder, result);
  }

  return result;
}

async function readSingleShoppingList(
  source: DocumentSource,
  folder: MenuFolder,
  result: ReadResult,
): Promise<void> {
  const listResult = await source.readShoppingList(folder);
  if (!listResult.ok) {
    result.failures.push({ menu: folder.number, error: listResult.error });
    return;
  }

  const { pages, items, anomalies } = listResult.value;
  if (items.length === 0) {
    result.failures.push({ menu: folder.number, error: { kind: 'empty-list' } });
    return;
  }

  result.listsToSave.push({ menuNumber: folder.number, items });
  result.perMenu.push({ menu: folder.number, pages, items: items.length });
  for (const anomaly of anomalies) {
    result.anomalies.push({ menu: folder.number, anomaly });
  }
}

function computeTotals(
  lists: ShoppingList[],
  perMenu: MenuShoppingListCount[],
): IngestShoppingListsTotals {
  const allItems = lists.flatMap((list) => list.items);

  return {
    listsRead: lists.length,
    listsWithMultiplePages: perMenu.filter((m) => m.pages > 1).length,
    items: allItems.length,
    optionalItems: allItems.filter((i) => i.optional).length,
    itemsWithoutQuantity: allItems.filter((i) => i.quantity === null).length,
  };
}
