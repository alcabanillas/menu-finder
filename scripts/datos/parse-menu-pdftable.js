// Generación local de datos (T0, paso 2; contrato en T2 §2). Extrae el conjunto de platos de
// Comida y Cena por menú directamente del PDF (menu.pdf), usando `pdf-parse`
// (getTable) para reconstruir la tabla real en vez de reconstruirla a mano a
// partir del TXT de `pdftotext -layout` (ver parse-menu.js).
//
// Motivación: parse-menu.js reconstruye columnas a partir de texto reflowed
// (heurística de huecos de espacios + centro de columna), lo que falla cuando
// una celda tiene 2 platos apilados o cuando el wrap de líneas desplaza
// palabras a la columna vecina. `pdf-parse` reconstruye la tabla real
// (filas/columnas) desde el propio PDF, sin ese paso de reconstrucción manual.
//
// Uso: pnpm datos:menu
'use strict';
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw', 'Dieta');
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'qa');
// El JSON de datos va a data/ (gitignoreado, SEG-datos-nutricionista): es el JSON estructurado de
// ING-menu-json, contiene nombres de plato reales y no debe acabar en el repo público.
// El CSV/MD de QA van a data/qa/ (son evidencia agregada
// de este análisis, no el dataset en sí).
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const ROW_LABELS = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena'];

