'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { DayDto } from '@/application/dto/weekly-menu';

type DayTabsProps = {
  days: { day: DayDto; date: string }[];
  selected: DayDto;
  /** `YYYY-MM-DD`; the tab of that date carries a mark. */
  today: string;
  /** The id of the panel the tabs control; each tab's id is derived from it with `tabIdOf`. */
  panelId: string;
  onSelect: (day: DayDto) => void;
};

// Ported from the design system's `navigation/DayTabs.jsx` (version 1791384225-1eab), with the ARIA tab pattern the mock
// lacks: roving `tabIndex`, arrow keys, Home and End, and "hoy" in the accessible name (design D5).
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

/** The id of the tab of `day`, so the panel can be labelled by it. */
export function tabIdOf(panelId: string, day: DayDto): string {
  return `${panelId}-${day}`;
}

/** Seven tabs, Monday to Sunday, that choose the day the panel shows. */
export function DayTabs({ days, selected, today, panelId, onSelect }: DayTabsProps) {
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
    <div role="tablist" aria-label="Días de la semana" className="flex gap-1">
      {days.map(({ day, date }, index) => {
        const isSelected = day === selected;
        const isToday = date === today;
        const dayOfMonth = Number(date.slice(DAY_OF_MONTH_AT));
        return (
          <button
            key={day}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabIdOf(panelId, day)}
            aria-selected={isSelected}
            aria-controls={panelId}
            aria-label={`${LABELS[day]} ${dayOfMonth}${isToday ? ' hoy' : ''}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(day)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`${TAB} ${isSelected ? 'border-ink bg-ink text-white' : 'border-transparent bg-transparent text-text-body'}`}
          >
            <span aria-hidden="true" className={`mb-0.5 h-1 w-[18px] rounded-[2px] ${BARS[day]}`} />
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${isSelected ? 'text-gray-200' : 'text-text-muted'}`}
            >
              {LABELS[day]}
            </span>
            <span className="text-[20px] font-extrabold leading-none">{dayOfMonth}</span>
            {isToday && (
              <span
                className={`absolute bottom-[5px] size-1 rounded-[2px] bg-olive-500 ${isSelected ? 'opacity-0' : ''}`}
              >
                <span className="sr-only">hoy</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function targetOf(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight') return index + 1;
  if (key === 'ArrowLeft') return index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
