export type ClassifyIngredientsSummary = {
  ingredients: number;
  classified: number;
  kept: number;
  model: string;
};

export type ClassifyIngredientsError =
  | { kind: 'recipes-empty' }
  | { kind: 'invalid-classification'; reason: string }
  | { kind: 'classifier-failed'; reason: string }
  | { kind: 'write-failed'; reason: string }
  | { kind: 'read-failed'; reason: string };
