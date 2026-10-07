import type { ShoppingChecklistDto } from '@/application/dto/shopping-checklist';
import type { Clock } from '@/application/ports/clock';
import type { RepositoryReadError } from '@/application/ports/repository-error';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import { mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { currentOf } from '@/domain/selection/week';
import { toChecklist, type Checklist } from '@/domain/shopping/checklist';
import { err, ok, type Result } from '@/shared/result';

/** Whose list is asked for: the user id comes from the session. */
export type ShoppingChecklistInput = { userId: string };

/** The selections, the items or the ticks could not be read: a fault of the system. */
export type ShoppingChecklistFailure = { kind: 'failed' };

type Deps = { selections: SelectionRepository; shoppingLists: ShoppingListRepository; clock: Clock };

/**
 * The user's current shopping list with its ticks. `null` when the user has no current shopping list; a checklist with
 * total 0 when its menu has no stored list.
 */
export async function shoppingChecklist(
  deps: Deps,
  { userId }: ShoppingChecklistInput,
): Promise<Result<ShoppingChecklistDto | null, ShoppingChecklistFailure>> {
  const current = await currentShoppingSelection(deps, userId);
  if (!current.ok) return err({ kind: 'failed' });
  if (current.value === null) return ok(null);

  const selection = current.value;
  const [items, ticks] = await Promise.all([
    deps.shoppingLists.find(selection.menuNumber),
    deps.selections.checkedPositions(userId, selection.id),
  ]);
  if (!items.ok || !ticks.ok) return err({ kind: 'failed' });
  return ok(toDto(selection, toChecklist(items.value, ticks.value)));
}

/** The selection whose shopping list is the user's current one, or `null` when there is none. */
export async function currentShoppingSelection(
  { selections, clock }: Pick<Deps, 'selections' | 'clock'>,
  userId: string,
): Promise<Result<Selection | null, RepositoryReadError>> {
  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  return fromThisMonday.ok ? ok(currentOf(fromThisMonday.value, today).shoppingList) : fromThisMonday;
}

function toDto({ menuNumber, startsOn }: Selection, checklist: Checklist): ShoppingChecklistDto {
  return {
    menuNumber,
    startsOn,
    checkedCount: checklist.checkedCount,
    total: checklist.total,
    categories: checklist.categories.map((category) => ({
      name: category.name,
      checkedCount: category.checkedCount,
      items: category.items.map(({ position, name, quantity, unit, optional, checked }) => ({
        position,
        name,
        quantity,
        unit,
        optional,
        checked,
      })),
    })),
  };
}
