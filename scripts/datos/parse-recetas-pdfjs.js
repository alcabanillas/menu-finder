// Generación local de datos (T0, paso 3; contrato en T2 §4). Extrae cada receta (data/raw/Dieta/Menu N/<plato>.pdf)
// a JSON: título, tiempos, ingredientes y preparación. Lee el texto CON COORDENADAS que
// da `pdfjs-dist` (la librería que `pdf-parse` lleva debajo) en vez del TXT de
// `pdftotext -layout`, porque el PDF de receta tiene tres columnas fijas:
//
//   x≈36  nombre de ingrediente / etiqueta de tiempo    x≈171 cantidad / valor
//   x≥300 preparación
//
// Con la posición, el caso "nombre de ingrediente partido en dos líneas con los dos
// puntos en la continuación" ("- Aceite de oliva virgen" / "extra:") deja de ser una
// heurística: el segundo trozo está en la columna de nombre y no empieza por guion,
// luego es continuación del anterior. `getTable()` no sirve aquí: los recuadros verdes
// son rectángulos decorativos, no una rejilla (0 tablas detectadas).
//
// Salida:
//   data/recetas.json                            (dataset, gitignoreado — SEG-datos-nutricionista)
//   data/qa/qa-recetas-pdfjs.md  (QA agregada, local)
//
// SEG-datos-nutricionista: el pie con la marca, el email de contacto y el eslogan NO se copian al JSON:
// todo lo que está a la altura de "Los ingredientes con un asterisco" o por debajo se
// descarta, y el pie de página se filtra por posición (y < 40).
//
// Uso: pnpm datos:recetas
'use strict';
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw', 'Dieta');
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'qa');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const NON_RECIPE_FILES = /^(menu|lista_de_la_compra|valoracion.*)$/i;

// Geometría medida sobre los PDF (puntos, origen abajo-izquierda).
const COL_RIGHT_X = 290; // a partir de aquí es la columna de preparación
const COL_VALUE_X = 150; // en la columna izquierda, a partir de aquí es cantidad / valor de tiempo
const TITLE_MIN_Y = 700; // por encima de las cabeceras TIEMPOS / PREPARACIÓN solo está el título
const FOOTER_MAX_Y = 40; // pie de página (eslogan, TCPDF): se descarta
const SAME_LINE_TOL = 2; // dos ítems con |Δy| < tol están en la misma línea
const PARAGRAPH_GAP = 18; // interlineado normal 12.5; salto de párrafo 25

// "1 cucharada (15 ml)", "(120 g)", "al gusto (1 g) *", "2-3 unidades (30 g) * *"
const AMOUNT_RE = /^(?:(.+?)\s+)?\((\d+(?:[.,]\d+)?)\s*(g|ml|kg|l)\)((?:\s*\*)*)$/;
const TIME_RE = /^(\d\d):(\d\d):(\d\d)$/;
const TIME_LABELS = { 'Total:': 'total', 'Elaboración:': 'elaboracion', 'Cocción:': 'coccion', 'Espera/reposo:': 'espera' };

function hhmmssToMin(s) {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(m[3]) / 60);
}

// Agrupa ítems (ya ordenados por y desc, x asc) en líneas por y, y las líneas en
// párrafos por el hueco vertical. Devuelve string[] (un párrafo por elemento).
function toParagraphs(items) {
  const lines = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < SAME_LINE_TOL) last.parts.push(it.s);
    else lines.push({ y: it.y, parts: [it.s] });
  }
  const paragraphs = [];
  let prevY = null;
  for (const l of lines) {
    const text = l.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (prevY !== null && prevY - l.y < PARAGRAPH_GAP) paragraphs[paragraphs.length - 1] += ' ' + text;
    else paragraphs.push(text);
    prevY = l.y;
  }
  return paragraphs;
}

function parseAmount(raw, anomalies, where) {
  const text = raw.join(' ').replace(/\s+/g, ' ').trim();
  const m = AMOUNT_RE.exec(text);
  if (!m) {
    anomalies.push(`${where}: cantidad no reconocida "${text}"`);
    return { cantidadTexto: text || null, cantidad: null, unidad: null, opcional: /\*/.test(text) };
  }
  return {
    cantidadTexto: m[1] || null,
    cantidad: Number(m[2].replace(',', '.')),
    unidad: m[3],
    opcional: m[4].includes('*'),
  };
}

