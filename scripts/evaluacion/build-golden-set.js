// Construye el golden set de recuperación (MF-12, spec retrieval-golden-set).
//
// Qué es: para cada consulta de prueba ("sin cerdo", "de cuchara", "pasta sin queso"...),
// una nota por cada uno de los 36 menús: 2 muy relevante, 1 algo relevante, 0 no relevante.
// MF-18 lo usa para comparar el buscador léxico, el semántico y el híbrido.
//
// Cómo: las notas NO se ponen a mano menú a menú. Se etiquetan los PLATOS (un plato "es de
// cuchara", "lleva pollo"...) y unas reglas fijas convierten esas etiquetas en la nota del menú.
// Así el mismo plato cuenta igual en todos los menús y cualquiera puede reconstruirlo.
//
// Uso: pnpm evals:golden-set   (sin argumentos)
// Entradas:
//   data/menu-platos.json, data/recetas.json   el dataset (local, nunca se sube)
//   evals/retrieval/queries.json               las consultas y la regla de cada una
//   evals/retrieval/dish-labels.json           platos etiquetados por concepto y descartes del autor
//   evals/retrieval/ingredient-groups.json     qué ingredientes son pollo, pescado, queso...
//   data/golden/literal-candidates.md          la revisión del autor de las consultas literales
// Salidas:
//   evals/retrieval/golden-set.json    se commitea: solo ids, textos y notas (nunca qué platos tiene un menú)
//   data/golden/golden-set-report.md   local: qué platos justifican cada nota
//
// Pasos (ver main al final): cargar → validar → saber qué es cada plato → poner notas → retirar
// consultas inútiles → comprobar la salida → escribir.

const fs = require('fs');
const path = require('path');
const { readJson, loadMenus, dishesOf, allDishNames } = require('./dataset');

const ROOT = path.join(__dirname, '..', '..');
const EVALS_DIR = path.join(ROOT, 'evals', 'retrieval');
const FILES = {
  queries: path.join(EVALS_DIR, 'queries.json'),
  dishLabels: path.join(EVALS_DIR, 'dish-labels.json'),
  ingredientGroups: path.join(EVALS_DIR, 'ingredient-groups.json'),
  literalReview: path.join(ROOT, 'data', 'golden', 'literal-candidates.md'),
  goldenSet: path.join(EVALS_DIR, 'golden-set.json'),
  report: path.join(ROOT, 'data', 'golden', 'golden-set-report.md'),
};

const QUERY_TYPES = ['literal', 'exclusion', 'attribute', 'fuzzy', 'combined'];
const ORIGINS = ['llm-blind', 'author', 'known-case'];
const SLOTS = ['lunch', 'dinner'];
const QUICK_CONCEPTS = ['quick', 'quick-under-20'];
const QUICK_MINUTES = 20;
// Una consulta en la que más de 5/6 de los menús sacan un 2 no distingue nada (30 de 36).
const SATURATION_SHARE = 5 / 6;

// ===========================================================================
// 1. Cargar
// ===========================================================================

// Lee la revisión de literales. Cada consulta abre con  ## L02 "salmón" — ...
// y cada candidato es  - [✅] **Menu 3 → 2**  seguido de sus platos ("  - (2) Plato...").
// ❌ en la marca = descartado. Sin marca = aceptado, con la nota que dejó el autor.
function parseLiteralReview(markdown) {
  const reviewByQuery = new Map();
  let current = null;
  let candidate = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (\S+) "/);
    const candidateLine = line.match(/^- \[([^\]]*)\] \*\*Menu (\d+) → (\d)\*\*/);
    const evidenceLine = line.match(/^ {2}- (.+)$/);
    if (heading) {
      current = new Map();
      reviewByQuery.set(heading[1], current);
    } else if (candidateLine && current) {
      candidate = {
        rejected: candidateLine[1].includes('❌'),
        grade: Number(candidateLine[3]),
        evidence: [],
      };
      current.set(Number(candidateLine[2]), candidate);
    } else if (evidenceLine && candidate) {
      candidate.evidence.push(evidenceLine[1]);
    }
  }
  return reviewByQuery;
}

