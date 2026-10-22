import { Fragment } from 'react';
import { ConfirmChange } from '@/features/menu-planner/components/confirm-change';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { describeChip, type CandidateCard, type EvidenceLine } from '@/features/menu-planner/search-view';
import { Button } from '@/shared/ui/button';

// Ported from the design system's `components/recipe/MenuCandidateCard.jsx` (version 1792443153-9554): the rank, "Menú N"
// as the heading, the fixed summary, the evidence lines with their state and the choose button (MF-61 design D5). The
// design system colours the terms of an attribute ochre; the author decided olive, the colour of `include` (MF-22.4 design D5).
// The terms are on the white of the card, a mixed group included: each keeps the colour of its polarity (version 1792443153-9554).
const TERM_COLOURS = { include: 'text-include', exclude: 'text-exclude' };

/** The state that starts a line: a literal dish, a similar one, or none (`MATCH` of the design system). */
const STATES: Record<EvidenceLine['state'], { symbol: string; colour: string }> = {
  met: { symbol: '✓', colour: 'text-olive-600' },
  similar: { symbol: '≈', colour: 'text-ochre-700' },
  unmet: { symbol: '✕', colour: 'text-terracotta-600' },
};

/**
 * The choose button of a card: it submits the choose form `formId` with the menu number, whatever its place in the page.
 * `label` is its visible text, "Elegir para el 12 oct", "Cambiar el menú del 5 oct" or, `selected`, "Menú del 5 oct".
 */
export type CardChoice = {
  formId: string;
  label: string;
  variant: 'primary' | 'secondary';
  selected: boolean;
  disabled: boolean;
  /** Present when the button replaces the menu of the week: it asks first (`onAsk`), and `open` shows the question. */
  replacing?: { text: string; open: boolean; onAsk: () => void; onCancel: () => void };
};

const PLAIN_BORDER = 'border-border-hairline';
const SELECTED_BORDER = 'border-olive-500 outline outline-olive-500';

type MenuCandidateCardProps = {
  card: CandidateCard;
  choice?: CardChoice;
  /** Opens the week preview of this menu; it gets the button, so that the focus can come back to it. */
  onViewWeek?: (trigger: HTMLButtonElement) => void;
  /** The preview of this menu is open. */
  viewing?: boolean;
};

