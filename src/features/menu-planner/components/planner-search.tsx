'use client';

import { useActionState, useRef, type ReactNode, type RefObject } from 'react';
import type { Week, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { ChoiceInputs } from '@/features/menu-planner/choice-prompts';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
import { ChooseControls } from '@/features/menu-planner/components/menu-candidate-card';
import { ChoiceMessage } from '@/features/menu-planner/components/choice-message';
import { PlannerResults } from '@/features/menu-planner/components/planner-results';
import { RequestStrip } from '@/features/menu-planner/components/request-strip';
import { putBackRequest, SearchBox } from '@/features/menu-planner/components/search-box';
import { SuggestionChips } from '@/features/menu-planner/components/suggestion-chips';
import { WeekPreviewPanel } from '@/features/menu-planner/components/week-preview-panel';
import { WeekSelector } from '@/features/menu-planner/components/week-selector';
import { cardChoice } from '@/features/menu-planner/choice-prompts';
import { addSentBreadcrumb, useAnswerBreadcrumb } from '@/features/menu-planner/planner-breadcrumbs';
import type { PreviewState } from '@/features/menu-planner/preview-view';
import { evidenceMarks, IDLE_SEARCH, type CandidateCard, type PlannerSearchState } from '@/features/menu-planner/search-view';
import { useMenuChoice } from '@/features/menu-planner/use-menu-choice';
import { useWeekPreview } from '@/features/menu-planner/use-week-preview';

type PlannerSearchProps = {
  action: (previous: PlannerSearchState, formData: FormData) => Promise<PlannerSearchState>;
  chooseAction: (previous: ChoiceState, formData: FormData) => Promise<ChoiceState>;
  /** The weeks of the selector, or `null` when the selections could not be read. */
  weeks: WeeksToChooseDto | null;
  /** The week the page was asked to start on (the link of an empty week in Menú); a locked week is ignored. */
  initialWeek?: Week;
  /** Reads the week of a menu for the preview of a card; the session is checked behind it. */
  previewAction: (menu: number) => Promise<PreviewState>;
  /** The requests offered under "Prueba con", chosen by the page. */
  suggestions: string[];
};

/**
 * The planner: the week selector, the search box, the suggestions with "Al azar", the strip of the request and the five best
 * menus, each with a button that chooses it for the selected week (spec menu-planner). The layout is the design system's
 * `PlannerScreen.jsx`: the strip across the page and the cards in one column, or two from a 1100 px container. Both forms post to server actions, so they work without JavaScript, and the text goes in the body
 * of the POST, never in the URL. The choose form is empty: the radios and the buttons join it with the `form` attribute
 * (MF-22.5 design D4).
 */
export function PlannerSearch({ action, chooseAction, previewAction, weeks, initialWeek, suggestions }: PlannerSearchProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_SEARCH);
  const choice = useMenuChoice(chooseAction, weeks, initialWeek);
  useAnswerBreadcrumb(state);
  const randomProps = { formId: choice.formId, disabled: choice.choosing, onAsk: choice.askRandom };
  const preview = useWeekPreview(previewAction);
  const sent = () => {
    choice.dismiss();
    preview.reset();
    addSentBreadcrumb();
  };
  const input = useRef<HTMLInputElement>(null);
  const chips = <SuggestionChips suggestions={suggestions} formAction={formAction} onSent={sent} random={randomProps} />;
  return (
    <section aria-label="Buscar menú" className="@container flex w-full flex-col gap-5 @min-[800px]:gap-6">
      {/* Hidden: an empty flex item would still add a gap. The controls join it with the `form` attribute. */}
      <form id={choice.formId} action={choice.formAction} onSubmit={choice.submitted} className="hidden" />
      <WeekSelector
        weeks={weeks}
        selected={choice.selected}
        onSelect={choice.select}
        formId={choice.formId}
        choice={choice.shownChoice}
        asking={choice.asking}
      />
      <ChoiceMessage choice={choice.shownChoice} choosing={choice.choosing} />
      <SearchRow formAction={formAction} pending={pending} searched={pending || state.status !== 'idle'} onSent={sent} inputRef={input} />
      {!pending && state.status === 'idle' && <Suggestions>{chips}</Suggestions>}
      <ResultsArea
        state={state}
        pending={pending}
        weeks={weeks}
        choice={choice}
        suggestions={chips}
        onEdit={(request) => putBackRequest(input.current, request)}
        onViewWeek={preview.toggle}
        viewing={preview.open}
      />
      {!pending && state.status === 'ranking' && (
        <OpenPreview cards={state.cards} preview={preview} weeks={weeks} choice={choice} />
      )}
    </section>
  );
}

