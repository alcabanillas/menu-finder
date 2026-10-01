import { describe, expect, it } from "vitest";
import type { MenuDish, WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Recipe } from "@/domain/recipe/recipe";
import { buildSearchDataset, embeddingDocument, embeddingSource, type IndexedRecipe } from "@/domain/search-index/search-dataset";

const dish = (name: string, recipeFile: string | null, position = 1): MenuDish => ({
  position,
  name,
  hasRecipeMark: recipeFile !== null,
  recipeFile,
});

const menu = (number: number, lunch: MenuDish[], dinner: MenuDish[] = []): WeeklyMenu => ({
  number,
  meals: [
    { day: "monday", type: "lunch", dishes: lunch },
    { day: "monday", type: "dinner", dishes: dinner },
  ],
});

const recipe = (file: string, title: string, ingredients: string[] = ["Huevo"]): Recipe => ({
  file,
  sourceMenu: 1,
  title,
  times: { total: 20, preparation: 5, cooking: 15, resting: null },
  ingredients: ingredients.map((name) => ({ name, householdMeasure: null, quantity: 100, unit: "g", optional: false })),
  preparation: ["Batir.", "Cuajar."],
});

const build = (menus: WeeklyMenu[], recipes: Recipe[]) => {
  const result = buildSearchDataset(menus, recipes);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
};

describe("buildSearchDataset", () => {
  it("points every dish with a recipe file to that recipe", () => {
    const dataset = build([menu(1, [dish("Tortilla", "Tortilla-de-patata")])], [recipe("Tortilla-de-patata", "Tortilla de patata")]);

    expect(dataset.menus[0].meals[0].dishes[0]).toMatchObject({ name: "Tortilla", recipeKey: "Tortilla-de-patata" });
    expect(dataset.recipes).toEqual([
      expect.objectContaining({ key: "Tortilla-de-patata", file: "Tortilla-de-patata", title: "Tortilla de patata" }),
    ]);
  });

  it("keeps the recipe text whole: times, ingredients and preparation in order", () => {
    const source = recipe("Tortilla-de-patata", "Tortilla de patata", ["Huevo", "Patata"]);

    const [indexed] = build([], [source]).recipes;

    expect(indexed).toEqual({
      key: "Tortilla-de-patata",
      file: "Tortilla-de-patata",
      sourceMenu: 1,
      title: source.title,
      times: source.times,
      ingredients: source.ingredients,
      preparation: ["Batir.", "Cuajar."],
    });
  });

  it("makes one name-only recipe per distinct dish name without a recipe file", () => {
    const dataset = build([menu(1, [dish("Fruta", null)]), menu(2, [dish("Fruta", null)], [dish("Yogur", null)])], []);

    expect(dataset.recipes).toEqual([
      { key: "dish:Fruta", file: null, sourceMenu: null, title: "Fruta", times: null, ingredients: [], preparation: null },
      { key: "dish:Yogur", file: null, sourceMenu: null, title: "Yogur", times: null, ingredients: [], preparation: null },
    ]);
    expect(dataset.menus.map((m) => m.meals[0].dishes[0].recipeKey)).toEqual(["dish:Fruta", "dish:Fruta"]);
  });

  it("points two dishes that share a recipe file to the same recipe row", () => {
    const dataset = build(
      [menu(1, [dish("Crema de calabaza", "Crema")]), menu(2, [dish("Crema", "Crema")])],
      [recipe("Crema", "Crema de calabaza")],
    );

    expect(dataset.recipes).toHaveLength(1);
    expect(dataset.menus.map((m) => m.meals[0].dishes[0].recipeKey)).toEqual(["Crema", "Crema"]);
  });

  it("keeps a recipe that no menu uses", () => {
    expect(build([], [recipe("Suelta", "Receta suelta")]).recipes.map((r) => r.key)).toEqual(["Suelta"]);
  });

  it("keeps the menus, meals and dish positions as they are", () => {
    const dataset = build([menu(3, [dish("Sopa", null, 1), dish("Pan", null, 2)], [dish("Pescado", null)])], []);

    expect(dataset.menus).toEqual([
      {
        number: 3,
        meals: [
          {
            day: "monday",
            type: "lunch",
            dishes: [
              { position: 1, name: "Sopa", hasRecipeMark: false, recipeKey: "dish:Sopa" },
              { position: 2, name: "Pan", hasRecipeMark: false, recipeKey: "dish:Pan" },
            ],
          },
          {
            day: "monday",
            type: "dinner",
            dishes: [{ position: 1, name: "Pescado", hasRecipeMark: false, recipeKey: "dish:Pescado" }],
          },
        ],
      },
    ]);
  });

  it("sorts the recipes by key, so that two runs give the same rows", () => {
    const dataset = build([menu(1, [dish("Zumo", null)])], [recipe("B", "Be"), recipe("A", "A")]);

    expect(dataset.recipes.map((r) => r.key)).toEqual(["A", "B", "dish:Zumo"]);
  });

  it("rejects every dish that names an unknown recipe file, with its menu", () => {
    const result = buildSearchDataset(
      [menu(4, [dish("Guiso", "Guiso-perdido")], [dish("Tortilla", "Tortilla")]), menu(9, [dish("Otro", "Nada")])],
      [recipe("Tortilla", "Tortilla")],
    );

    expect(result).toEqual({
      ok: false,
      error: [
        { menu: 4, dish: "Guiso", file: "Guiso-perdido" },
        { menu: 9, dish: "Otro", file: "Nada" },
      ],
    });
  });
});

describe("embeddingDocument", () => {
  const indexed = (changes: Partial<IndexedRecipe>): IndexedRecipe => ({
    key: "Tortilla",
    file: "Tortilla",
    sourceMenu: 1,
    title: "Tortilla de patata",
    times: null,
    ingredients: [],
    preparation: ["Batir los huevos.", "Cuajar."],
    ...changes,
  });

  it("is the title and the ingredient names, and never the preparation", () => {
    const document = embeddingDocument(indexed({ ingredients: recipe("x", "x", ["huevo", "patata"]).ingredients }));

    expect(document).toEqual({ title: "Tortilla de patata", content: "huevo, patata" });
    expect(JSON.stringify(document)).not.toContain("Batir");
  });

  it("repeats the title as content for a recipe without ingredients", () => {
    expect(embeddingDocument(indexed({ key: "dish:Fruta", title: "Fruta", preparation: null }))).toEqual({
      title: "Fruta",
      content: "Fruta",
    });
  });

  it("has a source text that changes when the title or the ingredients change", () => {
    const base = embeddingSource({ title: "Tortilla", content: "huevo" });

    expect(embeddingSource({ title: "Tortilla", content: "huevo" })).toBe(base);
    expect(embeddingSource({ title: "Tortilla", content: "huevo, patata" })).not.toBe(base);
    expect(embeddingSource({ title: "Tortilla francesa", content: "huevo" })).not.toBe(base);
  });
});
