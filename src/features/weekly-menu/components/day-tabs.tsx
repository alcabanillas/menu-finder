'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { DayDto } from '@/application/dto/weekly-menu';

type DayTabsProps = {
  days: { day: DayDto; date: string }[];
  /** The day in view, marked with `aria-current`. */
  active: DayDto;
  /** `YYYY-MM-DD`; the button of that date carries a mark. */
  today: string;
  onSelect: (day: DayDto) => void;
};

// Ported from the design system's `navigation/DayTabs.jsx` (version 1791384225-1eab). Since MF-69 every day is on the
// page, so the buttons are an in-page navigation with `aria-current`, not a tab list (design D1 of MF-69). They keep the
// arrow keys, Home and End, and "hoy" in the accessible name.
const LABELS: Record<DayDto, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

// Whole class names, so Tailwind finds them in the source.
const BARS: Record<DayDto, string> = {
  monday: 'bg-day-mon',
  tuesday: 'bg-day-tue',
  wednesday: 'bg-day-wed',
  thursday: 'bg-day-thu',
  friday: 'bg-day-fri',
  saturday: 'bg-day-sat',
  sunday: 'bg-day-sun shadow-[inset_0_0_0_1px_var(--color-gray-300)]',
};

// YYYY-MM-DD: the day of the month starts after the second dash.
const DAY_OF_MONTH_AT = 8;

const TAB =
  'relative flex h-16 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-md border p-0 ' +
  'transition-colors duration-[var(--dur-base)] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink';

/** Seven day buttons, Monday to Sunday, that take the page to a day and mark the day in view. */
export function DayTabs({ days, active, today, onSelect }: DayTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const target = (index + days.length) % days.length;
    onSelect(days[target].day);
    tabs.current[target]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = targetOf(event.key, index, days.length);
    if (target === null) return;
    event.preventDefault();
    select(target);
  };

  return (
    <nav aria-label="Días de la semana" className="flex gap-1">
      {days.map(({ day, date }, index) => {
        const isActive = day === active;
        const isToday = date === today;
        const dayOfMonth = Number(date.slice(DAY_OF_MONTH_AT));
        return (
          <button
            key={day}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            aria-current={isActive ? 'true' : undefined}
            aria-label={`${LABELS[day]} ${dayOfMonth}${isToday ? ' hoy' : ''}`}
            onClick={() => onSelect(day)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`${TAB} ${isActive ? 'border-ink bg-ink text-white' : 'border-transparent bg-transparent text-text-body'}`}
          >
            <span aria-hidden="true" className={`mb-0.5 h-1 w-[18px] rounded-[2px] ${BARS[day]}`} />
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${isActive ? 'text-gray-200' : 'text-text-muted'}`}
            >
              {LABELS[day]}
            </span>
            <span className="text-[20px] font-extrabold leading-none">{dayOfMonth}</span>
            {/* 1 px from the bottom, not the mock's 5 px, which leaves it touching the number (MF-69). */}
            {isToday && (
              <span
                className={`absolute bottom-px size-1 rounded-[2px] bg-olive-500 ${isActive ? 'opacity-0' : ''}`}
              >
                <span className="sr-only">hoy</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function targetOf(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight') return index + 1;
  if (key === 'ArrowLeft') return index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
