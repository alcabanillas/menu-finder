import { expect, test, type Page } from '@playwright/test';
import { readEnvFile, testDatabaseUrl } from './support/e2e-environment';
import { registerTestAccount } from './support/test-account';

// Spec authentication, MF-20.3, against the test database only (MF-49): the Neon `test` branch locally, `ci` in CI. The
// server gets it from playwright.config.ts; the CLI that creates the account, as every account is, gets the same.
test.skip(!testDatabaseUrl(process.env, readEnvFile()), 'needs the test database; DATABASE_URL_TEST is not set');

const WRONG_CREDENTIALS = 'El correo o la contraseña no coinciden.';
const SESSION_COOKIE = 'better-auth.session_token';
const HOSTILE_VALUES = ["' OR 1=1; --", '🍅@example.test', 'a'.repeat(10_000), 'ana\u0000@example.test'];

const { email, password } = registerTestAccount();

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

  test('the same message twice in a row comes in a new alert, so it is announced again', async ({ page }) => {
    await signIn(page, '/login', email, 'a-wrong-password');
    await formAlert(page).evaluate((alert) => alert.setAttribute('data-first-answer', ''));

    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForLoadState('networkidle');

    await expect(formAlert(page)).toHaveText(WRONG_CREDENTIALS);
    await expect(formAlert(page)).not.toHaveAttribute('data-first-answer');
  });

  test('/login sends a signed-in user to /planner, and / shows them the page "Hoy"', async ({ page }) => {
    await signIn(page, '/login', email, password);

    await page.goto('/login');
    await expect(page).toHaveURL('/planner');
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Hoy' })).toBeVisible();
  });
});

// Without JavaScript the form's own checks do not run, so these values reach the server, which must hold on its own.
// It also proves the form still posts without JavaScript (progressive enhancement, design D2 of MF-47.2).
test.describe('sign-in without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const value of HOSTILE_VALUES) {
    test(`a hostile email (${value.slice(0, 20)}) gets the wrong-credentials message`, async ({ page }) => {
      await signIn(page, '/login', value, password);

      await expect(formAlert(page)).toHaveText(WRONG_CREDENTIALS);
    });
  }
});

test.describe('sign-out', () => {
  // Spec app-shell, "Signing out from the menu" and "A request with no valid session gets no email" (MF-51.2).
  test('from the account menu ends on /, and the old cookie no longer opens /planner nor shows the email', async ({
    page,
    context,
  }) => {
    await signIn(page, '/login', email, password);
    const oldCookies = await context.cookies();

    await page.getByRole('button', { name: 'Cuenta' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/');

    await context.addCookies(oldCookies);
    const refused = await page.request.get('/planner', { maxRedirects: 0 });
    expect(refused.status()).toBe(307);
    expect(refused.headers().location).toContain('/login');
    expect(await refused.text()).not.toContain(email);
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
  await page.getByLabel('Correo electrónico').fill(userEmail);
  await page.getByLabel('Contraseña').fill(userPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForLoadState('networkidle');
}
