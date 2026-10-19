import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { cardChoice, type ChoiceInputs } from '@/features/menu-planner/choice-prompts';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import type { PlannerSearchState } from '@/features/menu-planner/search-view';

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido';
const ONLY_EXCLUSIONS = 'Todos cumplen lo que pides';
const TIE_LINE = 'Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600';

type PlannerResultsProps = { state: PlannerSearchState; weeks: WeeksToChooseDto | null; choice: ChoiceInputs };

/** The answer of the search: the failure, "no menu fits", or the results heading and the cards with their choose buttons. */
export function PlannerResults({ state, weeks, choice }: PlannerResultsProps) {
  if (state.status === 'failed') {
    // A new element on every answer (`attempt`), so a repeated message is announced again.
    return (
      <p key={state.attempt} role="alert" className="text-terracotta-700">
        {state.message}
      </p>
    );
  }
  if (state.status === 'idle') return null;
  if (state.cards.length === 0) return <h2 className="text-h3 text-text-strong">{NO_MENU_FITS}</h2>;
  return (
    <section aria-labelledby="planner-results-heading" className="flex min-w-0 flex-col gap-4">
      <ResultsHeading count={state.cards.length} onlyExclusions={state.onlyExclusions} />
      {state.cards.map((card) => (
        <MenuCandidateCard key={card.menu} card={card} choice={cardChoice(card, weeks, choice)} />
      ))}
    </section>
  );
}

// From `PlannerScreen.jsx` (version 1792433417-7fa2): the real count, or the tie of a request with only exclusions.
function ResultsHeading({ count, onlyExclusions }: { count: number; onlyExclusions: boolean }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 border-b border-border-ink pb-2">
        <p className={EYEBROW}>{onlyExclusions ? ONLY_EXCLUSIONS : countLine(count)}</p>
        <h2 id="planner-results-heading" className="text-h3 text-text-strong">
          Resultados
        </h2>
      </div>
      {onlyExclusions && <p className="text-text-body">{TIE_LINE}</p>}
    </header>
  );
}

function countLine(count: number): string {
  return count === 1 ? 'El que mejor encaja' : `Los ${count} que mejor encajan`;
}
