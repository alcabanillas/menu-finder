import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createCliContainer } from "@/composition/cli-container";
import { runIngestMenu } from "./commands/ingest-menu";
import { runIngestRecipes } from "./commands/ingest-recipes";
import { runLoad, runMigrate } from "./commands/search-index";
import { runCli } from "./run-cli";

// The only file that touches `process`. Secrets come from `.env.local` (git-ignored) or the environment.
try {
  process.loadEnvFile(new URL("../../.env.local", import.meta.url));
} catch (error) {
  if ((error as { code?: unknown }).code !== "ENOENT") throw error;
}

const print = (line: string) => console.log(line);

runCli(process.argv.slice(2), {
  print,
  createCommands: () => {
    const container = createCliContainer(process.env);
    const output = {
      print,
      writeFile: async (path: string, content: string) => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content, "utf8");
      },
    };
    return {
      menu: () => runIngestMenu({ ...container, ...output }),
      recipes: () => runIngestRecipes({ ...container, ...output }),
      migrate: () => runMigrate({ migrate: container.migrate, print }),
      load: () => runLoad({ loadSearchIndex: container.loadSearchIndex, print }),
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
