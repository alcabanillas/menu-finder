import { z } from 'zod';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import { positiveIntegerInput } from '@/application/use-cases/select-menu';
import { currentShoppingSelection } from '@/application/use-cases/shopping-checklist';
import { err, ok, type Result } from '@/shared/result';

/** What a form or a direct call sends: nothing but the user id is trusted, and it comes from the session. */
export type CheckShoppingItemsInput = { userId: string; menuNumber?: unknown; positions?: unknown; checked?: unknown };

/**
 * `invalid`: a malformed value or a position not in the list; `stale`: the list the request was drawn for is no longer
 * the current one, or there is none; `failed`: a fault of the system.
 */
export type CheckShoppingItemsFailure = { kind: 'invalid' } | { kind: 'stale' } | { kind: 'failed' };

type Deps = { selections: SelectionRepository; shoppingLists: ShoppingListRepository; clock: Clock };

// No shopping list has this many items: the limit only bounds the size of a request.
const MAX_POSITIONS = 200;

const requestSchema = z.object({
  menuNumber: positiveIntegerInput,
  positions: z.array(positiveIntegerInput).min(1).max(MAX_POSITIONS),
  checked: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]),
});

/** Ticks or unticks items of the user's current shopping list. Nothing is written unless every check passes. */
export async function checkShoppingItems(
  deps: Deps,
  { userId, menuNumber, positions, checked }: CheckShoppingItemsInput,
): Promise<Result<void, CheckShoppingItemsFailure>> {
  const parsed = requestSchema.safeParse({ menuNumber, positions, checked });
  if (!parsed.success) return err({ kind: 'invalid' });
  const request = parsed.data;

  const current = await currentShoppingSelection(deps, userId);
  if (!current.ok) return err({ kind: 'failed' });
  const selection = current.value;
  if (selection === null || selection.menuNumber !== request.menuNumber) return err({ kind: 'stale' });

  const items = await deps.shoppingLists.find(request.menuNumber);
  if (!items.ok) return err({ kind: 'failed' });
  const inList = new Set(items.value.map((item) => item.position));
  if (!request.positions.every((position) => inList.has(position))) return err({ kind: 'invalid' });

  const stored = await deps.selections.setChecked(userId, selection.id, [...new Set(request.positions)], request.checked);
  return stored.ok ? ok(undefined) : err({ kind: 'failed' });
}
