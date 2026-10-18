import type { Clock } from '@/application/ports/clock';
import type { RepositoryReadError } from '@/application/ports/repository-error';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { currentOf } from '@/domain/selection/week';
import { ok, type Result } from '@/shared/result';

type Deps = { selections: SelectionRepository; clock: Clock };

/** The selection whose shopping list is the user's current one, or `null` when there is none. */
export async function currentShoppingSelection(
  { selections, clock }: Deps,
  userId: string,
): Promise<Result<Selection | null, RepositoryReadError>> {
  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  return fromThisMonday.ok ? ok(currentOf(fromThisMonday.value, today).shoppingSelection) : fromThisMonday;
}
