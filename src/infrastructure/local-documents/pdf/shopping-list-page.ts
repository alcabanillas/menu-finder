import type { ShoppingListAnomaly, SourceShoppingList } from '@/application/ports/document-source';
import type { Unit } from '@/domain/recipe/recipe';
import type { ShoppingItem } from '@/domain/shopping/shopping-list';
import type { PositionedText } from '@/infrastructure/local-documents/pdf/positioned-text';

export type { PositionedText };

const ANOMALY_UNREADABLE_AMOUNT = 'item-without-readable-amount' as const;

const CATEGORY_HEADERS = [
  'Azúcar, chocolate y derivados',
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
] as const;

const FREE_TEXT_CATEGORIES = new Set<string>(['Especias', 'Grasas y aceites']);

const SAME_LINE_TOL = 2;
// Measured on the 36 real PDFs: footer lines sit at y <= 11.3, lowest content line sits at y >= 56.7.
const FOOTER_MAX_Y = 40;
const TITLE_MIN_Y = 750;
const COL_SPLIT_X = 280;
const TITLE_PATTERN = /^lista de la compra$/i;
const OPTIONAL_MARK = /\(opcional\)$/i;
const AMOUNT_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(g|ml)?$/i;
const FREE_TEXT_SEPARATOR = ' , ';

type ParseContext = {
  currentCategory: string | null;
  pendingItemLine: string | null;
  freeTextLines: string[];
  items: ShoppingItem[];
  anomalies: ShoppingListAnomaly[];
};

/**
 * Parses positioned text across all pages of a shopping list PDF into structured items.
 */
export function parseShoppingListPage(pages: PositionedText[][]): SourceShoppingList {
  const context: ParseContext = {
    currentCategory: null,
    pendingItemLine: null,
    freeTextLines: [],
    items: [],
    anomalies: [],
  };

  const lines = extractLines(pages);
  for (const line of lines) {
    if (TITLE_PATTERN.test(line)) continue;
    processLine(context, line);
  }

  flushCategory(context);

  return {
    pages: pages.length,
    items: context.items,
    anomalies: context.anomalies,
  };
}

function processLine(context: ParseContext, line: string): void {
  const matchedCategory = matchCategoryHeader(line);
  if (matchedCategory) {
    flushCategory(context);
    context.currentCategory = matchedCategory;
    return;
  }

  if (context.currentCategory === null) {
    context.anomalies.push({ kind: 'line-before-first-category', text: line });
    return;
  }

  processContentLine(context, line);
}

function flushCategory(context: ParseContext): void {
  flushPendingItem(context);
  flushFreeText(context);
}

function flushPendingItem(context: ParseContext): void {
  if (context.pendingItemLine) {
    context.anomalies.push({ kind: ANOMALY_UNREADABLE_AMOUNT, text: context.pendingItemLine });
    context.pendingItemLine = null;
  }
}

function flushFreeText(context: ParseContext): void {
  if (context.freeTextLines.length === 0 || !context.currentCategory) return;
  const parsedItems = parseFreeTextItems(context.currentCategory, context.freeTextLines);
  context.items.push(...parsedItems);
  context.freeTextLines = [];
}

function parseFreeTextItems(category: string, lines: string[]): ShoppingItem[] {
  const joined = collapse(lines.join(' '));
  if (!joined) return [];

  const tokens = joined.split(FREE_TEXT_SEPARATOR);
  const items: ShoppingItem[] = [];

  for (const token of tokens) {
    const isOptional = OPTIONAL_MARK.test(token);
    const name = collapse(token.replace(OPTIONAL_MARK, ''));
    if (name) {
      items.push({
        category,
        name,
        quantity: null,
        unit: null,
        optional: isOptional,
      });
    }
  }

  return items;
}

function processContentLine(context: ParseContext, line: string): void {
  if (FREE_TEXT_CATEGORIES.has(context.currentCategory!)) {
    context.freeTextLines.push(line);
    return;
  }

  processStandardItemLine(context, line);
}

