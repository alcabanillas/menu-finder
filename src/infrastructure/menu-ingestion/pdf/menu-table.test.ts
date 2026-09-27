import { describe, expect, it } from "vitest";
import { normalizeLabel } from "./menu-table";

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
