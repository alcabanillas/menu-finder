import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createCliContainer } from "@/composition/cli-container";
import { runIngestMenu } from "./commands/ingest-menu";
import { runCli } from "./run-cli";

// The only file that touches `process`.
const print = (line: string) => console.log(line);

runCli(process.argv.slice(2), {
  print,
  createCommands: () => {
    const container = createCliContainer();
    return {
      menu: () =>
        runIngestMenu({
          ...container,
          print,
          writeFile: async (path, content) => {
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, content, "utf8");
          },
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
