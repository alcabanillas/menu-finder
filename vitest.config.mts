import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Dos proyectos: la lógica (.test.ts) corre en Node; la UI (.test.tsx), en jsdom con Testing Library.
// Los E2E de Playwright viven en e2e/ y no pasan por Vitest.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    env: { DATABASE_URL_TEST: process.env.DATABASE_URL_TEST ?? testDatabaseUrl() ?? '' },
    // Drops the test schemas left by runs that were cut short (MF-49).
    globalSetup: ['./src/infrastructure/postgres/drop-stale-test-schemas.setup.ts'],
    // Umbrales por tipo de código (OPS-calidad). La infraestructura no tiene umbral.
    coverage: {
      thresholds: {
        // Lógica de negocio.
        'src/domain/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/application/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
        // Lo que ve el usuario: la UI y la salida de la CLI.
        'src/features/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/shared/ui/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/cli/**': { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        // Páginas y rutas de Next.js: las cubre Playwright (E2E).
        'src/app/**',
        // Solo conectan piezas y tocan `process`: los cubre la ejecución real de la CLI.
        'src/cli/index.ts',
        'src/composition/**',
        // Solo tipos: no hay código que ejecutar.
        'src/application/ports/**',
        'src/application/dto/**',
        'src/domain/menu/weekly-menu.ts',
        'src/domain/menu/source-menu.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          // Creating and migrating a test database is network to Neon: slower than Vitest's defaults (5 s test, 10 s hook).
          hookTimeout: 30_000,
          testTimeout: 30_000,
          // evals/: validación de los golden sets versionados (MF-13). scripts/: tooling del proyecto (MF-39).
          // e2e/support/: pure helpers of the Playwright run (MF-49); the .spec.ts files stay with Playwright.
          include: ['src/**/*.test.ts', 'evals/**/*.test.ts', 'scripts/**/*.test.ts', 'e2e/**/*.test.ts'],
          // Transformed, not loaded as is, so that a test's mock of `next/headers` also reaches the import inside
          // better-auth's `nextCookies` plugin (MF-20.3).
          server: { deps: { inline: ['better-auth'] } },
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});

/** The test branch URL from .env.local. Only this variable passes to the tests: never the production URL or the Gemini key. */
function testDatabaseUrl(): string | undefined {
  const file = new URL('./.env.local', import.meta.url);
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')).DATABASE_URL_TEST : undefined;
}
