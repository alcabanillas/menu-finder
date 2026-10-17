import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatWeekRange } from '@/shared/format-week';

describe('formatDayMonth', () => {
  it('writes a date as its day and short month', () => {
    expect(formatDayMonth('2026-10-12')).toBe('12 oct');
  });

  it('writes September as the browser abbreviates it, without the dot', () => {
    expect(formatDayMonth('2026-09-28')).toBe('28 sept');
  });
});

describe('formatWeekRange', () => {
  it('writes a week inside one month once', () => {
    expect(formatWeekRange('2026-10-05', '2026-10-11')).toBe('5 – 11 oct');
  });

  it('writes both months when the week crosses two', () => {
    expect(formatWeekRange('2026-09-29', '2026-10-05')).toBe('29 sept – 5 oct');
  });
});
