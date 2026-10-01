import { describe, expect, it } from "vitest";
import type { MenuDish, WeeklyMenu } from "@/domain/menu/weekly-menu";
import {
  embeddingDocument,
  embeddingSource,
  missingRecipes,
  recipeKeyOf,
} from "@/domain/search-index/recipe-rows";

const dish = (name: string, recipeFile: string | null, position = 1): MenuDish => ({
  position,
  name,
  hasRecipeMark: recipeFile !== null,
  recipeFile,
});

const menu = (number: number, dishes: MenuDish[]): WeeklyMenu => ({
  number,
  meals: [{ day: "monday", type: "lunch", dishes }],
});

describe("recipeKeyOf", () => {
  it("is the recipe file for a dish with one", () => {
    expect(recipeKeyOf(dish("Tortilla de patata", "Tortilla"))).toBe("Tortilla");
  });

  it("is one key per dish name for a dish without recipe file", () => {
    expect(recipeKeyOf(dish("Fruta", null))).toBe("dish:Fruta");
    expect(recipeKeyOf(dish("Fruta", null, 2))).toBe(recipeKeyOf(dish("Fruta", null)));
  });
});

describe("missingRecipes", () => {
  it("lists every dish whose recipe file is not known, with its menu", () => {
    const menus = [
      menu(1, [dish("Tortilla de patata", "Tortilla"), dish("Fruta", null, 2)]),
      menu(2, [dish("Crema", "Crema"), dish("Lentejas", "Lentejas", 2)]),
    ];

    expect(missingRecipes(menus, new Set(["Tortilla"]))).toEqual([
      { menu: 2, dish: "Crema", file: "Crema" },
      { menu: 2, dish: "Lentejas", file: "Lentejas" },
    ]);
  });

  it("is empty when every recipe file is known", () => {
    expect(missingRecipes([menu(1, [dish("Tortilla de patata", "Tortilla")])], new Set(["Tortilla"]))).toEqual([]);
  });
});

describe("embeddingDocument", () => {
  it("is the title and the ingredient names", () => {
    expect(embeddingDocument("Tortilla de patata", ["huevo", "patata"])).toEqual({
      title: "Tortilla de patata",
      content: "huevo, patata",
    });
  });

  it("repeats the title as content when there are no ingredients", () => {
    expect(embeddingDocument("Fruta", [])).toEqual({ title: "Fruta", content: "Fruta" });
  });

  it("has a source text that changes when the title or the ingredients change", () => {
    const base = embeddingSource({ title: "Tortilla", content: "huevo" });

    expect(embeddingSource({ title: "Tortilla", content: "huevo" })).toBe(base);
    expect(embeddingSource({ title: "Tortilla", content: "huevo, patata" })).not.toBe(base);
    expect(embeddingSource({ title: "Tortilla francesa", content: "huevo" })).not.toBe(base);
  });
});
