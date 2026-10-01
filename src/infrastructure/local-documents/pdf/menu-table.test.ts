import { describe, expect, it } from "vitest";
import { err } from "@/shared/result";
import { normalizeLabel, toSourceMenu } from "@/infrastructure/local-documents/pdf/menu-table";

describe("normalizeLabel", () => {
  it.each([
    ["strips accents and lowercases", "MIÉRCOLES", "miercoles"],
    ["collapses and trims whitespace", "  Sábado \n", "sabado"],
    ["keeps punctuation", "Comida:", "comida:"],
    ["treats a missing cell as empty", undefined, ""],
  ])("%s", (_case, input, expected) => {
    expect(normalizeLabel(input)).toBe(expected);
  });
});

const HEADER = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const row = (label: string, ...cells: string[]) => [label, ...cells];

describe("toSourceMenu", () => {
  it("reads the Comida and Cena rows, mapping Lunes..Domingo to monday..sunday", () => {
    const table = [
      row("Desayuno", "Tostada *", "", "", "", "", "", ""),
      HEADER,
      row("Comida", "Lentejas estofadas *", "", "", "", "", "Merluza al horno *", ""),
      row("Media tarde", "Una pieza de fruta", "", "", "", "", "", ""),
      row("Cena", "", "Pimientos asados", "", "", "", "", ""),
    ];

    const result = toSourceMenu(table);
    if (!result.ok) throw new Error("expected ok");

    const withDishes = result.value.meals.filter((meal) => meal.dishes.length > 0);
    expect(withDishes).toEqual([
      { day: "monday", type: "lunch", dishes: [{ name: "Lentejas estofadas", hasRecipeMark: true }] },
      { day: "saturday", type: "lunch", dishes: [{ name: "Merluza al horno", hasRecipeMark: true }] },
      { day: "tuesday", type: "dinner", dishes: [{ name: "Pimientos asados", hasRecipeMark: false }] },
    ]);
  });

  it("lists every day and meal, with no dishes for empty or missing cells", () => {
    const table = [HEADER, row("Comida", "Lentejas estofadas *"), row("Cena")];

    const result = toSourceMenu(table);
    if (!result.ok) throw new Error("expected ok");

    expect(result.value.meals).toHaveLength(14);
    const sunday = result.value.meals.filter((meal) => meal.day === "sunday");
    expect(sunday).toEqual([
      { day: "sunday", type: "lunch", dishes: [] },
      { day: "sunday", type: "dinner", dishes: [] },
    ]);
  });

  it("splits each cell into its ordered dishes", () => {
    const table = [HEADER, row("Comida", "Lentejas estofadas *\nMerluza al horno *"), row("Cena")];

    const result = toSourceMenu(table);
    if (!result.ok) throw new Error("expected ok");

    expect(result.value.meals[0].dishes.map((dish) => dish.name)).toEqual(["Lentejas estofadas", "Merluza al horno"]);
  });

  it("recognises labels with different accents and case", () => {
    const table = [
      ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"],
      row("comida", "Lentejas estofadas *"),
      row("CENA"),
    ];

    expect(toSourceMenu(table).ok).toBe(true);
  });

  it("fails with missing-header when no row lists Lunes..Domingo", () => {
    const table = [["", "Lunes", "Martes"], row("Comida"), row("Cena")];

    expect(toSourceMenu(table)).toEqual(err({ kind: "missing-header" }));
  });

  it.each([
    ["dinner", [HEADER, row("Comida")]],
    ["lunch", [HEADER, row("Cena")]],
  ] as const)("fails naming the missing %s row", (meal, table) => {
    expect(toSourceMenu(table.map((cells) => [...cells]))).toEqual(err({ kind: "missing-meal-row", meal }));
  });
});