function loadInputs() {
  const dataset = loadMenus();
  const queries = readJson(FILES.queries);
  const dishLabels = readJson(FILES.dishLabels);
  const ingredientGroups = readJson(FILES.ingredientGroups);
  const review = fs.existsSync(FILES.literalReview)
    ? { value: parseLiteralReview(fs.readFileSync(FILES.literalReview, 'utf8')) }
    : { error: 'data/golden/literal-candidates.md: not found; run `pnpm evals:literal-candidates` and review it first' };

  const errors = [...(dataset.errors ?? []), queries.error, dishLabels.error, ingredientGroups.error, review.error];
  return {
    errors: errors.filter(Boolean),
    inputs: {
      menus: dataset.menus,
      queries: queries.value,
      dishLabels: dishLabels.value,
      ingredientGroups: ingredientGroups.value,
      literalReview: review.value,
    },
  };
}

// ===========================================================================
// 2. Saber qué es cada plato
// ===========================================================================
//
// Un "concepto" es cualquier cosa que se puede preguntar de un plato:
//   - un grupo de ingredientes ("pollo", "queso") o un grupo derivado ("carne" = pollo + cerdo + ...)
//   - un concepto de plato etiquetado ("cuchara", "ligero", "pescado_crudo")
//   - "quick" (≤ 20 min) o "quick-under-20" (< 20 min)
//   - una lista de conceptos: el plato tiene que cumplirlos TODOS ("ligero" y "quick")
//
// La respuesta tiene tres valores: true, false o null (no se sabe: la receta no trae el tiempo).

function buildConceptIndex({ dishLabels, ingredientGroups }) {
  // ingrediente → grupos a los que pertenece ("Pechuga de pollo" → ["pollo"])
  const groupsOfIngredient = new Map();
  const addIngredient = (ingredient, group) => {
    groupsOfIngredient.set(ingredient, [...(groupsOfIngredient.get(ingredient) ?? []), group]);
  };
  for (const [group, ingredients] of Object.entries(ingredientGroups.groups)) {
    ingredients.forEach((ingredient) => addIngredient(ingredient, group));
  }
  // Filas ambiguas: "Carne picada (cerdo o pollo)" cuenta en ambos; "Caldo de pollo" en ninguno.
  for (const [ingredient, row] of Object.entries(ingredientGroups.ambiguous)) {
    row.counted_in.forEach((group) => addIngredient(ingredient, group));
  }

  const dishConcepts = new Map(
    Object.entries(dishLabels.concepts).map(([name, concept]) => [
      name,
      { ...concept, labels: new Set(concept.labels), rejected: new Set(concept.rejected) },
    ]),
  );

  const isGroup = (name) => name in ingredientGroups.groups || name in ingredientGroups.derived;

  function hasIngredientOf(dish, groupName) {
    const wanted = ingredientGroups.derived[groupName] ?? [groupName];
    return dish.ingredients.some((ingredient) =>
      (groupsOfIngredient.get(ingredient) ?? []).some((group) => wanted.includes(group)),
    );
  }

  // Sin receta = plato trivial = rápido (BUS-superficie-consulta (c)). Receta sin tiempo = no se sabe.
  function isQuick(dish, concept) {
    if (!dish.hasRecipe) return true;
    if (dish.totalMinutes === null) return null;
    return concept === 'quick-under-20' ? dish.totalMinutes < QUICK_MINUTES : dish.totalMinutes <= QUICK_MINUTES;
  }

  // Antes de aplicar los descartes del autor: etiquetado por el LLM, o con un ingrediente del grupo
  // asociado (pescado_crudo incluye cualquier plato con pescado curado o ahumado).
  function isCandidateOf(dish, conceptName) {
    const concept = dishConcepts.get(conceptName);
    return concept.labels.has(dish.name) || Boolean(concept.ingredientGroup && hasIngredientOf(dish, concept.ingredientGroup));
  }

  // "Y" con tres valores: basta un false para que sea false; si no, un null lo deja en null.
  function allOf(values) {
    if (values.includes(false)) return false;
    if (values.includes(null)) return null;
    return true;
  }

  function is(dish, concept) {
    if (Array.isArray(concept)) return allOf(concept.map((one) => is(dish, one)));
    if (QUICK_CONCEPTS.includes(concept)) return isQuick(dish, concept);
    if (dishConcepts.has(concept)) {
      return isCandidateOf(dish, concept) && !dishConcepts.get(concept).rejected.has(dish.name);
    }
    return hasIngredientOf(dish, concept);
  }

  const exists = (concept) => QUICK_CONCEPTS.includes(concept) || dishConcepts.has(concept) || isGroup(concept);

  return { is, exists, isCandidateOf, isGroup, dishConcepts };
}

