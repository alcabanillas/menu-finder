import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { newFixtureRun } from './support/fixture-run';
import { registerTestAccount, signInAs, type TestAccount } from './support/test-account';

// The weekly flow end to end (MF-22.7, UI-flujo-semanal): choose in /planner, see it in /menu, tick in /shopping-list.
// It chooses with the random button, because a search needs Gemini and CI has no valid key (decided by the author on
// 2026-10-17). Against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// A fictitious menu of this run, so there is at least one to pick (AGENTS.md: never real data; MF-62).
const MENU = newFixtureRun().menuNumber(0);
const CHOSEN = /Menú (\d+) para la semana del \d+ \p{L}+\./u;
// Other specs seed menus in parallel, mostly without a list; an empty list of the picked menu gets these two.
const ITEMS = [
  { position: 1, category: 'Legumbres', name: 'Lentejas pardinas' },
  { position: 2, category: 'Verduras', name: 'Calabacín' },
];

const account = registerTestAccount();
let seededFor: number | null = null;

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    await client.query('INSERT INTO menu (number) VALUES ($1) ON CONFLICT DO NOTHING', [MENU]);
    await client.query("INSERT INTO meal (menu_number, day, type) VALUES ($1, 'monday', 'lunch') ON CONFLICT DO NOTHING", [MENU]);
  });
});

// The account's selections go first: a selection blocks deleting its menu. Only the seeded items are removed.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [account.email]);
    if (seededFor !== null) {
      await client.query('DELETE FROM shopping_item WHERE menu_number = $1 AND name = ANY($2::text[])', [
        seededFor,
        ITEMS.map(({ name }) => name),
      ]);
    }
    await client.query('DELETE FROM selection WHERE menu_number = $1', [MENU]);
    await client.query('DELETE FROM menu WHERE number = $1', [MENU]);
  });
});

test('a menu chosen in Buscar shows in Menú, and its list can be ticked', async ({ page }) => {
  await clearSelectionsOf(account);
  await signInAs(page, account);

  const menuNumber = await chooseRandomMenu(page);
  await ensureShoppingList(menuNumber);

  await page.getByRole('link', { name: 'Ver semana' }).click();
  await expect(page).toHaveURL(/\/menu/);
  await expect(page.getByText(`Menú ${menuNumber}`).first()).toBeVisible();

  await page.goto('/shopping-list');
  await expect(page.getByText(`Menú ${menuNumber}`)).toBeVisible();
  const first = page.getByRole('checkbox').first();
  const answered = page.waitForResponse((response) => response.request().method() === 'POST');
  await first.click();
  await answered;
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
});

async function clearSelectionsOf({ email }: TestAccount): Promise<void> {
  await withDatabase((client) =>
    client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [email]),
  );
}

async function chooseRandomMenu(page: Page): Promise<number> {
  await page.goto('/planner');
  await page.getByRole('button', { name: 'Al azar' }).click();
  const message = page.getByText(CHOSEN);
  await expect(message).toBeVisible();
  return Number(CHOSEN.exec((await message.textContent())!)![1]);
}

async function ensureShoppingList(menuNumber: number): Promise<void> {
  await withDatabase(async (client) => {
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM shopping_item WHERE menu_number = $1', [
      menuNumber,
    ]);
    if (Number(rows[0]!.count) > 0) return;
    for (const { position, category, name } of ITEMS) {
      await client.query(
        `INSERT INTO shopping_item (menu_number, position, category, name, quantity, unit, optional)
         VALUES ($1, $2, $3, $4, NULL, NULL, false) ON CONFLICT DO NOTHING`,
        [menuNumber, position, category, name],
      );
    }
    seededFor = menuNumber;
  });
}

async function withDatabase<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: currentE2eEnvironment().DATABASE_URL_UNPOOLED });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}
