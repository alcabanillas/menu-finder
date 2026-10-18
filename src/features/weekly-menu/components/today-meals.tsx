'use client';

import Link from 'next/link';
import { useCallback, useId, useRef, useState } from 'react';
import type { WeekDayDto, WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { DAY_BARS } from '@/features/weekly-menu/components/day-bar';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';
import { RecipePanel, sideAwayFrom, type PanelSide } from '@/features/weekly-menu/components/recipe-panel';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';
import { formatWeekday, formatWeekdayAndDay } from '@/shared/format-date';

type TodayMealsProps = { menu: WeeklyMenuDto };

type MealDto = 'lunch' | 'dinner';

/** Today's dish whose recipe is open, and the side of the page its panel lies on. */
type OpenDish = { meal: MealDto; index: number; side: PanelSide };

// After "Qué toca hoy" of the design system's `ui_kits/app/HomeScreen.jsx` (version 1792337560-ff39). The heading and
// today's date are the page's (dashboard layout). On a phone the meals go one below the other with their unfolding
// cards; from an 800 px container they are two cards side by side and a recipe opens in Menú's side panel (design D9).
// Both views are in the page and CSS shows one, as in `/menu`.
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const MEAL_LABELS = Object.fromEntries(MEALS);
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const LABEL = `${EYEBROW} border-b border-border-ink pb-2 text-text-muted`;
const CARD = 'min-w-0 rounded-[14px] border border-border-hairline bg-surface-card px-[22px] pb-2 pt-4';
const ROW =
  'flex items-baseline gap-3 border-b border-border-hairline py-3 last:border-b-0 text-[19px] font-extrabold ' +
  'leading-[1.25] tracking-[-0.02em] text-text-strong';
const DISH_BUTTON =
  'cursor-pointer rounded-[3px] text-left decoration-olive-600 decoration-2 underline-offset-4 hover:underline ' +
  'focus-visible:underline aria-expanded:underline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink';
const TOMORROW_BOX = 'min-w-0 rounded-[12px] border border-dashed border-border-strong bg-surface-sunken px-[18px] py-3';

/**
 * Today's lunch and dinner of the week's menu, a meal with no dishes left out; then the way to the week and the names of
 * tomorrow's dishes.
 */
export function TodayMeals({ menu }: TodayMealsProps) {
  const index = menu.days.findIndex(({ date }) => date === menu.today);
  const today = menu.days[index];
  // On Sunday tomorrow is in another week, so it is not in this menu.
  const tomorrow = today ? menu.days[index + 1] : undefined;
  const [open, setOpen] = useState<OpenDish | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const openDish = (meal: MealDto, dishIndex: number, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpen({ meal, index: dishIndex, side: sideAwayFrom(button) });
  };
  const close = useCallback(() => {
    setOpen(null);
    trigger.current?.focus();
  }, []);

  const meals = today ? mealsWithDishes(today) : [];
  return (
    <div className="flex flex-col">
      {meals.length === 0 ? (
        <p className="mt-4 text-small text-text-muted">El menú no incluye platos para hoy.</p>
      ) : (
        <>
          <div className="@min-[800px]:hidden">
            {meals.map(([meal, label]) => (
              <PhoneMeal key={meal} label={label} dishes={today.meals[meal]} />
            ))}
          </div>
          <div className="mt-5 hidden grid-cols-2 items-start gap-5 @min-[800px]:grid">
            {meals.map(([meal, label]) => (
              <MealCard
                key={meal}
                label={label}
                dishes={today.meals[meal]}
                openIndex={open?.meal === meal ? open.index : null}
                onOpen={(dishIndex, button) => openDish(meal, dishIndex, button)}
              />
            ))}
          </div>
        </>
      )}
      <Link
        href="/menu"
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-4 self-start no-underline' })}
      >
        Ver menú
        <ArrowRight size={16} />
      </Link>
      {tomorrow && mealsWithDishes(tomorrow).length > 0 && <Tomorrow day={tomorrow} />}
      {open && today && <OpenRecipe day={today} open={open} onClose={close} />}
    </div>
  );
}

function mealsWithDishes(day: WeekDayDto) {
  return MEALS.filter(([meal]) => day.meals[meal].length > 0);
}

function PhoneMeal({ label, dishes }: { label: string; dishes: WeekDishDto[] }) {
  const id = useId();
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

type MealCardProps = {
  label: string;
  dishes: WeekDishDto[];
  /** The dish of this meal whose recipe is open, announced as expanded. */
  openIndex: number | null;
  onOpen: (index: number, trigger: HTMLButtonElement) => void;
};

function MealCard({ label, dishes, openIndex, onOpen }: MealCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={CARD}>
      <h2 id={id} className={LABEL}>
        {label}
      </h2>
      {dishes.map((dish, index) => (
        <DishRow
          key={`${dish.name}-${index}`}
          dish={dish}
          isOpen={openIndex === index}
          onOpen={(button) => onOpen(index, button)}
        />
      ))}
    </section>
  );
}

type DishRowProps = { dish: WeekDishDto; isOpen: boolean; onOpen: (trigger: HTMLButtonElement) => void };

// Every dish reads the same; a dish with a recipe is underlined only on hover, focus or while open, as in `/menu`.
function DishRow({ dish, isOpen, onOpen }: DishRowProps) {
  const total = dish.recipe?.times.total;
  return (
    <div className={ROW}>
      {dish.recipe ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={(event) => onOpen(event.currentTarget)}
          className={DISH_BUTTON}
        >
          {dish.name}
        </button>
      ) : (
        <span>{dish.name}</span>
      )}
      {total != null && (
        <span className="ml-auto inline-flex flex-none items-center gap-1 whitespace-nowrap text-[13px] font-normal tracking-normal text-text-muted">
          <MenuIcon name="clock" size={13} />
          {total} min
        </span>
      )}
    </div>
  );
}

// Only the names: tomorrow is a glance ahead, so no times, no recipes and no controls. The same boxes at every width,
// stacked on a phone and side by side from 800 px (design D9).
function Tomorrow({ day }: { day: WeekDayDto }) {
  const label = formatWeekdayAndDay(day.date);
  const meals = mealsWithDishes(day);
  return (
    <section aria-label={`Mañana, ${label}`} className="mt-7 border-t border-border-hairline pt-[18px]">
      <p className={`${EYEBROW} flex items-center gap-2.5 text-text-muted`}>
        <span aria-hidden="true" className={`h-[5px] w-6 flex-none rounded-[3px] ${DAY_BARS[day.day]}`} />
        Mañana · {label}
      </p>
      <div className="mt-3 grid grid-cols-1 items-start gap-2.5 @min-[800px]:grid-cols-2 @min-[800px]:gap-5">
        {meals.map(([meal, mealLabel]) => (
          <div key={meal} className={TOMORROW_BOX}>
            <div className={`${EYEBROW} mb-1.5 border-b border-border-hairline pb-1.5 text-text-muted`}>{mealLabel}</div>
            {day.meals[meal].map(({ name }, index) => (
              <p key={`${name}-${index}`} className="mt-1.5 text-[15px] font-semibold leading-[1.35] text-text-strong">
                {name}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function OpenRecipe({ day, open, onClose }: { day: WeekDayDto; open: OpenDish; onClose: () => void }) {
  const dish = day.meals[open.meal][open.index];
  if (!dish?.recipe) return null;
  return (
    <RecipePanel
      name={dish.name}
      eyebrow={`${formatWeekday(day.date)} · ${MEAL_LABELS[open.meal]}`}
      recipe={dish.recipe}
      side={open.side}
      onClose={onClose}
    />
  );
}
