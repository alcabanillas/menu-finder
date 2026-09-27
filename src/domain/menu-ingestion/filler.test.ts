import { describe, expect, it } from "vitest";
import { isFiller } from "./filler";

describe("isFiller", () => {
  it.each([
    "Una pieza de fruta (no zumo).",
    "Una pieza de fruta",
    "Un yogur/kéfir sin azúcares añadidos",
    "Yogur/kéfir sin azúcar añadido",
    "Un yogur sin azucares añadidos.",
    "  Una pieza de fruta  ",
  ])("recognises the generic filler %j", (text) => {
    expect(isFiller(text)).toBe(true);
  });

  it.each(["Merluza al horno", "Macedonia de fruta", "Salsa de yogur con pepino"])(
    "does not treat the dish %j as filler",
    (text) => {
      expect(isFiller(text)).toBe(false);
    },
  );
});
