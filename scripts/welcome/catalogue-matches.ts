// The logic of `pnpm welcome:check-samples` (MF-76 design D4): which sample dishes of the home are dishes or recipes of
// the local catalogue. A sample matches when it equals a catalogue name ignoring case and outer spaces.

type CatalogueMenu = { meals: { dishes: unknown }[] };
type CatalogueRecipe = { title: string };

/** The samples that name a dish or a recipe of the catalogue, as written in the samples. */
export function catalogueMatches(samples: string[], names: Set<string>): string[] {
  return samples.filter((sample) => names.has(normalize(sample)));
}

/** Every dish name of the menus and every recipe title, normalized. */
export function catalogueNames(menus: CatalogueMenu[], recipes: CatalogueRecipe[]): Set<string> {
  const dishes = menus.flatMap(({ meals }) => meals.flatMap(({ dishes }) => namesOf(dishes)));
  return new Set([...dishes, ...recipes.map(({ title }) => title)].map(normalize));
}

// A meal without dishes holds a string in the extracted file, not a list.
function namesOf(dishes: unknown): string[] {
  return Array.isArray(dishes) ? dishes.map((dish: { name: string }) => dish.name) : [];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}