function processStandardItemLine(context: ParseContext, line: string): void {
  if (line.toLowerCase() === '(opcional)') {
    markLastItemOptional(context.items);
    return;
  }

  if (line.startsWith('- ')) {
    flushPendingItem(context);
    parseOrQueueItem(context, line);
    return;
  }

  if (context.pendingItemLine) {
    const continuation = `${context.pendingItemLine} ${line}`;
    context.pendingItemLine = null;
    parseOrQueueItem(context, continuation);
    return;
  }

  context.anomalies.push({ kind: 'unrecognized-line', text: line });
}

function parseOrQueueItem(context: ParseContext, line: string): void {
  const colonIndex = line.lastIndexOf(':');
  if (colonIndex === -1) {
    context.pendingItemLine = line;
    return;
  }

  context.pendingItemLine = null;
  const parsedItem = parseItemLine(line, colonIndex, context.currentCategory!);
  if (parsedItem) {
    context.items.push(parsedItem);
  } else {
    context.anomalies.push({ kind: ANOMALY_UNREADABLE_AMOUNT, text: line });
  }
}

function markLastItemOptional(items: ShoppingItem[]): void {
  const lastItem = items.at(-1);
  if (lastItem) {
    lastItem.optional = true;
  }
}

function extractLines(pages: PositionedText[][]): string[] {
  const titles: string[] = [];
  const leftLines: string[] = [];
  const rightLines: string[] = [];

  for (let p = 0; p < pages.length; p += 1) {
    const isFirstPage = p === 0;
    const body = pages[p]
      .filter((item) => item.y > FOOTER_MAX_Y)
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text);

    const isTitle = (item: PositionedText) =>
      TITLE_PATTERN.test(item.text) || (isFirstPage && item.y > TITLE_MIN_Y);

    const titleItems = body.filter(isTitle).sort((a, b) => b.y - a.y);
    const content = body.filter((item) => !isTitle(item));
    const leftItems = content.filter((item) => item.x < COL_SPLIT_X).sort((a, b) => b.y - a.y);
    const rightItems = content.filter((item) => item.x >= COL_SPLIT_X).sort((a, b) => b.y - a.y);

    appendLines(titles, toLines(titleItems));
    appendLines(leftLines, toLines(leftItems));
    appendLines(rightLines, toLines(rightItems));
  }

  return [...titles, ...leftLines, ...rightLines];
}

function appendLines(target: string[], lineGroups: PositionedText[][]): void {
  for (const lineItems of lineGroups) {
    const text = collapse(lineItems.map((item) => item.text).join(' '));
    if (text) target.push(text);
  }
}

function toLines(items: PositionedText[]): PositionedText[][] {
  const lines: PositionedText[][] = [];
  for (const item of items) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0].y - item.y) < SAME_LINE_TOL) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function matchCategoryHeader(line: string): string | null {
  const normalized = line.trim().toLowerCase();
  for (const header of CATEGORY_HEADERS) {
    if (header.toLowerCase() === normalized) return header;
  }
  return null;
}

function parseItemLine(line: string, colonIndex: number, category: string): ShoppingItem | null {
  const name = collapse(line.slice(2, colonIndex));
  const rawAmount = line.slice(colonIndex + 1).trim();

  const isOptional = OPTIONAL_MARK.test(rawAmount);
  const cleanAmount = rawAmount.replace(OPTIONAL_MARK, '').trim();

  const match = AMOUNT_PATTERN.exec(cleanAmount);
  if (!match) return null;

  const [, quantityStr, unitStr] = match;
  const quantity = Number(quantityStr.replace(',', '.'));
  const unit = (unitStr?.toLowerCase() as Unit) ?? null;

  return {
    category,
    name,
    quantity,
    unit,
    optional: isOptional,
  };
}