// ===========================================================================
// 3. Validar (antes de escribir nada; se juntan TODOS los errores)
// ===========================================================================

// Los conceptos que usa una regla, para comprobar que existen.
function conceptsOfRule(rule) {
  const asList = (value) => (value === undefined ? [] : [value].flat());
  return [
    ...asList(rule.concept),
    ...asList(rule.concepts),
    ...asList(rule.all),
    ...asList(rule.main),
    ...asList(rule.without),
    ...asList(rule.excluding),
  ];
}

const RULE_KINDS = ['literal', 'exclusion', 'share', 'presence', 'cover', 'sameDish', 'coverExcluding', 'withdrawn'];

function validateQueries({ queries, literalReview }, concepts) {
  if (!Array.isArray(queries)) return ['queries.json: must be a list of queries'];
  const errors = [];
  const seen = new Set();
  for (const query of queries) {
    const where = `queries.json ${query.id ?? '(no id)'}`;
    if (!query.id) errors.push(`${where}: missing id`);
    else if (seen.has(query.id)) errors.push(`${where}: duplicate id`);
    seen.add(query.id);

    if (!QUERY_TYPES.includes(query.type)) errors.push(`${where}: unknown type "${query.type}"`);
    if (!query.text?.trim()) errors.push(`${where}: empty text`);
    if (!ORIGINS.includes(query.origin)) errors.push(`${where}: unknown origin "${query.origin}"`);

    const rule = query.rule ?? {};
    if (!RULE_KINDS.includes(rule.kind)) {
      errors.push(`${where}: unknown rule kind "${rule.kind}"`);
      continue;
    }
    if (rule.kind === 'withdrawn' && !rule.reason) errors.push(`${where}: a withdrawn rule needs a reason`);
    if (rule.kind === 'literal' && query.type !== 'literal') errors.push(`${where}: only literal queries take a literal rule`);
    if (rule.kind === 'literal' && literalReview && !literalReview.has(query.id)) {
      errors.push(`${where}: no section for it in data/golden/literal-candidates.md`);
    }
    if (rule.slot !== undefined && !SLOTS.includes(rule.slot)) errors.push(`${where}: unknown slot "${rule.slot}"`);
    if (concepts) {
      for (const concept of conceptsOfRule(rule).filter((c) => !concepts.exists(c))) {
        errors.push(`${where}: unknown concept "${concept}"`);
      }
    }
  }
  return errors;
}

function validateDishLabels({ dishLabels, menus }, concepts) {
  const errors = [];
  const menuDishes = allDishNames(menus);
  const dishesByName = new Map(menus.flatMap((menu) => dishesOf(menu)).map((dish) => [dish.name, dish]));
  for (const [name, concept] of Object.entries(dishLabels.concepts)) {
    const where = `dish-labels.json ${name}`;
    if (concept.ingredientGroup && !concepts.isGroup(concept.ingredientGroup)) {
      errors.push(`${where}: unknown ingredient group "${concept.ingredientGroup}"`);
    }
    for (const dish of [...concept.labels, ...concept.rejected].filter((d) => !menuDishes.has(d))) {
      errors.push(`${where}: "${dish}" is in no menu`);
    }
    // Solo se puede descartar lo que el concepto habría incluido.
    for (const dish of concept.rejected.filter((d) => menuDishes.has(d))) {
      if (!concepts.isCandidateOf(dishesByName.get(dish), name)) {
        errors.push(`${where}: rejected "${dish}" is not one of its dishes`);
      }
    }
  }
  return errors;
}

function validateIngredientGroups({ ingredientGroups }) {
  const errors = [];
  const known = (group) => group in ingredientGroups.groups;
  for (const [derived, groups] of Object.entries(ingredientGroups.derived)) {
    for (const group of groups.filter((g) => !known(g))) {
      errors.push(`ingredient-groups.json derived ${derived}: unknown group "${group}"`);
    }
  }
  for (const [ingredient, row] of Object.entries(ingredientGroups.ambiguous)) {
    for (const group of row.counted_in.filter((g) => !known(g))) {
      errors.push(`ingredient-groups.json ambiguous "${ingredient}": unknown group "${group}"`);
    }
  }
  return errors;
}