type SearchRowProps = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  searched: boolean;
  onSent: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

// On a phone only the box stays at the top when the page scrolls, under the header of the shell, which is sticky too
// (56 px, 64 px from 800 px) (`PlannerScreen.jsx`).
function SearchRow({ formAction, pending, searched, onSent, inputRef }: SearchRowProps) {
  return (
    <div className="sticky top-14 z-[4] -mx-5 -mt-3 bg-surface-page px-5 py-3 min-[800px]:top-16 @min-[640px]:-mx-8 @min-[640px]:px-8 @min-[800px]:static @min-[800px]:m-0 @min-[800px]:max-w-[760px] @min-[800px]:p-0">
      <form action={formAction} onSubmit={onSent} className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchBox pending={pending} searched={searched} inputRef={inputRef} />
        </div>
      </form>
    </div>
  );
}

// Only before the first search: after one with no menu or with an error, the suggestions are inside its panel (MF-79).
function Suggestions({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-eyebrow font-semibold tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted uppercase">
        Prueba con
      </p>
      {children}
    </div>
  );
}

type OpenPreviewProps = {
  cards: CandidateCard[];
  preview: ReturnType<typeof useWeekPreview>;
  weeks: WeeksToChooseDto | null;
  choice: ChoiceInputs;
};

// The week preview of the card that has it open: the card's own choose button is its footer (MF-73 design D4).
function OpenPreview({ cards, preview, weeks, choice }: OpenPreviewProps) {
  const card = cards.find(({ menu }) => menu === preview.open);
  if (!card) return null;
  const choose = cardChoice(card, weeks, choice);
  return (
    <WeekPreviewPanel
      menu={card.menu}
      rank={card.rank}
      state={preview.stateOf(card.menu)}
      marks={evidenceMarks(card.lines)}
      footer={choose && <ChooseControls menu={card.menu} choice={choose} fullWidth />}
      onClose={preview.close}
    />
  );
}

type ResultsAreaProps = {
  state: PlannerSearchState;
  pending: boolean;
  weeks: WeeksToChooseDto | null;
  choice: ChoiceInputs;
  suggestions: ReactNode;
  onEdit: (request: string) => void;
  onViewWeek: (menu: number, trigger: HTMLButtonElement) => void;
  viewing: number | null;
};

// While a search runs, `state` is still the previous answer: a new search replaces it, so it is not shown. The strip of
// the request goes across the page above the results (MF-73 design D7).
function ResultsArea({ state, pending, weeks, choice, suggestions, onEdit, onViewWeek, viewing }: ResultsAreaProps) {
  const chips = !pending && state.status === 'ranking' ? state.chips : null;
  return (
    <div className="flex flex-col gap-4 @min-[800px]:gap-6">
      {pending && (
        <p role="status" className="text-text-muted">
          Buscando…
        </p>
      )}
      {chips && <RequestStrip chips={chips} />}
      {!pending && (
        <PlannerResults
          state={state}
          weeks={weeks}
          choice={choice}
          suggestions={suggestions}
          onEdit={onEdit}
          onViewWeek={onViewWeek}
          viewing={viewing}
        />
      )}
    </div>
  );
}
