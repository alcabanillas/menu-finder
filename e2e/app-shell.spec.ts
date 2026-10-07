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
  for (const [tab, path] of [['Menú', '/menu'], ['Compra', '/shopping-list']]) {
    test(`the ${tab} tab leads to a page inside the shell, marked as current`, async ({ page }) => {
      await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: tab }).click();

      await expect(page).toHaveURL(path);
      await expect(page.getByRole('main').getByRole('heading', { name: tab })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: tab })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }

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