const NON_DISH_FILES = /^(lista_de_la_compra|menu|valoracion.*)$/i;
// El nombre de fichero de esta receta de desayuno viene truncado en algunas carpetas
// (límite de longitud de fichero), así que se compara por prefijo, no por igualdad.
const BREAKFAST_RECIPE_PREFIXES = [
  'tostada integral con hummus y hojas de espinacas',
  'tostada integral con un poco de aceite de oliva virgen',
];

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normalize(s) {
  return stripAccents(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function normLabel(s) {
  return stripAccents(String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

const FILLER_PATTERNS = [
  /^una pieza de fruta( \(no zumo\))?\.?$/i,
  // Variantes con "kéfir" y singular/plural: "Un yogur/kéfir sin azúcares añadidos",
  // "Yogur/kéfir sin azúcar añadido".
  /^(un\s+)?yogur(\s*\/\s*k[eé]fir)?\s+sin\s+az[uú]car(es)?\s+a[ñn]adidos?\.?$/i,
];

function isFiller(text) {
  const t = text.trim();
  return FILLER_PATTERNS.some((re) => re.test(t));
}

// Palabras de enlace con las que puede terminar una línea de wrap SIN que eso
// cierre el plato: son títulos en Title Case ("Ensalada California de\nArroz *",
// "Merluza en Salsa de\nPimientos Rojos *"), así que la siguiente línea también
// empieza en mayúscula aunque sea el mismo plato continuando.
const TRAILING_CONNECTOR = /\b(de|del|con|al|a|en|y|la|el|las|los|sin)$/i;

// Una celda con 2+ platos los trae como líneas separadas (sin marcador explícito
// de separación) que terminan en "*" cuando el plato tiene receta asociada.
// Heurística de cierre, dos señales:
//  1) una línea que termina en "*" cierra el plato acumulado (con receta).
//  2) una línea que empieza por mayúscula, mientras ya había algo acumulado sin
//     asterisco Y la línea anterior no termina en una palabra de enlace
//     (TRAILING_CONNECTOR), señala el inicio de un plato NUEVO (cierra el
//     anterior, SIN receta) — porque un salto de línea de wrap dentro del
//     MISMO plato o bien continúa en minúscula, o bien (si el título usa Title
//     Case) la línea previa queda cortada en una preposición/artículo.
//     Necesaria para el caso "plato sin receta seguido de plato con receta,
//     sin asterisco entre medias" (ej. Menú 13 Viernes-cena: "Tomate y cebolla
//     asada" + "Tortilla francesa *"), confirmado por inspección manual de
//     menús 13, 21 y 24. La salvaguarda de conector evita falsos positivos
//     como partir "Ensalada California de" / "Arroz" en dos platos (Menús 17,
//     27) o "Merluza en Salsa de" / "Pimientos Rojos" (Menú 35).
// Lo que quede sin cerrar al final de la celda es un plato sin receta (si no
// matchea el relleno genérico de fruta/yogur) o descartable (si matchea).
function splitCellIntoDishes(cellText) {
  const lines = String(cellText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  let buffer = [];

  function flushSinReceta() {
    if (!buffer.length) return;
    const text = buffer.join(' ').trim();
    buffer = [];
    if (text && !isFiller(text)) items.push({ plato: text, tieneRecetaMarcada: false });
  }
  function flushConReceta() {
    const text = buffer.join(' ').replace(/\*\s*$/, '').trim();
    buffer = [];
    if (text) items.push({ plato: text, tieneRecetaMarcada: true });
  }

  for (const line of lines) {
    const prevLine = buffer[buffer.length - 1];
    const looksLikeNewDish =
      buffer.length && /^[A-ZÁÉÍÓÚÑ]/.test(line) && !TRAILING_CONNECTOR.test(prevLine || '');
    if (looksLikeNewDish) flushSinReceta();
    buffer.push(line);
    if (/\*\s*$/.test(line)) flushConReceta();
  }
  flushSinReceta();
  return items;
}

function loadRecipeFilenames(menuDir) {
  const files = fs.readdirSync(menuDir).filter((f) => f.endsWith('.pdf.txt') || (f.endsWith('.pdf') && f !== 'menu.pdf' && f !== 'Lista_de_la_compra.pdf'));
  const seen = new Set();
  const out = [];
  for (const f of files) {
    const base = f.replace(/\.pdf(\.txt)?$/, '');
    if (NON_DISH_FILES.test(base) || seen.has(base)) continue;
    seen.add(base);
    out.push({ raw: base, norm: normalize(base.replace(/-/g, ' ')) });
  }
  return out.filter((r) => !BREAKFAST_RECIPE_PREFIXES.some((p) => r.norm.startsWith(p)));
}

function containment(extracted, candidate) {
  const sa = new Set(extracted.split(' ').filter((w) => w.length > 2));
  const sb = new Set(candidate.split(' ').filter((w) => w.length > 2));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / sa.size;
}

function bestMatch(dishNorm, recipeList) {
  if (!dishNorm) return { score: 0, match: null };
  let best = { score: 0, match: null };
  for (const r of recipeList) {
    const score = containment(dishNorm, r.norm);
    if (score > best.score) best = { score, match: r.raw };
  }
  return best;
}

const MATCH_THRESHOLD = 0.6;

function findHeaderRowIndex(table) {
  return table.findIndex((row) => {
    const cells = row.slice(1, 8).map(normLabel);
    if (cells.length < 7) return false;
    return DAYS.every((d, i) => cells[i] === normLabel(d));
  });
}

function findLabelRowIndex(table, label) {
  const target = normLabel(label);
  return table.findIndex((row) => normLabel(row[0]) === target);
}

async function extractMenuTable(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getTable();
    const page = result.pages && result.pages[0];
    const table = page && page.tables && page.tables[0];
    return table || null;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const menuDirs = fs
    .readdirSync(RAW_DIR)
    .filter((d) => /^Menu \d+$/.test(d))
    .sort((a, b) => parseInt(a.split(' ')[1], 10) - parseInt(b.split(' ')[1], 10));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const dishRows = [['menu', 'bloque', 'dia', 'plato', 'tiene_receta_marcada', 'match_receta', 'score_match']];
  const report = [];
  // Salida en JSON estructurado día → comida/cena → platos (ING-menu-json de
  // Fuente-de-Verdad.md: es la forma que consume la app; el CSV/MD son solo
  // para el análisis y la revisión manual de este script).
  const menusJson = [];

  for (const dir of menuDirs) {
    const menuId = dir.split(' ')[1];
    const menuPath = path.join(RAW_DIR, dir);
    const pdfPath = path.join(menuPath, 'menu.pdf');
    if (!fs.existsSync(pdfPath)) {
      report.push({ menu: menuId, error: 'menu.pdf no encontrado' });
      continue;
    }

    let table;
    try {
      table = await extractMenuTable(pdfPath);
    } catch (e) {
      report.push({ menu: menuId, error: `getTable() falló: ${e.message}` });
      continue;
    }
    if (!table) {
      report.push({ menu: menuId, error: 'getTable() no devolvió ninguna tabla' });
      continue;
    }

    const headerIdx = findHeaderRowIndex(table);
    if (headerIdx === -1) {
      report.push({ menu: menuId, error: 'No se encontró fila de cabecera Lunes..Domingo en la tabla' });
      continue;
    }

    const comidaIdx = findLabelRowIndex(table, 'Comida');
    const cenaIdx = findLabelRowIndex(table, 'Cena');
    if (comidaIdx === -1 || cenaIdx === -1) {
      report.push({ menu: menuId, error: `Fila no encontrada (Comida=${comidaIdx}, Cena=${cenaIdx})` });
      continue;
    }

    const recipeList = loadRecipeFilenames(menuPath);
    const usedRecipes = new Set();
    let emptySlots = 0;
    let matched = 0;
    let lowConfidence = 0;
    let multiDishSlots = 0;
    let sinReceta = 0;
    let recetaEsperadaNoEncontrada = 0;

    const rowsForMenu = [];
    const dias = {};
    for (const day of DAYS) dias[day] = { comida: [], cena: [] };

    for (const [bloque, rowIdx] of [
      ['comida', comidaIdx],
      ['cena', cenaIdx],
    ]) {
      const row = table[rowIdx];
      for (let d = 0; d < DAYS.length; d++) {
        const cellText = row[d + 1] || '';
        const dishes = splitCellIntoDishes(cellText);
        if (dishes.length === 0) {
          emptySlots++;
          rowsForMenu.push([menuId, bloque, DAYS[d], '', '', '', '']);
          continue;
        }
        if (dishes.length > 1) multiDishSlots++;
        for (const { plato, tieneRecetaMarcada } of dishes) {
          // El propio PDF ya dice (asterisco) si el plato tiene receta o no.
          // Solo se intenta el fuzzy-match contra ficheros cuando SÍ la tiene:
          // forzar un match para platos sin asterisco solo produce ruido
          // (coincidencias parciales accidentales con la receta de otro plato
          // de la misma carpeta) — confirmado en revisión manual de los menús
          // 8, 10-13, 17, 21-24.
          if (!tieneRecetaMarcada) {
            sinReceta++;
            rowsForMenu.push([menuId, bloque, DAYS[d], plato, '0', '', '']);
            dias[DAYS[d]][bloque].push({
              plato,
              tieneRecetaMarcada: false,
              recetaFichero: null,
              scoreMatch: null,
            });
            continue;
          }
          const dishNorm = normalize(plato);
          const { score, match } = bestMatch(dishNorm, recipeList);
          const resolved = score >= MATCH_THRESHOLD ? match : null;
          if (resolved) {
            usedRecipes.add(resolved);
            matched++;
          } else {
            // Plato marcado con "*" (debería tener receta) pero sin fichero
            // que lo respalde con score suficiente: o falta subir la receta
            // al Drive, o el nombre de fichero no coincide con el del PDF.
            recetaEsperadaNoEncontrada++;
          }
          rowsForMenu.push([menuId, bloque, DAYS[d], plato, '1', match || '', score.toFixed(2)]);
          dias[DAYS[d]][bloque].push({
            plato,
            tieneRecetaMarcada: true,
            recetaFichero: resolved,
            scoreMatch: Number(score.toFixed(2)),
          });
        }
      }
    }
    dishRows.push(...rowsForMenu);

    const totalSlots = DAYS.length * 2;
    const unusedRecipes = recipeList.filter((r) => !usedRecipes.has(r.raw)).map((r) => r.raw);

    report.push({
      menu: menuId,
      totalSlots,
      emptySlots,
      multiDishSlots,
      matched,
      sinReceta,
      recetaEsperadaNoEncontrada,
      nRecipeFiles: recipeList.length,
      unusedRecipes,
    });

    menusJson.push({ menu: menuId, dias });
  }

  const csv = dishRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'menu-platos-pdftable.csv'), csv, 'utf8');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'menu-platos.json'), JSON.stringify(menusJson, null, 2), 'utf8');

  const lines = [];
  lines.push('# QA — extracción de platos vía pdf-parse getTable() (36 menús)\n');
  lines.push('Alternativa a parse-menu.js: reconstruye la tabla real del PDF (pdf-parse) en vez de');
  lines.push('reconstruir columnas a partir del TXT de `pdftotext -layout`. Cada celda de Comida/Cena');
  lines.push('se divide en platos por la heurística "línea terminada en `*` cierra un plato" (ver');
  lines.push('splitCellIntoDishes). El asterisco del propio PDF decide si se intenta matchear contra');
  lines.push('fichero de receta: sin asterisco no se fuerza ningún match (evita falsos positivos por');
  lines.push('coincidencia parcial con la receta de OTRO plato de la carpeta). "receta esperada no');
  lines.push('encontrada" = plato con "*" pero sin fichero que lo respalde (score < 0.6): revisar si falta');
  lines.push('subir la receta al Drive o si el nombre de fichero no coincide. Domingo vacío es esperado.\n');
  lines.push('| Menu | slots (día×bloque) | vacíos | celdas con 2+ platos | match ok (con receta) | sin receta (esperado) | receta esperada no encontrada | ficheros receta | recetas no reclamadas |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of report) {
    if (r.error) {
      lines.push(`| ${r.menu} | ERROR: ${r.error} | | | | | | | |`);
      continue;
    }
    lines.push(
      `| ${r.menu} | ${r.totalSlots} | ${r.emptySlots} | ${r.multiDishSlots} | ${r.matched} | ${r.sinReceta} | ${r.recetaEsperadaNoEncontrada} | ${r.nRecipeFiles} | ${
        r.unusedRecipes.length ? r.unusedRecipes.join('; ') : '-'
      } |`
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, 'qa-menu-platos-pdftable.md'), lines.join('\n'), 'utf8');

  const ok = report.filter((r) => !r.error);
  const errors = report.filter((r) => r.error);
  const totalSlots = ok.reduce((a, r) => a + r.totalSlots, 0);
  const totalEmpty = ok.reduce((a, r) => a + r.emptySlots, 0);
  const totalMatched = ok.reduce((a, r) => a + r.matched, 0);
  const totalMultiDish = ok.reduce((a, r) => a + r.multiDishSlots, 0);
  const totalSinReceta = ok.reduce((a, r) => a + r.sinReceta, 0);
  const totalRecetaEsperadaNoEncontrada = ok.reduce((a, r) => a + r.recetaEsperadaNoEncontrada, 0);
  const totalUnused = ok.reduce((a, r) => a + r.unusedRecipes.length, 0);
  console.log(`OK. ${ok.length}/${menuDirs.length} menús procesados sin error.`);
  if (errors.length) {
    console.log(`Errores: ${errors.map((r) => `Menu ${r.menu} (${r.error})`).join('; ')}`);
  }
  console.log(`Slots vacíos (esperado: domingo, 2 por menú): ${totalEmpty}/${totalSlots}`);
  console.log(`Slots con 2+ platos detectados: ${totalMultiDish}`);
  console.log(`Platos con "*" y match >= ${MATCH_THRESHOLD} contra fichero de receta: ${totalMatched}`);
  console.log(`Platos sin "*" (sin receta esperada, no se intenta match): ${totalSinReceta}`);
  console.log(`Platos con "*" SIN fichero de receta encontrado (revisar Drive): ${totalRecetaEsperadaNoEncontrada}`);
  console.log(`Ficheros de receta no reclamados por ningún slot: ${totalUnused}`);
  console.log(`Salida: ${path.join(DATA_DIR, 'menu-platos.json')} (dataset, gitignoreado)`);
  console.log(`Salida: ${OUT_DIR} (menu-platos-pdftable.csv, qa-menu-platos-pdftable.md — QA, local)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
