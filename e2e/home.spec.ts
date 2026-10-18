import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { newFixtureRun } from './support/fixture-run';
import { registerTestAccount, signInAs, type TestAccount } from './support/test-account';
import { version } from '../package.json';

// Spec home (MF-25): the informative home of a visitor and the dashboard of a signed-in user, against the test database
// only (MF-49), like the other specs. It also covers the shell's variant with no session, which MF-51.1 built and only
// component tests covered until a route mounted it.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// The dashboard tests share one account and its selection, so they run one after another.
test.describe.configure({ mode: 'serial' });

// A fictitious menu of this run (AGENTS.md: never real data; MF-62), with the same dishes every day, so any day can be
// today, and a two-item list.
const run = newFixtureRun();
const MENU = run.menuNumber(0);
// A dish with no recipe still has a key: `dish:<name>` with no file, as the ingestion stores it (see menu.spec.ts).
const LUNCH = run.key('dish:Comida ficticia e2e');
const DINNER = run.key('dish:Cena ficticia e2e');
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ITEMS = [
  { position: 1, category: 'Legumbres', name: 'Garbanzos ficticios' },
  { position: 2, category: 'Verduras', name: 'Calabacín ficticio' },
];
// This week's Monday in Madrid, where "today" is (menu-selection spec).
const THIS_MONDAY = "date_trunc('week', now() AT TIME ZONE 'Europe/Madrid')::date";
const NEXT_MONDAY = `(${THIS_MONDAY} + 7)`;

const account = registerTestAccount();

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    await client.query(
      `INSERT INTO recipe (key, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation)
       VALUES ($1, NULL, NULL, 'Comida ficticia e2e', NULL, NULL, NULL, NULL, NULL),
              ($2, NULL, NULL, 'Cena ficticia e2e', NULL, NULL, NULL, NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [LUNCH, DINNER],
    );
    await client.query('INSERT INTO menu (number) VALUES ($1) ON CONFLICT DO NOTHING', [MENU]);
    for (const day of DAYS) {
      for (const type of ['lunch', 'dinner']) {
        await client.query('INSERT INTO meal (menu_number, day, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
          MENU,
          day,
          type,
        ]);
      }
      await client.query(
        `INSERT INTO menu_dish (menu_number, day, type, position, name, has_recipe_mark, recipe_key) VALUES
           ($1, $2, 'lunch', 1, 'Comida ficticia e2e', false, $3),
           ($1, $2, 'dinner', 1, 'Cena ficticia e2e', false, $4)
         ON CONFLICT DO NOTHING`,
        [MENU, day, LUNCH, DINNER],
      );
    }
    for (const item of ITEMS) {
      await client.query(
        `INSERT INTO shopping_item (menu_number, position, category, name, quantity, unit, optional)
         VALUES ($1, $2, $3, $4, NULL, NULL, false) ON CONFLICT DO NOTHING`,
        [MENU, item.position, item.category, item.name],
      );
    }
  });
});

// The selections block deleting the menu (their key is not CASCADE); the dishes, items and ticks go with them.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE menu_number = $1', [MENU]);
    await client.query('DELETE FROM menu WHERE number = $1', [MENU]);
    await client.query('DELETE FROM recipe WHERE key = ANY($1::text[])', [[LUNCH, DINNER]]);
  });
});

test.describe('without a session', () => {
  test('a visitor sees the informative home in the shell, and Acceder leads to the sign-in', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Acceder' })).toHaveAttribute('href', '/login');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cuenta' })).toHaveCount(0);
    await expect(page.getByRole('main')).toHaveCount(1);

    await page.getByRole('main').getByRole('link', { name: 'Acceder' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('the response holds no data, no version and no sign-up, also with a forged session cookie', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'better-auth.session_token', value: 'forged.value', url: baseURL! }]);

    const response = await page.request.get('/');
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(body).not.toContain('ficticia e2e');
    expect(body).not.toContain(account.email);
    expect(body).not.toContain(`v${version}`);
    expect(body).not.toMatch(/regístrate|crear cuenta|recuperar/i);
  });
});

test.describe('with a session', () => {
  test('with no menu this week, the dashboard says so and has no list', async ({ page }) => {
    await clearSelectionsOf(account);
    await signInAs(page, account);

    await expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Qué toca hoy' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Esta semana aún no tiene menú');
    await expect(page.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute(
      'href',
      '/planner?week=current',
    );
    await expect(page.getByRole('link', { name: 'Ver menú' })).toHaveCount(0);
    await expect(page.getByText('Aún no hay lista: aparece al elegir un menú.')).toBeVisible();
  });

  test("with only next week's menu, this week is locked and the notice leads to next week", async ({ page }) => {
    await chooseWeek(account, MENU, NEXT_MONDAY);
    await signInAs(page, account);

    await expect(page.getByRole('status')).toContainText('Esta semana no tiene menú');
    await expect(page.getByRole('status')).toContainText(`(Menú ${MENU})`);
    await expect(page.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Ver el menú de la semana que viene' }).click();
    await expect(page).toHaveURL(/\/menu\?startsOn=\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByRole('main')).toContainText('Comida ficticia e2e');
  });

  test("with a menu this week, it shows the menu, today's dishes and the progress, which follows the ticks", async ({
    page,
  }) => {
    await chooseWeek(account, MENU, THIS_MONDAY);
    await signInAs(page, account);

    await expect(page.getByRole('region', { name: 'Semanas' }).getByText(`Menú ${MENU}`)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Semanas' }).getByRole('link', { name: 'Elegir' })).toHaveAttribute(
      'href',
      '/planner?week=next',
    );
    await expect(page.getByRole('link', { name: 'Ver menú' })).toHaveAttribute('href', '/menu');
    await expect(page.getByRole('region', { name: 'Comida' }).getByText('Comida ficticia e2e')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cena' }).getByText('Cena ficticia e2e')).toBeVisible();
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '0 de 2');

    await page.goto('/shopping-list');
    // The server action's own answer: the browser also POSTs to Sentry, which must not count as the tick being saved.
    const answered = page.waitForResponse((response) => response.request().headers()['next-action'] !== undefined);
    await page.getByRole('checkbox', { name: /^Garbanzos ficticios/ }).click();
    await answered;

    await page.goto('/');
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '1 de 2');
    await page.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL('/shopping-list');
  });
});

function progress(page: Page) {
  return page.getByRole('progressbar', { name: 'Marcados' });
}

async function clearSelectionsOf({ email }: TestAccount): Promise<void> {
  await withDatabase((client) =>
    client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [email]),
  );
}

async function chooseWeek({ email }: TestAccount, menuNumber: number, monday: string): Promise<void> {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [email]);
    await client.query(
      `INSERT INTO selection (user_id, menu_number, starts_on)
       SELECT id, $2, ${monday} FROM "user" WHERE email = $1`,
      [email, menuNumber],
    );
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
