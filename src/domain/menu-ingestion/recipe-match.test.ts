import { describe, expect, it } from "vitest";
import { resolveDish } from "./recipe-match";

const marked = (name: string) => ({ name, hasRecipeMark: true });

describe("resolveDish", () => {
  // MF-11: the legacy QA report printed this discarded candidate as a match.
  it("keeps a below-threshold candidate as discarded, not as the recipe", () => {
    const resolution = resolveDish(marked("Pollo al curry con arroz"), ["Pollo-con-verduras"]);

    expect(resolution).toEqual({
      status: "unresolved",
      discarded: { recipe: "Pollo-con-verduras", score: 0.5 },
    });
  });

  it("resolves a marked dish to the best-scoring recipe file", () => {
    const resolution = resolveDish(marked("Merluza al horno"), ["Tarta-de-queso", "Merluza-al-horno-con-verduras"]);

    expect(resolution).toEqual({ status: "resolved", recipe: "Merluza-al-horno-con-verduras", score: 1 });
  });

  it("resolves when the best score is exactly the threshold", () => {
    // 3 of the 5 dish words (longer than two letters) appear in the file name.
    const resolution = resolveDish(marked("Crema de calabaza con jengibre y naranja"), ["Crema-de-calabaza-con-puerro"]);

    expect(resolution).toEqual({ status: "resolved", recipe: "Crema-de-calabaza-con-puerro", score: 0.6 });
  });

  it("compares names without accents, case or punctuation", () => {
    const resolution = resolveDish(marked("Salmón a la PLANCHA, con limón"), ["Salmon-a-la-plancha-con-limon"]);

    expect(resolution).toEqual({ status: "resolved", recipe: "Salmon-a-la-plancha-con-limon", score: 1 });
  });

  it("reports no discarded candidate when the folder has no recipe files", () => {
    expect(resolveDish(marked("Merluza al horno"), [])).toEqual({ status: "unresolved", discarded: null });
  });

  it("reports no discarded candidate when no file shares a word with the dish", () => {
    expect(resolveDish(marked("Merluza al horno"), ["Tarta-de-queso"])).toEqual({
      status: "unresolved",
      discarded: null,
    });
  });

  it("never matches an unmarked dish, even against an identical file name", () => {
    const resolution = resolveDish({ name: "Pimientos asados", hasRecipeMark: false }, ["Pimientos-asados"]);

    expect(resolution).toEqual({ status: "unmarked" });
  });

  it("keeps the first candidate when two files tie", () => {
    const resolution = resolveDish(marked("Lentejas estofadas"), ["Lentejas-estofadas-con-arroz", "Lentejas-estofadas"]);

    expect(resolution).toEqual({ status: "resolved", recipe: "Lentejas-estofadas-con-arroz", score: 1 });
  });

  it.each([
    "Tostada-integral-con-hummus-y-hojas-de-espinacas",
    // Truncated by the file-name length limit, after the known prefix.
    "Tostada-integral-con-hummus-y-hojas-de-espinacas-y-semillas-de-s",
    "Tostada-integral-con-un-poco-de-aceite-de-oliva-virgen",
  ])("never selects the breakfast recipe %j", (breakfastFile) => {
    const dish = marked("Tostada integral con hummus y hojas de espinacas y aceite de oliva virgen");

    expect(resolveDish(dish, [breakfastFile])).toEqual({ status: "unresolved", discarded: null });
  });
});
