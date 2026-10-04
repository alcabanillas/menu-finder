import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import sonarjs from 'eslint-plugin-sonarjs';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Reglas de dependencia de ADR-001 §3. Si una importación las rompe, el fallo está en el diseño.
const layer = (type) => ({ to: { element: { type } } });
const applicationPart = (...kinds) => ({
  to: { element: { type: 'application', captured: { kind: kinds.length > 1 ? `{${kinds.join(',')}}` : kinds[0] } } },
});
const container = (name) => ({
  to: { element: { type: 'composition', fileInternalPath: `${name}.ts` } },
});

const architecture = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/domain', partialMatch: false },
      { type: 'application', pattern: 'src/application/*', capture: ['kind'], partialMatch: false },
      { type: 'infrastructure', pattern: 'src/infrastructure', partialMatch: false },
      { type: 'composition', pattern: 'src/composition', partialMatch: false },
      { type: 'cli', pattern: 'src/cli', partialMatch: false },
      { type: 'app', pattern: 'src/app', partialMatch: false },
      { type: 'feature', pattern: 'src/features/*', capture: ['feature'], partialMatch: false },
      { type: 'shared-ui', pattern: 'src/shared/ui', partialMatch: false },
      { type: 'shared', pattern: 'src/shared', partialMatch: false },
    ],
  },
  rules: { 'boundaries/dependencies': dependencyRule() },
};

// Tests: same layer rules, plus the test runner. Scoped to test files so that
// production code in domain still cannot import any library.
const architectureTests = {
  files: ['src/**/*.test.{ts,tsx}'],
  rules: {
    'boundaries/dependencies': dependencyRule([
      { from: { element: { type: 'domain' } }, allow: { to: { module: { source: 'vitest' } } } },
    ]),
  },
};

function dependencyRule(extraPolicies = []) {
  return [
    'error',
    {
      default: 'disallow',
      // Sin esto solo se revisan las importaciones locales y domain podría importar librerías.
      checkAllOrigins: true,
      policies: [
        ...extraPolicies,
        // Librerías de terceros y módulos de Node: todas las capas salvo domain.
        {
          from: { element: { type: '!domain' } },
          allow: { to: { module: { origin: '{external,core}' } } },
        },
        { from: { element: { type: 'domain' } }, allow: [layer('domain'), layer('shared')] },
        {
          from: { element: { type: 'application' } },
          allow: [layer('application'), layer('domain'), layer('shared')],
        },
        {
          from: { element: { type: 'infrastructure' } },
          allow: [layer('infrastructure'), applicationPart('ports', 'dto'), layer('domain'), layer('shared')],
        },
        { from: { element: { type: 'composition' } }, allow: { to: { element: { type: '*' } } } },
        {
          from: { element: { type: 'app' } },
          allow: [
            layer('app'),
            container('web-container'),
            applicationPart('dto', 'use-cases'),
            layer('feature'),
            layer('shared-ui'),
            layer('shared'),
          ],
        },
        {
          from: { element: { type: 'cli' } },
          allow: [layer('cli'), container('cli-container'), applicationPart('dto', 'use-cases'), layer('shared')],
        },
        {
          // Scope Rule: una feature solo se importa a sí misma; lo compartido va a shared/ui.
          from: { element: { type: 'feature' } },
          allow: [
            { to: { element: { type: 'feature', captured: { feature: '{{from.element.captured.feature}}' } } } },
            applicationPart('dto'),
            layer('shared-ui'),
            layer('shared'),
          ],
        },
        {
          from: { element: { type: 'shared-ui' } },
          allow: [layer('shared-ui'), applicationPart('dto'), layer('shared')],
        },
        { from: { element: { type: 'shared' } }, allow: layer('shared') },
      ],
    },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accesibilidad: el set recomendado completo de jsx-a11y, como error. eslint-config-next ya registra el plugin y solo
  // activa seis reglas como aviso; registrarlo otra vez falla («Cannot redefine plugin»), así que aquí solo van las reglas.
  {
    files: ['src/**/*.tsx'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Reglas de calidad de Sonar (bugs, code smells, complejidad) en el mismo lint (OPS-calidad).
  // Solo en src/: scripts/datos/ se sustituye por la CLI de ingesta y no se refactoriza.
  {
    ...sonarjs.configs.recommended,
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...sonarjs.configs.recommended.rules,
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-nested-conditional': 'warn',
    },
  },
  // Reglas de la guía Airbnb TypeScript que no son de formato. Las comillas y el ancho de línea siguen la convención del proyecto.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-plusplus': 'error',
      'no-var': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'max-depth': ['error', 3],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: [0, 1, 2, -1], ignoreEnums: true, ignoreReadonlyClassProperties: true, ignoreTypeIndexes: true },
      ],
    },
  },
  // Comillas simples en todo el código (guía Airbnb). avoidEscape deja las dobles cuando el texto lleva comillas simples.
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    plugins: { '@stylistic': stylistic },
    rules: { '@stylistic/quotes': ['error', 'single', { avoidEscape: true }] },
  },
  // Toda función exportada explica qué hace. Los métodos de un adaptador no: su JSDoc está en el puerto que implementa.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, ArrowFunctionExpression: true },
          // Sin esto, --fix inserta un /** */ vacío que calla la regla sin documentar nada.
          enableFixer: false,
        },
      ],
      'jsdoc/require-description': 'error',
    },
  },
  // En los tests, repetir un dato de fixture deja cada caso legible; sacarlo a una constante lo esconde.
  // Los números de un test son datos del caso, no constantes por nombrar.
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { 'sonarjs/no-duplicate-string': 'off', '@typescript-eslint/no-magic-numbers': 'off' },
  },
  architecture,
  architectureTests,
  // MF-20.1: la autenticación con el registro abierto solo existe para la CLI (SEG-sistema-cerrado).
  // composition puede importarlo todo, así que la web se cierra aparte: app/ ya lo impide la regla de capas.
  {
    files: ['src/composition/web-container.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/auth/create-account', '@/infrastructure/auth/create-account'],
              message: 'The web must not build the authentication with open sign-up: only the CLI creates accounts.',
            },
          ],
        },
      ],
    },
  },
  // scripts/datos/ son los scripts CommonJS de generación local de datos (T0).
  // Se sustituyen por la CLI de ingesta (src/cli/); hasta entonces se permite require().
  {
    files: ['scripts/**/*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Informe de cobertura generado (pnpm test:coverage).
    'coverage/**',
  ]),
]);

export default eslintConfig;
