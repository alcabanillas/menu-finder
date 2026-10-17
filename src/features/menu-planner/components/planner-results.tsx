import { MenuCandidateCard, type CardChoice } from '@/features/menu-planner/components/menu-candidate-card';
import type { CandidateCard, PlannerSearchState } from '@/features/menu-planner/search-view';

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido.';

type PlannerResultsProps = { state: PlannerSearchState; choiceOf: (card: CandidateCard) => CardChoice | undefined };

/** The answer of the search: the failure, "no menu fits", or the cards with their choose buttons. */
export function PlannerResults({ state, choiceOf }: PlannerResultsProps) {
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
