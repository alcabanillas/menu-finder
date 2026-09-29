// Carga los 36 menús semanales del dataset local, cada plato con los datos de su receta.
// Lo usan los dos scripts de evaluación: literal-candidates.js y build-golden-set.js.
//
// Un plato queda así:
//   { name, hasRecipe, totalMinutes, ingredients }
//   - hasRecipe: false cuando el menú no enlaza receta (p. ej. "Fruta"): es un plato trivial.
//   - totalMinutes: el tiempo total de la receta, o null si la receta no lo trae (o trae 0).
//   - ingredients: nombres de ingrediente de la receta; [] si no hay receta.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MENUS_FILE = path.join(DATA_DIR, 'menu-platos.json');
const RECIPES_FILE = path.join(DATA_DIR, 'recetas.json');

// Lee un JSON. Si falla, devuelve el error en vez de lanzarlo, para poder
// informar de todos los problemas juntos.
function readJson(file, howToCreate) {
  const name = path.relative(path.join(__dirname, '..', '..'), file).replaceAll('\\', '/');
  if (!fs.existsSync(file)) {
    return { error: `${name}: not found${howToCreate ? `; run \`${howToCreate}\` first` : ''}` };
  }
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { error: `${name}: not valid JSON (${e.message})` };
  }
}

function toDish(menuDish, recipesByFile) {
  const recipe = menuDish.recipeFile ? recipesByFile.get(menuDish.recipeFile) : undefined;
  if (!recipe) {
    return { name: menuDish.name.trim(), hasRecipe: false, totalMinutes: null, ingredients: [] };
  }
  return {
    name: menuDish.name.trim(),
    hasRecipe: true,
    totalMinutes: recipe.times.total || null, // 0 o null: dato que falta
    ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
  };
}

// Devuelve { menus } o { errors }.
// menus = [{ number, meals: [{ day, slot: 'lunch' | 'dinner', dishes: [dish] }] }], ordenados por número.
function loadMenus() {
  const menusFile = readJson(MENUS_FILE, 'pnpm ingest menu');
  const recipesFile = readJson(RECIPES_FILE, 'pnpm ingest recipes');
  const errors = [menusFile.error, recipesFile.error].filter(Boolean);
  if (errors.length > 0) return { errors };

  const recipesByFile = new Map(recipesFile.value.map((recipe) => [recipe.file, recipe]));
  const menus = menusFile.value
    .map((menu) => ({
      number: menu.number,
      meals: menu.meals.map((meal) => ({
        day: meal.day,
        slot: meal.type,
        dishes: meal.dishes.map((dish) => toDish(dish, recipesByFile)),
      })),
    }))
    .sort((a, b) => a.number - b.number);
  return { menus };
}

// Todos los platos de un menú, o solo los de una franja (comida o cena).
function dishesOf(menu, slot) {
  return menu.meals.filter((meal) => !slot || meal.slot === slot).flatMap((meal) => meal.dishes);
}

// Nombres de plato distintos de todo el dataset.
function allDishNames(menus) {
  return new Set(menus.flatMap((menu) => dishesOf(menu).map((dish) => dish.name)));
}

module.exports = { DATA_DIR, readJson, loadMenus, dishesOf, allDishNames };
