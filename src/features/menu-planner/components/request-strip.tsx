import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import type { Chip } from '@/features/menu-planner/search-view';

const LABEL = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

// After the strip "Lo que has pedido" of the design system's `PlannerScreen.jsx` (version 1792443153-9554): as wide as the
// content, between hairlines, above the results; from 800 px the label and the chips share a row.
/** The label and the chips of the request, across the width of the page. */
export function RequestStrip({ chips }: { chips: Chip[] }) {
  return (
    <section className="flex flex-col gap-3 border-y border-border-hairline py-4 @min-[800px]:flex-row @min-[800px]:flex-wrap @min-[800px]:items-center @min-[800px]:gap-x-5">
      <p aria-hidden="true" className={`${LABEL} flex-none`}>
        Lo que has pedido
      </p>
      <RestrictionChipList chips={chips} />
    </section>
  );
}
