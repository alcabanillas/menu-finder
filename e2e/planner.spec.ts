import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { registerTestAccount, signInAs, type TestAccount } from './support/test-account';

// Spec menu-planner (MF-43.2), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// A fictitious menu, so there is at least one to pick (AGENTS.md: never real data). Other menus may exist in the test
// database, so the tests check the shape of the answer, not a fixed number.
const MENU = 9001;
const CHOSEN = /Te ha tocado el menú (\d+): empieza el lunes \d+ de \p{L}+\./u;

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
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
  });

  test('choosing a random menu says which one and shows it in the summary', async ({ page }) => {
    await expectChoiceShown(page);
  });

  test('choosing without a session stores nothing and goes to the sign-in page', async ({ page, context }) => {
    const before = await selectionsOf(account);
    await context.clearCookies();

    await page.getByRole('button', { name: 'Elegir un menú al azar' }).click();

    await expect(page).toHaveURL('/login');
    expect(await selectionsOf(account)).toBe(before);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('choosing a random menu still works: the form posts and the page shows the choice', async ({ page }) => {
    await signInAs(page, account);

    await expectChoiceShown(page);
  });
});

async function expectChoiceShown(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Elegir un menú al azar' }).click();

  const message = page.getByText(CHOSEN);
  await expect(message).toBeVisible();
  const menuNumber = CHOSEN.exec((await message.textContent())!)![1];
  await expect(page.getByText(new RegExp(`^Menú ${menuNumber} · desde el lunes`))).toBeVisible();
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
