import {
  SAMPLE_CARD,
  SAMPLE_CHIPS,
  SAMPLE_RECIPE,
  SAMPLE_REQUEST,
  SAMPLE_SHOPPING,
} from '@/app/_welcome/sample-data';
import { MenuCandidateCard } from '@/features/menu-planner/components/menu-candidate-card';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { RestrictionChipList } from '@/features/menu-planner/components/restriction-chip-list';
import { Checkbox } from '@/features/shopping-list/components/checkbox';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';

// The sample pieces of the visitor's home, built with the components of Buscar, Menú and Compra so that they look the
// same and change together (MF-76 design D1). The welcome makes them inert.

/** The request, its chips and the card that answers it, as Buscar shows them. */
export function SampleSearch() {
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-pill border border-border-strong py-1.5 pr-1.5 pl-4 text-[15px] text-text-strong">
        <span className="min-w-0 flex-1">{SAMPLE_REQUEST}</span>
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-olive-600 text-white">
          <PlannerIcon name="arrow-up" size={18} />
        </span>
      </div>
      <RestrictionChipList chips={SAMPLE_CHIPS} />
      <MenuCandidateCard card={SAMPLE_CARD} />
    </>
  );
}

/** A recipe card of Menú, open. */
export function SampleRecipe() {
  return <RecipeCard name={SAMPLE_RECIPE.title} recipe={SAMPLE_RECIPE} defaultOpen />;
}

/** One category of the shopping list, with its boxes. */
export function SampleShopping() {
  return (
    <div className="rounded-[12px] border border-border-hairline bg-surface-card px-4 py-3">
      <p className="border-b border-border-ink pb-2 text-eyebrow font-semibold tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted uppercase">
        {SAMPLE_SHOPPING.category}
      </p>
      {SAMPLE_SHOPPING.items.map(({ name, amount, checked, optional }) => (
        <div key={name} data-sample-item className="flex min-h-12 items-center gap-3.5 border-b border-border-hairline last:border-b-0">
          <Checkbox state={checked ? 'true' : 'false'} />
          <span className={`min-w-0 flex-1 ${checked ? 'text-text-faint line-through' : 'text-text-strong'}`}>
            {name}
            {optional && <span className="ml-1.5 text-[13px] text-text-muted italic">opcional</span>}
          </span>
          <span className="text-sm whitespace-nowrap text-text-muted tabular-nums">{amount}</span>
        </div>
      ))}
    </div>
  );
}
