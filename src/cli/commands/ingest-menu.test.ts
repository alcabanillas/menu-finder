import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DishQaRow, IngestMenusError, IngestMenusSummary } from "@/application/dto/ingest-menus";
import { err, ok, type Result } from "@/shared/result";
import { runIngestMenu } from "./ingest-menu";

const DATA_DIR = join("repo", "data");
const QA_DIR = join(DATA_DIR, "qa");

const row = (overrides: Partial<DishQaRow>): DishQaRow => ({
  menu: 1,
  day: "monday",
  type: "lunch",
  position: 1,
  dish: "Merluza al horno",
  hasRecipeMark: true,
  matchedRecipe: "Merluza-al-horno",
  score: 1,
  discardedCandidate: null,
  discardedScore: null,
  ...overrides,
});

const UNRESOLVED = row({
  menu: 7,
  day: "tuesday",
  type: "dinner",
  dish: "Pollo al curry",
  matchedRecipe: null,
  score: null,
  discardedCandidate: "Pollo-al-curry",
  discardedScore: 0.5,
});

const summary = (overrides: Partial<IngestMenusSummary> = {}): IngestMenusSummary => ({
  failures: [],
  totals: {
    menusFound: 1,
    menusProcessed: 1,
    emptySlots: 2,
    multiDishSlots: 3,
    resolved: 4,
    unmarked: 5,
    unresolved: 0,
    unclaimedRecipeFiles: 6,
  },
  qaRows: [row({})],
  unresolved: [],
  ...overrides,
});

const run = async (
  result: Result<IngestMenusSummary, IngestMenusError>,
  dirs: { dataDir: string; qaDir: string } = { dataDir: DATA_DIR, qaDir: QA_DIR },
) => {
  const lines: string[] = [];
  const files = new Map<string, string>();
  let ingestCalls = 0;
  const exitCode = await runIngestMenu({
    ingestMenus: async () => {
      ingestCalls++;
      return result;
    },
    print: (line) => lines.push(line),
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    ...dirs,
  });
  const csv = files.get(join(QA_DIR, "menu-platos-pdftable.csv"));
  return { exitCode, output: lines.join("\n"), files, csv, ingestCalls };
};

describe("runIngestMenu", () => {
  it("exits with 0 and writes both QA files when every menu is parsed", async () => {
    const { exitCode, files } = await run(ok(summary()));

    expect(exitCode).toBe(0);
    expect([...files.keys()].sort()).toEqual(
      [join(QA_DIR, "menu-platos-pdftable.csv"), join(QA_DIR, "qa-menu-platos-pdftable.md")].sort(),
    );
  });

  it("prints the summary counters", async () => {
    const { output } = await run(ok(summary()));

    expect(output).toContain("Menus processed without error: 1/1");
    expect(output).toContain("Empty slots: 2");
    expect(output).toContain("Slots with two or more dishes: 3");
    expect(output).toContain("Resolved marked dishes: 4");
    expect(output).toContain("Unmarked dishes: 5");
    expect(output).toContain("Unresolved marked dishes: 0");
    expect(output).toContain("Unclaimed recipe files: 6");
  });

  it("states that there are no unresolved marked dishes", async () => {
    const { output } = await run(ok(summary()));

    expect(output).toContain("No unresolved marked dishes.");
  });

  it("exits with 0 and prints one line per unresolved dish with its discarded candidate", async () => {
    const { exitCode, output } = await run(ok(summary({ qaRows: [UNRESOLVED], unresolved: [UNRESOLVED] })));

    expect(exitCode).toBe(0);
    expect(output).toContain('Unresolved: menu 7, tuesday, dinner, "Pollo al curry" (discarded: Pollo-al-curry, 0.50)');
    expect(output).not.toContain("No unresolved marked dishes.");
  });

  it("prints an unresolved dish with no candidate", async () => {
    const dish = { ...UNRESOLVED, discardedCandidate: null, discardedScore: null };

    const { output } = await run(ok(summary({ qaRows: [dish], unresolved: [dish] })));

    expect(output).toContain('Unresolved: menu 7, tuesday, dinner, "Pollo al curry" (no candidate)');
  });

  it("exits with 1 and prints each menu error with its cause", async () => {
    const { exitCode, output } = await run(
      ok(
        summary({
          failures: [{ menu: 2, error: { kind: "missing-meal-row", meal: "dinner" } }],
          totals: { ...summary().totals, menusFound: 2 },
        }),
      ),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain("Menus processed without error: 1/2");
    expect(output).toContain("Menu 2 error: missing meal row (dinner)");
  });

  it("exits with 1 and writes nothing when the use case fails", async () => {
    const { exitCode, output, files } = await run(
      err({ kind: "no-menu-parsed", failures: [{ menu: 1, error: { kind: "missing-file", file: "menu.pdf" } }] }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain("Menu 1 error: menu.pdf not found");
    expect(output).toContain("No menu could be parsed.");
    expect(files.size).toBe(0);
  });

  it("exits with 1, reports the missing raw directory and writes nothing", async () => {
    const { exitCode, output, files } = await run(
      err({ kind: "source-unavailable", error: { kind: "missing-raw-directory", path: "raw/Dieta" } }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain("raw directory not found: raw/Dieta");
    expect(files.size).toBe(0);
  });

  it("writes the matched recipe only for resolved dishes and the discarded candidate apart", async () => {
    const { csv } = await run(ok(summary({ qaRows: [row({}), UNRESOLVED], unresolved: [UNRESOLVED] })));

    expect(csv?.split("\n")).toEqual([
      '"menu","bloque","dia","plato","tiene_receta_marcada","match_receta","score_match","discarded_candidate","discarded_score"',
      '"1","lunch","monday","Merluza al horno","1","Merluza-al-horno","1.00","",""',
      '"7","dinner","tuesday","Pollo al curry","1","","","Pollo-al-curry","0.50"',
    ]);
  });

  it("rounds scores to two decimals and escapes quotes", async () => {
    const dish = { ...UNRESOLVED, dish: 'Tortilla "francesa"', discardedScore: 2 / 3 };

    const { csv } = await run(ok(summary({ qaRows: [dish], unresolved: [dish] })));

    expect(csv?.split("\n")[1]).toBe('"7","dinner","tuesday","Tortilla ""francesa""","1","","","Pollo-al-curry","0.67"');
  });

  it("rejects a QA directory outside the data directory before ingesting or writing", async () => {
    const { exitCode, files, ingestCalls } = await run(ok(summary()), {
      dataDir: DATA_DIR,
      qaDir: join(DATA_DIR, "..", "outside"),
    });

    expect(exitCode).toBe(1);
    expect(ingestCalls).toBe(0);
    expect(files.size).toBe(0);
  });
});
