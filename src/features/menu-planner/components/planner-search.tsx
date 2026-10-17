'use client';

import { useActionState, type ReactNode } from 'react';
import type { Week, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { cardChoice } from '@/features/menu-planner/choice-prompts';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
import { ChoiceMessage } from '@/features/menu-planner/components/choice-message';
import { PlannerResults } from '@/features/menu-planner/components/planner-results';
import { RandomButton } from '@/features/menu-planner/components/random-button';
import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import { SearchBox } from '@/features/menu-planner/components/search-box';
import { WeekSelector } from '@/features/menu-planner/components/week-selector';
import { addSentBreadcrumb, useAnswerBreadcrumb } from '@/features/menu-planner/planner-breadcrumbs';
import { IDLE_SEARCH, type PlannerSearchState } from '@/features/menu-planner/search-view';
import { useMenuChoice } from '@/features/menu-planner/use-menu-choice';

type PlannerSearchProps = {
  action: (previous: PlannerSearchState, formData: FormData) => Promise<PlannerSearchState>;
  chooseAction: (previous: ChoiceState, formData: FormData) => Promise<ChoiceState>;
  /** The weeks of the selector, or `null` when the selections could not be read. */
  weeks: WeeksToChooseDto | null;
  /** The week the page was asked to start on (the link of an empty week in Menú); a locked week is ignored. */
  initialWeek?: Week;
};

/**
 * The planner: the week selector, the search box with the random button, the chips of the request and the five best
 * menus, each with a button that chooses it for the selected week (spec menu-planner). The layout is the design system's
 * `PlannerScreen.jsx`: one column on a phone, and from an 800 px container with results the chips on the left and the
 * cards on the right. Both forms post to server actions, so they work without JavaScript, and the text goes in the body
 * of the POST, never in the URL. The choose form is empty: the radios and the buttons join it with the `form` attribute
 * (MF-22.5 design D4).
 */
export function PlannerSearch({ action, chooseAction, weeks, initialWeek }: PlannerSearchProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_SEARCH);
  const choice = useMenuChoice(chooseAction, weeks, initialWeek);
  useAnswerBreadcrumb(state);
  const randomProps = { formId: choice.formId, disabled: choice.choosing, onAsk: choice.askRandom };
  const choiceOf: ResultsAreaProps['choiceOf'] = (card) =>
    cardChoice({
      card,
      weeks,
      selected: choice.selected,
      formId: choice.formId,
      choosing: choice.choosing,
      ask: choice.ask,
      setAsk: choice.setAsk,
    });
  return (
    <section aria-label="Buscar menú" className="@container flex w-full flex-col gap-5 @min-[800px]:gap-6">
      <form id={choice.formId} action={choice.formAction} onSubmit={choice.submitted} />
      <WeekSelector
        weeks={weeks}
        selected={choice.selected}
        onSelect={choice.select}
        formId={choice.formId}
        choice={choice.shownChoice}
        asking={choice.asking}
      />
      <ChoiceMessage choice={choice.shownChoice} choosing={choice.choosing} />
      <SearchRow formAction={formAction} pending={pending} onSent={choice.dismiss} desktopRandom={<RandomButton size="md" {...randomProps} />} />
      <div className="-mt-2 @min-[800px]:hidden"><RandomButton size="sm" {...randomProps} /></div>
      <ResultsArea state={state} pending={pending} choiceOf={choiceOf} />
    </section>
  );
}

type SearchRowProps = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  onSent: () => void;
  desktopRandom: ReactNode;
};

// On a phone only the box stays at the top when the page scrolls; the random button goes under it (`PlannerScreen.jsx`).
function SearchRow({ formAction, pending, onSent, desktopRandom }: SearchRowProps) {
  return (
    <div className="sticky top-0 z-[4] -mx-5 -mt-3 bg-surface-page px-5 py-3 @min-[800px]:static @min-[800px]:m-0 @min-[800px]:max-w-[760px] @min-[800px]:p-0">
      <form
        action={formAction}
        onSubmit={() => {
          onSent();
          addSentBreadcrumb();
        }}
        className="flex items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <SearchBox pending={pending} />
        </div>
        <div className="hidden flex-none @min-[800px]:block">{desktopRandom}</div>
      </form>
    </div>
  );
}

type ResultsAreaProps = {
  state: PlannerSearchState;
  pending: boolean;
  choiceOf: Parameters<typeof PlannerResults>[0]['choiceOf'];
};

// While a search runs, `state` is still the previous answer: a new search replaces it, so it is not shown.
function ResultsArea({ state, pending, choiceOf }: ResultsAreaProps) {
  const chips = !pending && state.status === 'ranking' ? state.chips : null;
  const hasResults = chips !== null;
  const columns = hasResults ? '@min-[800px]:grid-cols-[300px_minmax(0,1fr)]' : '@min-[800px]:grid-cols-[minmax(0,640px)]';
  return (
    <div className={`flex flex-col gap-4 @min-[800px]:grid @min-[800px]:items-start @min-[800px]:gap-12 ${columns}`}>
      {(pending || hasResults) && (
        <div className="flex min-w-0 flex-col gap-4">
          {pending && (
            <p role="status" className="text-text-muted">
              Buscando…
            </p>
          )}
          {chips && <RestrictionChipList chips={chips} />}
        </div>
      )}
      {!pending && <PlannerResults state={state} choiceOf={choiceOf} />}
    </div>
  );
}
