// Ported from the design system's `components/recipe/SectionHeader.jsx` (version 1791390572-4ab7), eyebrow and rule only.
/** A small uppercase heading over a rule, as the mock's category title. */
export function SectionHeader({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="border-b border-border-ink pb-2">
      <h2 className="mb-0.5 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted">
        {eyebrow}
      </h2>
    </div>
  );
}
