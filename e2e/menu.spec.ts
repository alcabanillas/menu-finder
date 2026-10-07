import pg from 'pg';
import { expect, test } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { registerTestAccount, signInAs } from './support/test-account';

// Spec weekly-menu (MF-23.1), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// The mobile view: MF-23.2 shows a grid from 800 px instead.
test.use({ viewport: { width: 375, height: 812 } });

// A fictitious menu and recipe (AGENTS.md: never real data), with the same dishes every day and a dinner named after
// the day, so any day can be today and switching days shows a change.
const MENU = 9002;
const RECIPE = 'e2e-lentejas-ficticias';
const PLAIN = 'dish:Fruta ficticia e2e';
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TAB_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MS_PER_DAY = 86_400_000;

const account = registerTestAccount();
const otherAccount = registerTestAccount();

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    await client.query(
      `INSERT INTO recipe (key, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation)
       VALUES ($1, $1, $2, 'Lentejas ficticias', 45, 10, 35, NULL, $3), ($4, NULL, NULL, 'Fruta ficticia e2e', NULL, NULL, NULL, NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [RECIPE, MENU, ['Sofreír las verduras.', 'Cocer las lentejas.'], PLAIN],
    );
    await client.query(
      `INSERT INTO recipe_ingredient (recipe_key, position, name, household_measure, quantity, unit, optional)
       VALUES ($1, 1, 'Lentejas', NULL, 240, 'g', false), ($1, 2, 'Laurel', 'al gusto', NULL, NULL, true)
       ON CONFLICT DO NOTHING`,
      [RECIPE],
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
           ($1, $2, 'lunch', 1, 'Lentejas ficticias', true, $3),
           ($1, $2, 'lunch', 2, 'Fruta ficticia e2e', false, $4)
         ON CONFLICT DO NOTHING`,
        [MENU, day, RECIPE, PLAIN],
      );
    }
    await client.query(
      `INSERT INTO selection (user_id, menu_number, starts_on)
       SELECT id, $2, $3 FROM "user" WHERE email = $1`,
      [account.email, MENU, thisMonday()],
    );
  });
});

// The selection would block deleting the menu; the accounts and their sessions go with registerTestAccount.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE menu_number = $1', [MENU]);
    await client.query('DELETE FROM menu WHERE number = $1', [MENU]);
    await client.query('DELETE FROM recipe WHERE key = ANY($1::text[])', [[RECIPE, PLAIN]]);
  });
});

test.describe('with an active menu', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');
  });

  test("shows the week of the menu, opened on today's tab", async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: `Menú ${MENU}` })).toBeVisible();
    await expect(page.getByText(/^Semana del \d+ de \p{L}+$/u)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(7);
    await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(new RegExp(`^${todayLabel()} \\d+ hoy$`));
    await expect(page.getByRole('tabpanel').getByText('Lentejas ficticias')).toBeVisible();
  });

  test('shows another day when its tab is selected', async ({ page }) => {
    const other = (todayIndex() + 1) % DAYS.length;
    const dayHeading = page.getByRole('tabpanel').getByRole('heading', { level: 2 });
    const todayHeading = await dayHeading.textContent();

    await page.getByRole('tab', { name: new RegExp(`^${TAB_LABELS[other]} `) }).click();

    await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(new RegExp(`^${TAB_LABELS[other]} `));
    await expect(dayHeading).not.toHaveText(todayHeading!);
  });

  test('unfolds a recipe and folds it again', async ({ page }) => {
    const dish = page.getByRole('tabpanel').getByRole('button', { name: /Lentejas ficticias/ });

    await dish.click();

    await expect(dish).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('list', { name: 'Ingredientes' }).getByRole('listitem').first()).toHaveText(/Lentejas\s*240 g/);
    await expect(page.getByRole('list', { name: 'Preparación' }).getByRole('listitem')).toHaveCount(2);

    await dish.click();

    await expect(dish).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('list', { name: 'Ingredientes' })).toHaveCount(0);
  });

  test('shows a dish without a recipe as "Sin receta", not as a control', async ({ page }) => {
    const panel = page.getByRole('tabpanel');

    await expect(panel.getByText('Fruta ficticia e2e')).toBeVisible();
    await expect(panel.getByText('Sin receta')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Fruta ficticia e2e/ })).toHaveCount(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test("shows today's dishes", async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');

    await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(/ hoy$/);
    await expect(page.getByRole('tabpanel').getByText('Lentejas ficticias')).toBeVisible();
  });
});

// From an 800 px container, the week table and the recipe panel (MF-23.2).
test.describe('on a desktop screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');
  });

  test('shows the whole week as a table, with today marked, and no day tabs', async ({ page }) => {
    const table = page.getByRole('table', { name: 'Menú de la semana' });

    await expect(table.getByRole('columnheader')).toHaveCount(DAYS.length + 1);
    await expect(table.getByRole('columnheader').nth(todayIndex() + 1)).toContainText('hoy');
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('opens a recipe in a dialog and closes it with Escape, giving the focus back to the dish', async ({ page }) => {
    const dish = page.getByRole('table').getByRole('button', { name: 'Lentejas ficticias' }).nth(todayIndex());

    await dish.click();

    const dialog = page.getByRole('dialog', { name: 'Lentejas ficticias' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cerrar receta' })).toBeFocused();
    await expect(dialog.getByRole('list', { name: 'Ingredientes' }).getByRole('listitem').first()).toHaveText(
      /Lentejas\s*240 g/,
    );

    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    await expect(dish).toBeFocused();
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test("still shows every day's dishes", async ({ page }) => {
      await expect(page.getByRole('table').getByRole('button', { name: 'Lentejas ficticias' })).toHaveCount(DAYS.length);
    });
  });
});

test('another user, with no menu of their own, does not see this one', async ({ page }) => {
  await signInAs(page, otherAccount);
  await page.goto('/menu');

  await expect(page.getByText('Todavía no has elegido menú para esta semana.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
  await expect(page.getByText('Lentejas ficticias')).toHaveCount(0);
});

test('opening the menu without a session goes to the sign-in page', async ({ page }) => {
  await page.goto('/menu');

  await expect(page).toHaveURL('/login');
});

// "Today" is the date in Europe/Madrid (ARQ-modelo-datos), as on the server.
function todayInMadrid(): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  return new Date(`${date}T00:00:00Z`);
}

function todayIndex(): number {
  return (todayInMadrid().getUTCDay() + 6) % DAYS.length;
}

function todayLabel(): string {
  return TAB_LABELS[todayIndex()];
}

function thisMonday(): string {
  return new Date(todayInMadrid().getTime() - todayIndex() * MS_PER_DAY).toISOString().slice(0, 10);
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
