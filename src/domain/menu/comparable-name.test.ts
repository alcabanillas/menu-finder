import { describe, expect, it } from 'vitest';
import { toComparableName } from '@/domain/menu/comparable-name';

describe('toComparableName', () => {
  it.each([
    ['strips accents and lowercases', 'Ñoquis GRATINADOS con Limón', 'noquis gratinados con limon'],
    ['turns non-alphanumerics into spaces', 'Pollo, arroz (y) salsa-verde', 'pollo arroz y salsa verde'],
    ['collapses and trims whitespace', '  Crema   de\tcalabaza \n', 'crema de calabaza'],
    ['keeps digits', 'Ensalada 3 quesos', 'ensalada 3 quesos'],
  ])('%s', (_case, input, expected) => {
    expect(toComparableName(input)).toBe(expected);
  });
});
