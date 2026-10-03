import type { LayoutAnomaly, SourceError, SourceRecipe } from '@/application/ports/document-source';
import type { RecipeIngredient, RecipeTimes, Unit } from '@/domain/recipe/recipe';
import { err, ok, type Result } from '@/shared/result';

/** A text item of a PDF page, in points, with the origin at the bottom-left corner. */
export type PositionedText = { x: number; y: number; text: string };

// Geometry measured on the recipe template.
const COL_RIGHT_X = 290; // from here on, the preparation column
const COL_VALUE_X = 150; // in the left column, from here on, amounts and time values
const TITLE_MIN_Y = 700; // above the TIEMPOS / PREPARACIÓN headers there is only the title
const FOOTER_MAX_Y = 40; // page footer (slogan, generator): discarded
const SAME_LINE_TOL = 2; // two items with |Δy| below this are on the same line
const PARAGRAPH_GAP = 18; // normal line spacing 12.5; paragraph break 25

const TIMES_HEADER = /^TIEMPOS$/i;
const INGREDIENTS_HEADER = /^INGREDIENTES$/i;
const PREPARATION_HEADER = /^PREPARACI[OÓ]N$/i;
// The closing line and everything below it in the left column carry the nutritionist's contact data.
const CLOSING_LINE = /^Los ingredientes con un asterisco/i;
const INGREDIENT_START = /^-\s/;
const SECOND_PAGE_EXCERPT = 80;

// "1 cucharada (15 ml)", "(120 g)", "al gusto (1 g) *", "2-3 unidades (30 g) * *": an optional
// household measure, then the weight in brackets, then the optional marks.
const WEIGHT = /^\((\d+(?:[.,]\d+)?)\s*(g|ml|kg|l)\)([\s*]*)$/;
const TIME = /^(\d\d):(\d\d):(\d\d)$/;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const TIME_LABELS: Record<string, keyof RecipeTimes> = {
  'Total:': 'total',
  'Elaboración:': 'preparation',
  'Cocción:': 'cooking',
  'Espera/reposo:': 'resting',
};

/**
 * Reads a recipe page by the position of its text: title on top, times and
 * ingredients in the left column, preparation in the right one. The footer and
 * the closing block (the nutritionist's contact data) never reach the recipe.
 * Only the second page's leftover body text is looked at, to report it.
 */
export function parseRecipePage(
  page1: PositionedText[],
  page2: PositionedText[] | null,
): Result<SourceRecipe, SourceError> {
  const anomalies: LayoutAnomaly[] = [];
  const secondPageText = readingOrder(page2 ?? [])
    .map((item) => item.text)
    .join(' ');
  if (secondPageText) {
    anomalies.push({ kind: 'unexpected-second-page-text', text: secondPageText.slice(0, SECOND_PAGE_EXCERPT) });
  }

  const items = readingOrder(page1);
  const title = collapse(
    items
      .filter((item) => item.y > TITLE_MIN_Y)
      .map((item) => item.text)
      .join(' '),
  );
  const left = items.filter((item) => item.x < COL_RIGHT_X && item.y <= TITLE_MIN_Y);
  const right = items.filter((item) => item.x >= COL_RIGHT_X && item.y <= TITLE_MIN_Y);

  const timesY = left.find((item) => TIMES_HEADER.test(item.text))?.y;
  const ingredientsY = left.find((item) => INGREDIENTS_HEADER.test(item.text))?.y;
  const closingY = left.find((item) => CLOSING_LINE.test(item.text))?.y;
  const preparationY = right.find((item) => PREPARATION_HEADER.test(item.text))?.y;
  if (ingredientsY === undefined) return err({ kind: 'missing-section', section: 'ingredients' });
  if (timesY === undefined) anomalies.push({ kind: 'missing-times-section' });
  if (closingY === undefined) anomalies.push({ kind: 'missing-closing-line' });
  if (preparationY === undefined) anomalies.push({ kind: 'missing-preparation-section' });

  const times =
    timesY === undefined
      ? { total: null, preparation: null, cooking: null, resting: null }
      : readTimes(
          left.filter((item) => item.y < timesY && item.y > ingredientsY),
          anomalies,
        );
  const ingredients = readIngredients(
    left.filter((item) => item.y < ingredientsY && (closingY === undefined || item.y > closingY)),
    anomalies,
  );
  const preparation =
    preparationY === undefined ? [] : toParagraphs(right.filter((item) => item.y < preparationY));

  return ok({ content: { title, times, ingredients, preparation }, anomalies });
}

