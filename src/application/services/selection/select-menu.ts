import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository, SelectionWriteError } from '@/application/ports/selection-repository';
import { positiveIntegerInput } from '@/application/dto/positive-integer-input';
import type { ChooseMenuFailure } from '@/application/dto/choose-menu-failure';
import { weekInput } from '@/application/dto/week-input';
import { mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { isLocked, mondayOfWeek } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** What a form or a direct call sends: the menu number is not trusted, the user id comes from the session. */
export type SelectMenuInput = { userId: string; menuNumber?: unknown; week?: unknown };

export type SelectMenuFailure = ChooseMenuFailure;

type Deps = { selections: SelectionRepository; clock: Clock };

/**
 * Stores the user's choice of a menu for this week or next. The start date is computed here from today, never read
 * from the request, and replaces a choice already made for that Monday. This week is refused once next week has a menu.
 */
export async function selectMenu(
  { selections, clock }: Deps,
  { userId, menuNumber, week }: SelectMenuInput,
): Promise<Result<Selection, SelectMenuFailure>> {
  const parsed = positiveIntegerInput.safeParse(menuNumber);
  if (!parsed.success) return err({ kind: 'invalid-menu' });

  const parsedWeek = weekInput.safeParse(week);
  if (!parsedWeek.success) return err({ kind: 'invalid-week' });

  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  if (!fromThisMonday.ok) return err({ kind: 'failed' });

  if (isLocked(parsedWeek.data, fromThisMonday.value, today)) return err({ kind: 'week-locked' });

  const stored = await selections.replace(userId, {
    menuNumber: parsed.data,
    startsOn: mondayOfWeek(today, parsedWeek.data),
  });
  return stored.ok ? ok(stored.value) : err(toFailure(stored.error));
}

function toFailure(error: SelectionWriteError): SelectMenuFailure {
  return error.kind === 'unknown-menu' ? { kind: 'unknown-menu' } : { kind: 'failed' };
}
