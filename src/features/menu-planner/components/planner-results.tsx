import type { ReactNode } from 'react';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { cardChoice, type ChoiceInputs } from '@/features/menu-planner/choice-prompts';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import { Button } from '@/shared/ui/button';
import { PlannerIcon, type PlannerIconName } from '@/features/menu-planner/components/planner-icon';
import type { ErrorGroup, PlannerSearchState } from '@/features/menu-planner/search-view';

const NO_MENU_FITS = 'Ningún menú encaja con lo que has pedido';
const TIP = 'Suele funcionar mejor decirlo corto: «cenas sin horno» mejor que «nada de horno por la noche».';
// The padding grows from an 800 px container, for both panels (MF-79 design D5).
const PANEL = 'flex flex-col items-start gap-3.5 rounded-lg bg-surface-sunken px-5 py-[22px] @min-[800px]:px-8 @min-[800px]:py-7';
const ICON = 'flex size-9 flex-none items-center justify-center rounded-full border';
// The daily limit is no one's fault: its icon is grey (`.mf-plan__ei--wait`).
const ICON_TONES = {
  alarm: 'border-terracotta-300 bg-terracotta-50 text-terracotta-600',
  wait: 'border-border-hairline bg-surface-card text-text-muted',
};

type ErrorPanel = { title: string; icon: PlannerIconName; edit: boolean; tip: boolean; suggestions: boolean };

// `ERROR_GROUPS` of `PlannerScreen.jsx` (version 1792772980-f821): the heading, the icon and the actions of each group.
const ERROR_PANELS: Record<ErrorGroup, ErrorPanel> = {
  request: { title: 'Hay que decirlo de otra forma', icon: 'message-circle-question', edit: true, tip: true, suggestions: true },
  catalog: { title: 'Eso no está en los menús', icon: 'utensils-crossed', edit: true, tip: false, suggestions: true },
  failure: { title: 'Algo ha fallado', icon: 'triangle-alert', edit: true, tip: false, suggestions: false },
  limit: { title: 'Has llegado al límite de hoy', icon: 'clock', edit: false, tip: false, suggestions: false },
};
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
    return <SearchError key={state.attempt} state={state} suggestions={suggestions} onEdit={onEdit} />;
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
    <SearchPanel role="status" headingId="planner-empty-heading" title={NO_MENU_FITS} text="Quita alguna condición o dila de otra forma.">
      <PanelActions request={request} onEdit={onEdit} tip suggestions={suggestions} />
    </SearchPanel>
  );
}

type SearchErrorProps = {
  state: Extract<PlannerSearchState, { status: 'failed' }>;
  suggestions: ReactNode;
  onEdit: (request: string) => void;
};

// The block `state === 'error'` of `PlannerScreen.jsx` (version 1792772980-f821): the panel of "no menu fits" with a round
// icon before the heading, the message of the server unchanged and the actions of its group (MF-79 design D2).
function SearchError({ state, suggestions, onEdit }: SearchErrorProps) {
  const panel = ERROR_PANELS[state.group];
  const icon = (
    <span aria-hidden="true" className={`${ICON} ${state.group === 'limit' ? ICON_TONES.wait : ICON_TONES.alarm}`}>
      <PlannerIcon name={panel.icon} size={18} strokeWidth={2} />
    </span>
  );
  return (
    <SearchPanel role="alert" headingId="planner-error-heading" title={panel.title} text={state.message} icon={icon}>
      <PanelActions
        request={panel.edit ? state.request : ''}
        onEdit={onEdit}
        tip={panel.tip}
        suggestions={panel.suggestions ? suggestions : null}
      />
    </SearchPanel>
  );
}

type SearchPanelProps = {
  role: 'status' | 'alert';
  headingId: string;
  title: string;
  text: string;
  icon?: ReactNode;
  children: ReactNode;
};

// `.mf-plan__empty`, shared by "no menu fits" and the errors; the heading moves down to the middle of the icon.
function SearchPanel({ role, headingId, title, text, icon, children }: SearchPanelProps) {
  return (
    <section role={role} aria-labelledby={headingId} className={PANEL}>
      <div className="flex items-start gap-3">
        {icon}
        <h2
          id={headingId}
          className={`text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] text-text-strong ${icon ? 'pt-1' : ''}`}
        >
          {title}
        </h2>
      </div>
      <p className="max-w-[60ch] text-[15px] leading-normal text-text-body">{text}</p>
      {children}
    </section>
  );
}

type PanelActionsProps = { request: string; onEdit: (request: string) => void; tip: boolean; suggestions: ReactNode };

function PanelActions({ request, onEdit, tip, suggestions }: PanelActionsProps) {
  return (
    <>
      {request && (
        <Button size="sm" variant="secondary" onClick={() => onEdit(request)}>
          <PlannerIcon name="pencil" size={16} />
          Editar mi búsqueda
        </Button>
      )}
      {tip && <p className="text-sm text-text-muted">{TIP}</p>}
      {suggestions && (
        <div className="mt-1.5 flex flex-col gap-2.5">
          <p className={LABEL}>O prueba con algo que suele funcionar</p>
          {suggestions}
        </div>
      )}
    </>
  );
}
