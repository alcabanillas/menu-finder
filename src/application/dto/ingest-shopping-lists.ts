import type { ShoppingListAnomaly, SourceError } from '@/application/ports/document-source';
import type { RepositoryError } from '@/application/ports/repository-error';

export type { ShoppingListAnomaly };

export type ShoppingListFailure = { menu: number; error: SourceError | { kind: 'empty-list' } };

export type ShoppingListAnomalyRow = { menu: number; anomaly: ShoppingListAnomaly };

export type MenuShoppingListCount = { menu: number; pages: number; items: number };

export type IngestShoppingListsTotals = {
  listsRead: number;
  listsWithMultiplePages: number;
  items: number;
  optionalItems: number;
  itemsWithoutQuantity: number;
};

export type IngestShoppingListsSummary = {
  perMenu: MenuShoppingListCount[];
  failures: ShoppingListFailure[];
  anomalies: ShoppingListAnomalyRow[];
  totals: IngestShoppingListsTotals;
};

export type IngestShoppingListsError =
  | { kind: 'source-unavailable'; error: SourceError }
  | { kind: 'no-list-parsed'; failures: ShoppingListFailure[] }
  | { kind: 'save-failed'; error: RepositoryError };
