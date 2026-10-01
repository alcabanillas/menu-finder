import { describe, expect, it } from "vitest";
import type { CliCommands } from "@/cli/run-cli";
import { runCli } from "@/cli/run-cli";

const setup = () => {
  const lines: string[] = [];
  let built = 0;
  let menuRuns = 0;
  let recipesRuns = 0;
  let migrateRuns = 0;
  let embedRuns = 0;
  const createCommands = (): CliCommands => {
    built++;
    return {
      menu: async () => {
        menuRuns++;
        return 0;
      },
      recipes: async () => {
        recipesRuns++;
        return 1;
      },
      migrate: async () => {
        migrateRuns++;
        return 0;
      },
      embed: async () => {
        embedRuns++;
        return 1;
      },
    };
  };
  return {
    lines,
    run: (args: string[]) => runCli(args, { createCommands, print: (line) => lines.push(line) }),
    counts: () => ({ built, menuRuns, recipesRuns, migrateRuns, embedRuns }),
  };
};

describe("runCli", () => {
  it("runs the menu command and returns its exit code", async () => {
    const { run, counts } = setup();

    expect(await run(["menu"])).toBe(0);
    expect(counts()).toEqual({ built: 1, menuRuns: 1, recipesRuns: 0, migrateRuns: 0, embedRuns: 0 });
  });

  it("runs the recipes command and returns its exit code", async () => {
    const { run, counts } = setup();

    expect(await run(["recipes"])).toBe(1);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 1, migrateRuns: 0, embedRuns: 0 });
  });

  it("runs the migrate command and returns its exit code", async () => {
    const { run, counts } = setup();

    expect(await run(["migrate"])).toBe(0);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 0, migrateRuns: 1, embedRuns: 0 });
  });

  it("runs the embed command and returns its exit code", async () => {
    const { run, counts } = setup();

    expect(await run(["embed"])).toBe(1);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 0, migrateRuns: 0, embedRuns: 1 });
  });

  it.each([[[]], [["foo"]], [["menu", "extra"]], [["recipes", "extra"]], [["migrate", "extra"]], [["embed", "--force"]]])(
    "prints the usage and exits with 2 without building the commands for %j",
    async (args) => {
      const { run, counts, lines } = setup();

      expect(await run(args)).toBe(2);
      expect(lines.join("\n")).toContain("Usage: pnpm ingest <migrate|recipes|menu|embed>");
      expect(counts()).toEqual({ built: 0, menuRuns: 0, recipesRuns: 0, migrateRuns: 0, embedRuns: 0 });
    },
  );

  it("lists every command in the usage", async () => {
    const { run, lines } = setup();

    await run(["foo"]);

    expect(lines.some((line) => line.trim().startsWith("menu "))).toBe(true);
    expect(lines.some((line) => line.trim().startsWith("recipes "))).toBe(true);
    expect(lines.some((line) => line.trim().startsWith("migrate "))).toBe(true);
    expect(lines.some((line) => line.trim().startsWith("embed "))).toBe(true);
  });
});
