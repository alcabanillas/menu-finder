import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuChoice, SelectionRepository } from '@/application/ports/selection-repository';
import { selectMenu } from '@/application/services/selection/select-menu';
import type { LocalDate } from '@/domain/selection/local-date';
import { err, ok } from '@/shared/result';

type Row = { userId: string; id: string; menuNumber: number; startsOn: LocalDate };
type Failure = 'none' | 'read' | 'write';

const ANA = 'user-a';
const BEA = 'user-b';
const STORED_MENUS = [3, 12, 20];

const fixedClock = (today: LocalDate): Clock => ({ today: () => today });

const fakeSelections = (initial: Row[] = [], failure: Failure = 'none') => {
  let rows = [...initial];
  let nextId = 0;
  const replaced: MenuChoice[] = [];
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      if (failure === 'read') return err({ kind: 'read-failed', reason: 'connection refused' });
      return ok(
        rows
          .filter((row) => row.userId === userId && row.startsOn >= from)
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
          .map(({ id, menuNumber, startsOn }) => ({ id, menuNumber, startsOn })),
      );
    },
    replace: async (userId, choice) => {
      replaced.push(choice);
      if (failure === 'write') return err({ kind: 'write-failed', reason: 'connection refused' });
      if (!STORED_MENUS.includes(choice.menuNumber)) return err({ kind: 'unknown-menu' });
      nextId += 1;
      const row: Row = { userId, id: `new-${nextId}`, ...choice };
      rows = [...rows.filter((r) => !(r.userId === userId && r.startsOn === choice.startsOn)), row];
      return ok({ id: row.id, menuNumber: row.menuNumber, startsOn: row.startsOn });
    },
    checkedPositions: async () => err({ kind: 'read-failed', reason: 'not used' }),
    setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  return { selections, replaced, rowsOf: (userId: string) => rows.filter((row) => row.userId === userId) };
};

const row = (userId: string, id: string, menuNumber: number, startsOn: LocalDate): Row => ({
  userId,
  id,
  menuNumber,
  startsOn,
});

describe('selectMenu', () => {
  it('starts on this Monday when choosing in a week with no menu', async () => {
    const fake = fakeSelections();

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 12, week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-05' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'new-1', 12, '2026-10-05')]);
  });

  it('starts on the same day when choosing on a Monday with no menu', async () => {
    const fake = fakeSelections();

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-05') },
      { userId: ANA, menuNumber: 12, week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-05' }));
  });

  it('starts next Monday when choosing next week while a menu is active, and keeps the active one', async () => {
    const fake = fakeSelections([row(ANA, 'sel-3', 3, '2026-10-05')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-09') },
      { userId: ANA, menuNumber: 12, week: 'next' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-12' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'new-1', 12, '2026-10-12')]);
  });

  it('replaces next week’s menu when choosing again', async () => {
    const fake = fakeSelections([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'sel-12', 12, '2026-10-12')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-10') },
      { userId: ANA, menuNumber: 20, week: 'next' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 20, startsOn: '2026-10-12' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'new-1', 20, '2026-10-12')]);
  });

  it('keeps past selections', async () => {
    const fake = fakeSelections([row(ANA, 'sel-old', 3, '2026-09-28')]);

    await selectMenu({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: ANA, menuNumber: 12, week: 'current' });

    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'sel-old', 3, '2026-09-28'), row(ANA, 'new-1', 12, '2026-10-05')]);
  });

  it('accepts the menu number as a string of digits, as a form sends it', async () => {
    const fake = fakeSelections();

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: '12', week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-05' }));
  });

  it.each([['12abc'], [0], [-3], [1.5], ['1.5'], ['0'], [''], [undefined], [null], [Number.MAX_SAFE_INTEGER + 1]])(
    'refuses %j as an invalid menu without storing anything',
    async (menuNumber) => {
      const fake = fakeSelections();

      const result = await selectMenu(
        { selections: fake.selections, clock: fixedClock('2026-10-07') },
        { userId: ANA, menuNumber, week: 'current' },
      );

      expect(result).toEqual(err({ kind: 'invalid-menu' }));
      expect(fake.replaced).toEqual([]);
    },
  );

  it('refuses a menu that does not exist as an unknown menu', async () => {
    const fake = fakeSelections();

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 999, week: 'current' },
    );

    expect(result).toEqual(err({ kind: 'unknown-menu' }));
    expect(fake.rowsOf(ANA)).toEqual([]);
  });

  it('fails without storing anything when the selections cannot be read', async () => {
    const fake = fakeSelections([], 'read');

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 12, week: 'current' },
    );

    expect(result).toEqual(err({ kind: 'failed' }));
    expect(fake.replaced).toEqual([]);
  });

  it('fails when the choice cannot be written', async () => {
    const fake = fakeSelections([], 'write');

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 12, week: 'current' },
    );

    expect(result).toEqual(err({ kind: 'failed' }));
  });

  it('does not move the start date because of another user’s selection', async () => {
    const fake = fakeSelections([row(ANA, 'sel-3', 3, '2026-10-05')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: BEA, menuNumber: 12, week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-05' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'sel-3', 3, '2026-10-05')]);
  });

  it('starts next Monday when choosing next week with this week empty', async () => {
    const fake = fakeSelections();

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 12, week: 'next' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 12, startsOn: '2026-10-12' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'new-1', 12, '2026-10-12')]);
  });

  it('replaces this week’s menu when choosing this week again', async () => {
    const fake = fakeSelections([row(ANA, 'sel-3', 3, '2026-10-05')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: ANA, menuNumber: 20, week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 20, startsOn: '2026-10-05' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'new-1', 20, '2026-10-05')]);
  });

  it.each([['2026-10-19'], ['last'], ['CURRENT'], [1], [undefined]])(
    'refuses the week %j as an invalid week without storing anything',
    async (week) => {
      const fake = fakeSelections();

      const result = await selectMenu(
        { selections: fake.selections, clock: fixedClock('2026-10-07') },
        { userId: ANA, menuNumber: 12, week },
      );

      expect(result).toEqual(err({ kind: 'invalid-week' }));
      expect(fake.replaced).toEqual([]);
    },
  );

  it('refuses this week as locked once next week is chosen, with a menu on this week', async () => {
    const fake = fakeSelections([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'sel-12', 12, '2026-10-12')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-08') },
      { userId: ANA, menuNumber: 20, week: 'current' },
    );

    expect(result).toEqual(err({ kind: 'week-locked' }));
    expect(fake.replaced).toEqual([]);
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'sel-12', 12, '2026-10-12')]);
  });

  it('refuses this week as locked once next week is chosen, with this week empty', async () => {
    const fake = fakeSelections([row(ANA, 'sel-12', 12, '2026-10-12')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-08') },
      { userId: ANA, menuNumber: 20, week: 'current' },
    );

    expect(result).toEqual(err({ kind: 'week-locked' }));
    expect(fake.replaced).toEqual([]);
  });

  it('still accepts next week once it is chosen', async () => {
    const fake = fakeSelections([row(ANA, 'sel-12', 12, '2026-10-12')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-08') },
      { userId: ANA, menuNumber: 20, week: 'next' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 20, startsOn: '2026-10-12' }));
    expect(fake.rowsOf(ANA)).toEqual([row(ANA, 'new-1', 20, '2026-10-12')]);
  });

  it('does not lock this week because of another user’s next week', async () => {
    const fake = fakeSelections([row(ANA, 'sel-12', 12, '2026-10-12')]);

    const result = await selectMenu(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: BEA, menuNumber: 3, week: 'current' },
    );

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 3, startsOn: '2026-10-05' }));
  });
});
