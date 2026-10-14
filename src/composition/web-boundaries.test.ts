import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// ADR-001 §5: the request headers enter the web at one file, and SEG-sistema-cerrado keeps the sign-up setup out of
// the web. Both are the same ESLint rule, so a file under composition/web/ must get both restrictions at once.
const IMPORTS_BOTH =
  "import { headers } from 'next/headers';\nimport { createAccountCreator } from '@/infrastructure/auth/create-account';\nexport const both = [headers, createAccountCreator];\n";
const LINT_TIMEOUT_MS = 60_000;

describe('what the files of the web composition root may import', () => {
  it(
    'rejects next/headers and the open sign-up setup together in the same file',
    async () => {
      const messages = await lintedMessages('src/composition/web/search-deps.ts');

      expect(messages).toContainEqual(expect.stringContaining('next/headers'));
      expect(messages).toContainEqual(expect.stringContaining('open sign-up'));
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'accepts next/headers in the one file that reads the request headers',
    async () => {
      const messages = await lintedMessages('src/composition/web/request-headers.ts');

      expect(messages).not.toContainEqual(expect.stringContaining('next/headers'));
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'rejects next/headers in web-container.ts, which now receives the headers like any other file',
    async () => {
      const messages = await lintedMessages('src/composition/web-container.ts');

      expect(messages).toContainEqual(expect.stringContaining('next/headers'));
    },
    LINT_TIMEOUT_MS,
  );
});

// import/no-cycle walks the files on disk, and the linted paths do not exist: it would crash, and cycles are not
// what these cases check.
const LAYER_RULES_ONLY = { rules: { 'import/no-cycle': 'off' as const } };

async function lintedMessages(repoPath: string): Promise<string[]> {
  const [result] = await new ESLint({ overrideConfig: LAYER_RULES_ONLY }).lintText(IMPORTS_BOTH, {
    filePath: join(process.cwd(), repoPath),
  });
  return result.messages.map((message) => message.message);
}
