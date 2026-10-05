import { expect, test } from '@playwright/test';

// Spec authentication, MF-20.3. None of these reaches the database: with no cookie, or one whose signature is wrong,
// the library answers "no session" before any query. So they run in CI, where there is no database (until MF-44).

const SESSION_COOKIE = 'better-auth.session_token';

test.describe('without a session', () => {
  test('/planner sends the browser to /login and shows nothing of the page', async ({ page }) => {
    await page.goto('/planner');

    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Hola,')).toHaveCount(0);
  });

  test('/planner with a forged session cookie sends the browser to /login', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: SESSION_COOKIE, value: 'forged.value', url: baseURL! }]);

    await page.goto('/planner');

    await expect(page).toHaveURL('/login');
  });

  test('the response for /planner is a redirect, without the body of the page', async ({ request }) => {
    const response = await request.get('/planner', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/login');
    expect(await response.text()).not.toContain('Hola,');
  });

  for (const path of ['/', '/login']) {
    test(`${path} shows the sign-in form, with no sign-up or recovery`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByLabel('Correo electrónico')).toBeVisible();
      await expect(page.getByLabel('Contraseña')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
      await expect(page.getByText(/registr|crear cuenta|olvid|recuperar/i)).toHaveCount(0);
    });
  }
});

test.describe('no authentication endpoint is exposed', () => {
  for (const path of ['sign-up/email', 'sign-in/email', 'update-user', 'list-sessions']) {
    test(`/api/auth/${path} answers 404`, async ({ request }) => {
      const response = await request.post(`/api/auth/${path}`, {
        data: { email: 'ana@example.test', password: 'a-long-enough-pass', name: 'Ana' },
      });

      expect(response.status()).toBe(404);
    });
  }
});
