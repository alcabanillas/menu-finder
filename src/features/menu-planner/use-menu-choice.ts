'use client';

import { useActionState, useId, useRef, useState } from 'react';
import type { Week, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { randomAsking, startWeek, type Ask } from '@/features/menu-planner/choice-prompts';
import { IDLE_CHOICE, type ChoiceState } from '@/features/menu-planner/choice-view';
import type { Asking } from '@/features/menu-planner/components/week-selector';
import { addChosenBreadcrumb, useChoiceBreadcrumb } from '@/features/menu-planner/planner-breadcrumbs';

type ChooseAction = (previous: ChoiceState, formData: FormData) => Promise<ChoiceState>;

/**
 * The state of choosing a menu for a week (MF-22.5 design D4, D5, D11): the selected week, the choose form, its answer and
 * what waits for a yes. The message of a choice goes away when something replaces it: a new search, another week or a
 * choice that runs. A new search and another week also cancel the question that waits for a yes.
 */
export function useMenuChoice(chooseAction: ChooseAction, weeks: WeeksToChooseDto | null, initialWeek: Week | undefined) {
  const [choice, formAction, choosing] = useActionState(chooseAction, IDLE_CHOICE);
  const [picked, setPicked] = useState<Week>(startWeek(weeks, initialWeek));
  // A week that becomes locked (the random button chose next week) cannot stay selected: next week takes its place.
  const selected: Week = weeks?.[picked].locked ? 'next' : picked;
  const [ask, setAsk] = useState<Ask>(null);
  const [dismissedAt, setDismissedAt] = useState(0);
  const formId = useId();
  const choiceWeek = useRef<Week>(selected);
  useChoiceBreadcrumb(choice, choiceWeek);

  const target = weeks?.[selected];
  // Only one question can be open: a new search or another week closes the message and the question that waits (v68).
  const dismiss = () => {
    setDismissedAt(choice.attempt);
    setAsk(null);
  };
  const asking: Asking | null =
    ask === 'random' && target?.menuNumber != null ? randomAsking(target.menuNumber, target.startsOn, () => setAsk(null)) : null;
  return {
    formId,
    formAction,
    choosing,
    selected,
    ask,
    setAsk,
    asking,
    shownChoice: choosing || choice.attempt <= dismissedAt ? IDLE_CHOICE : choice,
    dismiss,
    /** With a menu in the week, the random button asks first; without one it posts at once. */
    askRandom: target?.menuNumber != null ? () => setAsk('random') : undefined,
    select: (week: Week) => {
      dismiss();
      setPicked(week);
    },
    submitted: () => {
      choiceWeek.current = selected;
      setAsk(null);
      addChosenBreadcrumb(selected);
    },
  };
}
