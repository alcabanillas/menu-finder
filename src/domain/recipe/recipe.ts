export type Unit = "g" | "ml" | "kg" | "l";

/** Whole minutes; `null` when the source gives no value. */
export type RecipeTimes = {
  total: number | null;
  preparation: number | null;
  cooking: number | null;
  resting: number | null;
};

export type RecipeIngredient = {
  name: string;
  /** The household measure as written ("1 cucharada", "al gusto"); `null` when there is only the weight. */
  householdMeasure: string | null;
  /** `null` with `unit` when the amount could not be read. */
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

export type RecipeContent = {
  title: string;
  times: RecipeTimes;
  /** In the source's order. */
  ingredients: RecipeIngredient[];
  /** One paragraph per element, in the source's order. */
  preparation: string[];
};

/** One recipe per recipe file: the version kept from the highest-numbered menu. */
export type Recipe = {
  /** Recipe file name without extension; what `MenuDish.recipeFile` points to. */
  file: string;
  /** Menu whose version of the file was kept. */
  sourceMenu: number;
} & RecipeContent;
