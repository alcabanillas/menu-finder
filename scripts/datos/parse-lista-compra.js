// Generación local de datos (T0, paso 4). Parsea Lista_de_la_compra.pdf.txt de los 36 menús.
// Pendiente de revisión y de documentar su contrato (T2 §3).
// Uso: pnpm datos:lista
//
// SEG-datos-nutricionista: el pie del PDF (eslogan, marca) no se escribe en el código.
// Sus patrones se leen de data/marca.json (gitignoreado); ver T0 §2.
'use strict';
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw', 'Dieta');
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'qa');
const MARCA_FILE = path.join(__dirname, '..', '..', 'data', 'marca.json');

// Patrones (regex, sin barras) de las líneas del pie que hay que descartar.
// Si falta el fichero, el pie no se filtra: saldrá como warning en la QA.
function loadFooterPatterns() {
  if (!fs.existsSync(MARCA_FILE)) {
    console.warn(`Aviso: no existe ${MARCA_FILE}; el pie del PDF no se filtrará (T0 §2).`);
    return [];
  }
  const { footerPatterns = [] } = JSON.parse(fs.readFileSync(MARCA_FILE, 'utf8'));
  return footerPatterns.map((p) => new RegExp(p, 'i'));
}
const FOOTER_PATTERNS = loadFooterPatterns();
const isFooter = (line) => FOOTER_PATTERNS.some((re) => re.test(line));

const CATEGORIES = [
  'Bebidas (no lácteas)',
  'Cárnicos y derivados',
  'Cereales y derivados',
  'Huevos y derivados',
  'Lácteos y derivados',
  'Legumbres, semillas, frutos secos y derivados',
  'Otros',
  'Pescados, moluscos, crustáceos y derivados',
  'Frutas y derivados',
  'Verduras, hortalizas y derivados',
  'Especias',
  'Grasas y aceites',
  'Azúcar, chocolate y derivados',
];
const FREEFORM_CATEGORIES = new Set(['Especias', 'Grasas y aceites']);

