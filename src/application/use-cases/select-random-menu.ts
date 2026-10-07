import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { selectMenu } from '@/application/use-cases/select-menu';
import type { Selection } from '@/domain/selection/selection';
import { err, ok, type Result } from '@/shared/result';

/** Only the user, from the session: the request chooses nothing. */
export type SelectRandomMenuInput = { userId: string };

/** `no-menus`: there is nothing to choose from; `failed`: a fault of the system. */
export type SelectRandomMenuFailure = { kind: 'no-menus' } | { kind: 'failed' };

/** `random` returns a number in [0, 1), like `Math.random`; tests fix it. */
type Deps = { menus: MenuRepository; selections: SelectionRepository; clock: Clock; random: () => number };

/** Picks one of the stored menus at random on the server and chooses it for the user with `selectMenu`'s rules. */
export async function selectRandomMenu(
  { menus, selections, clock, random }: Deps,
  { userId }: SelectRandomMenuInput,
): Promise<Result<Selection, SelectRandomMenuFailure>> {
  const listed = await menus.list();
  if (!listed.ok) return err({ kind: 'failed' });
  if (listed.value.length === 0) return err({ kind: 'no-menus' });

  const menuNumber = pickAt(listed.value.map(({ number }) => number), random());
  const chosen = await selectMenu({ selections, clock }, { userId, menuNumber });
  // `unknown-menu` here means the menu was removed between the read and the write: a fault, not the user's.
  return chosen.ok ? ok(chosen.value) : err({ kind: 'failed' });
}

function pickAt(numbers: number[], random: number): number {
  return numbers[Math.floor(random * numbers.length)]!;
}
