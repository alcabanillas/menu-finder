import { describe, expect, it } from 'vitest';
import type { DayDto, WeekDayDto } from '@/application/dto/weekly-menu';
import { columnsOf } from '@/features/weekly-menu/columns';

const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function week(sunday: WeekDayDto['meals']): WeekDayDto[] {
  return DAYS.map((day, index) => ({
    day,
    date: `2026-10-${String(5 + index).padStart(2, '0')}`,
    meals: day === 'sunday' ? sunday : { lunch: [{ name: 'Plato ficticio', recipe: null }], dinner: [] },
  }));
}

describe('columnsOf', () => {
  it('keeps Sunday when it has a dish', () => {
    const days = week({ lunch: [], dinner: [{ name: 'Cena ficticia', recipe: null }] });

    expect(columnsOf(days).map(({ day }) => day)).toEqual(DAYS);
  });

  it('leaves Sunday out when it has no dishes', () => {
    expect(columnsOf(week({ lunch: [], dinner: [] })).map(({ day }) => day)).toEqual(DAYS.slice(0, 6));
  });
});
