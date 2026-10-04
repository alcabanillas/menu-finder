import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createCliContainer } from '@/composition/cli-container';
import { runEmbed } from '@/cli/commands/embed';
import { runIngestMenu } from '@/cli/commands/ingest-menu';
import { runIngestRecipes } from '@/cli/commands/ingest-recipes';
import { runIngestShoppingList } from '@/cli/commands/ingest-shopping-list';
import { runMigrate } from '@/cli/commands/migrate';
import { runCreateAccount } from '@/cli/commands/create-account';
import { readPassword } from '@/cli/read-password';
import { runSearch } from '@/cli/commands/search';
import { runEvaluateSearch } from '@/cli/commands/evaluate-search';
import { runCli } from '@/cli/run-cli';

// The only file that touches `process`. Secrets come from `.env.local` (git-ignored) or the environment.
try {
  process.loadEnvFile(new URL('../../.env.local', import.meta.url));
} catch (error) {
  if ((error as { code?: unknown }).code !== 'ENOENT') throw error;
}

// The CLI output is the program's result, so it goes to stdout, not to a logger.
const print = (line: string) => process.stdout.write(`${line}\n`);

runCli(process.argv.slice(2), {
  print,
  createCommands: () => {
    const container = createCliContainer(process.env);
    const output = {
      print,
      writeFile: async (path: string, content: string) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content, 'utf8');
      },
    };
    return {
      menu: () => runIngestMenu({ ...container, ...output }),
      recipes: () => runIngestRecipes({ ...container, ...output }),
      migrate: () => runMigrate({ migrate: container.migrate, print }),
      'shopping-list': () => runIngestShoppingList({ ...container, ...output }),
      embed: () => runEmbed({ embedRecipes: container.embedRecipes, print }),
      account: ([email, name]) =>
        runCreateAccount({
          email,
          name,
          // The prompt goes to stderr, so that stdout carries only the result.
          readPassword: () => readPassword({ input: process.stdin, output: process.stderr }),
          createAccount: container.createAccount,
          print,
        }),
      search: ({ file, strategy }) =>
        runSearch({
          file,
          strategy,
          readFile: (path) => readFile(path, 'utf8'),
          searchMenus: container.searchMenus,
          print,
        }),
      'evaluate-search': () =>
        runEvaluateSearch({
          evaluateSearch: container.evaluateSearch,
          reportPath: container.searchReportPath,
          writeFile: output.writeFile,
          print,
        }),
    };
  },
})
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
