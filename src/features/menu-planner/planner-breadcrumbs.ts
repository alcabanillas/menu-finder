import * as Sentry from '@sentry/nextjs';
import { useEffect, type RefObject } from 'react';
import type { Week } from '@/application/dto/weeks-to-choose';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
import type { PlannerSearchState } from '@/features/menu-planner/search-view';

// Breadcrumbs carry counts and outcomes only: never the request, a term, a dish or a menu number (spec error-reporting).

/** The search form was sent. An empty box never gets here: the browser does not send a required field empty. */
export function addSentBreadcrumb(): void {
  Sentry.addBreadcrumb({ category: 'planner', message: 'search sent' });
}

/** The choose form was sent, for this week. */
export function addChosenBreadcrumb(week: Week): void {
  Sentry.addBreadcrumb({ category: 'planner', message: 'menu chosen', data: { week } });
}

/** One breadcrumb for each answer of the search: its outcome and the counts of chips and menus. */
export function useAnswerBreadcrumb(state: PlannerSearchState): void {
  const { attempt, status } = state;
  const outcome = status === 'failed' ? state.kind : status;
  const chips = status === 'ranking' ? state.chips.length : 0;
  const menus = status === 'ranking' ? state.cards.length : 0;
  useEffect(() => {
    if (status === 'idle') return;
    Sentry.addBreadcrumb({ category: 'planner', message: 'search answered', data: { outcome, chips, menus } });
  }, [attempt, status, outcome, chips, menus]);
}

/** One breadcrumb for each answer of a choice: its outcome and the week it was made for. */
export function useChoiceBreadcrumb(choice: ChoiceState, week: RefObject<Week>): void {
  const { attempt, status } = choice;
  const outcome = choice.status === 'failed' ? choice.kind : status;
  useEffect(() => {
    if (status === 'idle') return;
    Sentry.addBreadcrumb({ category: 'planner', message: 'choice answered', data: { outcome, week: week.current } });
  }, [attempt, status, outcome, week]);
}
