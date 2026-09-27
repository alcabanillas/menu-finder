// Sorteo reproducible de la muestra de ground truth (EVAL-ground-truth).
// 10 menús (se etiquetan los 5 primeros; los otros 5 solo si da tiempo) y 30 recetas.
// No lee ni escribe ningún JSON de parser: solo lista carpetas y nombres de fichero de
// data/raw, para que el sorteo no contamine el etiquetado ciego.
//
// Uso: pnpm datos:sorteo <semilla> [fichero-de-excluidos]
//   <semilla>             entero; se anota antes de ejecutar (p. ej. 20260927)
//   [fichero-de-excluidos] una línea por ítem ya inspeccionado a mano:
//                          "menu 7" excluye el menú 7; "Alcachofas-rellenas" excluye esa receta
// Salida: data/ground-truth/sorteo.json (gitignoreado, SEG-datos-nutricionista).

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw', 'Dieta');
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'ground-truth');
const NON_RECIPE_FILES = /^(menu|lista_de_la_compra|valoracion.*)$/i;
const MENUS_TO_DRAW = 10;
const RECIPES_TO_DRAW = 30;

// mulberry32: PRNG pequeño y determinista; la misma semilla da siempre el mismo sorteo.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readExclusions(file) {
  if (!file) return { menus: new Set(), recipes: new Set() };
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const menus = new Set();
  const recipes = new Set();
  for (const line of lines) {
    const m = line.match(/^menu\s+(\d+)$/i);
    if (m) menus.add(m[1]);
    else recipes.add(line.replace(/\.pdf$/i, ''));
  }
  return { menus, recipes };
}

function main() {
  const seed = Number.parseInt(process.argv[2], 10);
  if (!Number.isInteger(seed)) {
    console.error('Falta la semilla: node scripts/datos/sorteo-ground-truth.js <semilla> [excluidos.txt]');
    process.exit(1);
  }
  const excluded = readExclusions(process.argv[3]);
  const rand = mulberry32(seed);

  const menuDirs = fs.readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^Menu \d+$/.test(d.name))
    .map((d) => d.name.replace('Menu ', ''))
    .sort((a, b) => Number(a) - Number(b));

  // Una receta cuenta una vez aunque se repita entre menús; se etiqueta la versión del
  // primer menú (el de número más bajo) en el que aparece.
  const recipeByFile = new Map();
  for (const menu of menuDirs) {
    const files = fs.readdirSync(path.join(RAW_DIR, `Menu ${menu}`))
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => f.replace(/\.pdf$/i, ''))
      .filter((f) => !NON_RECIPE_FILES.test(f));
    for (const fichero of files) {
      if (!recipeByFile.has(fichero)) recipeByFile.set(fichero, menu);
    }
  }

  const menus = shuffle(menuDirs.filter((m) => !excluded.menus.has(m)), rand).slice(0, MENUS_TO_DRAW);
  const recipes = shuffle([...recipeByFile.keys()].filter((f) => !excluded.recipes.has(f)).sort(), rand)
    .slice(0, RECIPES_TO_DRAW)
    .map((fichero) => ({ menu: recipeByFile.get(fichero), fichero }));

  const result = {
    seed,
    drawnAt: new Date().toISOString(),
    excluded: { menus: [...excluded.menus], recipes: [...excluded.recipes] },
    menus: { mandatory: menus.slice(0, 5), ifTimeAllows: menus.slice(5) },
    recipes,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'sorteo.json');
  if (fs.existsSync(outFile)) {
    console.error(`Ya existe ${outFile}: el sorteo se hace una vez. Bórralo a mano si de verdad quieres repetirlo.`);
    process.exit(1);
  }
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  console.log(`Semilla ${seed}. Menús obligatorios: ${result.menus.mandatory.join(', ')}`);
  console.log(`Menús si da tiempo: ${result.menus.ifTimeAllows.join(', ')}`);
  console.log(`Recetas (${recipes.length}):`);
  for (const r of recipes) console.log(`  Menu ${r.menu} / ${r.fichero}.pdf`);
  console.log(`Guardado en ${path.relative(process.cwd(), outFile)}`);
}

main();
