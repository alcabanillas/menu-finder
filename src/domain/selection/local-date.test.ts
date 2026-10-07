import { describe, expect, it } from 'vitest';
import { addDays, isMonday, mondayOf } from '@/domain/selection/local-date';

describe('mondayOf', () => {
  it.each([
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
  ] as const)('gives Monday 2026-10-05 for %s', (date) => {
    expect(mondayOf(date)).toBe('2026-10-05');
  });

  it('goes back across a year end', () => {
    expect(mondayOf('2026-12-31')).toBe('2026-12-28');
    expect(mondayOf('2027-01-03')).toBe('2026-12-28');
  });

  it('is not moved by the daylight-saving change', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-03-29')).toBe('2026-03-23');
  });
});

describe('addDays', () => {
  it('adds days across a month end', () => {
    expect(addDays('2026-10-26', 7)).toBe('2026-11-02');
  });

  it('subtracts days with a negative number', () => {
    expect(addDays('2026-03-02', -2)).toBe('2026-02-28');
  });
});

describe('isMonday', () => {
  it('is true only for a Monday', () => {
    expect(isMonday('2026-10-05')).toBe(true);
    expect(isMonday('2026-10-06')).toBe(false);
    expect(isMonday('2026-10-11')).toBe(false);
  });
});
