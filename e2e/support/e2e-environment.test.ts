import { describe, expect, it } from 'vitest';
import { E2E_PORT, e2eEnvironment } from './e2e-environment';

const TEST_URL = 'postgresql://test:test@ep-test.example.test/db';
const APP_URL = 'postgresql://app:app@ep-app.example.test/db';
const UNREACHABLE = 'postgresql://e2e:e2e@unreachable.invalid:5432/none';

describe('e2eEnvironment', () => {
  it('points both database variables to DATABASE_URL_TEST', () => {
    const env = e2eEnvironment({}, { DATABASE_URL_TEST: TEST_URL });

    expect(env.DATABASE_URL).toBe(TEST_URL);
    expect(env.DATABASE_URL_UNPOOLED).toBe(TEST_URL);
  });

  it('never carries the app database URL of the env file', () => {
    const env = e2eEnvironment(
      {},
      { DATABASE_URL: APP_URL, DATABASE_URL_UNPOOLED: APP_URL, DATABASE_URL_TEST: TEST_URL },
    );

    expect(JSON.stringify(env)).not.toContain(APP_URL);
  });

  it('points both database variables to an unreachable host without DATABASE_URL_TEST', () => {
    const env = e2eEnvironment({}, { DATABASE_URL: APP_URL, DATABASE_URL_UNPOOLED: APP_URL });

    expect(env.DATABASE_URL).toBe(UNREACHABLE);
    expect(env.DATABASE_URL_UNPOOLED).toBe(UNREACHABLE);
    expect(JSON.stringify(env)).not.toContain(APP_URL);
  });

  it('treats an empty DATABASE_URL_TEST as missing', () => {
    const env = e2eEnvironment({ DATABASE_URL_TEST: '' }, {});

    expect(env.DATABASE_URL).toBe(UNREACHABLE);
  });

  it('prefers DATABASE_URL_TEST from the process environment over the env file', () => {
    const env = e2eEnvironment({ DATABASE_URL_TEST: TEST_URL }, { DATABASE_URL_TEST: 'postgresql://other/db' });

    expect(env.DATABASE_URL).toBe(TEST_URL);
  });

  it('sets BETTER_AUTH_URL to the end-to-end port, 3100', () => {
    const env = e2eEnvironment({}, {});

    expect(E2E_PORT).toBe(3100);
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:3100');
  });
});
