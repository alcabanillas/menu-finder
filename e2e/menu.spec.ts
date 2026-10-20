import pg from 'pg';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { newFixtureRun } from './support/fixture-run';
import { registerTestAccount, signInAs } from './support/test-account';

// Spec weekly-menu (MF-23.1), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// The mobile view: MF-23.2 shows a grid from 800 px instead.
test.use({ viewport: { width: 375, height: 812 } });

// A fictitious menu and recipe (AGENTS.md: never real data), with the same dishes every day and a dinner named after
// the day, so any day can be today and switching days shows a change.
// The number and the recipe keys are this run's only, so a parallel run never deletes them (MF-62). Titles stay.
const run = newFixtureRun();
const MENU = run.menuNumber(0);
const RECIPE = run.key('e2e-lentejas-ficticias');
const PLAIN = run.key('dish:Fruta ficticia e2e');
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
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

  test("shows the week of the menu, opened on today's day", async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: `Menú ${MENU}` })).toBeVisible();
    await expect(page.getByText(/^Semana del \d+ de \p{L}+$/u)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Días de la semana' }).getByRole('button')).toHaveCount(7);
    await expect(currentDay(page)).toHaveAccessibleName(new RegExp(`^${DAY_LABELS[todayIndex()]} \\d+ hoy$`));
    await expect(dayHeading(page, todayIndex())).toBeInViewport();
    await expect(daySection(page, todayIndex()).getByText('Lentejas ficticias')).toBeVisible();
  });

  test('takes the page to a day when its button is pressed', async ({ page }) => {
    const other = (todayIndex() + 1) % DAYS.length;

    await page.getByRole('button', { name: new RegExp(`^${DAY_LABELS[other]} `) }).click();

    await expect(currentDay(page)).toHaveAccessibleName(new RegExp(`^${DAY_LABELS[other]} `));
    await expect(dayHeading(page, other)).toBeInViewport();
  });

  test('marks the day in view while the page scrolls', async ({ page }) => {
    const other = (todayIndex() + 2) % DAYS.length;

    await daySection(page, other).evaluate((section) => section.scrollIntoView({ block: 'start' }));

    await expect(currentDay(page)).toHaveAccessibleName(new RegExp(`^${DAY_LABELS[other]} `));
  });

  test('unfolds a recipe and folds it again', async ({ page }) => {
    const dish = daySection(page, todayIndex()).getByRole('button', { name: /Lentejas ficticias/ });

    await dish.click();

    await expect(dish).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('list', { name: 'Ingredientes' }).getByRole('listitem').first()).toHaveText(/Lentejas\s*240 g/);
    await expect(page.getByRole('list', { name: 'Preparación' }).getByRole('listitem')).toHaveCount(2);

    await dish.click();

    await expect(dish).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('list', { name: 'Ingredientes' })).toHaveCount(0);
  });

  test('shows a dish without a recipe as "Sin receta", not as a control', async ({ page }) => {
    const panel = daySection(page, todayIndex());

    await expect(panel.getByText('Fruta ficticia e2e')).toBeVisible();
    await expect(panel.getByText('Sin receta')).toBeVisible();
    await expect(panel.getByRole('button', { name: /Fruta ficticia e2e/ })).toHaveCount(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test("shows every day's dishes in one scroll, with today's button marked", async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');

    await expect(currentDay(page)).toHaveAccessibleName(/ hoy$/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(DAYS.length);
    await expect(page.getByRole('button', { name: /Lentejas ficticias/ })).toHaveCount(DAYS.length);
  });
});

// From an 800 px container, the day cards and the recipe panel (MF-23.2, MF-56).
test.describe('on a desktop screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');
  });

  test('shows the whole week as day cards, with today saying "Hoy", and no day bar', async ({ page }) => {
    const cards = page.getByRole('region');

    await expect(cards).toHaveCount(DAYS.length);
    await expect(cards.nth(todayIndex())).toContainText('Hoy');
    // In the page, not the shell, whose first tab is also "Hoy".
    await expect(page.getByRole('main').getByText('Hoy', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Días de la semana' })).toHaveCount(0);
  });

  test('opens a recipe in a dialog and closes it with Escape, giving the focus back to the dish', async ({ page }) => {
    const dish = page.getByRole('button', { name: 'Lentejas ficticias', exact: true }).nth(todayIndex());

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
      await expect(page.getByRole('region')).toHaveCount(DAYS.length);
      await expect(page.getByRole('button', { name: 'Lentejas ficticias', exact: true })).toHaveCount(DAYS.length);
    });
  });
});

test('another user, with no menu of their own, does not see this one', async ({ page }) => {
  await signInAs(page, otherAccount);
  await page.goto('/menu');

  await expect(page.getByRole('heading', { level: 1, name: 'Semana sin menú' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Esta semana aún no tiene menú');
  await expect(page.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute('href', '/planner?week=current');
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

// The day bar's button marked as the day in view (MF-69).
function currentDay(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Días de la semana' }).locator('button[aria-current="true"]');
}

// A day of the mobile scroll, by its index from Monday: its heading ("Miércoles 7 de octubre") names its section.
function dayHeading(page: Page, index: number): Locator {
  return page.getByRole('heading', { level: 2, name: new RegExp(`^${WEEKDAYS[index]} `) });
}

function daySection(page: Page, index: number): Locator {
  return page.getByRole('region', { name: new RegExp(`^${WEEKDAYS[index]} `) });
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
