'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { WeekDayDto, WeekDishDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import { DayTabs, tabIdOf } from '@/features/weekly-menu/components/day-tabs';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';
import { RecipePanel } from '@/features/weekly-menu/components/recipe-panel';
import { WeekTable, type DishRef } from '@/features/weekly-menu/components/week-table';
import { columnsOf } from '@/features/weekly-menu/columns';
import { formatDayDate, formatShortDate, formatWeekday } from '@/features/weekly-menu/format-date';

type WeeklyMenuProps = { menu: WeeklyMenuDto };

// After the design system's `ui_kits/app/MenuScreen.jsx`, mobile view (version 1791384225-1eab). Its `TopBar` and
// `SectionHeader` are a few lines of markup each, written here rather than ported (design D5). From an 800 px
// container, the week table and the recipe panel of version 1791390572-4ab7 instead (design D1 of MF-23.2).
const PAGE = 'mx-auto w-full max-w-[var(--spacing-content-max)] @min-[800px]:max-w-[1200px]';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const MEAL_LABELS = Object.fromEntries(MEALS);

/**
 * The menu of the week, one day at a time: a heading, seven day tabs and the selected day's dishes. It opens on today,
 * so the page rendered on the server, before any script runs, already shows today's dishes.
 */
export function WeeklyMenu({ menu }: WeeklyMenuProps) {
  const todays = menu.days.find(({ date }) => date === menu.today) ?? menu.days[0];
  const [selected, setSelected] = useState(todays.day);
  const [open, setOpen] = useState<DishRef | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const day = menu.days.find((candidate) => candidate.day === selected) ?? todays;

  const openDish = (ref: DishRef, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpen(ref);
  };
  const close = useCallback(() => {
    setOpen(null);
    trigger.current?.focus();
  }, []);

  return (
    <div className={PAGE}>
      <header className="flex min-h-[88px] flex-col justify-end px-gutter-mobile py-3 @min-[800px]:px-8">
        <p className={`${EYEBROW} mb-1 text-olive-600`}>Semana del {formatShortDate(menu.startsOn)}</p>
        <h1 className="text-h1 font-extrabold">Menú {menu.menuNumber}</h1>
      </header>
      <div className="@min-[800px]:hidden">
        <div className="sticky top-0 z-[2] bg-surface-page px-3 pb-2">
          <DayTabs days={menu.days} selected={selected} today={menu.today} panelId={panelId} onSelect={setSelected} />
        </div>
        <DayPanel id={panelId} labelledBy={tabIdOf(panelId, selected)} day={day} />
      </div>
      <div className="hidden px-8 pb-14 pt-2 @min-[800px]:block">
        <WeekTable days={menu.days} today={menu.today} open={open} onOpen={openDish} />
      </div>
      {open && <OpenRecipe menu={menu} open={open} onClose={close} />}
    </div>
  );
}

function DayPanel({ id, labelledBy, day }: { id: string; labelledBy: string; day: WeekDayDto }) {
  const empty = day.meals.lunch.length === 0 && day.meals.dinner.length === 0;
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={0}
      className="flex flex-col gap-7 px-gutter-mobile pb-8 pt-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
    >
      <h2 className="text-h2 font-extrabold">{formatDayDate(day.date)}</h2>
      {empty ? (
        <p className="border-t border-border-ink pt-3 text-[15px] text-text-muted">
          El menú no incluye platos para este día.
        </p>
      ) : (
        MEALS.map(([type, label]) => <Meal key={type} label={label} dishes={day.meals[type]} />)
      )}
    </div>
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

// The panel lies over the half of the table away from the dish's column.
function OpenRecipe({ menu, open, onClose }: { menu: WeeklyMenuDto; open: DishRef; onClose: () => void }) {
  const columns = columnsOf(menu.days);
  const column = columns.findIndex(({ day }) => day === open.day);
  const { date, meals } = columns[column];
  const dish = meals[open.meal][open.index];
  if (!dish?.recipe) return null;
  return (
    <RecipePanel
      name={dish.name}
      eyebrow={`${formatWeekday(date)} · ${MEAL_LABELS[open.meal]}`}
      recipe={dish.recipe}
      side={column < columns.length / 2 ? 'right' : 'left'}
      onClose={onClose}
    />
  );
}
