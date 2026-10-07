import pg from 'pg';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { currentE2eEnvironment, readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { registerTestAccount, signInAs, type TestAccount } from './support/test-account';

// Spec shopping-checklist (MF-24), against the test database only (MF-49), like the other specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

// The tests share one account and its ticks, so they run one after another, each from a fresh selection.
test.describe.configure({ mode: 'serial' });

// Fictitious menus and items (AGENTS.md: never real data). MENU has the list; OTHER_MENU only replaces it.
const MENU = 9101;
const OTHER_MENU = 9102;
const ITEMS = [
  { position: 1, category: 'Legumbres', name: 'Garbanzos cocidos', quantity: 400, unit: 'g', optional: false },
  { position: 2, category: 'Legumbres', name: 'Piñones', quantity: 20, unit: 'g', optional: true },
  { position: 3, category: 'Lácteos', name: 'Leche', quantity: 1000, unit: 'ml', optional: false },
  { position: 4, category: 'Especias', name: 'Comino', quantity: null, unit: null, optional: false },
];

// This week's Monday in Madrid, where "today" is (menu-selection spec).
const THIS_MONDAY = "date_trunc('week', now() AT TIME ZONE 'Europe/Madrid')::date";

const account = registerTestAccount();

test.beforeAll(async () => {
  await withDatabase(async (client) => {
    await client.query('INSERT INTO menu (number) VALUES ($1), ($2) ON CONFLICT DO NOTHING', [MENU, OTHER_MENU]);
    await client.query('DELETE FROM shopping_item WHERE menu_number = $1', [MENU]);
    for (const item of ITEMS) {
      await client.query(
        `INSERT INTO shopping_item (menu_number, position, category, name, quantity, unit, optional)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [MENU, item.position, item.category, item.name, item.quantity, item.unit, item.optional],
      );
    }
  });
});

// The selections block deleting the menus (their key is not CASCADE); the items and ticks go with them.
test.afterAll(async () => {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE menu_number = ANY($1::int[])', [[MENU, OTHER_MENU]]);
    await client.query('DELETE FROM menu WHERE number = ANY($1::int[])', [[MENU, OTHER_MENU]]);
  });
});

test.beforeEach(async () => {
  await chooseThisWeek(account, MENU);
});

test.describe('with a session', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/shopping-list');
  });

  test('shows the current list grouped by category, with amounts and the optional mark', async ({ page }) => {
    await expect(page.getByText(`Menú ${MENU}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lista de la compra' })).toBeVisible();
    await expect(row(page, 'Garbanzos cocidos')).toHaveAccessibleName('Garbanzos cocidos 400 g');
    await expect(row(page, 'Piñones')).toHaveAccessibleName('Piñones opcional 20 g');
    await expect(row(page, 'Comino')).toHaveAccessibleName('Comino');
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '0 de 4');
  });

  test('a ticked item stays ticked after a reload, and unticking removes it', async ({ page }) => {
    await tick(page, row(page, 'Garbanzos cocidos'));
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '1 de 4');

    await page.reload();
    await expect(row(page, 'Garbanzos cocidos')).toHaveAttribute('aria-checked', 'true');
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '1 de 4');

    await tick(page, row(page, 'Garbanzos cocidos'));
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '0 de 4');
    await page.reload();
    await expect(row(page, 'Garbanzos cocidos')).toHaveAttribute('aria-checked', 'false');
  });

  test('ticking a category ticks every item of it and nothing else', async ({ page }) => {
    await tick(page, page.getByRole('checkbox', { name: 'Marcar todos: Legumbres' }));
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '2 de 4');

    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Marcar todos: Legumbres' })).toHaveAttribute('aria-checked', 'true');
    await expect(row(page, 'Leche')).toHaveAttribute('aria-checked', 'false');
  });

  test('"Por comprar" hides the ticked items and keeps counting every item', async ({ page }) => {
    await tick(page, row(page, 'Garbanzos cocidos'));
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '1 de 4');

    await page.getByRole('link', { name: 'Por comprar' }).click();

    await expect(page).toHaveURL('/shopping-list?vista=por-comprar');
    await expect(row(page, 'Garbanzos cocidos')).toHaveCount(0);
    await expect(row(page, 'Piñones')).toBeVisible();
    await expect(progress(page)).toHaveAttribute('aria-valuetext', '1 de 4');
  });

  test('a list that changed while the page was open stores nothing and asks to reload', async ({ page }) => {
    await chooseThisWeek(account, OTHER_MENU);

    await row(page, 'Leche').click();

    // Next.js has its own empty alert (the route announcer), so the alert is found by its text.
    await expect(page.getByRole('alert').filter({ hasText: 'La lista ha cambiado. Recarga la página.' })).toBeVisible();
    expect(await ticksOf(account)).toBe(0);
  });

  test('ticking without a session stores nothing and goes to the sign-in page', async ({ page, context }) => {
    await context.clearCookies();

    await row(page, 'Leche').click();

    await expect(page).toHaveURL('/login');
    expect(await ticksOf(account)).toBe(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('ticking an item still works: the form posts and the page shows it ticked', async ({ page }) => {
    await signInAs(page, account);
    await page.goto('/shopping-list');

    await row(page, 'Leche').click();

    await expect(row(page, 'Leche')).toHaveAttribute('aria-checked', 'true');
    await page.goto('/shopping-list');
    await expect(row(page, 'Leche')).toHaveAttribute('aria-checked', 'true');
  });
});

test('without a session the page goes to the sign-in page', async ({ page }) => {
  await page.goto('/shopping-list');

  await expect(page).toHaveURL('/login');
});

function row(page: Page, name: string) {
  return page.getByRole('checkbox', { name: new RegExp(`^${name}`) });
}

// The tick shows at once (optimistic); wait for the server action's answer before reloading, or the reload cancels it.
async function tick(page: Page, checkbox: Locator): Promise<void> {
  const answered = page.waitForResponse((response) => response.request().method() === 'POST');
  await checkbox.click();
  await answered;
}

function progress(page: Page) {
  return page.getByRole('progressbar', { name: 'Marcados' });
}

// A fresh selection of this week replaces the account's earlier one, so its ticks go with it (ON DELETE CASCADE).
async function chooseThisWeek({ email }: TestAccount, menuNumber: number): Promise<void> {
  await withDatabase(async (client) => {
    await client.query('DELETE FROM selection WHERE user_id = (SELECT id FROM "user" WHERE email = $1)', [email]);
    await client.query(
      `INSERT INTO selection (user_id, menu_number, starts_on)
       SELECT id, $2, ${THIS_MONDAY} FROM "user" WHERE email = $1`,
      [email, menuNumber],
    );
  });
}

async function ticksOf({ email }: TestAccount): Promise<number> {
  return withDatabase(async (client) => {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*) FROM user_shopping_item t
         JOIN selection s ON s.id = t.selection_id
         JOIN "user" u ON u.id = s.user_id
        WHERE u.email = $1 AND t.checked`,
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
