import Link from 'next/link';
import type { WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';

type TodayMealsProps = { menu: WeeklyMenuDto };

// After "Qué toca hoy" of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792319321-0ddf). The heading and
// today's date are the page's (dashboard layout); this is lunch and dinner, one below the other, and the way to the week.
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const LABEL =
  'border-b border-border-ink pb-2 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

/** Today's lunch and dinner of the week's menu, each dish with its recipe to unfold; a meal with no dishes is left out. */
export function TodayMeals({ menu }: TodayMealsProps) {
  const today = menu.days.find(({ date }) => date === menu.today);
  const meals = MEALS.filter(([meal]) => (today?.meals[meal] ?? []).length > 0);
  return (
    <div className="flex flex-col">
      {meals.length === 0 && <p className="mt-4 text-small text-text-muted">El menú no incluye platos para hoy.</p>}
      {meals.map(([meal, label]) => (
        <Meal key={meal} label={label} dishes={today?.meals[meal] ?? []} />
      ))}
      <Link
        href="/menu"
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-4 self-start no-underline' })}
      >
        Ver menú
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function Meal({ label, dishes }: { label: string; dishes: WeekDishDto[] }) {
  const id = `hoy-${label.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="mt-5 flex flex-col gap-2.5">
      <h2 id={id} className={LABEL}>
        {label}
      </h2>
      {dishes.map((dish, index) => (
        <RecipeCard key={`${dish.name}-${index}`} name={dish.name} recipe={dish.recipe} />
      ))}
    </section>
  );
}
