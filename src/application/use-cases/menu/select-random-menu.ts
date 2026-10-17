import type { ChooseMenuFailure, ChooseRandomMenuFailure } from '@/application/dto/choose-menu-failure';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { selectMenu } from '@/application/services/selection/select-menu';
import { mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { suggestedWeek } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** The user, from the session, and the week the selector shows, not trusted; the menu is not asked for: it is picked here. */
export type SelectRandomMenuInput = { userId: string; week?: unknown };

/** The failures of a choice that can reach the user, and `no-menus`: there is nothing to choose from. */
export type SelectRandomMenuFailure = ChooseRandomMenuFailure;

/** `random` returns a number in [0, 1), like `Math.random`; tests fix it. */
type Deps = { menus: Pick<MenuRepository, 'list'>; selections: SelectionRepository; clock: Clock; random: () => number };

/** Picks one of the stored menus at random on the server and chooses it with `selectMenu`'s rules, for the week given or, without one, the suggested week. */
export async function selectRandomMenu(
  { menus, selections, clock, random }: Deps,
  { userId, week }: SelectRandomMenuInput,
): Promise<Result<Selection, SelectRandomMenuFailure>> {
  const listed = await menus.list();
  if (!listed.ok) return err({ kind: 'failed' });
  if (listed.value.length === 0) return err({ kind: 'no-menus' });

  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  if (!fromThisMonday.ok) return err({ kind: 'failed' });

  const menuNumber = pickAt(listed.value.map(({ number }) => number), random());
  const chosen = await selectMenu(
    { selections, clock },
    { userId, menuNumber, week: week ?? suggestedWeek(fromThisMonday.value, today) },
  );
  return chosen.ok ? ok(chosen.value) : err(toFailure(chosen.error));
}

// The menu is ours, so an invalid or unknown one means it was removed between the read and the write: a fault, not the user's.
function toFailure(failure: ChooseMenuFailure): ChooseRandomMenuFailure {
  return failure.kind === 'invalid-menu' || failure.kind === 'unknown-menu' ? { kind: 'failed' } : failure;
}

function pickAt(numbers: number[], random: number): number {
  return numbers[Math.floor(random * numbers.length)]!;
}
