import type { DayDto, WeekDayDto, WeekDishDto } from '@/application/dto/weekly-menu';
import { columnsOf } from '@/features/weekly-menu/columns';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { formatColumnDate, formatWeekday } from '@/features/weekly-menu/format-date';

type MealDto = 'lunch' | 'dinner';

/** Which dish of the week: its day, its meal and its place in that meal. */
export type DishRef = { day: DayDto; meal: MealDto; index: number };

type WeekTableProps = {
  days: WeekDayDto[];
  /** `YYYY-MM-DD`; that day's column is highlighted. */
  today: string;
  /** The dish whose recipe is open, announced as expanded. */
  open: DishRef | null;
  onOpen: (dish: DishRef, trigger: HTMLButtonElement) => void;
};

// After the design system's `ui_kits/app/MenuScreen.jsx`, desktop view (version 1791390572-4ab7): days in columns,
// Comida and Cena in rows, the dish names in the cells (design D2 of MF-23.2).
const MEALS: [MealDto, string][] = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
];

// Whole class names, so Tailwind finds them in the source.
const TEMPLATES: Record<number, string> = {
  6: 'grid-cols-[72px_repeat(6,minmax(0,1fr))]',
  7: 'grid-cols-[72px_repeat(7,minmax(0,1fr))]',
};
const BARS: Record<DayDto, string> = {
  monday: 'bg-day-mon',
  tuesday: 'bg-day-tue',
  wednesday: 'bg-day-wed',
  thursday: 'bg-day-thu',
  friday: 'bg-day-fri',
  saturday: 'bg-day-sat',
  sunday: 'bg-day-sun border border-border-strong',
};

const TODAY = 'bg-gray-100';
const DAY_HEADER = 'border-b border-border-ink px-2.5 pb-3';
const LABEL =
  'border-t border-border-hairline py-4 text-eyebrow font-semibold uppercase ' +
  'tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600';
const CELL =
  'flex min-w-0 flex-col gap-2.5 border-t border-border-hairline px-2.5 py-3.5 text-[14.5px] leading-[1.35] text-text-strong';
const DISH_BUTTON =
  'block w-full cursor-pointer rounded-[3px] text-left decoration-olive-600 decoration-2 underline-offset-[3px] ' +
  'hover:underline aria-expanded:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** The whole week at once: a column per day (Sunday only with dishes) and a row per meal. */
export function WeekTable({ days, today, open, onOpen }: WeekTableProps) {
  const columns = columnsOf(days);
  return (
    <div role="table" aria-label="Menú de la semana" className={`grid gap-x-3 ${TEMPLATES[columns.length]}`}>
      <div role="row" className="contents">
        <div role="columnheader" className={DAY_HEADER}>
          <span className="sr-only">Comida o cena</span>
        </div>
        {columns.map(({ day, date }) => (
          <DayHeader key={day} day={day} date={date} isToday={date === today} />
        ))}
      </div>
      {MEALS.map(([meal, label]) => (
        <div role="row" key={meal} className="contents">
          <div role="rowheader" className={LABEL}>
            {label}
          </div>
          {columns.map(({ day, date, meals }) => (
            <div role="cell" key={day} className={`${CELL} ${date === today ? TODAY : ''}`}>
              <MealDishes dishes={meals[meal]} at={{ day, meal }} open={open} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DayHeader({ day, date, isToday }: { day: DayDto; date: string; isToday: boolean }) {
  return (
    <div role="columnheader" className={`${DAY_HEADER} ${isToday ? TODAY : ''}`}>
      <span aria-hidden="true" className={`mb-2 mt-2 block h-1 w-7 rounded-[2px] ${BARS[day]}`} />
      <span className="block text-[17px] font-extrabold leading-[1.1] text-text-strong">{formatWeekday(date)}</span>
      <span className="mt-[3px] block text-[13px] font-normal text-text-muted">
        {formatColumnDate(date)}
        {isToday && ' · hoy'}
      </span>
    </div>
  );
}

type MealDishesProps = {
  dishes: WeekDishDto[];
  at: Omit<DishRef, 'index'>;
  open: DishRef | null;
  onOpen: WeekTableProps['onOpen'];
};

function MealDishes({ dishes, at, open, onOpen }: MealDishesProps) {
  if (dishes.length === 0) return <span className="italic text-text-muted">—</span>;
  return dishes.map((dish, index) => {
    const ref = { ...at, index };
    const isOpen = open?.day === at.day && open.meal === at.meal && open.index === index;
    return (
      // Every dish reads the same: the mock greys all but the first, which reads as a lesser or optional dish.
      <div key={index} className="font-semibold">
        {dish.recipe ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={(event) => onOpen(ref, event.currentTarget)}
            className={DISH_BUTTON}
          >
            <DishName name={dish.name} />
          </button>
        ) : (
          dish.name
        )}
      </div>
    );
  });
}

// The last word and the icon do not break apart, as in the mock: the icon never sits alone on a line.
function DishName({ name }: { name: string }) {
  const at = name.lastIndexOf(' ') + 1;
  return (
    <>
      {name.slice(0, at)}
      <span className="whitespace-nowrap">
        {name.slice(at)}
        <span className="ml-[5px] inline-block align-[-2px] text-olive-600">
          <MenuIcon name="chef-hat" size={13} />
        </span>
      </span>
    </>
  );
}