function normalizeSpaces(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function matchCategory(line) {
  const norm = normalizeSpaces(line);
  for (const cat of CATEGORIES) {
    if (norm === cat || norm.replace(/\s*\(.*\)\s*$/, '') === cat.replace(/\s*\(.*\)\s*$/, '')) {
      return cat;
    }
  }
  return null;
}

// Divide cada línea física en fragmento-izquierdo / fragmento-derecho según la
// posición de la columna derecha (detectada por huecos de >=6 espacios).
function splitColumns(lines) {
  const gapRe = /( {6,})/;
  // Posición absoluta (en la línea original) donde arranca la columna derecha,
  // medida solo en líneas que sí tienen hueco interno (tras quitar el margen izquierdo).
  const rightStarts = [];
  for (const line of lines) {
    const leadingLen = line.length - line.replace(/^\s+/, '').length;
    const trimmedLine = line.slice(leadingLen);
    if (!trimmedLine) continue;
    const m = gapRe.exec(trimmedLine);
    if (m) rightStarts.push(leadingLen + m.index + m[1].length);
  }
  rightStarts.sort((a, b) => a - b);
  const rightColStart = rightStarts.length
    ? rightStarts[Math.floor(rightStarts.length / 2)]
    : 60;

  const left = [];
  const right = [];
  for (const rawLine of lines) {
    const leadingLen = rawLine.length - rawLine.replace(/^\s+/, '').length;
    const trimmedLine = rawLine.slice(leadingLen);
    if (!trimmedLine) continue;
    const m = gapRe.exec(trimmedLine);
    if (m) {
      const l = trimmedLine.slice(0, m.index).trim();
      const r = trimmedLine.slice(m.index + m[1].length).trim();
      if (l) left.push(l);
      if (r) right.push(r);
    } else {
      if (leadingLen < rightColStart - 15) left.push(trimmedLine);
      else right.push(trimmedLine);
    }
  }
  return { left, right, rightColStart };
}

const ITEM_RE = /^-\s*(.+?):\s*([0-9]+(?:[.,][0-9]+)?\s*\S*?)\s*(\(opcional\))?\s*$/i;

function parseStream(entries) {
  const items = []; // { categoria, nombre, cantidadRaw, opcional }
  const freeform = {}; // categoria -> texto acumulado
  const warnings = [];
  let currentCategory = null;
  let mode = 'items'; // 'items' | 'freeform'
  let pendingNamePrefix = null; // para nombres partidos en dos líneas antes de ':'

  for (const entry of entries) {
    const cat = matchCategory(entry);
    if (cat) {
      currentCategory = cat;
      mode = FREEFORM_CATEGORIES.has(cat) ? 'freeform' : 'items';
      pendingNamePrefix = null;
      continue;
    }
    if (!currentCategory) {
      warnings.push(`Línea fuera de categoría, ignorada: "${entry}"`);
      continue;
    }
    if (mode === 'freeform') {
      freeform[currentCategory] = (freeform[currentCategory] || '') + ' ' + entry;
      continue;
    }
    // mode === 'items'
    if (/^\(opcional\)$/i.test(entry)) {
      if (items.length) items[items.length - 1].opcional = true;
      else warnings.push('"(opcional)" suelto sin ítem previo');
      continue;
    }
    if (entry.startsWith('-')) {
      const withPrefix = pendingNamePrefix ? `- ${pendingNamePrefix} ${entry.slice(1).trim()}` : entry;
      const m = ITEM_RE.exec(withPrefix);
      if (m) {
        items.push({
          categoria: currentCategory,
          nombre: m[1].trim(),
          cantidadRaw: m[2].trim(),
          opcional: !!m[3],
        });
        pendingNamePrefix = null;
      } else {
        // No matchea "- nombre: cantidad" completo -> puede que la cantidad venga en la siguiente línea
        pendingNamePrefix = entry.replace(/^-\s*/, '');
        warnings.push(`Ítem sin cantidad reconocible, se intenta continuar: "${entry}"`);
      }
      continue;
    }
    // Línea sin "-": continuación de nombre partido, o cierre de un pendiente
    if (pendingNamePrefix) {
      const withPrefix = `- ${pendingNamePrefix} ${entry}`;
      const m = ITEM_RE.exec(withPrefix);
      if (m) {
        items.push({
          categoria: currentCategory,
          nombre: m[1].trim(),
          cantidadRaw: m[2].trim(),
          opcional: !!m[3],
        });
        pendingNamePrefix = null;
      } else {
        pendingNamePrefix = `${pendingNamePrefix} ${entry}`;
      }
      continue;
    }
    warnings.push(`Línea no reconocida en modo items, ignorada: "${entry}"`);
  }
  if (pendingNamePrefix) warnings.push(`Nombre de ítem sin cerrar al final del stream: "${pendingNamePrefix}"`);
  return { items, freeform, warnings };
}

function parseListaCompra(txt) {
  const lines = txt.split(/\r?\n/);
  // Recorta la cabecera "Lista de la compra", la línea del generador (TCPDF) y el pie (data/marca.json)
  const bodyLines = lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^Lista de la compra$/i.test(t)) return false;
    if (/^Powered by TCPDF/i.test(t)) return false;
    if (isFooter(t)) return false;
    return true;
  });
  const { left, right, rightColStart } = splitColumns(bodyLines);
  const leftParsed = parseStream(left);
  const rightParsed = parseStream(right);
  const items = [...leftParsed.items, ...rightParsed.items];
  const freeform = { ...leftParsed.freeform, ...rightParsed.freeform };
  const warnings = [...leftParsed.warnings, ...rightParsed.warnings];
  return { items, freeform, warnings, rightColStart };
}

function detectTwoPageArtifact(txt) {
  // Indicio de que el PDF original tenía 2 páginas y el copy/paste (o la extracción)
  // duplicó cabecera/pie, o hay dos bloques "Lista de la compra" / categorías repetidas.
  const footerCount = txt.split(/\r?\n/).filter((l) => isFooter(l.trim())).length;
  const titleCount = (txt.match(/Lista de la compra/g) || []).length;
  return { footerCount, titleCount, suspicious: footerCount > 1 || titleCount > 1 };
}

