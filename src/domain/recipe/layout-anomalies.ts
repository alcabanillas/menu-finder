/** Something in a recipe document's layout that the reader could not place; the recipe is still read. */
export type LayoutAnomaly =
  | { kind: 'missing-times-section' }
  | { kind: 'missing-closing-line' }
  | { kind: 'missing-preparation-section' }
  | { kind: 'unknown-time-label'; text: string }
  | { kind: 'invalid-time'; label: string; text: string }
  | { kind: 'text-before-first-ingredient'; text: string }
  | { kind: 'amount-without-ingredient'; text: string }
  | { kind: 'name-without-colon'; text: string }
  | { kind: 'ingredient-without-amount'; text: string }
  | { kind: 'unrecognized-amount'; text: string }
  | { kind: 'unexpected-second-page-text'; text: string };
