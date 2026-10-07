import { describe, expect, it } from 'vitest';
import { formatColumnDate, formatDayDate, formatShortDate, formatWeekday } from '@/features/weekly-menu/format-date';

describe('formatShortDate', () => {
  it('writes the day and the month in Spanish', () => {
    expect(formatShortDate('2026-10-05')).toBe('5 de octubre');
    expect(formatShortDate('2027-01-01')).toBe('1 de enero');
  });
});

describe('formatDayDate', () => {
  it('writes the weekday, capitalised, with the day and the month, and no comma', () => {
    expect(formatDayDate('2026-10-07')).toBe('Miércoles 7 de octubre');
    expect(formatDayDate('2026-10-11')).toBe('Domingo 11 de octubre');
  });
});

describe('formatWeekday', () => {
  it('writes the weekday alone, capitalised', () => {
    expect(formatWeekday('2026-10-07')).toBe('Miércoles');
    expect(formatWeekday('2026-10-11')).toBe('Domingo');
  });
});

describe('formatColumnDate', () => {
  it('writes the day and the short month, without a period', () => {
    expect(formatColumnDate('2026-10-07')).toBe('7 oct');
    expect(formatColumnDate('2026-09-30')).toBe('30 sept');
  });
});