function hasShape(value, keys) {
  return value !== null && typeof value === 'object' && keys.every((key) => value[key] && typeof value[key] === 'object');
}

function validate(inputs) {
  const shapeErrors = [];
  if (inputs.dishLabels && !hasShape(inputs.dishLabels, ['concepts'])) {
    shapeErrors.push('dish-labels.json: must have "concepts"');
  }
  if (inputs.ingredientGroups && !hasShape(inputs.ingredientGroups, ['groups', 'derived', 'ambiguous'])) {
    shapeErrors.push('ingredient-groups.json: must have "groups", "derived" and "ambiguous"');
  }
  // Sin etiquetas y grupos no se puede saber si un concepto existe; se validan las consultas igualmente.
  const canResolveConcepts = inputs.dishLabels && inputs.ingredientGroups && shapeErrors.length === 0;
  const concepts = canResolveConcepts ? buildConceptIndex(inputs) : null;

  return [
    ...shapeErrors,
    ...(inputs.queries ? validateQueries(inputs, concepts) : []),
    ...(concepts && inputs.menus ? validateDishLabels(inputs, concepts) : []),
    ...(canResolveConcepts ? validateIngredientGroups(inputs) : []),
  ];
}

// ===========================================================================
// 4. Poner notas
// ===========================================================================
//
// Cada regla devuelve, por menú, { grade, evidence }: la nota y los platos que la justifican.

// Nota relativa, para puntuaciones que no tienen un "sí" absoluto (ningún menú está libre
// de pescado): 2 = el mejor cuarto de los menús, 1 = la mejor mitad, 0 = el resto.
// Los empates reciben la misma nota.
function relativeGrades(scores, { lowerIsBetter }) {
  const ranked = [...scores].sort((a, b) => (lowerIsBetter ? a - b : b - a));
  const scoreAtPosition = (fraction) => ranked[Math.max(1, Math.floor(ranked.length * fraction)) - 1];
  const topQuarter = scoreAtPosition(1 / 4);
  const topHalf = scoreAtPosition(1 / 2);
  const isAtLeast = (score, threshold) => (lowerIsBetter ? score <= threshold : score >= threshold);
  return scores.map((score) => {
    if (isAtLeast(score, topQuarter)) return 2;
    if (isAtLeast(score, topHalf)) return 1;
    return 0;
  });
}

const namesOf = (dishes) => [...new Set(dishes.map((dish) => dish.name))];
const breakingEvidence = (dishes) => (dishes.length > 0 ? [`breaks: ${namesOf(dishes).join('; ')}`] : []);
const conceptName = (concept) => [concept].flat().join(' + ');

// El dato del que sale la nota, para poder revisarla a ojo: "2 of 12 dishes are pescado (17 %)".
function tally(count, total, description) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return `${count} of ${total} ${description} (${percent} %)`;
}

// "sin cerdo": cuantos menos platos con cerdo, mejor.
function gradeExclusion(menus, rule, { is }) {
  const breaking = menus.map((menu) => dishesOf(menu).filter((dish) => is(dish, rule.concept) === true));
  const grades = relativeGrades(breaking.map((dishes) => dishes.length), { lowerIsBetter: true });
  return menus.map((menu, i) => ({
    grade: grades[i],
    evidence: [
      tally(breaking[i].length, dishesOf(menu).length, `dishes are ${conceptName(rule.concept)}`),
      ...breakingEvidence(breaking[i]),
    ],
  }));
}

