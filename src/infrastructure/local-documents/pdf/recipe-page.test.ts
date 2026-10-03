import { describe, expect, it } from 'vitest';
import type { LayoutAnomaly, SourceRecipe } from '@/application/ports/document-source';
import { err } from '@/shared/result';
import { parseRecipePage, type PositionedText } from '@/infrastructure/local-documents/pdf/recipe-page';

const at = (x: number, y: number, text: string): PositionedText => ({ x, y, text });

// A fictitious recipe page with the real template's geometry: title above y=700,
// names and labels at x=36, amounts and time values at x=171, preparation at x=300.
const TITLE = [at(36, 750, 'Tortilla de prueba')];
const TIMES = [
  at(36, 690, 'TIEMPOS'),
  at(36, 675, 'Total:'),
  at(171, 675, '00:30:00'),
  at(36, 662, 'Elaboración:'),
  at(171, 662, '00:10:00'),
];
const INGREDIENTS_HEADER = [at(36, 640, 'INGREDIENTES')];
const EGG = [at(36, 625, '- Huevo:'), at(171, 625, '2 unidades (120 g)')];
const CLOSING = [
  at(36, 400, 'Los ingredientes con un asterisco son opcionales'),
  at(36, 388, 'Contacto: marca-ficticia@example.com'),
];
const PREPARATION = [at(300, 690, 'PREPARACIÓN'), at(300, 675, 'Batir los huevos.')];
const FOOTER = [at(36, 20, 'Eslogan ficticio de la marca')];

const page = (...parts: PositionedText[][]): PositionedText[] => parts.flat();
const fullPage = (...extra: PositionedText[][]) =>
  page(TITLE, TIMES, INGREDIENTS_HEADER, EGG, CLOSING, PREPARATION, FOOTER, ...extra);

const parse = (page1: PositionedText[], page2: PositionedText[] | null = null): SourceRecipe => {
  const result = parseRecipePage(page1, page2);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
};

const withIngredients = (...lines: PositionedText[]) =>
  parse(page(TITLE, TIMES, INGREDIENTS_HEADER, lines, CLOSING, PREPARATION));

const withTimes = (...lines: PositionedText[]) =>
  parse(page(TITLE, [at(36, 690, 'TIEMPOS'), ...lines], INGREDIENTS_HEADER, EGG, CLOSING, PREPARATION));

const withPreparation = (...lines: PositionedText[]) =>
  parse(page(TITLE, TIMES, INGREDIENTS_HEADER, EGG, CLOSING, lines));

