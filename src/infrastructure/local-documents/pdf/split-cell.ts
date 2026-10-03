export type ParsedDish = { name: string; hasRecipeMark: boolean };

// A line ending in one of these words does not close the dish: dish titles use
// Title Case, so a wrapped continuation may also start with an uppercase letter
// ("Ensalada California de" / "Arroz *").
const TRAILING_CONNECTOR = /\b(de|del|con|al|a|en|y|la|el|las|los|sin)$/i;

const RECIPE_MARK = /\*\s*$/;
const STARTS_UPPERCASE = /^[A-ZÁÉÍÓÚÑ]/;

/**
 * Splits a menu cell into dishes. A cell may stack several dishes on separate
 * lines with no explicit separator, so a dish is closed by two signals:
 * a line ending in `*` closes a marked dish, and an uppercase line after
 * unmarked text (unless the previous line ends in a connector word) closes
 * that text as an unmarked dish. Filler is returned as any other unmarked dish.
 */
export function splitCellIntoDishes(cellText: string): ParsedDish[] {
  const lines = cellText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const dishes: ParsedDish[] = [];
  let buffer: string[] = [];

  const closeUnmarked = () => {
    const name = buffer.join(' ').trim();
    buffer = [];
    if (name) dishes.push({ name, hasRecipeMark: false });
  };
  const closeMarked = () => {
    const name = buffer.join(' ').replace(RECIPE_MARK, '').trim();
    buffer = [];
    if (name) dishes.push({ name, hasRecipeMark: true });
  };

  for (const line of lines) {
    const previousLine = buffer.at(-1);
    const startsNewDish =
      previousLine !== undefined && STARTS_UPPERCASE.test(line) && !TRAILING_CONNECTOR.test(previousLine);
    if (startsNewDish) closeUnmarked();
    buffer.push(line);
    if (RECIPE_MARK.test(line)) closeMarked();
  }
  closeUnmarked();
  return dishes;
}