// "cenas rápidas": qué fracción de los platos (de la franja, si la hay) cumple el concepto.
// Los platos de los que no se sabe (receta sin tiempo) no cuentan ni a favor ni en contra.
function gradeShare(menus, rule, { is }) {
  const perMenu = menus.map((menu) => {
    const known = dishesOf(menu, rule.slot).filter((dish) => is(dish, rule.concept) !== null);
    const matching = known.filter((dish) => is(dish, rule.concept) === true);
    return { share: known.length > 0 ? matching.length / known.length : 0, known, matching };
  });
  const grades = relativeGrades(perMenu.map((m) => m.share), { lowerIsBetter: false });
  const dishesLabel = rule.slot ? `${rule.slot} dishes` : 'dishes';
  return perMenu.map(({ known, matching }, i) => ({
    grade: grades[i],
    evidence: [
      tally(matching.length, known.length, `${dishesLabel} are ${conceptName(rule.concept)}`),
      ...namesOf(matching),
    ],
  }));
}

// "de cuchara": un menú sin ningún plato así es 0; entre los que tienen, 2 los que más.
function gradePresence(menus, rule, { is }) {
  const matching = menus.map((menu) => dishesOf(menu).filter((dish) => is(dish, rule.concept) === true));
  const relative = relativeGrades(matching.map((dishes) => dishes.length), { lowerIsBetter: false });
  return menus.map((menu, i) => {
    const count = tally(matching[i].length, dishesOf(menu).length, `dishes are ${conceptName(rule.concept)}`);
    if (matching[i].length === 0) return { grade: 0, evidence: [count] };
    return { grade: relative[i] === 2 ? 2 : 1, evidence: [count, ...namesOf(matching[i])] };
  });
}

// "legumbres y pasta": cada concepto lo puede cumplir cualquier plato de la semana.
// Todos cubiertos = 2, alguno = 1, ninguno = 0.
function coverageOf(menu, concepts, is) {
  return concepts.map((concept) => ({
    concept,
    dishes: dishesOf(menu).filter((dish) => is(dish, concept) === true),
  }));
}

function coverGrade(coverage) {
  const covered = coverage.filter((c) => c.dishes.length > 0).length;
  if (covered === coverage.length) return 2;
  return covered > 0 ? 1 : 0;
}

const coverEvidence = (coverage) =>
  coverage.map(({ concept, dishes }) => `${concept}: ${namesOf(dishes).join('; ') || '—'}`);

function gradeCover(menus, rule, { is }) {
  return menus.map((menu) => {
    const coverage = coverageOf(menu, rule.concepts, is);
    return { grade: coverGrade(coverage), evidence: coverEvidence(coverage) };
  });
}

// "salmón con verduras", "pasta sin queso": todo en el MISMO plato.
// Un plato que lo cumple todo = 2; uno que solo cumple el principal (salmón, pasta) = 1.
function gradeSameDish(menus, rule, { is }) {
  const isFull = (dish) =>
    rule.all.every((concept) => is(dish, concept) === true) && !(rule.without && is(dish, rule.without) === true);
  const isMainOnly = (dish) => Boolean(rule.main) && is(dish, rule.main) === true;
  return menus.map((menu) => {
    const full = dishesOf(menu).filter(isFull);
    if (full.length > 0) return { grade: 2, evidence: namesOf(full) };
    const partial = dishesOf(menu).filter(isMainOnly);
    if (partial.length > 0) return { grade: 1, evidence: namesOf(partial).map((name) => `main only: ${name}`) };
    return { grade: 0, evidence: [] };
  });
}

// "pollo y brócoli sin pescado": se cubre como en "y", pero la exclusión es de toda la semana.
// Un menú cubierto se queda en 2 solo si está entre los que menos platos excluidos tienen.
function gradeCoverExcluding(menus, rule, { is }) {
  const breaking = menus.map((menu) => dishesOf(menu).filter((dish) => is(dish, rule.excluding) === true));
  const exclusionGrades = relativeGrades(breaking.map((dishes) => dishes.length), { lowerIsBetter: true });
  return menus.map((menu, i) => {
    const coverage = coverageOf(menu, rule.concepts, is);
    const covered = coverGrade(coverage);
    const grade = covered === 2 && exclusionGrades[i] !== 2 ? 1 : covered;
    return {
      grade,
      evidence: [
        ...coverEvidence(coverage),
        tally(breaking[i].length, dishesOf(menu).length, `dishes are ${conceptName(rule.excluding)}`),
        ...breakingEvidence(breaking[i]),
      ],
    };
  });
}

