import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dos proyectos: la lógica (.test.ts) corre en Node; la UI (.test.tsx), en jsdom con Testing Library.
// Los E2E de Playwright viven en e2e/ y no pasan por Vitest.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
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
