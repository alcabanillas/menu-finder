import { describe, expect, it } from 'vitest';
import { newFixtureRun } from './fixture-run';

const LAST_REAL_MENU = 36;
const FIRST_FIXTURE_MENU = 1_000_000;
const MAX_POSTGRES_INTEGER = 2_147_483_647;
// The most menus a spec file seeds (menu-weeks.spec.ts: three weeks).
const OFFSETS = [0, 1, 2];

describe('newFixtureRun', () => {
  it('gives two runs different menu numbers and keys', () => {
    const first = newFixtureRun(() => 0.25);
    const second = newFixtureRun(() => 0.75);

    const firstNumbers = OFFSETS.map((offset) => first.menuNumber(offset));
    const secondNumbers = OFFSETS.map((offset) => second.menuNumber(offset));
    expect(firstNumbers.filter((number) => secondNumbers.includes(number))).toEqual([]);
    expect(first.key('e2e-recipe')).not.toBe(second.key('e2e-recipe'));
  });

  it('keeps the base name in the key', () => {
    expect(newFixtureRun(() => 0.5).key('e2e-recipe')).toMatch(/^e2e-recipe-\d+$/);
  });

  it.each([0, 0.999_999_999])('never picks a real menu, and fits a PostgreSQL integer (random %s)', (value) => {
    const run = newFixtureRun(() => value);

    for (const offset of OFFSETS) {
      const number = run.menuNumber(offset);
      expect(Number.isInteger(number)).toBe(true);
      expect(number).toBeGreaterThan(LAST_REAL_MENU);
      expect(number).toBeGreaterThanOrEqual(FIRST_FIXTURE_MENU);
      expect(number).toBeLessThanOrEqual(MAX_POSTGRES_INTEGER);
    }
  });
});
