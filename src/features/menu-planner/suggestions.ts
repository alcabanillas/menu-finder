// Requests to try, all of them queries of the retrieval golden set (`evals/retrieval/queries.json`) that are not
// withdrawn, so each one returns menus; a test checks it. The wording follows the design system's `SUGGESTIONS` (version
// 1792443153-9554) where the set has it.
export const SUGGESTIONS = [
  'de cuchara',
  'algo fresquito',
  'cenas rápidas',
  'para el invierno',
  'sin cerdo',
  'pasta sin queso',
  'cenas que no den mucho trabajo',
  'comida reconfortante',
  'cenas ligeras y rápidas',
  'salmón con verduras',
  'arroz sin carne',
  'ligero',
];

const SHOWN = 4;

/** Four different requests of the list, in the order `random` (a number in [0, 1)) shuffles them; the list is not changed. */
export function pickSuggestions(list: readonly string[], random: () => number): string[] {
  const shuffled = [...list];
  for (let end = shuffled.length - 1; end > 0; end -= 1) {
    const other = Math.floor(random() * (end + 1));
    [shuffled[end], shuffled[other]] = [shuffled[other], shuffled[end]];
  }
  return shuffled.slice(0, SHOWN);
}
