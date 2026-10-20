import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { newFixtureRun } from './support/fixture-run';
import { registerTestAccount, signInAs, type TestAccount } from './support/test-account';

// Spec menu-planner (MF-43.2), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// A fictitious menu, so there is at least one to pick (AGENTS.md: never real data). Other menus may exist in the test
// database, so the tests check the shape of the answer, not a fixed number.
// A number of this run only, so a parallel run never deletes it (MF-62).
const MENU = newFixtureRun().menuNumber(0);
const CHOSEN = /Menú (\d+) para la semana del \d+ \p{L}+\./u;
const RANDOM = 'Al azar';

const account = registerTestAccount();

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    await client.query('INSERT INTO menu (number) VALUES ($1) ON CONFLICT DO NOTHING', [MENU]);
    await client.query("INSERT INTO meal (menu_number, day, type) VALUES ($1, 'monday', 'lunch') ON CONFLICT DO NOTHING", [MENU]);
  });
});

// The account's selections go with the account (ON DELETE CASCADE); a selection of this menu would block deleting it.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE menu_number = $1', [MENU]);
    await client.query('DELETE FROM menu WHERE number = $1', [MENU]);
  });
});

test.describe('with a session', () => {
  // The sign-in lands on `/` (MF-25); these tests start on `/planner`.
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/planner');
  });

  test('offers "Prueba con" with "Al azar" first, and no loose random button', async ({ page }) => {
    const row = page.getByText('Prueba con').locator('..');

    await expect(row.getByRole('button').first()).toHaveText('Al azar');
    await expect(row.getByRole('button')).toHaveCount(5);
    await expect(page.getByRole('button', { name: /Elegir uno al azar/ })).toHaveCount(0);
  });

  test('choosing a random menu says which one and shows it in the week selector', async ({ page }) => {
    await expectChoiceShown(page);
  });

  // The random button chooses for the week the selector shows, so a click fills this week and a click on the other week
  // fills next week; the lock needs no search (MF-22.5, spec menu-selection "This week is locked once next week is chosen").
  test('choosing for both weeks fills them and closes this week', async ({ page }) => {
    await clearSelectionsOf(account);
    await page.goto('/planner');
    const thisWeek = page.getByRole('radio', { name: /Esta semana/ });
    const nextWeek = page.getByRole('radio', { name: /La que viene/ });
    await expect(thisWeek).toBeChecked();
    await expect(thisWeek).toBeEnabled();

    await page.getByRole('button', { name: RANDOM }).click();
    await expect(thisWeek).toHaveAccessibleName(/Menú \d+/);
    await expect(nextWeek).toHaveAccessibleName(/Sin menú/);

    await nextWeek.check();
    await page.getByRole('button', { name: RANDOM }).click();
    await expect(nextWeek).toHaveAccessibleName(/Menú \d+/);
    await expect(nextWeek).toBeChecked();
    await expect(thisWeek).toBeDisabled();
    await expect(thisWeek).toHaveAccessibleName(/Cerrada/);
  });

  test('a week that has a menu asks before a random one replaces it', async ({ page }) => {
    await clearSelectionsOf(account);
    await page.goto('/planner');
    await page.getByRole('button', { name: RANDOM }).click();
    await expect(page.getByRole('radio', { name: /Esta semana/ })).toHaveAccessibleName(/Si eliges otro, lo sustituye/);

    await page.getByRole('button', { name: RANDOM }).click();

    await expect(page.getByRole('group', { name: 'Confirmar cambio' })).toContainText('por uno al azar en la semana del');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('group', { name: 'Confirmar cambio' })).toHaveCount(0);
  });

  test('the link of an empty week in Menú opens Buscar on that week', async ({ page }) => {
    await clearSelectionsOf(account);
    await page.goto('/menu');

    await page.getByRole('link', { name: 'Elegir menú' }).click();

    await expect(page).toHaveURL('/planner?week=current');
    await expect(page.getByRole('radio', { name: /Esta semana/ })).toBeChecked();
  });

  test('choosing without a session stores nothing and goes to the sign-in page', async ({ page, context }) => {
    await clearSelectionsOf(account);
    await page.goto('/planner');
    const before = await selectionsOf(account);
    await context.clearCookies();

    await page.getByRole('button', { name: RANDOM }).click();

    await expect(page).toHaveURL('/login');
    expect(await selectionsOf(account)).toBe(before);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('choosing a random menu still works: the form posts and the page shows the choice', async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/planner');

    await expectChoiceShown(page);
  });

  // MF-22.4 tasks 8.6: the search posts and the server answers, with no model call. A request of only spaces passes
  // `required` and is refused on the server before the daily limit. The search still needs `GEMINI_API_KEY` set to
  // start; CI gives it one that is not valid, so a model call would fail this test (`.github/workflows/ci.yml`).
  test('searching still works: the form posts, the server answers and the URL holds no text', async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/planner');

    await page.getByRole('textbox', { name: 'Qué te apetece' }).fill('   ');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByRole('alert')).toHaveText('Escribe qué te apetece.');
    expect(new URL(page.url()).search).toBe('');
  });
});

async function expectChoiceShown(page: Page): Promise<void> {
  await clearSelectionsOf(account);
  await page.goto('/planner');
  await page.getByRole('button', { name: RANDOM }).click();

  const message = page.getByText(CHOSEN);
  await expect(message).toBeVisible();
  const menuNumber = CHOSEN.exec((await message.textContent())!)![1];
  // The random menu goes to the selected week: "Esta semana" now reads its number.
  await expect(page.getByRole('radio', { name: new RegExp(String.raw`Menú ${menuNumber}\b`) }).first()).toBeAttached();
}

async function clearSelectionsOf({ email }: TestAccount): Promise<void> {
  await withDatabase((client) =>
    client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [email]),
  );
}

async function selectionsOf({ email }: TestAccount): Promise<number> {
  return withDatabase(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      'SELECT count(*) FROM selection s JOIN "user" u ON u.id = s.user_id WHERE u.email = $1',
      [email],
    );
    return Number(rows[0]!.count);
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
