import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dos proyectos: la lógica (.test.ts) corre en Node; la UI (.test.tsx), en jsdom con Testing Library.
// Los E2E de Playwright viven en e2e/ y no pasan por Vitest.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    // Sin umbral todavía: se fija con la primera medición real (OPS-calidad).
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Páginas y rutas de Next.js: las cubre Playwright (E2E).
        "src/app/**",
        // Solo conectan piezas y tocan `process`: los cubre la ejecución real de la CLI.
        "src/cli/index.ts",
        "src/composition/**",
        // Solo tipos: no hay código que ejecutar.
        "src/application/ports/**",
        "src/application/dto/**",
        "src/domain/menu/weekly-menu.ts",
        "src/domain/menu-ingestion/source-menu.ts",
      ],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
