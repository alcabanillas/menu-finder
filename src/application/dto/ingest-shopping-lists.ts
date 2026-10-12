import type { SaveFailure, SourceFailure } from '@/application/dto/ingest-failure';
import type { ShoppingListAnomaly } from '@/domain/shopping/shopping-list-anomalies';

export type { ShoppingListAnomaly };

export type ShoppingListFailure = { menu: number; error: SourceFailure | { kind: 'empty-list' } };

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
  | { kind: 'source-unavailable'; error: SourceFailure }
  | { kind: 'no-list-parsed'; failures: ShoppingListFailure[] }
  | { kind: 'save-failed'; error: SaveFailure };
