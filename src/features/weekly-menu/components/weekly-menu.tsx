'use client';

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import type { WeekDayDto, WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { DayTabs } from '@/features/weekly-menu/components/day-tabs';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';
import { RecipePanel } from '@/features/weekly-menu/components/recipe-panel';
import { WeekCards, type DishRef } from '@/features/weekly-menu/components/week-cards';
import { WeekHeader } from '@/features/weekly-menu/components/week-header';
import { formatDayDate, formatShortDate, formatWeekday } from '@/shared/format-date';
import { daySectionId, useDayScroll } from '@/features/weekly-menu/use-day-scroll';

type WeeklyMenuProps = { menu: WeeklyMenuDto; nav?: ReactNode };

// After the design system's `ui_kits/app/MenuScreen.jsx`, mobile view (version 1791384225-1eab). Its `TopBar` and
// `SectionHeader` are a few lines of markup each, written here rather than ported (design D5). From an 800 px
// container, the day cards and the recipe panel of version 1791414282-6467 instead (design D1 of MF-56). The page's
// width box is `app/(signed-in)/menu/page.tsx`'s (design D5 of MF-74).
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const MEAL_LABELS = Object.fromEntries(MEALS);

/**
 * The menu of the week. Below 800 px, a sticky day bar over all seven days in one scroll, which opens on today and
 * marks the day in view (MF-69); from 800 px, the day cards and the recipe panel.
 */
export function WeeklyMenu({ menu, nav }: WeeklyMenuProps) {
  const { active, goTo } = useDayScroll(menu.days, menu.today);
  const [open, setOpen] = useState<DishRef | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const openDish = (ref: DishRef, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpen(ref);
  };
  const close = useCallback(() => {
    setOpen(null);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <WeekHeader
        eyebrow={`Semana del ${formatShortDate(menu.startsOn)}`}
        title={`Menú ${menu.menuNumber}`}
        nav={nav}
      />
      <div className="@min-[800px]:hidden">
        {/* Under the shell's header, which is sticky too, 56 px high and 64 px from 800 px. */}
        <div className="sticky top-14 z-[2] bg-surface-page px-3 pb-2 min-[800px]:top-16">
          <DayTabs days={menu.days} active={active} today={menu.today} onSelect={goTo} />
        </div>
        <div className="flex flex-col">
          {menu.days.map((d) => (
            <DaySection key={d.day} day={d} />
          ))}
        </div>
      </div>
      <div className="hidden px-8 pb-14 pt-2 @min-[800px]:block">
        <WeekCards days={menu.days} today={menu.today} open={open} onOpen={openDish} />
      </div>
      {open && <OpenRecipe menu={menu} open={open} onClose={close} />}
    </>
  );
}

function DaySection({ day }: { day: WeekDayDto }) {
  const headingId = useId();
  const empty = day.meals.lunch.length === 0 && day.meals.dinner.length === 0;
  return (
    <section
      id={daySectionId(day.day)}
      aria-labelledby={headingId}
      // Room for the header and the day bar above the section the page scrolls to: 128 px, 136 px from 800 px. The last
      // day is at least the rest of the viewport high, so however short it is it reaches the top and the bar marks it.
      className={
        'flex scroll-mt-32 flex-col gap-7 px-gutter-mobile pb-10 pt-4 min-[800px]:scroll-mt-34 ' +
        'last:min-h-[calc(100dvh-8rem)] min-[800px]:last:min-h-[calc(100dvh-8.5rem)]'
      }
    >
      <h2 id={headingId} className="text-h2 font-extrabold">{formatDayDate(day.date)}</h2>
      {empty ? (
        <p className="border-t border-border-ink pt-3 text-[15px] text-text-muted">
          El menú no incluye platos para este día.
        </p>
      ) : (
        MEALS.map(([type, label]) => <Meal key={type} label={label} dishes={day.meals[type]} />)
      )}
    </section>
  );
}

function Meal({ label, dishes }: { label: string; dishes: WeekDishDto[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <h3 id={headingId} className={`${EYEBROW} border-b border-border-ink pb-2 text-text-muted`}>
        {label}
      </h3>
      {dishes.map((dish, index) => (
        <RecipeCard key={index} name={dish.name} recipe={dish.recipe} />
      ))}
    </section>
  );
}

function OpenRecipe({ menu, open, onClose }: { menu: WeeklyMenuDto; open: DishRef; onClose: () => void }) {
  const day = menu.days.find(({ day: candidate }) => candidate === open.day);
  const dish = day?.meals[open.meal][open.index];
  if (!day || !dish?.recipe) return null;
  return (
    <RecipePanel
      name={dish.name}
      eyebrow={`${formatWeekday(day.date)} · ${MEAL_LABELS[open.meal]}`}
      recipe={dish.recipe}
      onClose={onClose}
    />
  );
}