async function parseRecipe(getDocument, pdfPath, where, anomalies) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), verbosity: 0 }).promise;
  try {
    if (doc.numPages > 1) {
      // El único caso conocido (Menú 7, canelones) solo lleva el pie en la 2ª página.
      const tc2 = await (await doc.getPage(2)).getTextContent();
      // El pie se descarta por posición, igual que en la página 1 (SEG-datos-nutricionista).
      const extra = tc2.items
        .filter((i) => i.str.trim() && i.transform[5] > FOOTER_MAX_Y)
        .map((i) => i.str.trim());
      if (extra.length) anomalies.push(`${where}: página 2 con texto no esperado: "${extra.join(' ').slice(0, 80)}"`);
    }
    const tc = await (await doc.getPage(1)).getTextContent();
    const items = tc.items
      .filter((i) => i.str.trim() && i.transform[5] > FOOTER_MAX_Y)
      .map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const titulo = items.filter((i) => i.y > TITLE_MIN_Y).map((i) => i.s).join(' ').replace(/\s+/g, ' ');
    const left = items.filter((i) => i.x < COL_RIGHT_X && i.y <= TITLE_MIN_Y);
    const right = items.filter((i) => i.x >= COL_RIGHT_X && i.y <= TITLE_MIN_Y);

    const yTiempos = left.find((i) => /^TIEMPOS$/i.test(i.s))?.y;
    const yIngr = left.find((i) => /^INGREDIENTES$/i.test(i.s))?.y;
    const yEnd = left.find((i) => /^Los ingredientes con un asterisco/i.test(i.s))?.y;
    const yPrep = right.find((i) => /^PREPARACI[OÓ]N$/i.test(i.s))?.y;
    if (yTiempos == null) anomalies.push(`${where}: sin cabecera TIEMPOS`);
    if (yIngr == null) anomalies.push(`${where}: sin cabecera INGREDIENTES`);
    if (yEnd == null) anomalies.push(`${where}: sin línea de cierre de ingredientes`);
    if (yPrep == null) anomalies.push(`${where}: sin cabecera PREPARACIÓN`);
    if (yIngr == null) return null;

    // TIEMPOS: etiqueta (x<150) y valor hh:mm:ss (x>=150) en la misma línea.
    const tiempos = { total: null, elaboracion: null, coccion: null, espera: null };
    if (yTiempos != null) {
      const block = left.filter((i) => i.y < yTiempos && i.y > yIngr);
      for (const it of block) {
        const key = TIME_LABELS[it.s];
        if (!key) {
          if (it.x < COL_VALUE_X) anomalies.push(`${where}: etiqueta de tiempo desconocida "${it.s}"`);
          continue;
        }
        const val = block.find((v) => v.x >= COL_VALUE_X && Math.abs(v.y - it.y) < SAME_LINE_TOL);
        if (val) {
          tiempos[key] = hhmmssToMin(val.s);
          if (tiempos[key] === null) anomalies.push(`${where}: tiempo ${it.s} no es hh:mm:ss: "${val.s}"`);
        }
      }
      if (tiempos.total === null) anomalies.push(`${where}: sin Total en TIEMPOS`);
    }

    // INGREDIENTES: "- Nombre:" (x<150) abre uno; texto sin guion en esa columna es
    // continuación del nombre; todo lo que está a x>=150 es su cantidad.
    const block = left.filter((i) => i.y < yIngr && (yEnd == null || i.y > yEnd));
    const raw = [];
    for (const it of block) {
      if (it.x < COL_VALUE_X) {
        if (/^-\s/.test(it.s)) raw.push({ name: it.s.replace(/^-\s*/, ''), amount: [] });
        else if (raw.length) raw[raw.length - 1].name += ' ' + it.s;
        else anomalies.push(`${where}: texto antes del primer ingrediente "${it.s}"`);
      } else if (raw.length) raw[raw.length - 1].amount.push(it.s);
      else anomalies.push(`${where}: cantidad sin ingrediente "${it.s}"`);
    }
    const ingredientes = raw.map((r) => {
      if (!/:$/.test(r.name)) anomalies.push(`${where}: nombre sin ':' "${r.name}"`);
      if (!r.amount.length) anomalies.push(`${where}: ingrediente sin cantidad "${r.name}"`);
      return { nombre: r.name.replace(/:$/, '').replace(/\s+/g, ' ').trim(), ...parseAmount(r.amount, anomalies, where) };
    });
    if (!ingredientes.length) anomalies.push(`${where}: 0 ingredientes`);

    const preparacion = yPrep == null ? [] : toParagraphs(right.filter((i) => i.y < yPrep));
    if (!preparacion.length) anomalies.push(`${where}: preparación vacía`);

    return { titulo, tiempos, ingredientes, preparacion };
  } finally {
    await doc.destroy();
  }
}

