import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import { ok } from "@/shared/result";
import { JsonFileMenuRepository } from "@/infrastructure/json-file/json-file-menu-repository";

const MENU: WeeklyMenu = {
  number: 3,
  meals: [
    {
      day: "monday",
      type: "lunch",
      dishes: [{ position: 1, name: "Lentejas estofadas", hasRecipeMark: true, recipeFile: "Lentejas-estofadas" }],
    },
  ],
};

describe("JsonFileMenuRepository", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "menu-repository-"));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const readSaved = async () => JSON.parse(await readFile(join(dataDir, "menu-platos.json"), "utf8"));

  it("writes menu-platos.json with exactly the weekly menu fields", async () => {
    const result = await new JsonFileMenuRepository(dataDir).saveAll([MENU]);

    expect(result).toEqual(ok(undefined));
    // Fixes the file's keys: renaming an entity field must fail here, not change the file silently.
    expect(await readSaved()).toEqual([
      {
        number: 3,
        meals: [
          {
            day: "monday",
            type: "lunch",
            dishes: [{ position: 1, name: "Lentejas estofadas", hasRecipeMark: true, recipeFile: "Lentejas-estofadas" }],
          },
        ],
      },
    ]);
  });

  it("overwrites a previous file", async () => {
    await writeFile(join(dataDir, "menu-platos.json"), '[{"menu":"1"}]');

    await new JsonFileMenuRepository(dataDir).saveAll([MENU]);

    expect((await readSaved()).map((menu: WeeklyMenu) => menu.number)).toEqual([3]);
  });

  it("returns an error instead of throwing when the file cannot be written", async () => {
    const result = await new JsonFileMenuRepository(join(dataDir, "missing", "dir")).saveAll([MENU]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("write-failed");
  });
});