/** A menu of the ranking: how well it answers each unit of the request, and, with the weeks, a button to choose it. */
export function MenuCandidateCard({ card, choice, onViewWeek, viewing = false }: MenuCandidateCardProps) {
  return (
    <article
      className={`rounded-md border bg-surface-card p-5 shadow-card ${choice?.selected ? SELECTED_BORDER : PLAIN_BORDER}`}
    >
      <div className="flex items-start gap-3.5">
        {card.rank !== null && (
          <div
            className={`w-[26px] flex-none text-[40px] leading-[0.9] font-extrabold italic ${card.rank === 1 ? 'text-olive-500' : 'text-text-faint'}`}
          >
            {card.rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[22px] leading-[1.2] font-extrabold text-text-strong">Menú {card.menu}</h3>
          {card.summary && <p className="mt-2 text-[15px] leading-normal text-pretty text-text-body">{card.summary}</p>}
        </div>
      </div>
      <ul className="mt-4 flex list-none flex-col gap-2 border-t border-border-hairline p-0 pt-3">
        {card.lines.map((line, index) => (
          <EvidenceItem key={index} line={line} />
        ))}
      </ul>
      <Actions card={card} choice={choice} onViewWeek={onViewWeek} viewing={viewing} />
    </article>
  );
}

// The question of a replacement is asked here, or in the footer of the preview while it is open (MF-73 design D4).
function Actions({ card, choice, onViewWeek, viewing }: Pick<MenuCandidateCardProps, 'card' | 'choice' | 'onViewWeek'> & { viewing: boolean }) {
  if (!choice && !onViewWeek) return null;
  if (choice?.replacing?.open && !viewing) return <ChooseControls menu={card.menu} choice={choice} className="mt-4" />;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {choice && <ChooseControls menu={card.menu} choice={withoutQuestion(choice)} />}
      {onViewWeek && <ViewWeekButton menu={card.menu} onViewWeek={onViewWeek} viewing={viewing} />}
    </div>
  );
}

// While the preview is open the question is asked in its footer, so the card keeps its button and asks nothing.
function withoutQuestion(choice: CardChoice): CardChoice {
  return choice.replacing ? { ...choice, replacing: { ...choice.replacing, open: false } } : choice;
}

function ViewWeekButton({ menu, onViewWeek, viewing }: { menu: number; onViewWeek: (trigger: HTMLButtonElement) => void; viewing: boolean }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-haspopup="dialog"
      aria-expanded={viewing}
      aria-label={`Ver semana del Menú ${menu}`}
      onClick={(event) => onViewWeek(event.currentTarget)}
      className={viewing ? 'border-olive-600 bg-olive-50 text-olive-700 hover:enabled:bg-olive-50' : undefined}
    >
      <PlannerIcon name="calendar-days" size={16} />
      Ver semana
    </Button>
  );
}

/**
 * The choose button of a card, or the question that comes first when it replaces the menu of the week. The card and the
 * footer of the week preview both use it, so that the rules of the week are written once.
 */
export function ChooseControls({ menu, choice, className, fullWidth = false }: { menu: number; choice: CardChoice; className?: string; fullWidth?: boolean }) {
  const { replacing } = choice;
  if (replacing?.open) {
    return (
      <ConfirmChange
        text={replacing.text}
        formId={choice.formId}
        field={{ name: 'menu', value: menu }}
        onCancel={replacing.onCancel}
        className={className}
      />
    );
  }
  return (
    <Button
      fullWidth={fullWidth}
      type="submit"
      size="sm"
      name="menu"
      value={menu}
      form={choice.formId}
      variant={choice.selected ? 'primary' : choice.variant}
      disabled={choice.selected || choice.disabled}
      // With JavaScript the question comes first; without it the button posts, as it always did.
      onClick={replacing && !choice.selected ? (event) => { event.preventDefault(); replacing.onAsk(); } : undefined}
      // The visible text first, then the menu, so that "Elegir para el 12 oct" says which card it belongs to.
      aria-label={`${choice.label} (Menú ${menu})`}
    >
      {choice.selected && <PlannerIcon name="check" size={17} strokeWidth={2.2} />}
      {choice.label}
    </Button>
  );
}

function EvidenceItem({ line }: { line: EvidenceLine }) {
  return (
    // The terms keep their width beside the detail; with no room left, the detail moves under them.
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
      {/* The separators and colours carry meaning a screen reader would lose: it reads the chip's text instead. */}
      <span className="sr-only">{`${describeChip({ kind: line.kind, members: line.terms })}: ${line.detail}`}</span>
      <span
        aria-hidden="true"
        data-terms
        className="inline-flex max-w-full shrink-0 flex-wrap items-baseline gap-1 font-semibold"
      >
        <span data-state={line.state} className={`w-3 flex-none text-center font-bold ${STATES[line.state].colour}`}>
          {STATES[line.state].symbol}
        </span>
        {line.terms.map((term, index) => (
          <Fragment key={index}>
            {index > 0 && <TermSeparator kind={line.kind} />}
            {/* No minus before an excluded term, as in the design system (version 1792687168-5ad7): the colour tells it on
                screen and the screen reader text says "excluido" (MF-76 design D6). */}
            <span className={`wrap-anywhere ${TERM_COLOURS[term.polarity]}`}>{term.term}</span>
          </Fragment>
        ))}
      </span>
      <span aria-hidden="true" className="min-w-0 flex-1 basis-40 text-text-muted">
        {line.detail}
      </span>
    </li>
  );
}

// The separators of the chip (`RestrictionChip.jsx`): a thin rule for "con", an italic "o" for "o".
function TermSeparator({ kind }: { kind: EvidenceLine['kind'] }) {
  if (kind === 'anyOf') {
    return (
      <span aria-hidden="true" data-separator="or" className="self-center font-normal text-text-muted italic">
        o
      </span>
    );
  }
  return <span aria-hidden="true" data-separator="and" className="mx-1 h-3.5 w-px self-center bg-current opacity-25" />;
}
