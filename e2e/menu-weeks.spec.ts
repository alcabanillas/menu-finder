import pg from 'pg';
import { expect, test } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { registerTestAccount, signInAs } from './support/test-account';

// Spec weekly-menu (MF-55), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// Fictitious menus, one per week, each with a single dish named after its week, so the page's heading and dish say
// which week is on screen. Numbers of their own: menu.spec.ts uses 9002 and removes it in parallel.
const THIS_WEEK = { number: 9011, dish: 'Sopa ficticia de esta semana' };
const LAST_WEEK = { number: 9012, dish: 'Sopa ficticia de la semana pasada' };
const NEXT_WEEK = { number: 9013, dish: 'Sopa ficticia de la semana que viene' };
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MS_PER_DAY = 86_400_000;
const WEEK_MS = 7 * MS_PER_DAY;

const account = registerTestAccount();
const otherAccount = registerTestAccount();

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    for (const week of [THIS_WEEK, LAST_WEEK, NEXT_WEEK]) await insertMenu(client, week.number, week.dish);
    await insertSelection(client, account.email, THIS_WEEK.number, mondayOffset(0));
    await insertSelection(client, account.email, LAST_WEEK.number, mondayOffset(-1));
    await insertSelection(client, account.email, NEXT_WEEK.number, mondayOffset(1));
  });
});

// The selections go with the accounts (ON DELETE CASCADE); the menus are removed here, once nothing points to them.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    const numbers = [THIS_WEEK.number, LAST_WEEK.number, NEXT_WEEK.number];
    await client.query('DELETE FROM selection WHERE menu_number = ANY($1::int[])', [numbers]);
    await client.query('DELETE FROM menu WHERE number = ANY($1::int[])', [numbers]);
    const keys = [THIS_WEEK, LAST_WEEK, NEXT_WEEK].map(({ dish }) => dishKey(dish));
    await client.query('DELETE FROM recipe WHERE key = ANY($1::text[])', [keys]);
  });
});

test.describe('moving between weeks', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');
  });

  test('the back arrow shows last week and its menu', async ({ page }) => {
    await page.getByRole('link', { name: 'Semana anterior' }).click();

    await expect(page).toHaveURL(`/menu?startsOn=${mondayOffset(-1)}`);
    await expect(page.getByRole('heading', { level: 1, name: `Menú ${LAST_WEEK.number}` })).toBeVisible();
    // The phone's day view and the desktop cards both hold the dish; only one of them is shown at this width.
    await expect(page.getByText(LAST_WEEK.dish).and(page.locator(':visible')).first()).toBeVisible();
  });

  test('the next arrow shows next week, and the one after it is disabled', async ({ page }) => {
    await page.getByRole('link', { name: 'Semana siguiente' }).click();

    await expect(page.getByRole('heading', { level: 1, name: `Menú ${NEXT_WEEK.number}` })).toBeVisible();
    await expect(page.locator('[aria-disabled="true"]').filter({ hasText: 'Semana siguiente' })).toBeVisible();
  });

  test('a week with no menu says so, and the back arrow stays enabled over it', async ({ page }) => {
    await page.goto(`/menu?startsOn=${mondayOffset(-2)}`);

    await expect(page.getByText('No se eligió menú para esta semana.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Semana anterior' })).toHaveAttribute(
      'href',
      `/menu?startsOn=${mondayOffset(-3)}`,
    );
    await expect(page.getByRole('link', { name: 'Elegir menú' })).toHaveCount(0);
  });

  test('an invalid startsOn shows this week instead', async ({ page }) => {
    await page.goto('/menu?startsOn=2026-02-30');

    await expect(page.getByRole('heading', { level: 1, name: `Menú ${THIS_WEEK.number}` })).toBeVisible();
  });

  test('a week older than ten weeks is not shown; this week is', async ({ page }) => {
    await page.goto(`/menu?startsOn=${mondayOffset(-11)}`);

    await expect(page.getByRole('heading', { level: 1, name: `Menú ${THIS_WEEK.number}` })).toBeVisible();
  });
});

// A phone: the header stacks, the controls sit under the title, and nothing scrolls sideways.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/menu');
  });

  test('the page does not scroll sideways', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the week controls sit under the title and fit the screen', async ({ page }) => {
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Cambiar de semana' }).boundingBox();

    expect(title && nav).toBeTruthy();
    expect(nav!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
    expect(nav!.x).toBeGreaterThanOrEqual(0);
    expect(nav!.x + nav!.width).toBeLessThanOrEqual(375);
  });

  test('the chevrons are large enough to tap', async ({ page }) => {
    for (const name of ['Semana anterior', 'Semana siguiente']) {
      const box = await page.getByRole('link', { name }).boundingBox();

      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('tapping the back arrow goes to last week', async ({ page }) => {
    await page.getByRole('link', { name: 'Semana anterior' }).tap();

    await expect(page).toHaveURL(`/menu?startsOn=${mondayOffset(-1)}`);
    await expect(page.getByRole('heading', { level: 1, name: `Menú ${LAST_WEEK.number}` })).toBeVisible();
  });

  test('an empty week fits the screen, with its card and day placeholders', async ({ page }) => {
    await page.goto(`/menu?startsOn=${mondayOffset(-2)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByText('No se eligió menú para esta semana.')).toBeVisible();
  });
});

test('another user does not see this account\'s past week', async ({ page }) => {
  await signInAs(page, otherAccount);
  await page.goto(`/menu?startsOn=${mondayOffset(-1)}`);

  await expect(page.getByText('No se eligió menú para esta semana.')).toBeVisible();
  await expect(page.getByText(LAST_WEEK.dish)).toHaveCount(0);
});

// "Today" is the date in Europe/Madrid (ARQ-modelo-datos), as on the server.
function todayInMadrid(): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  return new Date(`${date}T00:00:00Z`);
}

function thisMonday(): string {
  const today = todayInMadrid();
  const sinceMonday = (today.getUTCDay() + 6) % DAYS.length;
  return new Date(today.getTime() - sinceMonday * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The Monday `weeks` weeks away from this one, as `YYYY-MM-DD`. */
function mondayOffset(weeks: number): string {
  return new Date(Date.parse(`${thisMonday()}T00:00:00Z`) + weeks * WEEK_MS).toISOString().slice(0, 10);
}

// A dish without a recipe is keyed `dish:<name>` and has a name-only recipe row, as the menu repository stores it.
function dishKey(dish: string): string {
  return `dish:${dish}`;
}

async function insertMenu(client: pg.Client, number: number, dish: string): Promise<void> {
  await client.query('INSERT INTO recipe (key, title) VALUES ($1, $2) ON CONFLICT DO NOTHING', [dishKey(dish), dish]);
  await client.query('INSERT INTO menu (number) VALUES ($1) ON CONFLICT DO NOTHING', [number]);
  for (const day of DAYS) {
    for (const type of ['lunch', 'dinner']) {
      await client.query('INSERT INTO meal (menu_number, day, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
        number,
        day,
        type,
      ]);
    }
    await client.query(
      `INSERT INTO menu_dish (menu_number, day, type, position, name, has_recipe_mark, recipe_key)
       VALUES ($1, $2, 'lunch', 1, $3, false, $4) ON CONFLICT DO NOTHING`,
      [number, day, dish, dishKey(dish)],
    );
  }
}

async function insertSelection(client: pg.Client, email: string, menuNumber: number, startsOn: string): Promise<void> {
  await client.query(
    `INSERT INTO selection (user_id, menu_number, starts_on)
     SELECT id, $2, $3 FROM "user" WHERE email = $1`,
    [email, menuNumber, startsOn],
  );
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