describe('parseRecipePage', () => {
  describe('page layout', () => {
    it('reads a complete page with no anomalies', () => {
      expect(parse(fullPage())).toEqual({
        content: {
          title: 'Tortilla de prueba',
          times: { total: 30, preparation: 10, cooking: null, resting: null },
          ingredients: [
            { name: 'Huevo', householdMeasure: '2 unidades', quantity: 120, unit: 'g', optional: false },
          ],
          preparation: ['Batir los huevos.'],
        },
        anomalies: [],
      });
    });

    it('keeps the footer and the closing block out of every field', () => {
      const serialized = JSON.stringify(parse(fullPage()));

      expect(serialized).not.toMatch(/asterisco|marca-ficticia|Eslogan/);
    });

    it('keeps footer text in the preparation column out of the preparation', () => {
      const { content } = parse(fullPage([at(300, 30, 'Eslogan en la columna derecha')]));

      expect(content.preparation).toEqual(['Batir los huevos.']);
    });

    it('joins a title on two lines', () => {
      const { content } = parse(
        fullPage().filter((item) => item.y <= 700).concat(at(36, 760, 'Alcachofas rellenas'), at(36, 740, 'de huevo y gambas')),
      );

      expect(content.title).toBe('Alcachofas rellenas de huevo y gambas');
    });

    it('joins items on the same line from left to right, whatever their input order', () => {
      const { content } = parse(
        fullPage().filter((item) => item.y <= 700).concat(at(120, 751, 'prueba'), at(36, 750, 'Tortilla de')),
      );

      expect(content.title).toBe('Tortilla de prueba');
    });

    it('fails without an INGREDIENTES header', () => {
      expect(parseRecipePage(page(TITLE, TIMES, EGG, CLOSING, PREPARATION), null)).toEqual(
        err({ kind: 'missing-section', section: 'ingredients' }),
      );
    });

    it('reports a missing TIEMPOS header and leaves every time empty', () => {
      const recipe = parse(page(TITLE, INGREDIENTS_HEADER, EGG, CLOSING, PREPARATION));

      expect(recipe.content.times).toEqual({ total: null, preparation: null, cooking: null, resting: null });
      expect(recipe.anomalies).toEqual([{ kind: 'missing-times-section' }]);
    });

    it('reports a missing closing line and still reads the ingredients', () => {
      const recipe = parse(page(TITLE, TIMES, INGREDIENTS_HEADER, EGG, PREPARATION));

      expect(recipe.content.ingredients).toHaveLength(1);
      expect(recipe.anomalies).toEqual([{ kind: 'missing-closing-line' }]);
    });

    it('reports a missing PREPARACIÓN header with an empty preparation', () => {
      const recipe = parse(page(TITLE, TIMES, INGREDIENTS_HEADER, EGG, CLOSING, [at(300, 675, 'Texto suelto.')]));

      expect(recipe.content.preparation).toEqual([]);
      expect(recipe.anomalies).toEqual([{ kind: 'missing-preparation-section' }]);
    });

    it('accepts the preparation header without accent', () => {
      const recipe = withPreparation(at(300, 690, 'PREPARACION'), at(300, 675, 'Batir.'));

      expect(recipe.content.preparation).toEqual(['Batir.']);
    });
  });

  describe('times', () => {
    it('stores the times in whole minutes, with the seconds rounded', () => {
      const { content, anomalies } = withTimes(
        at(36, 675, 'Total:'),
        at(171, 675, '01:05:00'),
        at(36, 662, 'Cocción:'),
        at(171, 662, '00:20:40'),
        at(36, 649, 'Espera/reposo:'),
        at(171, 649, '00:00:20'),
      );

      expect(content.times).toEqual({ total: 65, preparation: null, cooking: 21, resting: 0 });
      expect(anomalies).toEqual([]);
    });

    it('leaves an invalid value empty and reports it', () => {
      const { content, anomalies } = withTimes(at(36, 675, 'Total:'), at(171, 675, '1h 5min'));

      expect(content.times.total).toBeNull();
      expect(anomalies).toEqual([{ kind: 'invalid-time', label: 'Total:', text: '1h 5min' }]);
    });

    it('reports an unknown label and keeps the known times', () => {
      const { content, anomalies } = withTimes(
        at(36, 675, 'Total:'),
        at(171, 675, '00:30:00'),
        at(36, 662, 'Horneado:'),
        at(171, 662, '00:15:00'),
      );

      expect(content.times).toEqual({ total: 30, preparation: null, cooking: null, resting: null });
      expect(anomalies).toEqual([{ kind: 'unknown-time-label', text: 'Horneado:' }]);
    });

    it('leaves a label without value empty', () => {
      const { content } = withTimes(at(36, 675, 'Total:'), at(171, 675, '00:30:00'), at(36, 662, 'Cocción:'));

      expect(content.times.cooking).toBeNull();
    });
  });

  describe('ingredients', () => {
    it('joins a name wrapped onto a second line', () => {
      const { content, anomalies } = withIngredients(
        at(36, 625, '- Aceite de oliva virgen'),
        at(171, 625, '1 cucharada (15 ml)'),
        at(36, 612, 'extra:'),
      );

      expect(content.ingredients).toEqual([
        { name: 'Aceite de oliva virgen extra', householdMeasure: '1 cucharada', quantity: 15, unit: 'ml', optional: false },
      ]);
      expect(anomalies).toEqual([]);
    });

    it('reads an amount without household measure', () => {
      const { content } = withIngredients(at(36, 625, '- Arroz:'), at(171, 625, '(120 g)'));

      expect(content.ingredients[0]).toMatchObject({ householdMeasure: null, quantity: 120, unit: 'g' });
    });

    it.each([
      ['al gusto (1 g) *', 'al gusto'],
      ['2-3 unidades (30 g) * *', '2-3 unidades'],
    ])('reads the optional mark in %s', (amount, householdMeasure) => {
      const { content } = withIngredients(at(36, 625, '- Sal:'), at(171, 625, amount));

      expect(content.ingredients[0]).toMatchObject({ householdMeasure, optional: true });
    });

    it('reads a decimal comma', () => {
      const { content } = withIngredients(at(36, 625, '- Sal:'), at(171, 625, '(2,5 g)'));

      expect(content.ingredients[0].quantity).toBe(2.5);
    });

    it('joins an amount split into several items', () => {
      const { content } = withIngredients(at(36, 625, '- Leche:'), at(171, 625, '1 vaso'), at(171, 612, '(200 ml)'));

      expect(content.ingredients[0]).toMatchObject({ householdMeasure: '1 vaso', quantity: 200, unit: 'ml' });
    });

    it('keeps an unrecognized amount as text and reports it', () => {
      const { content, anomalies } = withIngredients(at(36, 625, '- Pimienta:'), at(171, 625, 'una pizca *'));

      expect(content.ingredients[0]).toEqual({
        name: 'Pimienta',
        householdMeasure: 'una pizca *',
        quantity: null,
        unit: null,
        optional: true,
      });
      expect(anomalies).toEqual([{ kind: 'unrecognized-amount', text: 'una pizca *' }]);
    });

    it('reports a name without its colon', () => {
      const { content, anomalies } = withIngredients(at(36, 625, '- Huevo'), at(171, 625, '(60 g)'));

      expect(content.ingredients[0].name).toBe('Huevo');
      expect(anomalies).toEqual([{ kind: 'name-without-colon', text: 'Huevo' }]);
    });

    it('reports an ingredient without amount', () => {
      const { content, anomalies } = withIngredients(at(36, 625, '- Huevo:'));

      expect(content.ingredients[0]).toMatchObject({ householdMeasure: null, quantity: null, unit: null, optional: false });
      expect(anomalies).toEqual([
        { kind: 'ingredient-without-amount', text: 'Huevo:' },
        { kind: 'unrecognized-amount', text: '' },
      ]);
    });

    it('reports text and an amount before the first ingredient', () => {
      const { content, anomalies } = withIngredients(at(36, 630, 'Suelto'), at(171, 630, '(5 g)'), ...EGG);

      expect(content.ingredients).toHaveLength(1);
      expect(anomalies).toEqual([
        { kind: 'text-before-first-ingredient', text: 'Suelto' },
        { kind: 'amount-without-ingredient', text: '(5 g)' },
      ]);
    });

    it('keeps the page order', () => {
      const { content } = withIngredients(
        at(36, 612, '- Cebolla:'),
        at(171, 612, '(50 g)'),
        at(36, 625, '- Huevo:'),
        at(171, 625, '(60 g)'),
      );

      expect(content.ingredients.map((ingredient) => ingredient.name)).toEqual(['Huevo', 'Cebolla']);
    });
  });

  describe('preparation', () => {
    it('starts a new paragraph after a gap of 18 points or more', () => {
      const { content } = withPreparation(
        at(300, 690, 'PREPARACIÓN'),
        at(300, 675, 'Batir los'),
        at(300, 662.5, 'huevos   con sal.'),
        at(300, 637.5, 'Cuajar.'),
      );

      expect(content.preparation).toEqual(['Batir los huevos con sal.', 'Cuajar.']);
    });

    it('gives an empty list when there is no text under the header', () => {
      const { content, anomalies } = withPreparation(at(300, 690, 'PREPARACIÓN'));

      expect(content.preparation).toEqual([]);
      expect(anomalies).toEqual([]);
    });
  });

  describe('second page', () => {
    it('ignores a second page with only footer text', () => {
      const recipe = parse(fullPage(), [at(36, 20, 'Eslogan ficticio de la marca')]);

      expect(recipe.anomalies).toEqual([]);
    });

    it('reports body text on the second page with its beginning, without using it', () => {
      const longText = 'Continuación de la receta '.repeat(5);
      const recipe = parse(fullPage(), [at(300, 700, longText)]);

      expect(recipe.content.preparation).toEqual(['Batir los huevos.']);
      expect(recipe.anomalies).toEqual<LayoutAnomaly[]>([
        { kind: 'unexpected-second-page-text', text: longText.trim().slice(0, 80) },
      ]);
    });
  });
});
