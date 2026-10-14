'use client';

import * as Sentry from '@sentry/nextjs';
import { useActionState, useEffect, useState, type FormEvent } from 'react';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import { SearchBox } from '@/features/menu-planner/components/search-box';
import { EMPTY_REQUEST_MESSAGE, IDLE_SEARCH, type PlannerSearchState } from '@/features/menu-planner/search-view';

type PlannerSearchProps = {
  action: (previous: PlannerSearchState, formData: FormData) => Promise<PlannerSearchState>;
};

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido.';

/**
 * The planner's search: the box, the chips of the request and the five best menus (spec menu-planner). The layout is
 * the design system's `PlannerScreen.jsx`: one column on a phone, and from an 800 px container with results the box
 * and the chips on the left and the cards on the right. The form posts to the server action, so it works without
 * JavaScript, and the text goes in the body of the POST, never in the URL.
 */
export function PlannerSearch({ action }: PlannerSearchProps) {
  const [state, formAction, pending] = useActionState(action, IDLE_SEARCH);
  useAnswerBreadcrumb(state);
  const [blankSends, setBlankSends] = useState(0);
  const blank = blankSends > 0;
  // While a search runs, `state` is still the previous answer: a new search replaces it, so it is not shown. The same
  // goes for a blank request, which is answered in the browser.
  const shown = !pending && !blank;
  const hasResults = shown && state.status === 'ranking';
  return (
    <section
      aria-label="Buscar menú"
      className="@container w-full"
    >
      <div
        className={`flex flex-col gap-4 @min-[800px]:grid @min-[800px]:items-start @min-[800px]:gap-12 ${
          hasResults ? '@min-[800px]:grid-cols-[300px_minmax(0,1fr)]' : '@min-[800px]:grid-cols-[minmax(0,640px)]'
        }`}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <form action={formAction} onSubmit={(event) => onSend(event, () => setBlankSends((sends) => sends + 1), () => setBlankSends(0))} className="flex flex-col gap-4">
            <SearchBox pending={pending} />
          </form>
          {pending && (
            <p role="status" className="text-text-muted">
              Buscando…
            </p>
          )}
          {shown && state.status === 'ranking' && <RestrictionChipList chips={state.chips} />}
        </div>
        {blank && (
          // A new element on every blank send, so that it is announced each time.
          <p key={blankSends} role="alert" className="text-terracotta-700">
            {EMPTY_REQUEST_MESSAGE}
          </p>
        )}
        {shown && <Results state={state} />}
      </div>
    </section>
  );
}

function Results({ state }: { state: PlannerSearchState }) {
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
        <MenuCandidateCard key={card.menu} card={card} />
      ))}
    </div>
  );
}

// A blank request is answered here, with no trip to the server and no breadcrumb. Without JavaScript this code does
// not run and the server answers the same (spec menu-planner, "Empty request"). The text is read from the form, so the
// action still receives the form untouched.
function onSend(event: FormEvent<HTMLFormElement>, onBlank: () => void, onRequest: () => void): void {
  const request = new FormData(event.currentTarget).get('request');
  if (typeof request === 'string' && request.trim() === '') {
    event.preventDefault();
    onBlank();
    return;
  }
  onRequest();
  addSentBreadcrumb();
}

// Breadcrumbs carry counts and outcomes only: never the request, a term or a dish (spec error-reporting).
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