function main() {
  const menuDirs = fs
    .readdirSync(RAW_DIR)
    .filter((d) => /^Menu \d+$/.test(d))
    .sort((a, b) => parseInt(a.split(' ')[1], 10) - parseInt(b.split(' ')[1], 10));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allItemsRows = [['menu', 'categoria', 'ingrediente', 'cantidad_raw', 'opcional']];
  const report = [];

  for (const dir of menuDirs) {
    const menuId = dir.split(' ')[1];
    const filePath = path.join(RAW_DIR, dir, 'Lista_de_la_compra.pdf.txt');
    if (!fs.existsSync(filePath)) {
      report.push({ menu: menuId, error: 'Fichero no encontrado' });
      continue;
    }
    const txt = fs.readFileSync(filePath, 'utf8');
    const twoPage = detectTwoPageArtifact(txt);
    const { items, freeform, warnings, rightColStart } = parseListaCompra(txt);

    const categoriasVistas = new Set(items.map((i) => i.categoria));
    const categoriasFaltantes = CATEGORIES.filter(
      (c) => !categoriasVistas.has(c) && !(c in freeform)
    );

    for (const it of items) {
      allItemsRows.push([menuId, it.categoria, it.nombre, it.cantidadRaw, it.opcional ? '1' : '0']);
    }

    report.push({
      menu: menuId,
      rightColStart,
      nItems: items.length,
      nWarnings: warnings.length,
      categoriasFaltantes,
      twoPageSuspicious: twoPage.suspicious,
      footerCount: twoPage.footerCount,
      titleCount: twoPage.titleCount,
      warnings,
    });
  }

  // CSV agregado
  const csv = allItemsRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'lista-compra-items.csv'), csv, 'utf8');

  // Informe QA en texto
  const lines = [];
  lines.push('# QA — parseo de Lista_de_la_compra.pdf.txt (36 menús)\n');
  const nItemsArr = report.filter((r) => !r.error).map((r) => r.nItems);
  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  lines.push(`Ítems por menú: mediana=${median(nItemsArr)}, min=${Math.min(...nItemsArr)}, max=${Math.max(...nItemsArr)}\n`);

  const conWarnings = report.filter((r) => r.nWarnings > 0);
  const conDosPaginas = report.filter((r) => r.twoPageSuspicious);
  const conCategoriasFaltantes = report.filter((r) => r.categoriasFaltantes && r.categoriasFaltantes.length > 0);

  lines.push(`Menús con warnings de parseo: ${conWarnings.length}/36`);
  lines.push(`Menús con indicio de artefacto de 2 páginas (título o pie duplicado): ${conDosPaginas.length}/36`);
  lines.push(`Menús con categorías fijas ausentes: ${conCategoriasFaltantes.length}/36\n`);

  lines.push('## Detalle por menú\n');
  lines.push('| Menu | items | warnings | 2-páginas? | categorías faltantes |');
  lines.push('|---|---|---|---|---|');
  for (const r of report) {
    if (r.error) {
      lines.push(`| ${r.menu} | - | - | - | ERROR: ${r.error} |`);
      continue;
    }
    lines.push(
      `| ${r.menu} | ${r.nItems} | ${r.nWarnings} | ${r.twoPageSuspicious ? `SÍ (título×${r.titleCount}, pie×${r.footerCount})` : 'no'} | ${
        r.categoriasFaltantes.length ? r.categoriasFaltantes.join('; ') : '-'
      } |`
    );
  }

  lines.push('\n## Warnings detallados (menús con >0)\n');
  for (const r of conWarnings) {
    lines.push(`### Menu ${r.menu}`);
    for (const w of r.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'qa-lista-compra.md'), lines.join('\n'), 'utf8');

  console.log(`OK. ${allItemsRows.length - 1} ítems extraídos en total.`);
  console.log(`Menús con warnings: ${conWarnings.length}/36`);
  console.log(`Menús con indicio de 2 páginas: ${conDosPaginas.length}/36 -> ${conDosPaginas.map((r) => r.menu).join(', ')}`);
  console.log(`Salida: ${OUT_DIR}`);
}

main();
