import type { Week, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { CardChoice } from '@/features/menu-planner/components/menu-candidate-card';
import type { Asking } from '@/features/menu-planner/components/week-selector';
import type { CandidateCard } from '@/features/menu-planner/search-view';
import { formatDayMonth } from '@/shared/format-week';

/** What waits for a yes: the menu of a card, the random button, or nothing. */
export type Ask = number | 'random' | null;

/** The week asked for if it can take a menu, otherwise the suggested one. */
export function startWeek(weeks: WeeksToChooseDto | null, initialWeek: Week | undefined): Week {
  if (weeks && initialWeek && !weeks[initialWeek].locked) return initialWeek;
  return weeks?.suggested ?? 'current';
}

/** The question before a random menu replaces the one the selected week has. */
export function randomAsking(menu: number, startsOn: string, onCancel: () => void): Asking {
  return { text: `¿Cambiar el Menú ${menu} por uno al azar en la semana del ${formatDayMonth(startsOn)}?`, onCancel };
}

/** What the buttons need from the choice: the selected week, the choose form, whether a choice runs and what waits for a yes. */
export type ChoiceInputs = { selected: Week; formId: string; choosing: boolean; ask: Ask; setAsk: (ask: Ask) => void };

// The button of a card names the week it goes to, and the card of the week's menu reads as chosen. A card that replaces
// the week's menu asks first. Without weeks, no button.
/** The choose button of a card for the selected week. */
export function cardChoice(card: CandidateCard, weeks: WeeksToChooseDto | null, choice: ChoiceInputs): CardChoice | undefined {
  if (!weeks) return undefined;
  const { selected, formId, choosing, ask, setAsk } = choice;
  const target = weeks[selected];
  const date = formatDayMonth(target.startsOn);
  if (target.menuNumber === card.menu) {
    return { formId, label: `Menú del ${date}`, variant: 'primary', selected: true, disabled: choosing };
  }
  if (target.menuNumber === null) {
    return { formId, label: `Elegir para el ${date}`, variant: 'primary', selected: false, disabled: choosing };
  }
  return {
    formId,
    label: `Cambiar el menú del ${date}`,
    variant: 'secondary',
    selected: false,
    disabled: choosing,
    replacing: {
      text: `¿Cambiar el Menú ${target.menuNumber} por el Menú ${card.menu} en la semana del ${date}?`,
      open: ask === card.menu,
      onAsk: () => setAsk(card.menu),
      onCancel: () => setAsk(null),
    },
  };
}
