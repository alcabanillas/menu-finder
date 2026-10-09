import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Day, Meal, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { LocalDate } from '@/domain/selection/local-date';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresSelectionRepository } from '@/infrastructure/postgres/postgres-selection-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const USER = 'user-ana';
const OTHER_USER = 'user-bruno';
const MISSING_MENU = 999;
const MONDAY = '2026-10-05';
const NEXT_MONDAY = '2026-10-12';
const MONDAY_AFTER = '2026-10-19';
const TUESDAY = '2026-10-06';
const DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** A full week of 14 meals with fictitious dishes, enough for the menu repository to load it again. */
function weeklyMenu(number: number): WeeklyMenu {
  const meals: Meal[] = DAYS.flatMap((day) =>
    (['lunch', 'dinner'] as const).map((type) => ({
      day,
      type,
      dishes: [{ position: 1, name: `Plato ficticio ${day} ${type}`, hasRecipeMark: false, recipeFile: null }],
    })),
  );
  return { number, meals };
}

describe.skipIf(!TEST_DATABASE_URL)('PostgresSelectionRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let selections: PostgresSelectionRepository;

  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    selections = new PostgresSelectionRepository(db.pool);
  });
  beforeEach(async () => {
    await db.truncate();
    await db.pool.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified")
       VALUES ($1, 'Ana', 'ana@example.test', true), ($2, 'Bruno', 'bruno@example.test', true)`,
      [USER, OTHER_USER],
    );
    await db.pool.query('INSERT INTO menu (number) VALUES (3), (12), (20)');
  });
  afterAll(async () => {
    await db.drop();
  });

  const storedRows = async () =>
    (
      await db.pool.query<{ user_id: string; menu_number: number; starts_on: string }>(
        'SELECT user_id, menu_number, starts_on::text FROM selection ORDER BY user_id, starts_on',
      )
    ).rows;

  it('stores the choice and returns it with its start date as YYYY-MM-DD', async () => {
    const result = await selections.replace(USER, { menuNumber: 12, startsOn: MONDAY });

    expect(result).toEqual({ ok: true, value: { id: expect.any(String), menuNumber: 12, startsOn: MONDAY } });
    expect(await storedRows()).toEqual([{ user_id: USER, menu_number: 12, starts_on: MONDAY }]);
  });

  it('reads the ten-week window: selections from seventy days back on, none older, none of another user', async () => {
    const SEVENTY_DAYS_BACK = '2026-07-27';
    const ELEVEN_WEEKS_BACK = '2026-07-20';
    await selections.replace(USER, { menuNumber: 3, startsOn: ELEVEN_WEEKS_BACK });
    await selections.replace(USER, { menuNumber: 12, startsOn: SEVENTY_DAYS_BACK });
    await selections.replace(OTHER_USER, { menuNumber: 20, startsOn: SEVENTY_DAYS_BACK });

    const result = await selections.listFrom(USER, SEVENTY_DAYS_BACK);

    expect(result).toEqual({
      ok: true,
      value: [{ id: expect.any(String), menuNumber: 12, startsOn: SEVENTY_DAYS_BACK }],
    });
  });

  it('returns no selection for an empty user id, since no row belongs to it', async () => {
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });

    expect(await selections.listFrom('', MONDAY)).toEqual({ ok: true, value: [] });
  });

  it('lists only the given user’s selections from the date on, ordered by start date', async () => {
    await selections.replace(USER, { menuNumber: 20, startsOn: MONDAY_AFTER });
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });
    await selections.replace(USER, { menuNumber: 12, startsOn: NEXT_MONDAY });
    await selections.replace(OTHER_USER, { menuNumber: 3, startsOn: NEXT_MONDAY });

    const result = await selections.listFrom(USER, NEXT_MONDAY);

    expect(result).toEqual({
      ok: true,
      value: [
        { id: expect.any(String), menuNumber: 12, startsOn: NEXT_MONDAY },
        { id: expect.any(String), menuNumber: 20, startsOn: MONDAY_AFTER },
      ],
    });
  });

  it('gives an empty list to a user who never chose', async () => {
    await selections.replace(OTHER_USER, { menuNumber: 3, startsOn: MONDAY });

    expect(await selections.listFrom(USER, MONDAY)).toEqual({ ok: true, value: [] });
  });

  it('replacing the same start date leaves one row with a new id and keeps the other dates', async () => {
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });
    const first = await selections.replace(USER, { menuNumber: 12, startsOn: NEXT_MONDAY });

    const second = await selections.replace(USER, { menuNumber: 20, startsOn: NEXT_MONDAY });

    expect(first.ok && second.ok && first.value.id !== second.value.id).toBe(true);
    expect(await storedRows()).toEqual([
      { user_id: USER, menu_number: 3, starts_on: MONDAY },
      { user_id: USER, menu_number: 20, starts_on: NEXT_MONDAY },
    ]);
  });

  it('a menu that does not exist gives unknown-menu and stores nothing', async () => {
    const result = await selections.replace(USER, { menuNumber: MISSING_MENU, startsOn: MONDAY });

    expect(result).toEqual({ ok: false, error: { kind: 'unknown-menu' } });
    expect(await storedRows()).toEqual([]);
  });

  it('a menu that does not exist keeps the earlier choice of that date', async () => {
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });

    await selections.replace(USER, { menuNumber: MISSING_MENU, startsOn: MONDAY });

    expect(await storedRows()).toEqual([{ user_id: USER, menu_number: 3, starts_on: MONDAY }]);
  });

  it('The stored start date is always a Monday: a direct insert with a Tuesday is refused', async () => {
    await expect(
      db.pool.query('INSERT INTO selection (user_id, menu_number, starts_on) VALUES ($1, 3, $2::date)', [
        USER,
        TUESDAY,
      ]),
    ).rejects.toThrow(/check constraint/);
  });

  it('Re-ingesting the menus: loading menu 3 again succeeds and the selection still exists', async () => {
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });

    const loaded = await new PostgresMenuRepository(db.pool).saveAll([weeklyMenu(3)]);

    expect(loaded.ok).toBe(true);
    expect(await storedRows()).toEqual([{ user_id: USER, menu_number: 3, starts_on: MONDAY }]);
  });

  it('deleting the user deletes their selections', async () => {
    await selections.replace(USER, { menuNumber: 3, startsOn: MONDAY });
    await selections.replace(OTHER_USER, { menuNumber: 12, startsOn: MONDAY });

    await db.pool.query('DELETE FROM "user" WHERE "id" = $1', [USER]);

    expect(await storedRows()).toEqual([{ user_id: OTHER_USER, menu_number: 12, starts_on: MONDAY }]);
  });

  describe('ticks of the shopping list', () => {
    const NO_SELECTION = '00000000-0000-4000-8000-000000000000';

    const choose = async (userId: string, menuNumber: number, startsOn: LocalDate) => {
      const result = await selections.replace(userId, { menuNumber, startsOn });
      if (!result.ok) throw new Error('could not choose the menu');
      return result.value.id;
    };
    const tickRows = async () =>
      (
        await db.pool.query<{ selection_id: string; position: number; checked: boolean }>(
          'SELECT selection_id, position, checked FROM user_shopping_item ORDER BY selection_id, position',
        )
      ).rows;

    it('ticked positions are read back in order', async () => {
      const id = await choose(USER, 3, MONDAY);

      const written = await selections.setChecked(USER, id, [5, 2], true);

      expect(written).toEqual({ ok: true, value: undefined });
      expect(await selections.checkedPositions(USER, id)).toEqual({ ok: true, value: [2, 5] });
    });

    it('unticking removes the position from the checked ones and stores checked = false', async () => {
      const id = await choose(USER, 3, MONDAY);
      await selections.setChecked(USER, id, [1, 2], true);

      await selections.setChecked(USER, id, [1], false);

      expect(await selections.checkedPositions(USER, id)).toEqual({ ok: true, value: [2] });
      expect((await tickRows()).find((row) => row.position === 1)?.checked).toBe(false);
    });

    it('the same position twice stores one row', async () => {
      const id = await choose(USER, 3, MONDAY);

      await selections.setChecked(USER, id, [4, 4], true);
      await selections.setChecked(USER, id, [4], true);

      expect(await tickRows()).toEqual([{ selection_id: id, position: 4, checked: true }]);
    });

    it('another user’s selection id reads nothing and writes nothing', async () => {
      const id = await choose(USER, 3, MONDAY);
      await selections.setChecked(USER, id, [1], true);

      const written = await selections.setChecked(OTHER_USER, id, [2], true);
      const read = await selections.checkedPositions(OTHER_USER, id);

      expect(written).toEqual({ ok: true, value: undefined });
      expect(read).toEqual({ ok: true, value: [] });
      expect(await tickRows()).toEqual([{ selection_id: id, position: 1, checked: true }]);
    });

    it('a selection that does not exist reads nothing and writes nothing', async () => {
      expect(await selections.setChecked(USER, NO_SELECTION, [1], true)).toEqual({ ok: true, value: undefined });
      expect(await selections.checkedPositions(USER, NO_SELECTION)).toEqual({ ok: true, value: [] });
      expect(await tickRows()).toEqual([]);
    });

    it('an id that is not a uuid is a failure, not a crash', async () => {
      const written = await selections.setChecked(USER, 'not-a-uuid', [1], true);
      const read = await selections.checkedPositions(USER, 'not-a-uuid');

      expect(!written.ok && written.error.kind).toBe('write-failed');
      expect(!read.ok && read.error.kind).toBe('read-failed');
    });

    it('replacing the selection of that week drops the ticks', async () => {
      const oldId = await choose(USER, 3, MONDAY);
      await selections.setChecked(USER, oldId, [1, 2], true);

      const newId = await choose(USER, 12, MONDAY);

      expect(await tickRows()).toEqual([]);
      expect(await selections.checkedPositions(USER, oldId)).toEqual({ ok: true, value: [] });
      expect(await selections.checkedPositions(USER, newId)).toEqual({ ok: true, value: [] });
    });

    it('saving the same shopping list again keeps the ticks', async () => {
      const id = await choose(USER, 3, MONDAY);
      const list = { menuNumber: 3, items: [{ category: 'Especias', name: 'Curry', quantity: null, unit: null, optional: false }] };
      const lists = new PostgresShoppingListRepository(db.pool);
      await lists.saveAll([list]);
      await selections.setChecked(USER, id, [1], true);

      await lists.saveAll([list]);

      expect(await selections.checkedPositions(USER, id)).toEqual({ ok: true, value: [1] });
    });

    it('the database refuses position 0', async () => {
      const id = await choose(USER, 3, MONDAY);

      const written = await selections.setChecked(USER, id, [0], true);

      expect(!written.ok && written.error.kind).toBe('write-failed');
      expect(await tickRows()).toEqual([]);
    });
  });

  it('reports read-failed and write-failed when the table is missing', async () => {
    const own = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    try {
      // The search path ends in `public`, which may hold a migrated `selection` (the e2e run migrates it): a table
      // without the columns, in the own schema, keeps the queries from falling through to it.
      await own.pool.query('DROP TABLE selection CASCADE');
      await own.pool.query('CREATE TABLE selection (id uuid)');
      const broken = new PostgresSelectionRepository(own.pool);

      const read = await broken.listFrom(USER, MONDAY);
      const write = await broken.replace(USER, { menuNumber: 3, startsOn: MONDAY });

      expect(!read.ok && read.error.kind).toBe('read-failed');
      expect(!write.ok && write.error.kind).toBe('write-failed');
    } finally {
      await own.drop();
    }
  });
});
