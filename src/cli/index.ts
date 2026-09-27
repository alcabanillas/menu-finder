import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createCliContainer } from "@/composition/cli-container";
import { runIngestMenu } from "./commands/ingest-menu";
import { runIngestRecipes } from "./commands/ingest-recipes";
import { runCli } from "./run-cli";

// The only file that touches `process`.
const print = (line: string) => console.log(line);

runCli(process.argv.slice(2), {
  print,
  createCommands: () => {
    const container = createCliContainer();
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
