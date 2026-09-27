import { describe, expect, it } from "vitest";
import type { RecipeContent } from "@/domain/recipe/recipe";
import { selectRecipeVersions } from "./select-versions";

const content: RecipeContent = {
  title: "Tortilla de prueba",
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [{ name: "Huevo", householdMeasure: "2 unidades", quantity: 120, unit: "g", optional: false }],
  preparation: ["Batir.", "Cuajar."],
};

const version = (menu: number, file: string, changes: Partial<RecipeContent> = {}) => ({
  menu,
  file,
  content: { ...content, ...changes },
});

describe("selectRecipeVersions", () => {
  it("keeps the version of the highest menu and lists the differing menu and field", () => {
    const moreSalt = [{ ...content.ingredients[0], quantity: 125 }];

    const selection = selectRecipeVersions([
      version(3, "Tortilla-de-prueba", { ingredients: moreSalt }),
      version(12, "Tortilla-de-prueba"),
    ]);

    expect(selection.recipes).toEqual([{ file: "Tortilla-de-prueba", sourceMenu: 12, ...content }]);
    expect(selection.repeatedFiles).toBe(1);
    expect(selection.divergent).toEqual([
      { file: "Tortilla-de-prueba", keptMenu: 12, differingMenus: [3], fields: ["ingredients"] },
    ]);
  });

  it("does not depend on the order of the versions", () => {
    const selection = selectRecipeVersions([
      version(12, "Tortilla-de-prueba"),
      version(3, "Tortilla-de-prueba", { title: "Otra" }),
    ]);

    expect(selection.recipes[0].sourceMenu).toBe(12);
    expect(selection.divergent[0].differingMenus).toEqual([3]);
  });

  it("counts identical versions as repeated, not divergent", () => {
    const selection = selectRecipeVersions([version(3, "Tortilla-de-prueba"), version(12, "Tortilla-de-prueba")]);

    expect(selection.recipes).toHaveLength(1);
    expect(selection.recipes[0].sourceMenu).toBe(12);
    expect(selection.repeatedFiles).toBe(1);
    expect(selection.divergent).toEqual([]);
  });

  it("lists every differing field and menu, in order", () => {
    const selection = selectRecipeVersions([
      version(20, "Guiso", { preparation: ["Cocer."] }),
      version(2, "Guiso", { times: { ...content.times, total: 40 }, title: "Guiso viejo" }),
      version(9, "Guiso", { preparation: ["Cocer."] }),
    ]);

    expect(selection.divergent).toEqual([
      { file: "Guiso", keptMenu: 20, differingMenus: [2], fields: ["title", "times", "preparation"] },
    ]);
  });

  it("treats a single version as neither repeated nor divergent", () => {
    const selection = selectRecipeVersions([version(1, "Guiso")]);

    expect(selection.repeatedFiles).toBe(0);
    expect(selection.divergent).toEqual([]);
  });

  it("sorts the recipes by file name", () => {
    const selection = selectRecipeVersions([version(1, "Tortilla"), version(1, "Arroz"), version(2, "Merluza")]);

    expect(selection.recipes.map((recipe) => recipe.file)).toEqual(["Arroz", "Merluza", "Tortilla"]);
  });
});