/** Drops the footer and orders the items in reading order: by line from the top, then left to right. */
function readingOrder(items: PositionedText[]): PositionedText[] {
  const body = items
    .filter((item) => item.y > FOOTER_MAX_Y)
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text)
    .sort((a, b) => b.y - a.y);
  return toLines(body).flat();
}

/** Groups items in reading order into lines, each sorted left to right. */
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

function readTimes(block: PositionedText[], anomalies: LayoutAnomaly[]): RecipeTimes {
  const times: RecipeTimes = { total: null, preparation: null, cooking: null, resting: null };
  for (const item of block) {
    const key = TIME_LABELS[item.text];
    if (!key) {
      if (item.x < COL_VALUE_X) anomalies.push({ kind: 'unknown-time-label', text: item.text });
      continue;
    }
    const value = block.find((other) => other.x >= COL_VALUE_X && Math.abs(other.y - item.y) < SAME_LINE_TOL);
    if (!value) continue;
    times[key] = toMinutes(value.text);
    if (times[key] === null) anomalies.push({ kind: 'invalid-time', label: item.text, text: value.text });
  }
  return times;
}

function toMinutes(value: string): number | null {
  const match = TIME.exec(value);
  if (!match) return null;
  const [, hours, minutes, seconds] = match.map(Number);
  return hours * MINUTES_PER_HOUR + minutes + Math.round(seconds / SECONDS_PER_MINUTE);
}

function readIngredients(block: PositionedText[], anomalies: LayoutAnomaly[]): RecipeIngredient[] {
  const raw: { name: string; amount: string[] }[] = [];
  for (const item of block) {
    const current = raw.at(-1);
    if (item.x >= COL_VALUE_X) {
      if (current) current.amount.push(item.text);
      else anomalies.push({ kind: 'amount-without-ingredient', text: item.text });
    } else if (INGREDIENT_START.test(item.text)) {
      raw.push({ name: item.text.replace(/^-\s*/, ''), amount: [] });
    } else if (current) {
      current.name += ` ${item.text}`;
    } else {
      anomalies.push({ kind: 'text-before-first-ingredient', text: item.text });
    }
  }
  return raw.map(({ name, amount }) => {
    if (!name.endsWith(':')) anomalies.push({ kind: 'name-without-colon', text: name });
    if (amount.length === 0) anomalies.push({ kind: 'ingredient-without-amount', text: name });
    return { name: collapse(name.replace(/:$/, '')), ...readAmount(amount, anomalies) };
  });
}

function readAmount(parts: string[], anomalies: LayoutAnomaly[]): Omit<RecipeIngredient, 'name'> {
  const text = collapse(parts.join(' '));
  const match = matchAmount(text);
  if (!match) {
    anomalies.push({ kind: 'unrecognized-amount', text });
    return { householdMeasure: text || null, quantity: null, unit: null, optional: text.includes('*') };
  }
  const [, quantity, unit, marks] = match.weight;
  return {
    householdMeasure: match.householdMeasure,
    quantity: Number(quantity.replace(',', '.')),
    unit: unit as Unit,
    optional: marks.includes('*'),
  };
}

/** Splits the amount at its last bracket, which must open the text or follow a space. */
function matchAmount(text: string): { householdMeasure: string | null; weight: RegExpExecArray } | null {
  const open = text.lastIndexOf('(');
  if (open < 0 || (open > 0 && text[open - 1] !== ' ')) return null;
  const weight = WEIGHT.exec(text.slice(open));
  return weight ? { householdMeasure: open > 0 ? text.slice(0, open).trim() : null, weight } : null;
}

/** Joins lines into paragraphs; a vertical gap of `PARAGRAPH_GAP` or more starts a new one. */
function toParagraphs(items: PositionedText[]): string[] {
  const paragraphs: string[] = [];
  let previousY: number | null = null;
  for (const line of toLines(items)) {
    const text = collapse(line.map((item) => item.text).join(' '));
    const y = line[0].y;
    if (previousY !== null && previousY - y < PARAGRAPH_GAP) paragraphs[paragraphs.length - 1] += ` ${text}`;
    else paragraphs.push(text);
    previousY = y;
  }
  return paragraphs;
}
