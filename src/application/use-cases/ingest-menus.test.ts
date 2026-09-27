import { describe, expect, it } from "vitest";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { SourceMenu } from "@/domain/menu-ingestion/source-menu";
import { err, ok, type Result } from "@/shared/result";
import type { DocumentSource, MenuFolder, SourceError } from "../ports/document-source";
import type { MenuRepository, RepositoryError } from "../ports/menu-repository";
import { ingestMenus } from "./ingest-menus";

type FakeMenu = { menu: SourceMenu; recipeFiles?: string[] } | { error: SourceError };

const folder = (number: number): MenuFolder => ({ number, name: `Menu ${number}` });

const fakeSource = (menus: Record<number, FakeMenu>): DocumentSource => ({
  listMenuFolders: async () => ok(Object.keys(menus).map((key) => folder(Number(key)))),
  readMenu: async ({ number }) => {
    const entry = menus[number];
    return "error" in entry ? err(entry.error) : ok(entry.menu);
  },
  listRecipeFiles: async ({ number }) => {
    const entry = menus[number];
    return "error" in entry ? [] : (entry.recipeFiles ?? []);
  },
});

const missingRawDirectory: DocumentSource = {
  listMenuFolders: async () => err({ kind: "missing-raw-directory", path: "raw" }),
  readMenu: async () => {
    throw new Error("not expected");
  },
  listRecipeFiles: async () => [],
};

const fakeRepository = (result: Result<void, RepositoryError> = ok(undefined)) => {
  const saved: WeeklyMenu[][] = [];
  const repository: MenuRepository = {
    saveAll: async (menus) => {
      saved.push(menus);
      return result;
    },
  };
  return { repository, saved };
};

const lunch = (...dishes: SourceMenu["meals"][number]["dishes"]): SourceMenu => ({
  meals: [{ day: "monday", type: "lunch", dishes }],
});
const EMPTY: FakeMenu = { menu: { meals: [] } };

describe("ingestMenus", () => {
  it("saves the parsed menus in numeric order", async () => {
    const { repository, saved } = fakeRepository();

    await ingestMenus({ source: fakeSource({ 10: EMPTY, 2: EMPTY, 1: EMPTY }), menus: repository });

    expect(saved).toHaveLength(1);
    expect(saved[0].map((menu) => menu.number)).toEqual([1, 2, 10]);
  });

  it("records each menu's source error with its cause and still saves the other menus", async () => {
    const { repository, saved } = fakeRepository();
    const source = fakeSource({
      1: EMPTY,
      2: { error: { kind: "missing-meal-row", meal: "dinner" } },
      3: { error: { kind: "missing-file", file: "menu.pdf" } },
    });

    const result = await ingestMenus({ source, menus: repository });

    expect(saved[0].map((menu) => menu.number)).toEqual([1]);
    expect(result.ok && result.value.failures).toEqual([
      { menu: 2, error: { kind: "missing-meal-row", meal: "dinner" } },
      { menu: 3, error: { kind: "missing-file", file: "menu.pdf" } },
    ]);
    expect(result.ok && [result.value.totals.menusProcessed, result.value.totals.menusFound]).toEqual([1, 3]);
  });

  it("fails without saving when the source is missing", async () => {
    const { repository, saved } = fakeRepository();

    const result = await ingestMenus({ source: missingRawDirectory, menus: repository });

    expect(result).toEqual(err({ kind: "source-unavailable", error: { kind: "missing-raw-directory", path: "raw" } }));
    expect(saved).toEqual([]);
  });

  it("fails without saving when no menu could be parsed", async () => {
    const { repository, saved } = fakeRepository();
    const source = fakeSource({ 1: { error: { kind: "no-table" } } });

    const result = await ingestMenus({ source, menus: repository });

    expect(result).toEqual(err({ kind: "no-menu-parsed", failures: [{ menu: 1, error: { kind: "no-table" } }] }));
    expect(saved).toEqual([]);
  });

  it("fails without saving anything else when there are no menu folders", async () => {
    const { repository, saved } = fakeRepository();

    const result = await ingestMenus({ source: fakeSource({}), menus: repository });

    expect(result).toEqual(err({ kind: "no-menu-parsed", failures: [] }));
    expect(saved).toEqual([]);
  });

  it("reports a repository failure as an error", async () => {
    const { repository } = fakeRepository(err({ kind: "write-failed", reason: "disk full" }));

    const result = await ingestMenus({ source: fakeSource({ 1: EMPTY }), menus: repository });

    expect(result).toEqual(err({ kind: "save-failed", error: { kind: "write-failed", reason: "disk full" } }));
  });

  it("returns one QA row per dish, the unresolved dishes and the totals across menus", async () => {
    const { repository } = fakeRepository();
    const source = fakeSource({
      1: {
        menu: lunch(
          { name: "Merluza al horno", hasRecipeMark: true },
          { name: "Pollo al curry con arroz", hasRecipeMark: true },
        ),
        recipeFiles: ["Merluza-al-horno", "Pollo-con-verduras"],
      },
      2: { menu: lunch({ name: "Pimientos asados", hasRecipeMark: false }), recipeFiles: ["Tarta-de-queso"] },
    });

    const result = await ingestMenus({ source, menus: repository });
    if (!result.ok) throw new Error("expected ok");

    const unresolvedRow = {
      menu: 1,
      day: "monday",
      type: "lunch",
      position: 2,
      dish: "Pollo al curry con arroz",
      hasRecipeMark: true,
      matchedRecipe: null,
      score: null,
      discardedCandidate: "Pollo-con-verduras",
      discardedScore: 0.5,
    };
    expect(result.value.qaRows).toEqual([
      {
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
      },
      unresolvedRow,
      {
        menu: 2,
        day: "monday",
        type: "lunch",
        position: 1,
        dish: "Pimientos asados",
        hasRecipeMark: false,
        matchedRecipe: null,
        score: null,
        discardedCandidate: null,
        discardedScore: null,
      },
    ]);
    expect(result.value.unresolved).toEqual([unresolvedRow]);
    expect(result.value.totals).toEqual({
      menusFound: 2,
      menusProcessed: 2,
      // 13 empty meals per menu.
      emptySlots: 26,
      multiDishSlots: 1,
      resolved: 1,
      unmarked: 1,
      unresolved: 1,
      unclaimedRecipeFiles: 2,
    });
  });
});
