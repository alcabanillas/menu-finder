import { useId } from 'react';
import type { DayDto, WeekDayDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { daysShown } from '@/features/weekly-menu/days-shown';
import { formatShortDate, formatWeekday } from '@/features/weekly-menu/format-date';

type MealDto = 'lunch' | 'dinner';

/** Which dish of the week: its day, its meal and its place in that meal. */
export type DishRef = { day: DayDto; meal: MealDto; index: number };

type WeekCardsProps = {
  days: WeekDayDto[];
  /** `YYYY-MM-DD`; that day's card is highlighted. */
  today: string;
  /** The dish whose recipe is open, announced as expanded. */
  open: DishRef | null;
  onOpen: (dish: DishRef, trigger: HTMLButtonElement) => void;
};

// After `.mf-wk` in the design system's `ui_kits/app/MenuScreen.jsx`, desktop view (version 1791414282-6467): one card
// per day, two columns and three from 1100 px (design D1 of MF-56).
const MEALS: [MealDto, string][] = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
];
const BARS: Record<DayDto, string> = {
  monday: 'bg-day-mon',
  tuesday: 'bg-day-tue',
  wednesday: 'bg-day-wed',
  thursday: 'bg-day-thu',
  friday: 'bg-day-fri',
  saturday: 'bg-day-sat',
  sunday: 'bg-day-sun border border-border-strong',
};

const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const CARD = 'min-w-0 rounded-[12px] border bg-surface-card px-5 pb-4 pt-3.5';
const TODAY_TAG = `${EYEBROW} ml-auto self-center rounded-xs bg-aceite-500 px-2 py-1 leading-none text-ink`;
const DISH_BUTTON =
  'cursor-pointer rounded-[3px] text-left decoration-olive-600 decoration-2 underline-offset-[3px] hover:underline ' +
  'focus-visible:underline aria-expanded:underline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink';

/** The whole week at once: a card per day (Sunday only with dishes), with the dishes of its lunch and dinner. */
export function WeekCards({ days, today, open, onOpen }: WeekCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 @min-[1100px]:grid-cols-3">
      {daysShown(days).map((day) => (
        <DayCard key={day.day} day={day} isToday={day.date === today} open={open} onOpen={onOpen} />
      ))}
    </div>
  );
}

type DayCardProps = { day: WeekDayDto; isToday: boolean } & Pick<WeekCardsProps, 'open' | 'onOpen'>;

function DayCard({ day, isToday, open, onOpen }: DayCardProps) {
  const headingId = useId();
  const empty = day.meals.lunch.length === 0 && day.meals.dinner.length === 0;
  return (
    <section
      aria-labelledby={headingId}
      className={`${CARD} ${isToday ? 'border-olive-500' : 'border-border-hairline'}`}
    >
      <div className="flex items-baseline gap-2.5 border-b border-border-ink pb-2.5">
        <span aria-hidden="true" className={`h-1 w-6 flex-none self-center rounded-[2px] ${BARS[day.day]}`} />
        <h2 id={headingId} className="text-[19px] font-extrabold leading-[1.1] tracking-[-0.02em] text-text-strong">
          {formatWeekday(day.date)}
        </h2>
        <span className="text-[13px] text-text-muted">{formatShortDate(day.date)}</span>
        {isToday && <span className={TODAY_TAG}>Hoy</span>}
      </div>
      {empty ? (
        <p className="pt-3 text-sm italic text-text-muted">El menú no incluye platos para este día.</p>
      ) : (
        MEALS.map(([meal, label]) => (
          <Meal key={meal} label={label} dishes={day.meals[meal]} at={{ day: day.day, meal }} open={open} onOpen={onOpen} />
        ))
      )}
    </section>
  );
}

type MealProps = { label: string; dishes: WeekDishDto[]; at: Omit<DishRef, 'index'> } & Pick<
  WeekCardsProps,
  'open' | 'onOpen'
>;

function Meal({ label, dishes, at, open, onOpen }: MealProps) {
  if (dishes.length === 0) return null;
  return (
    <div>
      <h3 className={`${EYEBROW} mb-0.5 mt-3 text-olive-600`}>{label}</h3>
      {dishes.map((dish, index) => (
        <DishRow
          key={index}
          dish={dish}
          isOpen={open?.day === at.day && open.meal === at.meal && open.index === index}
          onOpen={(trigger) => onOpen({ ...at, index }, trigger)}
        />
      ))}
    </div>
  );
}

type DishRowProps = { dish: WeekDishDto; isOpen: boolean; onOpen: (trigger: HTMLButtonElement) => void };

// Every dish reads the same, bold ink; a dish with a recipe is underlined only on hover, focus or while open.
function DishRow({ dish, isOpen, onOpen }: DishRowProps) {
  const total = dish.recipe?.times.total;
  return (
    <div className="flex items-baseline gap-3 py-1 text-[15px] font-semibold leading-[1.35] text-text-strong">
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
        <span className="ml-auto inline-flex flex-none items-center gap-1 whitespace-nowrap text-[13px] font-normal text-text-muted">
          <MenuIcon name="clock" size={13} />
          {total} min
        </span>
      )}
    </div>
  );
}
