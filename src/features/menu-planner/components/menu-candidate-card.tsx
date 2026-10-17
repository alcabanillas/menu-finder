import { Fragment } from 'react';
import { ConfirmChange } from '@/features/menu-planner/components/confirm-change';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { describeChip, type CandidateCard, type EvidenceLine } from '@/features/menu-planner/search-view';
import { Button } from '@/shared/ui/button';

// Ported from the design system's `components/recipe/MenuCandidateCard.jsx` (version 1792178100-1406): the rank, the
// number, the evidence lines and the choose button. No title or explanation (spec menu-planner). The design system colours the
// terms of an attribute ochre; the author decided olive, the colour of `include` (MF-22.4 design D5).
// A group that mixes include and exclude has the ochre background of its chip (`RestrictionChip.jsx`).
const MIXED_TERMS = 'rounded-pill bg-ochre-100 px-2.5 py-0.5';
const TERM_COLOURS = { include: 'text-include', exclude: 'text-exclude' };

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

/** A menu of the ranking: how well it answers each unit of the request, and, with the weeks, a button to choose it. */
export function MenuCandidateCard({ card, choice }: { card: CandidateCard; choice?: CardChoice }) {
  return (
    <article
      className={`rounded-md border bg-surface-card p-5 shadow-card ${choice?.selected ? SELECTED_BORDER : PLAIN_BORDER}`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`w-[26px] flex-none text-[40px] leading-[0.9] font-extrabold italic ${card.rank === 1 ? 'text-olive-500' : 'text-text-faint'}`}
        >
          {card.rank}
        </div>
        <span className="rounded-pill bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Menú {card.menu}</span>
      </div>
      <ul className="mt-4 flex list-none flex-col gap-2 border-t border-border-hairline p-0 pt-3">
        {card.lines.map((line, index) => (
          <EvidenceItem key={index} line={line} />
        ))}
      </ul>
      {choice && <ChooseButton menu={card.menu} choice={choice} />}
    </article>
  );
}

function ChooseButton({ menu, choice }: { menu: number; choice: CardChoice }) {
  const { replacing } = choice;
  if (replacing?.open) {
    return (
      <ConfirmChange
        text={replacing.text}
        formId={choice.formId}
        field={{ name: 'menu', value: menu }}
        onCancel={replacing.onCancel}
        className="mt-4"
      />
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
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
    </div>
  );
}

function EvidenceItem({ line }: { line: EvidenceLine }) {
  const mixed = new Set(line.terms.map(({ polarity }) => polarity)).size > 1;
  return (
    // The terms keep their width beside the detail; with no room left, the detail moves under them.
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
      {/* The separators and colours carry meaning a screen reader would lose: it reads the chip's text instead. */}
      <span className="sr-only">{`${describeChip({ kind: line.kind, members: line.terms })}: ${line.detail}`}</span>
      <span
        aria-hidden="true"
        data-terms
        className={`inline-flex max-w-full shrink-0 flex-wrap items-baseline gap-1 font-semibold ${mixed ? MIXED_TERMS : ''}`}
      >
        {/* The icon has no text baseline: centred on its own, so that the terms give the baseline of the line. */}
        <span className="flex-none self-center">
          <PlannerIcon name={line.found ? 'check' : 'x'} size={14} strokeWidth={2.2} />
        </span>
        {line.terms.map((term, index) => (
          <Fragment key={index}>
            {index > 0 && <TermSeparator kind={line.kind} />}
            {term.polarity === 'exclude' && (
              // A minus as well as the colour, so the polarity is not told by colour alone (WCAG 1.4.1).
              <span className={`flex-none self-center ${TERM_COLOURS.exclude}`}>
                <PlannerIcon name="minus" size={12} strokeWidth={2.2} />
              </span>
            )}
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
