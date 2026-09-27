import { describe, expect, it } from "vitest";
import { splitCellIntoDishes } from "./split-cell";

const marked = (name: string) => ({ name, hasRecipeMark: true });
const unmarked = (name: string) => ({ name, hasRecipeMark: false });

describe("splitCellIntoDishes", () => {
  it("splits two marked dishes stacked in one cell", () => {
    expect(splitCellIntoDishes("Lentejas estofadas *\nMerluza al horno *")).toEqual([
      marked("Lentejas estofadas"),
      marked("Merluza al horno"),
    ]);
  });

  it("joins a wrapped dish name that continues in lowercase", () => {
    expect(splitCellIntoDishes("Crema de calabaza\ny zanahoria *")).toEqual([marked("Crema de calabaza y zanahoria")]);
  });

  it("joins a Title Case wrap when the previous line ends in a connector", () => {
    expect(splitCellIntoDishes("Ensalada California de\nArroz *")).toEqual([marked("Ensalada California de Arroz")]);
  });

  it("splits an unmarked dish followed by a marked dish", () => {
    expect(splitCellIntoDishes("Tomate y cebolla asada\nTortilla francesa *")).toEqual([
      unmarked("Tomate y cebolla asada"),
      marked("Tortilla francesa"),
    ]);
  });

  it("keeps unmarked text left at the end of the cell as an unmarked dish", () => {
    expect(splitCellIntoDishes("Merluza al horno *\nPimientos asados")).toEqual([
      marked("Merluza al horno"),
      unmarked("Pimientos asados"),
    ]);
  });

  it("trims lines and ignores blank ones", () => {
    expect(splitCellIntoDishes("  Pasta con pisto *  \n\n   \n")).toEqual([marked("Pasta con pisto")]);
  });

  // Deciding what is filler is not layout: the domain drops it (filler.ts).
  it("returns filler text as an unmarked dish", () => {
    expect(splitCellIntoDishes("Merluza al horno *\nUna pieza de fruta (no zumo).")).toEqual([
      marked("Merluza al horno"),
      unmarked("Una pieza de fruta (no zumo)."),
    ]);
  });

  it.each(["", "   \n  "])("produces no dish for the empty cell %j", (cell) => {
    expect(splitCellIntoDishes(cell)).toEqual([]);
  });
});