// Literales: manda la revisión del autor. Descartado o no listado = 0.
function gradeLiteral(menus, query, literalReview) {
  const review = literalReview.get(query.id);
  return menus.map((menu) => {
    const candidate = review.get(menu.number);
    if (!candidate) return { grade: 0, evidence: [] };
    if (candidate.rejected) return { grade: 0, evidence: ['rejected by the author', ...candidate.evidence] };
    return { grade: candidate.grade, evidence: candidate.evidence };
  });
}

const GRADERS = {
  exclusion: gradeExclusion,
  share: gradeShare,
  presence: gradePresence,
  cover: gradeCover,
  sameDish: gradeSameDish,
  coverExcluding: gradeCoverExcluding,
};

// ===========================================================================
// 5. Retirar las consultas que no sirven para medir
// ===========================================================================

function withdrawalOf(perMenu, menuCount) {
  if (perMenu.every(({ grade }) => grade === 0)) return 'no relevant menu';
  const topGraded = perMenu.filter(({ grade }) => grade === 2).length;
  if (topGraded > menuCount * SATURATION_SHARE) return `saturated: ${topGraded} of ${menuCount} menus get 2`;
  return null;
}

function gradeQuery(query, inputs, concepts) {
  const { menus } = inputs;
  if (query.rule.kind === 'withdrawn') return { query, reason: query.rule.reason };

  const perMenu =
    query.rule.kind === 'literal'
      ? gradeLiteral(menus, query, inputs.literalReview)
      : GRADERS[query.rule.kind](menus, query.rule, concepts);
  const graded = menus.map((menu, i) => ({ menu: menu.number, ...perMenu[i] }));

  const reason = withdrawalOf(graded, menus.length);
  return reason ? { query, reason } : { query, graded };
}

// ===========================================================================
// 6. Salida: golden-set.json (repo) y su comprobación
// ===========================================================================

function toGoldenSet(results, menuCount) {
  const queries = [...results]
    .sort((a, b) => a.query.id.localeCompare(b.query.id))
    .map(({ query, reason, graded }) => ({
      id: query.id,
      type: query.type,
      text: query.text,
      origin: query.origin,
      status: reason ? 'withdrawn' : 'kept',
      ...(reason ? { reason } : { grades: Object.fromEntries(graded.map(({ menu, grade }) => [menu, grade])) }),
    }));
  return {
    description: 'Retrieval golden set (MF-12): a relevance grade per weekly menu for every kept query.',
    grades: { 2: 'highly relevant', 1: 'partially relevant', 0: 'not relevant' },
    menuCount,
    queries,
  };
}

// JSON con dos espacios, pero las notas de cada consulta en una sola línea.
function serialize(goldenSet) {
  const pretty = JSON.stringify(goldenSet, null, 2);
  return pretty.replace(/"grades": \{\n([^}]*)\n\s*\}/g, (_, body) => `"grades": { ${body.trim().split(/,\s*\n\s*/).join(', ')} }`) + '\n';
}

// Las autocomprobaciones sustituyen a los tests unitarios (design D4).
function selfCheck(goldenSet, text, menus) {
  const errors = [];
  const menuNumbers = menus.map((menu) => String(menu.number));
  for (const query of goldenSet.queries.filter((q) => q.status === 'kept')) {
    const keys = Object.keys(query.grades);
    const sameMenus = keys.length === menuNumbers.length && keys.every((key, i) => key === menuNumbers[i]);
    if (!sameMenus) errors.push(`${query.id}: does not have exactly one grade per menu, in menu order`);
    if (Object.values(query.grades).some((grade) => ![0, 1, 2].includes(grade))) {
      errors.push(`${query.id}: a grade is not 0, 1 or 2`);
    }
  }
  const ids = goldenSet.queries.map((query) => query.id);
  if (ids.join() !== [...ids].sort((a, b) => a.localeCompare(b)).join()) errors.push('queries are not in id order');

  // Lo que no puede llegar al repo: qué platos tiene un menú (SEG-datos-nutricionista).
  const lowered = text.toLowerCase();
  for (const dish of allDishNames(menus)) {
    if (lowered.includes(dish.toLowerCase())) errors.push(`dish name "${dish}" appears in golden-set.json`);
  }
  return errors;
}

// ===========================================================================
// 7. Salida: el informe local
// ===========================================================================

