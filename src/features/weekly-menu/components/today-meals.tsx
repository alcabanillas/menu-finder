import type { WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';

type TodayMealsProps = { menu: WeeklyMenuDto };

// After "Qué toca hoy" of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792255497-a1ff). The mock shows the
// first dish of each meal; this shows every dish of today (design D6 of MF-25). From an 800 px container, lunch and
// dinner sit side by side.
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

/** Today's lunch and dinner of the week's menu, each dish with its recipe to unfold. */
export function TodayMeals({ menu }: TodayMealsProps) {
  const today = menu.days.find(({ date }) => date === menu.today);
  return (
    <section aria-labelledby="que-toca-hoy" className="flex flex-col gap-3">
      <div className="border-b border-border-ink pb-2">
        <p className={EYEBROW}>Hoy</p>
        <h2 id="que-toca-hoy" className="text-[22px] font-extrabold leading-[1.2] text-text-strong">
          Qué toca hoy
        </h2>
      </div>
      <div className="flex flex-col gap-3 @min-[800px]:grid @min-[800px]:grid-cols-2 @min-[800px]:items-start @min-[800px]:gap-4">
        {MEALS.map(([meal, label]) => (
          <Meal key={meal} label={label} dishes={today?.meals[meal] ?? []} />
        ))}
      </div>
    </section>
  );
}

function Meal({ label, dishes }: { label: string; dishes: WeekDishDto[] }) {
  const id = `hoy-${label.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className={EYEBROW}>
        {label}
      </h3>
      {dishes.length === 0 && <p className="text-text-muted">Nada en el menú.</p>}
      {dishes.map((dish, index) => (
        <RecipeCard key={`${dish.name}-${index}`} name={dish.name} recipe={dish.recipe} />
      ))}
    </section>
  );
}
