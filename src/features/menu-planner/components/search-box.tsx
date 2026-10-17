import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';

type SearchBoxProps = { pending: boolean };

// Ported from the design system's `components/forms/SearchBox.jsx` (version 1791992191-0fd0). It has no state of its
// own: the form belongs to the server action, so it also posts without JavaScript. `required` keeps an empty box from
// being sent, with or without JavaScript; there is no `maxLength`, because the server checks the length and the
// browser would cut pasted text without a word (MF-22.4 design D5).
const BOX =
  'flex min-h-14 items-center gap-2.5 rounded-pill border border-border-strong bg-surface-card py-1.5 pr-1.5 pl-[18px] ' +
  'transition-colors duration-[var(--dur-base)] focus-within:border-border-ink';
const SUBMIT =
  'inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-pill bg-olive-600 text-white ' +
  'hover:enabled:bg-olive-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

/** The text field and the "Buscar" button of the planner's search. */
export function SearchBox({ pending }: SearchBoxProps) {
  return (
    <div className={BOX}>
      <span className="text-text-muted">
        <PlannerIcon name="search" size={20} />
      </span>
      <input
        type="text"
        name="request"
        aria-label="Qué te apetece"
        placeholder="¿Qué te apetece?"
        required
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-text-strong outline-0 placeholder:text-text-muted"
      />
      <button type="submit" aria-label="Buscar" disabled={pending} className={SUBMIT}>
        <PlannerIcon name="arrow-up" size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
