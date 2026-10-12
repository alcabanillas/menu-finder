/** Something in a shopping list document's layout that the reader could not place; the list is still read. */
export type ShoppingListAnomaly =
  | { kind: 'line-before-first-category'; text: string }
  | { kind: 'item-without-readable-amount'; text: string }
  | { kind: 'unrecognized-line'; text: string };
