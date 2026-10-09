import { describe, expect, it } from 'vitest';
import { resolveStartsOn } from '@/domain/selection/starts-on';

const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';
const TENTH_WEEK_BACK = '2026-07-27';
const ELEVENTH_WEEK_BACK = '2026-07-20';
const NEXT_MONDAY = '2026-10-12';
const BEYOND_NEXT = '2026-10-19';

describe('resolveStartsOn', () => {
  describe('valid Mondays inside the window', () => {
    it('gives the requested Monday when it is the previous week', () => {
      expect(resolveStartsOn('2026-09-28', TODAY)).toBe('2026-09-28');
    });

    it('gives the requested Monday when it is the next week', () => {
      expect(resolveStartsOn(NEXT_MONDAY, TODAY)).toBe(NEXT_MONDAY);
    });

    it('accepts the tenth week back, seventy days before this Monday', () => {
      expect(resolveStartsOn(TENTH_WEEK_BACK, TODAY)).toBe(TENTH_WEEK_BACK);
    });

    it('accepts this Monday itself', () => {
      expect(resolveStartsOn(THIS_MONDAY, TODAY)).toBe(THIS_MONDAY);
    });
  });

  describe('fallbacks to this Monday', () => {
    it.each([
      ['undefined', undefined],
      ['an empty string', ''],
      ['not-a-date', 'not-a-date'],
      ['a slash format', '2026/10/05'],
      ['a day-first format', '05-10-2026'],
      ['a short month and day', '2026-10-5'],
      ['an impossible day', '2026-02-30'],
      ['an impossible month', '2026-13-01'],
      ['a leading space', ' 2026-10-05'],
      ['a trailing space', '2026-10-05 '],
      ['a Wednesday in the window', '2026-10-07'],
      ['an injection-shaped value', "2026-10-05' OR '1'='1"],
      ['an oversized value', '2026-10-05'.padEnd(5000, 'x')],
      ['a repeated parameter as an array', ['2026-10-05', '2026-09-28']],
      ['a number', 20261005],
    ])('gives this Monday for %s', (_label, raw) => {
      expect(resolveStartsOn(raw, TODAY)).toBe(THIS_MONDAY);
    });

    it('gives this Monday for a Monday older than the window', () => {
      expect(resolveStartsOn(ELEVENTH_WEEK_BACK, TODAY)).toBe(THIS_MONDAY);
    });

    it('gives this Monday for a Monday beyond next week', () => {
      expect(resolveStartsOn(BEYOND_NEXT, TODAY)).toBe(THIS_MONDAY);
    });

    it('does not read a valid Monday followed by extra characters as that Monday', () => {
      expect(resolveStartsOn('2026-09-28T00:00', TODAY)).toBe(THIS_MONDAY);
    });
  });
});