function precisionSection(concepts, menus) {
  const allDishes = [...new Map(menus.flatMap((m) => dishesOf(m)).map((d) => [d.name, d])).values()];
  const rows = [...concepts.dishConcepts.entries()].map(([name, concept]) => {
    const candidates = allDishes.filter((dish) => concepts.isCandidateOf(dish, name)).length;
    const rejected = concept.rejected.size;
    const precision = candidates > 0 ? (((candidates - rejected) / candidates) * 100).toFixed(1) : '—';
    return `| ${name} | ${candidates} | ${rejected} | ${precision} % |`;
  });
  return [
    '## Labeller precision',
    '',
    '| Concept | Labelled dishes | Rejected by the author | Precision |',
    '|---|---|---|---|',
    ...rows,
    '',
    'Recall is not measured: a dish the labeller missed is not detected by the review.',
  ].join('\n');
}

function rejectionsSection(concepts) {
  const lines = ['## Author rejections', ''];
  for (const [name, concept] of concepts.dishConcepts) {
    for (const dish of concept.rejected) lines.push(`- ${name}: ${dish}`);
  }
  return lines.join('\n');
}

function formatReport(results, concepts, menus) {
  const byId = [...results].sort((a, b) => a.query.id.localeCompare(b.query.id));
  const withdrawn = byId.filter((r) => r.reason);
  const kept = byId.filter((r) => !r.reason);

  const withdrawnSection = [
    '## Withdrawn queries',
    '',
    ...withdrawn.map(({ query, reason }) => `- ${query.id} "${query.text}": ${reason}`),
  ].join('\n');

  const keptSections = kept.map(({ query, graded }) =>
    [
      `### ${query.id} "${query.text}" (${query.type}, rule ${query.rule.kind})`,
      '',
      ...graded.map(({ menu, grade, evidence }) => `- Menu ${menu} → **${grade}** · ${evidence.join(' · ') || '—'}`),
    ].join('\n'),
  );

  return [
    '# Retrieval golden set — report\n\n' +
      'Local only (data/): it says which dishes each menu has. The committed golden set carries only the grades.',
    precisionSection(concepts, menus),
    rejectionsSection(concepts),
    withdrawnSection,
    '## Kept queries',
    ...keptSections,
  ].join('\n\n') + '\n';
}

// ===========================================================================
// main
// ===========================================================================

function fail(messages, exitCode = 1) {
  console.error([messages].flat().join('\n'));
  process.exit(exitCode);
}

function printCounts(goldenSet) {
  console.log('type        kept  withdrawn');
  for (const type of QUERY_TYPES) {
    const ofType = goldenSet.queries.filter((q) => q.type === type);
    const kept = ofType.filter((q) => q.status === 'kept').length;
    console.log(`${type.padEnd(11)} ${String(kept).padStart(4)}  ${String(ofType.length - kept).padStart(9)}`);
  }
}

function main(args) {
  if (args.length > 0) fail('Usage: pnpm evals:golden-set   (takes no arguments)', 2);

  // Cargar y validar: si algo falla, se listan todos los errores y no se escribe nada.
  const { errors: loadErrors, inputs } = loadInputs();
  const errors = [...loadErrors, ...validate(inputs)];
  if (errors.length > 0) fail(['Nothing written. Fix these inputs:', ...errors.map((e) => `  - ${e}`)]);

  // Poner notas a cada consulta.
  const concepts = buildConceptIndex(inputs);
  const results = inputs.queries.map((query) => gradeQuery(query, inputs, concepts));

  // Comprobar la salida antes de escribirla.
  const goldenSet = toGoldenSet(results, inputs.menus.length);
  const text = serialize(goldenSet);
  const checkErrors = selfCheck(goldenSet, text, inputs.menus);
  if (checkErrors.length > 0) fail(['Nothing written. Self-check failed:', ...checkErrors.map((e) => `  - ${e}`)]);

  fs.writeFileSync(FILES.goldenSet, text);
  fs.mkdirSync(path.dirname(FILES.report), { recursive: true });
  fs.writeFileSync(FILES.report, formatReport(results, concepts, inputs.menus));

  printCounts(goldenSet);
  console.log('Written evals/retrieval/golden-set.json and data/golden/golden-set-report.md');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { relativeGrades, parseLiteralReview, buildConceptIndex };
