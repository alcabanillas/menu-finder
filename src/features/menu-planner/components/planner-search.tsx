'use client';

import * as Sentry from '@sentry/nextjs';
import { useActionState, useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { Week, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { IDLE_CHOICE, type ChoiceState } from '@/features/menu-planner/choice-view';
import { MenuCandidateCard, type CardChoice } from '@/features/menu-planner/components/menu-candidate-card';
import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { SearchBox } from '@/features/menu-planner/components/search-box';
import { WeekSelector, type Asking } from '@/features/menu-planner/components/week-selector';
import { IDLE_SEARCH, type CandidateCard, type PlannerSearchState } from '@/features/menu-planner/search-view';
import { formatDayMonth } from '@/shared/format-week';
import { Button } from '@/shared/ui/button';

type PlannerSearchProps = {
  action: (previous: PlannerSearchState, formData: FormData) => Promise<PlannerSearchState>;
  chooseAction: (previous: ChoiceState, formData: FormData) => Promise<ChoiceState>;
  /** The weeks of the selector, or `null` when the selections could not be read. */
  weeks: WeeksToChooseDto | null;
  /** The week the page was asked to start on (the link of an empty week in Menú); a locked week is ignored. */
  initialWeek?: Week;
};

// What waits for a yes: the menu of a card, the random button, or nothing.
type Ask = number | 'random' | null;

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido.';

/**
 * The planner: the week selector, the search box, the chips of the request and the five best menus, each with a button
 * that chooses it for the selected week (spec menu-planner). The layout is the design system's `PlannerScreen.jsx`: one
 * column on a phone, and from an 800 px container with results the box and the chips on the left and the cards on the
 * right. Both forms post to server actions, so they work without JavaScript, and the text goes in the body of the POST,
 * never in the URL. The choose form is empty: the radios and the card buttons join it with the `form` attribute
 * (MF-22.5 design D4).
 */
export function PlannerSearch({ action, chooseAction, weeks, initialWeek }: PlannerSearchProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_SEARCH);
  const [choice, chooseFormAction, choosing] = useActionState(chooseAction, IDLE_CHOICE);
  const [picked, setPicked] = useState<Week>(startWeek(weeks, initialWeek));
  // A week that becomes locked (the random button chose next week) cannot stay selected: next week takes its place.
  const selected: Week = weeks?.[picked].locked ? 'next' : picked;
  const [ask, setAsk] = useState<Ask>(null);
  const [dismissedAt, setDismissedAt] = useState(0);
  const chooseFormId = useId();
  const choiceWeek = useRef<Week>(selected);
  useAnswerBreadcrumb(state);
  useChoiceBreadcrumb(choice, choiceWeek);
  // While a search runs, `state` is still the previous answer: a new search replaces it, so it is not shown.
  const shown = !pending;
  const hasResults = shown && state.status === 'ranking';
  // The message of a choice goes away when something replaces it: a new search, another week or a choice that runs.
  const shownChoice = choosing || choice.attempt <= dismissedAt ? IDLE_CHOICE : choice;
  const dismissChoice = () => setDismissedAt(choice.attempt);
  const target = weeks?.[selected];
  const asking = ask === 'random' && target?.menuNumber != null ? randomAsking(target.menuNumber, target.startsOn, () => setAsk(null)) : null;
  const randomButton = (size: 'sm' | 'md') => (
    <RandomButton
      size={size}
      formId={chooseFormId}
      disabled={choosing}
      onAsk={target?.menuNumber != null ? () => setAsk('random') : undefined}
    />
  );
  return (
    <section aria-label="Buscar menú" className="@container flex w-full flex-col gap-5 @min-[800px]:gap-6">
      <form
        id={chooseFormId}
        action={chooseFormAction}
        onSubmit={() => {
          choiceWeek.current = selected;
          setAsk(null);
          Sentry.addBreadcrumb({ category: 'planner', message: 'menu chosen', data: { week: selected } });
        }}
      />
      <WeekSelector
        weeks={weeks}
        selected={selected}
        onSelect={(week) => {
          dismissChoice();
          setAsk(null);
          setPicked(week);
        }}
        formId={chooseFormId}
        choice={shownChoice}
        asking={asking}
      />
      <ChoiceMessage choice={shownChoice} choosing={choosing} />
      {/* On a phone only the box stays at the top when the page scrolls; the random button goes under it. */}
      <div className="sticky top-0 z-[4] -mx-5 -mt-3 bg-surface-page px-5 py-3 @min-[800px]:static @min-[800px]:m-0 @min-[800px]:max-w-[760px] @min-[800px]:p-0">
        <form
          action={formAction}
          onSubmit={() => {
            dismissChoice();
            addSentBreadcrumb();
          }}
          className="flex items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <SearchBox pending={pending} />
          </div>
          <div className="hidden flex-none @min-[800px]:block">{randomButton('md')}</div>
        </form>
      </div>
      <div className="-mt-2 @min-[800px]:hidden">{randomButton('sm')}</div>
      <div
        className={`flex flex-col gap-4 @min-[800px]:grid @min-[800px]:items-start @min-[800px]:gap-12 ${
          hasResults ? '@min-[800px]:grid-cols-[300px_minmax(0,1fr)]' : '@min-[800px]:grid-cols-[minmax(0,640px)]'
        }`}
      >
        {(pending || hasResults) && (
          <div className="flex min-w-0 flex-col gap-4">
            {pending && (
              <p role="status" className="text-text-muted">
                Buscando…
              </p>
            )}
            {shown && state.status === 'ranking' && <RestrictionChipList chips={state.chips} />}
          </div>
        )}
        {shown && (
          <Results
            state={state}
            choiceOf={(card) => cardChoice({ card, weeks, selected, formId: chooseFormId, choosing, ask, setAsk })}
          />
        )}
      </div>
    </section>
  );
}

// The week asked for if it can take a menu, otherwise the suggested one.
function startWeek(weeks: WeeksToChooseDto | null, initialWeek: Week | undefined): Week {
  if (weeks && initialWeek && !weeks[initialWeek].locked) return initialWeek;
  return weeks?.suggested ?? 'current';
}

function randomAsking(menu: number, startsOn: string, onCancel: () => void): Asking {
  return { text: `¿Cambiar el Menú ${menu} por uno al azar en la semana del ${formatDayMonth(startsOn)}?`, onCancel };
}

const DICE_SIZE = { sm: 17, md: 18 };

type RandomButtonProps = { size: 'sm' | 'md'; formId: string; disabled: boolean; onAsk?: () => void };

// A secondary button that submits the choose form with `random`: the server picks the menu for the selected week. When the
// week has a menu, with JavaScript the question comes first; without it the button posts.
function RandomButton({ size, formId, disabled, onAsk }: RandomButtonProps) {
  return (
    <Button
      type="submit"
      variant="secondary"
      size={size}
      name="random"
      value="1"
      form={formId}
      disabled={disabled}
      onClick={onAsk ? (event) => { event.preventDefault(); onAsk(); } : undefined}
    >
      <PlannerIcon name="dices" size={DICE_SIZE[size]} />
      Elegir uno al azar
    </Button>
  );
}

function ChoiceMessage({ choice, choosing }: { choice: ChoiceState; choosing: boolean }) {
  if (choosing) {
    return (
      <p role="status" className="m-0 text-text-muted">
        Eligiendo…
      </p>
    );
  }
  if (choice.status !== 'failed') return null;
  // A new element on every answer (`attempt`), so a repeated message is announced again.
  return (
    <p key={choice.attempt} role="alert" className="m-0 text-terracotta-700">
      {choice.message}
    </p>
  );
}

type CardChoiceInput = {
  card: CandidateCard;
  weeks: WeeksToChooseDto | null;
  selected: Week;
  formId: string;
  choosing: boolean;
  ask: Ask;
  setAsk: (ask: Ask) => void;
};

// The button of a card names the week it goes to, and the card of the week's menu reads as chosen. A card that replaces
// the week's menu asks first. Without weeks, no button.
function cardChoice({ card, weeks, selected, formId, choosing, ask, setAsk }: CardChoiceInput): CardChoice | undefined {
  if (!weeks) return undefined;
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

type ResultsProps = { state: PlannerSearchState; choiceOf: (card: CandidateCard) => CardChoice | undefined };

function Results({ state, choiceOf }: ResultsProps) {
  if (state.status === 'failed') {
    // A new element on every answer (`attempt`), so a repeated message is announced again.
    return (
      <p key={state.attempt} role="alert" className="text-terracotta-700">
        {state.message}
      </p>
    );
  }
  if (state.status === 'idle') return null;
  if (state.cards.length === 0) return <p className="text-text-body">{NO_MENU_FITS}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {state.cards.map((card) => (
        <MenuCandidateCard key={card.menu} card={card} choice={choiceOf(card)} />
      ))}
    </div>
  );
}

// Breadcrumbs carry counts and outcomes only: never the request, a term or a dish (spec error-reporting). An empty box
// never gets here: the browser does not send a required field empty, so it fires no `submit` event.
function addSentBreadcrumb(): void {
  Sentry.addBreadcrumb({ category: 'planner', message: 'search sent' });
}

function useAnswerBreadcrumb(state: PlannerSearchState): void {
  const { attempt, status } = state;
  const outcome = status === 'failed' ? state.kind : status;
  const chips = status === 'ranking' ? state.chips.length : 0;
  const menus = status === 'ranking' ? state.cards.length : 0;
  useEffect(() => {
    if (status === 'idle') return;
    Sentry.addBreadcrumb({ category: 'planner', message: 'search answered', data: { outcome, chips, menus } });
  }, [attempt, status, outcome, chips, menus]);
}

// The outcome and the week only: never the menu number, the request or a dish (spec error-reporting).
function useChoiceBreadcrumb(choice: ChoiceState, week: RefObject<Week>): void {
  const { attempt, status } = choice;
  const outcome = choice.status === 'failed' ? choice.kind : status;
  useEffect(() => {
    if (status === 'idle') return;
    Sentry.addBreadcrumb({ category: 'planner', message: 'choice answered', data: { outcome, week: week.current } });
  }, [attempt, status, outcome, week]);
}
