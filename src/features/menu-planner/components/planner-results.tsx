import type { ReactNode } from 'react';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { cardChoice, type ChoiceInputs } from '@/features/menu-planner/choice-prompts';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import { Button } from '@/shared/ui/button';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import type { PlannerSearchState } from '@/features/menu-planner/search-view';

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido';
const ONLY_EXCLUSIONS = 'Todos cumplen lo que pides';
const TIE_LINE = 'Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú.';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600';

const LABEL = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

type PlannerResultsProps = {
  state: PlannerSearchState;
  weeks: WeeksToChooseDto | null;
  choice: ChoiceInputs;
  /** The chips of the suggestions, for the panel of a search with no menu. */
  suggestions: ReactNode;
  /** Puts the last request back in the box. */
  onEdit: (request: string) => void;
  /** Opens or closes the week preview of a menu, and which menu's is open. */
  onViewWeek: (menu: number, trigger: HTMLButtonElement) => void;
  viewing: number | null;
};

/** The answer of the search: the failure, "no menu fits", or the results heading and the cards with their choose buttons. */
export function PlannerResults({ state, weeks, choice, suggestions, onEdit, onViewWeek, viewing }: PlannerResultsProps) {
  if (state.status === 'failed') {
    // A new element on every answer (`attempt`), so a repeated message is announced again.
    return (
      <p key={state.attempt} role="alert" className="text-terracotta-700">
        {state.message}
      </p>
    );
  }
  if (state.status === 'idle') return null;
  if (state.cards.length === 0) return <NoMenuFits request={state.request} suggestions={suggestions} onEdit={onEdit} />;
  return (
    <section aria-labelledby="planner-results-heading" className="flex min-w-0 flex-col gap-4">
      <ResultsHeading count={state.cards.length} onlyExclusions={state.onlyExclusions} />
      <div className="grid grid-cols-1 items-start gap-4 @min-[1100px]:grid-cols-2">
        {state.cards.map((card) => (
          <MenuCandidateCard
            key={card.menu}
            card={card}
            choice={cardChoice(card, weeks, choice)}
            onViewWeek={(trigger) => onViewWeek(card.menu, trigger)}
            viewing={viewing === card.menu}
          />
        ))}
      </div>
    </section>
  );
}

// From `PlannerScreen.jsx` (version 1792443153-9554): the real count, or the tie of a request with only exclusions.
function ResultsHeading({ count, onlyExclusions }: { count: number; onlyExclusions: boolean }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 border-b border-border-ink pb-2">
        <p className={EYEBROW}>{onlyExclusions ? ONLY_EXCLUSIONS : countLine(count)}</p>
        <h2 id="planner-results-heading" className="text-h3 text-text-strong">
          Resultados
        </h2>
      </div>
      {onlyExclusions && <p className="max-w-[70ch] text-sm text-text-muted">{TIE_LINE}</p>}
    </header>
  );
}

function countLine(count: number): string {
  return count === 1 ? 'El que mejor encaja' : `Los ${count} que mejor encajan`;
}

type NoMenuFitsProps = { request: string; suggestions: ReactNode; onEdit: (request: string) => void };

// After `.mf-plan__empty` of `PlannerScreen.jsx` (version 1792443153-9554). "Editar mi búsqueda" needs JavaScript and only
// shows when there is a last request; it never rewrites the user's words.
function NoMenuFits({ request, suggestions, onEdit }: NoMenuFitsProps) {
  return (
    <section
      role="status"
      aria-labelledby="planner-empty-heading"
      className="flex flex-col items-start gap-3.5 rounded-lg bg-surface-sunken px-5 py-[22px]"
    >
      <h2 id="planner-empty-heading" className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] text-text-strong">
        {NO_MENU_FITS}
      </h2>
      <p className="max-w-[60ch] text-[15px] leading-normal text-text-body">Quita alguna condición o dila de otra forma.</p>
      {request && (
        <Button size="sm" variant="secondary" onClick={() => onEdit(request)}>
          <PlannerIcon name="pencil" size={16} />
          Editar mi búsqueda
        </Button>
      )}
      <p className="text-sm text-text-muted">
        Suele funcionar mejor decirlo corto: «cenas sin horno» mejor que «nada de horno por la noche».
      </p>
      <div className="mt-1.5 flex flex-col gap-2.5">
        <p className={LABEL}>O prueba con algo que suele funcionar</p>
        {suggestions}
      </div>
    </section>
  );
}
