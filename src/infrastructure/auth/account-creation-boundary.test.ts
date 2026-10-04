import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// MF-20.1 design D1 (option c): the setup with open sign-up exists only for the CLI.
// Linting a snippet "as if" it were in a given file shows which rules would stop it.
const IMPORTS_OPEN_SETUP =
  "import { createAccountCreator } from '@/infrastructure/auth/create-account';\nexport const creator = createAccountCreator;\n";
const LINT_TIMEOUT_MS = 60_000;

describe('who may build the setup with open sign-up', () => {
  it(
    'rejects the web composition root, which can import everything else',
    async () => {
      const ruleIds = await lintedRuleIds('src/composition/web-container.ts');

      expect(ruleIds).toContain('no-restricted-imports');
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'rejects a route under app/, already closed by the layer rules of ADR-001',
    async () => {
      const ruleIds = await lintedRuleIds('src/app/api/accounts/route.ts');

      expect(ruleIds).toContain('boundaries/dependencies');
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'accepts the CLI composition root',
    async () => {
      const ruleIds = await lintedRuleIds('src/composition/cli-container.ts');

      expect(ruleIds).not.toContain('no-restricted-imports');
      expect(ruleIds).not.toContain('boundaries/dependencies');
    },
    LINT_TIMEOUT_MS,
  );
});

async function lintedRuleIds(repoPath: string): Promise<Array<string | null>> {
  const [result] = await new ESLint().lintText(IMPORTS_OPEN_SETUP, { filePath: join(process.cwd(), repoPath) });
  return result.messages.map((message) => message.ruleId);
}
