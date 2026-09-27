import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { IngestRecipesError, IngestRecipesSummary } from "@/application/dto/ingest-recipes";
import { err, ok, type Result } from "@/shared/result";
import { runIngestRecipes } from "./ingest-recipes";

const DATA_DIR = join("repo", "data");
const QA_DIR = join(DATA_DIR, "qa");
const QA_FILE = join(QA_DIR, "qa-recetas-pdfjs.md");

const SUMMARY: IngestRecipesSummary = {
  perMenu: [
    { menu: 1, files: 2, parsed: 2 },
    { menu: 15, files: 1, parsed: 1 },
  ],
  failures: [],
  anomalies: [{ menu: 15, file: "Tostada-de-prueba", anomaly: { kind: "empty-preparation" } }],
  divergent: [{ file: "Guiso-de-prueba", keptMenu: 15, differingMenus: [1], fields: ["title", "ingredients"] }],
  totals: {
    filesFound: 3,
    filesParsed: 3,
    distinctFiles: 2,
    repeatedFiles: 1,
    divergentFiles: 1,
    divergentByField: { title: 1, times: 0, ingredients: 1, preparation: 0 },
    withTotalTime: 2,
    withPreparation: 1,
    paragraphs: 3,
    ingredients: 7,
    ingredientsWithQuantity: 6,
    optionalIngredients: 2,
    distinctIngredientNames: 5,
    ingredientsByUnit: { g: 5, ml: 1, none: 1 },
  },
};

const WITH_FAILURE: IngestRecipesSummary = {
  ...SUMMARY,
  failures: [{ menu: 5, file: "Crema-de-prueba", error: { kind: "missing-section", section: "ingredients" } }],
};

const setup = (result: Result<IngestRecipesSummary, IngestRecipesError>, qaDir = QA_DIR) => {
  const lines: string[] = [];
  const files = new Map<string, string>();
  const ingestRecipes = vi.fn(async () => result);
  const run = () =>
    runIngestRecipes({
      ingestRecipes,
      print: (line) => lines.push(line),
      writeFile: async (path, content) => {
        files.set(path, content);
      },
      dataDir: DATA_DIR,
      qaDir,
    });
  return { run, lines, files, ingestRecipes };
};

describe("runIngestRecipes", () => {
  it("exits 0 on success, even with anomalies", async () => {
    const { run } = setup(ok(SUMMARY));

    expect(await run()).toBe(0);
  });

  it("prints the totals and the per-menu counts", async () => {
    const { run, lines } = setup(ok(SUMMARY));

    await run();

    expect(lines).toEqual(
      expect.arrayContaining([
        "Recipe files parsed without error: 3/3",
        "Distinct recipe files: 2",
        "Files in two or more menus: 1",
        "Files with divergent versions: 1 (title: 1, times: 0, ingredients: 1, preparation: 0)",
        "Recipes with total time: 2",
        "Recipes with preparation: 1 (3 paragraphs)",
        "Ingredients: 7 (6 with quantity and unit, 2 optional)",
        "Distinct ingredient names: 5",
        "Ingredients per unit: g: 5, ml: 1, none: 1",
        "Menu 1: 2 files, 2 parsed",
        "Menu 15: 1 files, 1 parsed",
      ]),
    );
  });

  it("prints each anomaly with its menu and file", async () => {
    const { run, lines } = setup(ok(SUMMARY));

    await run();

    expect(lines).toContain("Menu 15/Tostada-de-prueba anomaly: empty preparation");
  });

  it("describes every anomaly kind, with its text when there is one", async () => {
    const { run, lines } = setup(
      ok({
        ...SUMMARY,
        anomalies: [
          { kind: "missing-times-section" },
          { kind: "missing-closing-line" },
          { kind: "missing-preparation-section" },
          { kind: "unknown-time-label", text: "Horneado:" },
          { kind: "invalid-time", label: "Total:", text: "1h" },
          { kind: "text-before-first-ingredient", text: "Suelto" },
          { kind: "amount-without-ingredient", text: "(5 g)" },
          { kind: "name-without-colon", text: "Huevo" },
          { kind: "ingredient-without-amount", text: "Huevo:" },
          { kind: "unrecognized-amount", text: "una pizca" },
          { kind: "unexpected-second-page-text", text: "Sigue" },
          { kind: "no-ingredients" },
          { kind: "missing-total-time" },
        ].map((anomaly) => ({ menu: 1, file: "Guiso", anomaly }) as IngestRecipesSummary["anomalies"][number]),
      }),
    );

    await run();

    expect(lines.filter((line) => line.startsWith("Menu 1/Guiso anomaly: "))).toEqual(
      [
        "no TIEMPOS section",
        "no closing line",
        "no PREPARACIÓN section",
        'unknown time label "Horneado:"',
        'invalid time Total: "1h"',
        'text before the first ingredient "Suelto"',
        'amount without ingredient "(5 g)"',
        'ingredient name without colon "Huevo"',
        'ingredient without amount "Huevo:"',
        'unrecognized amount "una pizca"',
        'unexpected text on page 2 "Sigue"',
        "no ingredients",
        "no total time",
      ].map((description) => `Menu 1/Guiso anomaly: ${description}`),
    );
  });

  it("exits 1 and prints the failure with its menu, file and cause", async () => {
    const { run, lines } = setup(ok(WITH_FAILURE));

    expect(await run()).toBe(1);
    expect(lines).toContain("Menu 5/Crema-de-prueba error: missing section (ingredients)");
  });

  it.each<[IngestRecipesError, string]>([
    [{ kind: "source-unavailable", error: { kind: "missing-raw-directory", path: "raw" } }, "Cannot read the recipes: raw directory not found: raw"],
    [
      { kind: "no-recipe-parsed", failures: WITH_FAILURE.failures },
      "No recipe could be parsed.",
    ],
    [{ kind: "save-failed", error: { kind: "write-failed", reason: "disk full" } }, "Cannot save the recipes: disk full"],
  ])("exits 1 on a use-case error (%o) and writes nothing", async (error, message) => {
    const { run, lines, files } = setup(err(error));

    expect(await run()).toBe(1);
    expect(lines).toContain(message);
    expect(files.size).toBe(0);
  });

  it("lists each failure when no recipe could be parsed", async () => {
    const { run, lines } = setup(err({ kind: "no-recipe-parsed", failures: WITH_FAILURE.failures }));

    await run();

    expect(lines).toContain("Menu 5/Crema-de-prueba error: missing section (ingredients)");
  });

  it("writes the QA report with totals, per-menu table, divergent versions, failures and anomalies", async () => {
    const { run, files } = setup(ok(WITH_FAILURE));

    await run();

    const report = files.get(QA_FILE) ?? "";
    expect([...files.keys()]).toEqual([QA_FILE]);
    expect(report).toContain("- Distinct recipe files: 2");
    expect(report).toContain("| 15 | 1 | 1 |");
    expect(report).toContain("| Guiso-de-prueba | 15 | 1 | title, ingredients |");
    expect(report).toContain("- Menu 5/Crema-de-prueba error: missing section (ingredients)");
    expect(report).toContain("- Menu 15/Tostada-de-prueba anomaly: empty preparation");
  });

  it("rejects a QA directory outside the data directory without running or writing", async () => {
    const { run, files, ingestRecipes } = setup(ok(SUMMARY), join(DATA_DIR, "..", "elsewhere"));

    expect(await run()).toBe(1);
    expect(ingestRecipes).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });
});
