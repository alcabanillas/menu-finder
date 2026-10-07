type SectionHeaderProps = {
  eyebrow: string;
  /** The `id` of the heading, to name its section. */
  id?: string;
  /** "1/2": shown from 800 px, where the index holds the category's control (design D5 of MF-56). */
  count?: string;
};

// Ported from the design system's `components/recipe/SectionHeader.jsx` (version 1791390572-4ab7), eyebrow and rule only;
// the count from `.mf-shop__h` of `ui_kits/app/ShoppingScreen.jsx` (version 1791414282-6467).
/** A small uppercase heading over a rule, as the mock's category title. */
export function SectionHeader({ eyebrow, id, count }: SectionHeaderProps) {
  return (
    <div className="flex justify-between gap-3 border-b border-border-ink pb-2 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted">
      <h2 id={id} className="mb-0.5">
        {eyebrow}
      </h2>
      {count && <span className="hidden tracking-normal tabular-nums @min-[800px]:inline">{count}</span>}
    </div>
  );
}
