// Propone candidatos para las consultas literales del golden set (MF-12, spec retrieval-golden-set).
// El autor los revisa a mano (✅/❌) y esa revisión es la verdad de las literales.
//
// A propósito es MÁS amplio que el buscador léxico que se va a medir: compara por subcadena,
// sin tildes ni mayúsculas y en singular. Así "salmón" también encuentra "Salmonete", y es el
// autor quien lo descarta. Si el generador fuera igual que el buscador, el golden set daría
// siempre la razón al buscador léxico.
//
// Uso: pnpm evals:literal-candidates   (sin argumentos)
// Entrada: evals/retrieval/queries.json (las consultas con regla "literal") y el dataset de data/.
// Salida: data/golden/literal-candidates.md (gitignoreado: dice qué platos tiene cada menú).
// Nunca sobrescribe una revisión existente.

const fs = require('fs');
const path = require('path');
const { readJson, loadMenus, dishesOf } = require('./dataset');

const ROOT = path.join(__dirname, '..', '..');
const QUERIES_FILE = path.join(ROOT, 'evals', 'retrieval', 'queries.json');
const REVIEW_FILE = path.join(ROOT, 'data', 'golden', 'literal-candidates.md');

// ---------------------------------------------------------------------------
// Normalización del texto: "Judías Verdes" → ["judia", "verd"]
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'a', 'al', 'en']);

function withoutAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Singular aproximado: "garbanzos" → "garbanzo", "verdes" → "verd".
function singular(word) {
  if (word.endsWith('es') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function termsOf(queryText) {
  return withoutAccents(queryText)
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map(singular);
}

function containsAll(text, terms) {
  const normalized = withoutAccents(text);
  return terms.every((term) => normalized.includes(term));
}

// ---------------------------------------------------------------------------
// Coincidencias de un plato con una consulta
// ---------------------------------------------------------------------------

// Devuelve la coincidencia del plato, o null si no coincide:
//   grade 2 → todos los términos en el nombre del plato
//   grade 1 → solo aparecen si se añaden los ingredientes
//   grade 0 → casi: solo el primer término ("Sardinas con tomate" para "sardinas en lata")
function matchDish(dish, terms) {
  const nameAndIngredients = `${dish.name} ${dish.ingredients.join(' ')}`;

  if (containsAll(dish.name, terms)) return { grade: 2, dish: dish.name };

  if (containsAll(nameAndIngredients, terms)) {
    const matchedIngredients = dish.ingredients.filter((ingredient) =>
      terms.some((term) => withoutAccents(ingredient).includes(term)),
    );
    return { grade: 1, dish: dish.name, matchedIngredients };
  }

  const isMultiWord = terms.length > 1;
  if (isMultiWord && containsAll(nameAndIngredients, terms.slice(0, 1))) {
    return { grade: 0, dish: dish.name, nearMiss: true };
  }
  return null;
}

// Los menús que tienen al menos un plato candidato, con la nota del mejor.
function candidatesFor(query, menus) {
  const terms = termsOf(query.text);
  const candidates = [];
  for (const menu of menus) {
    const matches = dishesOf(menu)
      .map((dish) => matchDish(dish, terms))
      .filter(Boolean);
    if (matches.length > 0) {
      candidates.push({ menu: menu.number, grade: Math.max(...matches.map((m) => m.grade)), matches });
    }
  }
  return { query, terms, candidates };
}

// ---------------------------------------------------------------------------
// Fichero de revisión (Markdown)
// ---------------------------------------------------------------------------

function formatMatch(match) {
  if (match.nearMiss) return `  - (0? near miss) ${match.dish}`;
  const ingredients = match.matchedIngredients ? ` — ingredient: ${match.matchedIngredients.join('; ')}` : '';
  return `  - (${match.grade}) ${match.dish}${ingredients}`;
}

function formatQuery({ query, terms, candidates }) {
  const lines = [`## ${query.id} "${query.text}" — ${candidates.length} menus (stems: ${terms.join(', ')})`, ''];
  if (candidates.length === 0) lines.push('_No candidates: every menu gets 0._');
  for (const candidate of candidates) {
    lines.push(`- [ ] **Menu ${candidate.menu} → ${candidate.grade}**`);
    lines.push(...candidate.matches.map(formatMatch));
  }
  return lines.join('\n');
}

function formatReview(results) {
  const header = [
    '# Literal candidates — review',
    '',
    'Rule: **2** = term in the dish name · **1** = only in ingredients. ' +
      'Mark each line ✅ keep / ❌ reject / change the grade. Menus not listed = 0.',
  ].join('\n');
  return [header, ...results.map(formatQuery)].join('\n\n') + '\n';
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function fail(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

function main(args) {
  if (args.length > 0) fail('Usage: pnpm evals:literal-candidates   (takes no arguments)', 2);

  if (fs.existsSync(REVIEW_FILE)) {
    fail('data/golden/literal-candidates.md already exists: it holds the author\'s review, so it is not overwritten.');
  }

  const queriesFile = readJson(QUERIES_FILE);
  const dataset = loadMenus();
  const errors = [queriesFile.error, ...(dataset.errors ?? [])].filter(Boolean);
  if (errors.length > 0) fail(errors.join('\n'));

  const literalQueries = queriesFile.value.filter((query) => query.rule?.kind === 'literal');
  const results = literalQueries.map((query) => candidatesFor(query, dataset.menus));

  fs.mkdirSync(path.dirname(REVIEW_FILE), { recursive: true });
  fs.writeFileSync(REVIEW_FILE, formatReview(results));

  for (const { query, candidates } of results) {
    console.log(`${query.id} ${query.text}: ${candidates.length} candidate menus`);
  }
  console.log('Written data/golden/literal-candidates.md: review it and mark ✅ / ❌.');
}

main(process.argv.slice(2));
