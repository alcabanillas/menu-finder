import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { ChooseMenuFailure } from '@/application/dto/choose-menu-failure';
import { selectMenu, type SelectMenuInput } from '@/application/services/selection/select-menu';
import type { Selection } from '@/domain/selection/selection';
import type { Result } from '@/shared/result';

/** What the choose form sends: the menu number and the week are not trusted, the user id comes from the session. */
export type ChooseMenuInput = SelectMenuInput;

type Deps = { selections: SelectionRepository; clock: Clock };

/** The user chooses a menu for this week or next. The rules live in `selectMenu`, which the random button also calls. */
export async function chooseMenu(
  { selections, clock }: Deps,
  input: ChooseMenuInput,
): Promise<Result<Selection, ChooseMenuFailure>> {
  return selectMenu({ selections, clock }, input);
}
