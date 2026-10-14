import { Fragment } from 'react';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { describeChip, type CandidateCard, type EvidenceLine } from '@/features/menu-planner/search-view';

// Ported from the design system's `components/recipe/MenuCandidateCard.jsx` (version 1791992191-0fd0): the rank, the
// number and the evidence lines. No title, explanation or action (spec menu-planner). The design system colours the
// terms of an attribute ochre; the author decided olive, the colour of `include` (MF-22.4 design D5).
// A group that mixes include and exclude has the ochre background of its chip (`RestrictionChip.jsx`).
const MIXED_TERMS = 'rounded-pill bg-ochre-100 px-2.5 py-0.5';
const TERM_COLOURS = { include: 'text-olive-600', exclude: 'text-terracotta-600' };

/** A menu of the ranking: how well it answers each unit of the request. */
export function MenuCandidateCard({ card }: { card: CandidateCard }) {
  return (
    <article className="rounded-md border border-border-hairline bg-surface-card p-5 shadow-card">
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
    </article>
  );
}

function EvidenceItem({ line }: { line: EvidenceLine }) {
  const mixed = new Set(line.terms.map(({ polarity }) => polarity)).size > 1;
  return (
    <li className="flex items-baseline gap-2.5 text-sm">
      {/* The separators and colours carry meaning a screen reader would lose: it reads the chip's text instead. */}
      <span className="sr-only">{`${describeChip({ kind: line.kind, members: line.terms })}: ${line.detail}`}</span>
      <span
        aria-hidden="true"
        data-terms
        className={`inline-flex min-w-0 flex-wrap items-baseline gap-1 font-semibold ${mixed ? MIXED_TERMS : ''}`}
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
      <span aria-hidden="true" className="min-w-0 text-text-muted">
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
