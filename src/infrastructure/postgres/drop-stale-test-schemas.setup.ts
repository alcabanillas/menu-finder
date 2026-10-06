import type { TestProject } from 'vitest/node';
import { dropStaleTestSchemas } from '@/infrastructure/postgres/test-database';

/**
 * Vitest global setup, once per run (MF-49 design D5): drops the test schemas that earlier runs, cut short, left on
 * the test database. Does nothing without `DATABASE_URL_TEST`, which `vitest.config.mts` passes to the tests.
 */
export default async function setup(project: TestProject): Promise<void> {
  const url = project.config.env?.DATABASE_URL_TEST;
  if (url) await dropStaleTestSchemas(url, new Date());
}
