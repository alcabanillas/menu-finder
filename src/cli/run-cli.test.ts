import { describe, expect, it } from "vitest";
import type { CliCommands } from "./run-cli";
import { runCli } from "./run-cli";

const setup = () => {
  const lines: string[] = [];
  let built = 0;
  let menuRuns = 0;
  const createCommands = (): CliCommands => {
    built++;
    return {
      menu: async () => {
        menuRuns++;
        return 0;
      },
    };
  };
  return {
    lines,
    run: (args: string[]) => runCli(args, { createCommands, print: (line) => lines.push(line) }),
    counts: () => ({ built, menuRuns }),
  };
};

describe("runCli", () => {
  it("runs the menu command and returns its exit code", async () => {
    const { run, counts } = setup();

    expect(await run(["menu"])).toBe(0);
    expect(counts()).toEqual({ built: 1, menuRuns: 1 });
  });

  it.each([[[]], [["foo"]], [["menu", "extra"]]])(
    "prints the usage and exits with 2 without building the commands for %j",
    async (args) => {
      const { run, counts, lines } = setup();

      expect(await run(args)).toBe(2);
      expect(lines.join("\n")).toContain("Usage: pnpm ingest menu");
      expect(counts()).toEqual({ built: 0, menuRuns: 0 });
    },
  );
});
