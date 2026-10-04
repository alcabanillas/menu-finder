import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Spec authentication, MF-20.3, against the database the app uses (`.env.local`, the Neon development branch). CI has
// no database until MF-44, so these run locally only. The account is created by the CLI, as every account is.
test.skip(!!process.env.CI, 'needs the database of the app; CI has none until MF-44');

const WRONG_CREDENTIALS = 'El email o la contraseña no son correctos.';
const SESSION_COOKIE = 'better-auth.session_token';
const HOSTILE_VALUES = ["' OR 1=1; --", '🍅@example.test', 'a'.repeat(10_000), 'ana\u0000@example.test'];

const email = `e2e-${Date.now()}@example.test`;
const password = randomUUID();

test.beforeAll(() => {
  execSync(`pnpm ingest account ${email} E2E`, { input: `${password}\n`, stdio: ['pipe', 'ignore', 'inherit'] });
});

test.describe('sign-in', () => {
  for (const path of ['/login', '/']) {
    test(`from ${path}, correct credentials land on /planner with an HttpOnly session cookie`, async ({ page }) => {
      await signIn(page, path, email, password);

      await expect(page).toHaveURL('/planner');
      await expect(page.getByRole('heading', { name: 'Hola, E2E' })).toBeVisible();
      const cookie = (await page.context().cookies()).find(({ name }) => name === SESSION_COOKIE);
      expect(cookie?.httpOnly).toBe(true);
    });
  }

  test('a wrong password and an unknown email show the same message', async ({ page }) => {
    await signIn(page, '/login', email, 'a-wrong-password');
    const wrongPassword = await formAlert(page).textContent();

    await signIn(page, '/login', 'nobody@example.test', password);
    const unknownEmail = await formAlert(page).textContent();

    expect(wrongPassword).toBe(WRONG_CREDENTIALS);
    expect(unknownEmail).toBe(wrongPassword);
    await expect(page).toHaveURL('/login');
  });

  test('a redirect target in the URL is ignored', async ({ page }) => {
    await page.goto('/login?next=https://evil.example&callbackURL=https://evil.example&returnTo=https://evil.example');
    await fillAndSubmit(page, email, password);

    await expect(page).toHaveURL('/planner');
  });

  for (const value of HOSTILE_VALUES) {
    test(`a hostile email (${value.slice(0, 20)}) gets the wrong-credentials message`, async ({ page }) => {
      await page.goto('/login');
      // The browser would block a malformed email before sending it; the server must hold on its own.
      await page.locator('form').evaluate((form: HTMLFormElement) => {
        form.noValidate = true;
      });
      await fillAndSubmit(page, value, password);

      await expect(formAlert(page)).toHaveText(WRONG_CREDENTIALS);
    });
  }

  test('/ and /login send a signed-in user to /planner', async ({ page }) => {
    await signIn(page, '/login', email, password);

    await page.goto('/');
    await expect(page).toHaveURL('/planner');
    await page.goto('/login');
    await expect(page).toHaveURL('/planner');
  });
});

test.describe('sign-out', () => {
  test('ends on /, and the old cookie no longer opens /planner', async ({ page, context }) => {
    await signIn(page, '/login', email, password);
    const oldCookies = await context.cookies();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/');

    await context.addCookies(oldCookies);
    await page.goto('/planner');
    await expect(page).toHaveURL('/login');
  });
});

// Next.js adds its own role=alert (the route announcer), so the message is looked for inside the form.
function formAlert(page: Page) {
  return page.locator('form').getByRole('alert');
}

async function signIn(page: Page, path: string, userEmail: string, userPassword: string): Promise<void> {
  await page.goto(path);
  await fillAndSubmit(page, userEmail, userPassword);
}

async function fillAndSubmit(page: Page, userEmail: string, userPassword: string): Promise<void> {
  await page.getByLabel('Email').fill(userEmail);
  await page.getByLabel('Contraseña').fill(userPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForLoadState('networkidle');
}
