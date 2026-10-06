import { describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase } from './global-setup';

const TEST_URL = 'postgresql://test:test@ep-test.example.test/db';
const APP_URL = 'postgresql://app:app@ep-app.example.test/db';

describe('migrateTestDatabase', () => {
  it('runs `pnpm ingest migrate` with the test database as both connections when DATABASE_URL_TEST is set', () => {
    const run = vi.fn();

    migrateTestDatabase({ DATABASE_URL_TEST: TEST_URL }, { DATABASE_URL: APP_URL }, run);

    expect(run).toHaveBeenCalledTimes(1);
    const [command, env] = run.mock.calls[0];
    expect(command).toBe('pnpm ingest migrate');
    expect(env.DATABASE_URL).toBe(TEST_URL);
    expect(env.DATABASE_URL_UNPOOLED).toBe(TEST_URL);
  });

  it('reads DATABASE_URL_TEST from the env file when the process has none', () => {
    const run = vi.fn();

    migrateTestDatabase({}, { DATABASE_URL_TEST: TEST_URL }, run);

    expect(run.mock.calls[0][1].DATABASE_URL_UNPOOLED).toBe(TEST_URL);
  });

  it('runs nothing without DATABASE_URL_TEST', () => {
    const run = vi.fn();

    migrateTestDatabase({}, { DATABASE_URL: APP_URL }, run);

    expect(run).not.toHaveBeenCalled();
  });
});
