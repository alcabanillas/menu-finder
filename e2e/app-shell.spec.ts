import { expect, test, type Page } from '@playwright/test';
import { readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { signInAs, registerTestAccount } from './support/test-account';

// Spec app-shell (MF-51.1), against the test database only (MF-49), like the sign-in specs.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

const WIDE = { width: 1024, height: 768 };
const NARROW = { width: 375, height: 812 };
const TABS = ['Hoy', 'Buscar', 'Menú', 'Compra'];

const account = registerTestAccount();

test.describe('with a session', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, account);
  });

  test('a protected page has the shell: wordmark, navigation and one main landmark', async ({ page }) => {
    await expect(page.getByRole('banner').getByRole('link', { name: 'Menu Finder' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Hola, E2E' })).toBeVisible();
  });

  test('the four links are in order and only the current route is marked', async ({ page }) => {
    await expectTabs(page);
  });

  test('on a wide screen the tabs are inside the header and the navigation appears once', async ({ page }) => {
    await page.setViewportSize(WIDE);

    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1);
    await expect(page.getByRole('banner').getByRole('navigation', { name: 'Principal' })).toBeVisible();
    for (const tab of TABS) await expect(page.getByRole('banner').getByRole('link', { name: tab })).toBeVisible();
  });

  test('on a narrow screen the tabs are at the bottom, below the content, and the navigation appears once', async ({ page }) => {
    await page.setViewportSize(NARROW);

    const navigation = page.getByRole('navigation', { name: 'Principal' });
    await expect(navigation).toHaveCount(1);
    await expect(page.getByRole('banner').getByRole('navigation')).toHaveCount(0);
    for (const tab of TABS) await expect(navigation.getByRole('link', { name: tab })).toBeVisible();
    const heading = await page.getByRole('heading', { name: 'Hola, E2E' }).boundingBox();
    const bar = await navigation.boundingBox();
    expect(bar!.y).toBeGreaterThan(heading!.y);
  });

  // Spec app-shell, "The home of a signed-in user has the shell".
  test('the home has the shell, with Hoy marked as current', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Hoy' })).toBeVisible();
    const links = page.getByRole('navigation', { name: 'Principal' }).getByRole('link');
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'page');
    for (const index of [1, 2, 3]) await expect(links.nth(index)).not.toHaveAttribute('aria-current');
  });

  // Spec app-shell, "The Menú and Compra tabs lead to a page".
  // `/menu` heads with its menu number when there is one ("Menú 3"); `/shopping-list` with "Lista de la compra".
  for (const [tab, path, heading] of [
    ['Menú', '/menu', /^Menú/],
    ['Compra', '/shopping-list', /^Lista de la compra$/],
  ] as const) {
    test(`the ${tab} tab leads to a page inside the shell, marked as current`, async ({ page }) => {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: tab }).click();

      await expect(page).toHaveURL(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: tab })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }

  // Spec app-shell, the account menu (MF-51.2). "Signing out from the menu" is in sign-in.spec.ts, with the sign-out flow.
  test('the account menu is closed by default', async ({ page }) => {
    await expect(accountButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  });

  test('the home of a signed-in user has the menu too, and opening it shows the email and the sign-out control', async ({ page }) => {
    await page.goto('/');

    await expect(accountButton(page)).toHaveAttribute('aria-expanded', 'false');
    await accountButton(page).click();
    await expect(page.getByText(account.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('opening the menu shows the email and the sign-out control, and no user id', async ({ page }) => {
    await accountButton(page).click();

    await expect(accountButton(page)).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator(`#${await accountButton(page).getAttribute('aria-controls')}`);
    await expect(panel).toHaveText(`${account.email}Cerrar sesión`);
  });

  test('Escape closes the panel and returns the focus to the button', async ({ page }) => {
    await accountButton(page).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).focus();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
    await expect(accountButton(page)).toBeFocused();
  });

  test('a click outside closes the panel', async ({ page }) => {
    await accountButton(page).click();

    await page.getByRole('heading', { name: 'Hola, E2E' }).click();

    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  });

  test('on a narrow screen the account button is in the header and the panel fits in the viewport', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await accountButton(page).click();

    const panel = await page.getByRole('button', { name: 'Cerrar sesión' }).locator('xpath=../..').boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(NARROW.width);
  });

  test('the skip link is the first stop of the keyboard and moves the focus to the content', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });
});

test.describe('with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('the four links are in the page and the current route is marked', async ({ page }) => {
    await signInAs(page, account);

    await expectTabs(page);
  });
});

test.describe('without a session', () => {
  for (const path of ['/', '/login']) {
    test(`${path} has no shell`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    });
  }
});

function accountButton(page: Page) {
  return page.getByRole('banner').getByRole('button', { name: 'Cuenta' });
}

async function expectTabs(page: Page): Promise<void> {
  const links = page.getByRole('navigation', { name: 'Principal' }).getByRole('link');
  await expect(links).toHaveText(TABS);
  await expect(links).toHaveCount(TABS.length);
  await expect(links.nth(0)).toHaveAttribute('href', '/');
  await expect(links.nth(1)).toHaveAttribute('href', '/planner');
  await expect(links.nth(2)).toHaveAttribute('href', '/menu');
  await expect(links.nth(3)).toHaveAttribute('href', '/shopping-list');
  await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
  for (const index of [0, 2, 3]) await expect(links.nth(index)).not.toHaveAttribute('aria-current');
}
