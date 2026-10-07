import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { currentE2eEnvironment } from './e2e-environment';

export type TestAccount = { email: string; password: string };

const DISPLAY_NAME = 'E2E';
const SUFFIX_LENGTH = 8;

/**
 * The account a spec file signs in with: created through the CLI, as every account is, before the file's tests, and
 * deleted after them (MF-49 design D4). Call it at the top level of the file. Each file gets its own account, so files
 * can run in parallel.
 */
export function registerTestAccount(): TestAccount {
  const account = {
    email: `e2e-${Date.now()}-${randomUUID().slice(0, SUFFIX_LENGTH)}@example.test`,
    password: randomUUID(),
  };
  test.beforeAll(() => createAccount(account));
  test.afterAll(() => deleteAccount(account.email));
  return account;
}

/** Signs in through `/login`, as a user does, and waits for the page it lands on. */
export async function signInAs(page: Page, { email, password }: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('/planner');
}

function createAccount({ email, password }: TestAccount): void {
  execSync(`pnpm ingest account ${email} ${DISPLAY_NAME}`, {
    input: `${password}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
    env: { ...process.env, ...currentE2eEnvironment() },
  });
}

// The account goes with its sessions (ON DELETE CASCADE). Exactly one row: the one this run created (MF-49 design D4).
async function deleteAccount(email: string): Promise<void> {
  const client = new pg.Client({ connectionString: currentE2eEnvironment().DATABASE_URL_UNPOOLED });
  await client.connect();
  try {
    const deleted = await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    expect(deleted.rowCount).toBe(1);
    const left = await client.query('SELECT 1 FROM "user" WHERE email = $1', [email]);
    expect(left.rowCount).toBe(0);
  } finally {
    await client.end();
  }
}
