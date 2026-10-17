import type { ChooseRandomMenuFailure } from '@/application/dto/choose-menu-failure';
import type { Week } from '@/application/dto/weeks-to-choose';
import { formatDayMonth } from '@/shared/format-week';
import type { Result } from '@/shared/result';

/**
 * What the planner shows for a choice, built on the server (MF-22.5 design D5). `attempt` counts the answers: it tells
 * a new answer from the previous one even when the message is the same.
 */
export type ChoiceState =
  | { status: 'idle'; attempt: number }
  | { status: 'chosen'; menu: number; week: Week; message: string; weekHref: string; attempt: number }
  | { status: 'failed'; kind: ChooseRandomMenuFailure['kind']; message: string; attempt: number };

export const IDLE_CHOICE: ChoiceState = { status: 'idle', attempt: 0 };

const MENU_FAILURE = 'Ese menú no existe.';

const MESSAGES: Record<ChooseRandomMenuFailure['kind'], string> = {
  'invalid-menu': MENU_FAILURE,
  'unknown-menu': MENU_FAILURE,
  'invalid-week': 'Esa semana no se puede elegir.',
  'week-locked': 'Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene.',
  failed: 'No se ha podido elegir el menú. Inténtalo de nuevo.',
  'no-menus': 'No hay menús para elegir.',
};

/** The answer of `chooseMenu` or of the random button as the planner shows it; `week` is the one the user chose, valid when the choice is stored. */
export function toChoiceState(result: Result<{ menuNumber: number; startsOn: string }, ChooseRandomMenuFailure>, week: Week, attempt: number): ChoiceState {
  if (!result.ok) return { status: 'failed', kind: result.error.kind, message: MESSAGES[result.error.kind], attempt };

  const { menuNumber, startsOn } = result.value;
  return {
    status: 'chosen',
    menu: menuNumber,
    week,
    message: `Menú ${menuNumber} para la semana del ${formatDayMonth(startsOn)}.`,
    weekHref: `/menu?startsOn=${startsOn}`,
    attempt,
  };
}