async function main() {
  // pdfjs-dist solo se distribuye como ESM; se carga con import() desde CommonJS.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const menuDirs = fs
    .readdirSync(RAW_DIR)
    .filter((d) => /^Menu \d+$/.test(d))
    .sort((a, b) => parseInt(a.split(' ')[1], 10) - parseInt(b.split(' ')[1], 10));

  const recetas = [];
  const anomalies = [];
  const perMenu = [];
  for (const dir of menuDirs) {
    const menu = dir.split(' ')[1];
    const files = fs
      .readdirSync(path.join(RAW_DIR, dir))
      .filter((f) => f.endsWith('.pdf') && !NON_RECIPE_FILES.test(f.replace(/\.pdf$/, '')))
      .sort();
    let n = 0;
    for (const f of files) {
      const fichero = f.replace(/\.pdf$/, '');
      const where = `Menu ${menu}/${fichero}`;
      const before = anomalies.length;
      let parsed = null;
      try {
        parsed = await parseRecipe(getDocument, path.join(RAW_DIR, dir, f), where, anomalies);
      } catch (e) {
        anomalies.push(`${where}: ERROR ${e.message}`);
      }
      if (!parsed) continue;
      n++;
      recetas.push({ menu, fichero, ...parsed, anomalias: anomalies.length - before });
    }
    perMenu.push({ menu, files: files.length, parsed: n });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'recetas.json'), JSON.stringify(recetas, null, 2), 'utf8');

  // --- QA agregada ---
  const nFiles = perMenu.reduce((a, m) => a + m.files, 0);
  const nIng = recetas.reduce((a, r) => a + r.ingredientes.length, 0);
  const nIngOk = recetas.reduce((a, r) => a + r.ingredientes.filter((i) => i.cantidad !== null).length, 0);
  const nOpc = recetas.reduce((a, r) => a + r.ingredientes.filter((i) => i.opcional).length, 0);
  const nTotal = recetas.filter((r) => r.tiempos.total !== null).length;
  const nPrep = recetas.filter((r) => r.preparacion.length).length;
  const nParr = recetas.reduce((a, r) => a + r.preparacion.length, 0);
  const nombresIng = new Set(recetas.flatMap((r) => r.ingredientes.map((i) => i.nombre.toLowerCase())));
  const unidades = {};
  for (const r of recetas) for (const i of r.ingredientes) unidades[i.unidad] = (unidades[i.unidad] || 0) + 1;

  // Misma receta (mismo fichero) en varios menús: ¿contenido idéntico? Sostiene ARQ-modelo-datos
  // (Recipe como unidad, una fila por receta distinta).
  const byFile = new Map();
  for (const r of recetas) {
    if (!byFile.has(r.fichero)) byFile.set(r.fichero, []);
    byFile.get(r.fichero).push(r);
  }
  const distintos = byFile.size;
  const repetidos = [...byFile.values()].filter((rs) => rs.length > 1).length;
  const CAMPOS = ['titulo', 'tiempos', 'ingredientes', 'preparacion'];
  const divergentes = []; // { fichero, menus, campos }
  for (const [fichero, rs] of byFile) {
    const campos = new Set();
    for (const r of rs.slice(1)) for (const k of CAMPOS) if (JSON.stringify(r[k]) !== JSON.stringify(rs[0][k])) campos.add(k);
    if (campos.size) divergentes.push({ fichero, menus: rs.map((r) => r.menu), campos: [...campos] });
  }
  const divPorCampo = Object.fromEntries(CAMPOS.map((k) => [k, divergentes.filter((d) => d.campos.includes(k)).length]));

  const lines = [];
  lines.push('# QA — extracción de recetas vía pdfjs-dist (texto con coordenadas)\n');
  lines.push('Salida de `scripts/datos/parse-recetas-pdfjs.js`: un objeto por fichero PDF de receta');
  lines.push('(título, tiempos en minutos, ingredientes con nombre/cantidad/unidad/opcional, preparación');
  lines.push('en párrafos). El JSON va a `data/recetas.json` (gitignoreado, SEG-datos-nutricionista); aquí solo la QA agregada.\n');
  lines.push('| Métrica | Valor |');
  lines.push('|---|---|');
  lines.push(`| Ficheros PDF de receta | ${nFiles} |`);
  lines.push(`| Recetas extraídas | ${recetas.length} |`);
  lines.push(`| Ficheros de receta distintos (por nombre) | ${distintos} |`);
  lines.push(`| Ficheros que se repiten en 2+ menús | ${repetidos} |`);
  lines.push(`| … de ellos, con contenido divergente entre menús | ${divergentes.length} (${CAMPOS.map((k) => `${k}: ${divPorCampo[k]}`).join(', ')}) |`);
  lines.push(`| Recetas con \`Total\` en TIEMPOS | ${nTotal} |`);
  lines.push(`| Recetas con preparación | ${nPrep} (${nParr} párrafos) |`);
  lines.push(`| Ingredientes | ${nIng} |`);
  lines.push(`| Ingredientes con cantidad numérica y unidad | ${nIngOk} |`);
  lines.push(`| Ingredientes opcionales (\`*\`) | ${nOpc} |`);
  lines.push(`| Nombres de ingrediente distintos (sin normalizar) | ${nombresIng.size} |`);
  lines.push(`| Unidades | ${Object.entries(unidades).map(([u, n]) => `${u}: ${n}`).join(', ')} |`);
  lines.push(`| Anomalías | ${anomalies.length} |`);
  lines.push('');
  lines.push('| Menú | ficheros | extraídas |');
  lines.push('|---|---|---|');
  for (const m of perMenu) lines.push(`| ${m.menu} | ${m.files} | ${m.parsed} |`);
  if (divergentes.length) {
    lines.push('\n## Recetas con versiones distintas entre menús\n');
    lines.push('El mismo fichero aparece en varios menús con diferencias (una pizca de sal 5 g → 2 g, un');
    lines.push('ingrediente que pasa a opcional, "180º" → "180ºC"...). Son ediciones del nutricionista a lo');
    lines.push('largo del tiempo, no errores del parser. La ingesta tiene que elegir versión (T2 §4).\n');
    lines.push('| Fichero | Menús | Campos que difieren |');
    lines.push('|---|---|---|');
    for (const d of divergentes) lines.push(`| ${d.fichero} | ${d.menus.join(', ')} | ${d.campos.join(', ')} |`);
  }
  if (anomalies.length) {
    lines.push('\n## Anomalías\n');
    for (const a of anomalies) lines.push(`- ${a}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'qa-recetas-pdfjs.md'), lines.join('\n') + '\n', 'utf8');

  console.log(`OK. ${recetas.length} recetas extraídas de ${nFiles} PDF; ${distintos} ficheros distintos, ${repetidos} repetidos, ${divergentes.length} con versiones divergentes.`);
  console.log(`Ingredientes: ${nIng} (${nIngOk} con cantidad+unidad, ${nOpc} opcionales). Tiempos con Total: ${nTotal}. Preparación: ${nPrep}.`);
  console.log(`Anomalías: ${anomalies.length}`);
  for (const a of anomalies.slice(0, 20)) console.log('  ' + a);
  console.log(`Salida: ${path.join(DATA_DIR, 'recetas.json')} (dataset, gitignoreado)`);
  console.log(`Salida: ${path.join(OUT_DIR, 'qa-recetas-pdfjs.md')} (QA, local)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
