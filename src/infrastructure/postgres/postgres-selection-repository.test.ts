import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Day, Meal, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresSelectionRepository } from '@/infrastructure/postgres/postgres-selection-repository';
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

// Creating and migrating a database of its own is network to Neon, slower than the default 5 s on the CI runner (MF-49).
const OWN_DATABASE_TIMEOUT_MS = 30_000;

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
  }, OWN_DATABASE_TIMEOUT_MS);
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

  it('reports read-failed and write-failed when the table is missing', async () => {
    const own = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    try {
      // The search path ends in `public`, which may hold a migrated `selection` (the e2e run migrates it): a table
      // without the columns, in the own schema, keeps the queries from falling through to it.
      await own.pool.query('DROP TABLE selection');
      await own.pool.query('CREATE TABLE selection (id uuid)');
      const broken = new PostgresSelectionRepository(own.pool);

      const read = await broken.listFrom(USER, MONDAY);
      const write = await broken.replace(USER, { menuNumber: 3, startsOn: MONDAY });

      expect(!read.ok && read.error.kind).toBe('read-failed');
      expect(!write.ok && write.error.kind).toBe('write-failed');
    } finally {
      await own.drop();
    }
  }, OWN_DATABASE_TIMEOUT_MS);
});
