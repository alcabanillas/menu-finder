import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import sonarjs from "eslint-plugin-sonarjs";

// Reglas de dependencia de ADR-001 §3. Si una importación las rompe, el fallo está en el diseño.
const layer = (type) => ({ to: { element: { type } } });
const applicationPart = (...kinds) => ({
  to: { element: { type: "application", captured: { kind: kinds.length > 1 ? `{${kinds.join(",")}}` : kinds[0] } } },
});
const container = (name) => ({
  to: { element: { type: "composition", fileInternalPath: `${name}.ts` } },
});

const architecture = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "boundaries/elements": [
      { type: "domain", pattern: "src/domain", partialMatch: false },
      { type: "application", pattern: "src/application/*", capture: ["kind"], partialMatch: false },
      { type: "infrastructure", pattern: "src/infrastructure", partialMatch: false },
      { type: "composition", pattern: "src/composition", partialMatch: false },
      { type: "cli", pattern: "src/cli", partialMatch: false },
      { type: "app", pattern: "src/app", partialMatch: false },
      { type: "feature", pattern: "src/features/*", capture: ["feature"], partialMatch: false },
      { type: "shared-ui", pattern: "src/shared/ui", partialMatch: false },
      { type: "shared", pattern: "src/shared", partialMatch: false },
    ],
  },
  rules: { "boundaries/dependencies": dependencyRule() },
};

// Tests: same layer rules, plus the test runner. Scoped to test files so that
// production code in domain still cannot import any library.
const architectureTests = {
  files: ["src/**/*.test.{ts,tsx}"],
  rules: {
    "boundaries/dependencies": dependencyRule([
      { from: { element: { type: "domain" } }, allow: { to: { module: { source: "vitest" } } } },
    ]),
  },
};

function dependencyRule(extraPolicies = []) {
  return [
    "error",
    {
      default: "disallow",
      // Sin esto solo se revisan las importaciones locales y domain podría importar librerías.
      checkAllOrigins: true,
      policies: [
        ...extraPolicies,
        // Librerías de terceros y módulos de Node: todas las capas salvo domain.
        {
          from: { element: { type: "!domain" } },
          allow: { to: { module: { origin: "{external,core}" } } },
        },
        { from: { element: { type: "domain" } }, allow: [layer("domain"), layer("shared")] },
        {
          from: { element: { type: "application" } },
          allow: [layer("application"), layer("domain"), layer("shared")],
        },
        {
          from: { element: { type: "infrastructure" } },
          allow: [layer("infrastructure"), applicationPart("ports", "dto"), layer("domain"), layer("shared")],
        },
        { from: { element: { type: "composition" } }, allow: { to: { element: { type: "*" } } } },
        {
          from: { element: { type: "app" } },
          allow: [
            layer("app"),
            container("web-container"),
            applicationPart("dto", "use-cases"),
            layer("feature"),
            layer("shared-ui"),
            layer("shared"),
          ],
        },
        {
          from: { element: { type: "cli" } },
          allow: [layer("cli"), container("cli-container"), applicationPart("dto", "use-cases"), layer("shared")],
        },
        {
          // Scope Rule: una feature solo se importa a sí misma; lo compartido va a shared/ui.
          from: { element: { type: "feature" } },
          allow: [
            { to: { element: { type: "feature", captured: { feature: "{{from.element.captured.feature}}" } } } },
            applicationPart("dto"),
            layer("shared-ui"),
            layer("shared"),
          ],
        },
        {
          from: { element: { type: "shared-ui" } },
          allow: [layer("shared-ui"), applicationPart("dto"), layer("shared")],
        },
        { from: { element: { type: "shared" } }, allow: layer("shared") },
      ],
    },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Reglas de calidad de Sonar (bugs, code smells, complejidad) en el mismo lint (OPS-calidad).
  // Solo en src/: scripts/datos/ se sustituye por la CLI de ingesta y no se refactoriza.
  {
    ...sonarjs.configs.recommended,
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      ...sonarjs.configs.recommended.rules,
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-duplicate-string": ["error", { threshold: 3 }],
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-nested-conditional": "warn",
    },
  },
  // En los tests, repetir un dato de fixture deja cada caso legible; sacarlo a una constante lo esconde.
  { files: ["src/**/*.test.{ts,tsx}"], rules: { "sonarjs/no-duplicate-string": "off" } },
  architecture,
  architectureTests,
  // scripts/datos/ son los scripts CommonJS de generación local de datos (T0).
  // Se sustituyen por la CLI de ingesta (src/cli/); hasta entonces se permite require().
  {
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Informe de cobertura generado (pnpm test:coverage).
    "coverage/**",
  ]),
]);

export default eslintConfig;
