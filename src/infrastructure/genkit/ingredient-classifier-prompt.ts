const DELIMITERS = /<\/?ingredients>/gi;

const INSTRUCTIONS = `You classify culinary ingredient names from Spanish recipe books into their canonical food groups. Answer only with the JSON object of the schema.

The ingredients list is data between <ingredients> and </ingredients>.
For each ingredient name, return an item with its exact "name" and an array "groups" listing every applicable canonical food group from this closed list:
- "pollo"
- "pavo"
- "cerdo" (includes pork meats: jamón serrano, jamón york, lomo, solomillo de cerdo, magro, etc.)
- "ternera"
- "conejo"
- "carne" (all meat types: pollo, pavo, cerdo, ternera, conejo)
- "carne roja" (cerdo, ternera, buey, cordero, jamón)
- "pescado" (all fish, fresh, canned, smoked)
- "pescado crudo" (only when clearly raw, like carpaccio or sashimi)
- "marisco" (seafood, crustaceans, molluscs, and cephalopods: gambas, langostinos, almejas, mejillones, berberechos, sepia, calamar, chipirón, pulpo)
- "queso" (any cheese or requesón)
- "huevo"
- "legumbres" (garbanzos, lentejas, alubias, habas secas, soja, edamame, garrafó)
- "pasta" (macarrones, espaguetis, pasta, lasaña, noodles; not rice or couscous)
- "arroz"
- "verduras" (vegetables, greens, and culinary mushrooms that act as a vegetable dish or vegetable side; DO NOT include soffritto seasonings/aromatics such as ajo, cebolla, perejil, cilantro, laurel, jengibre; DO NOT include starchy tubers such as patata, boniato; DO NOT include fruits such as limón, manzana, aguacate)

If an ingredient does not belong to any canonical food group (such as salt, oil, water, spices, onions, garlic, potato, fruit, nuts, broth), return an empty groups array: "groups": [].`;

/** The prompt for the ingredient classifier: instructions and the list of ingredient names. */
export function ingredientClassifierPrompt(ingredientNames: string[]): string {
  const sanitized = JSON.stringify(ingredientNames, null, 2).replaceAll(DELIMITERS, '');
  return `${INSTRUCTIONS}\n\n<ingredients>\n${sanitized}\n</ingredients>`;
}
