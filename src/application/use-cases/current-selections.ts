import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { mondayOf } from '@/domain/selection/local-date';
import type { CurrentSelections } from '@/domain/selection/selection';
import { currentOf } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** Whose selections are asked for: the user id comes from the session. */
export type CurrentSelectionsInput = { userId: string };

/** The selections could not be read: a fault of the system. */
export type CurrentSelectionsFailure = { kind: 'failed' };

type Deps = { selections: SelectionRepository; clock: Clock };

/** The user's active menu and current shopping list today. Older selections cannot be active, so they are not read. */
export async function currentSelections(
  { selections, clock }: Deps,
  { userId }: CurrentSelectionsInput,
): Promise<Result<CurrentSelections, CurrentSelectionsFailure>> {
  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  return fromThisMonday.ok ? ok(currentOf(fromThisMonday.value, today)) : err({ kind: 'failed' });
}
