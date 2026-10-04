import { describe, expect, it } from 'vitest';
import type { PositionedText } from '@/infrastructure/local-documents/pdf/recipe-page';
import { parseShoppingListPage } from '@/infrastructure/local-documents/pdf/shopping-list-page';
import type { ShoppingList } from '@/domain/shopping/shopping-list';

const at = (x: number, y: number, text: string): PositionedText => ({ x, y, text });

describe('parseShoppingListPage', () => {
  it('reads an item with weight', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Cárnicos y derivados'),
      at(36, 680, '- Pollo (pechuga): 240g'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Cárnicos y derivados',
        name: 'Pollo (pechuga)',
        quantity: 240,
        unit: 'g',
        optional: false,
      },
    ]);
  });

  it('reads an item that is a count without a unit', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Huevos y derivados'),
      at(36, 680, '- Huevo de gallina fresco: 3'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Huevos y derivados',
        name: 'Huevo de gallina fresco',
        quantity: 3,
        unit: null,
        optional: false,
      },
    ]);
  });

  it('marks items as optional when specified on the same line or on the next', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Frutas y derivados'),
      at(36, 680, '- Uva pasa: 15g (opcional)'),
      at(36, 660, 'Bebidas (no lácteas)'),
      at(36, 640, '- Café: 30g'),
      at(36, 620, '(opcional)'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Frutas y derivados',
        name: 'Uva pasa',
        quantity: 15,
        unit: 'g',
        optional: true,
      },
      {
        category: 'Bebidas (no lácteas)',
        name: 'Café',
        quantity: 30,
        unit: 'g',
        optional: true,
      },
    ]);
  });

  it('joins an item name that wraps across two lines', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Cereales y derivados'),
      at(36, 680, '- Copos de avena'),
      at(36, 660, 'integrales: 200g'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Cereales y derivados',
        name: 'Copos de avena integrales',
        quantity: 200,
        unit: 'g',
        optional: false,
      },
    ]);
  });

  it('keeps both instances in order when an ingredient appears normal and optional', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Legumbres, semillas, frutos secos y derivados'),
      at(36, 680, '- Sésamo, semilla: 5g'),
      at(36, 660, '- Sésamo, semilla: 5g (opcional)'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Legumbres, semillas, frutos secos y derivados',
        name: 'Sésamo, semilla',
        quantity: 5,
        unit: 'g',
        optional: false,
      },
      {
        category: 'Legumbres, semillas, frutos secos y derivados',
        name: 'Sésamo, semilla',
        quantity: 5,
        unit: 'g',
        optional: true,
      },
    ]);
  });

  it('reads free-text category items separated by space-comma', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Especias'),
      at(36, 680, 'Curry , Laurel, hoja , Sal'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Especias',
        name: 'Curry',
        quantity: null,
        unit: null,
        optional: false,
      },
      {
        category: 'Especias',
        name: 'Laurel, hoja',
        quantity: null,
        unit: null,
        optional: false,
      },
      {
        category: 'Especias',
        name: 'Sal',
        quantity: null,
        unit: null,
        optional: false,
      },
    ]);
  });

  it('reads wrapped free-text category with optional marks', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Especias'),
      at(36, 680, 'Ajo, en polvo (opcional) , Perejil'),
      at(36, 660, 'fresco (opcional)'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Especias',
        name: 'Ajo, en polvo',
        quantity: null,
        unit: null,
        optional: true,
      },
      {
        category: 'Especias',
        name: 'Perejil fresco',
        quantity: null,
        unit: null,
        optional: true,
      },
    ]);
  });

  it('joins a list of two pages where a category splits across the page break', () => {
    const page1 = [
      at(36, 750, 'Lista de la compra'),
      at(36, 100, 'Pescados, moluscos, crustáceos y derivados'),
    ];
    const page2 = [
      at(36, 750, 'Lista de la compra'),
      at(36, 680, '- Salmón: 200g'),
    ];

    const result = parseShoppingListPage([page1, page2]);

    expect(result.pages).toBe(2);
    expect(result.items).toEqual([
      {
        category: 'Pescados, moluscos, crustáceos y derivados',
        name: 'Salmón',
        quantity: 200,
        unit: 'g',
        optional: false,
      },
    ]);
  });

  it('continues a left-column category onto page 2 even when page 1 has right-column categories', () => {
    const page1 = [
      at(36, 780, 'Lista de la compra'),
      at(36, 700, 'Pescados, moluscos, crustáceos y derivados'),
      at(36, 60, '- Mero: 100g'),
      at(300, 700, 'Grasas y aceites'),
      at(300, 600, 'Aceite de oliva virgen extra'),
    ];
    const page2 = [
      at(36, 792, '- Rodaballo: 250g'),
    ];

    const result = parseShoppingListPage([page1, page2]);

    expect(result.items).toEqual([
      {
        category: 'Pescados, moluscos, crustáceos y derivados',
        name: 'Mero',
        quantity: 100,
        unit: 'g',
        optional: false,
      },
      {
        category: 'Pescados, moluscos, crustáceos y derivados',
        name: 'Rodaballo',
        quantity: 250,
        unit: 'g',
        optional: false,
      },
      {
        category: 'Grasas y aceites',
        name: 'Aceite de oliva virgen extra',
        quantity: null,
        unit: null,
        optional: false,
      },
    ]);
  });

  it('reports a list of one page as having 1 page', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Huevos y derivados'),
      at(36, 680, '- Huevo de gallina fresco: 2'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.pages).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('sorts scrambled items into reading order', () => {
    const page = [
      at(150, 680, '240g'),
      at(36, 650, '- Ternera: 150g'),
      at(36, 680, '- Pollo (pechuga):'),
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Cárnicos y derivados'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items.map((item) => item.name)).toEqual(['Pollo (pechuga)', 'Ternera']);
  });

  it('never includes footer text below the threshold in items or anomalies', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Huevos y derivados'),
      at(36, 680, '- Huevo: 2'),
      at(36, 30, 'Generador ficticio v1.0'),
      at(36, 15, 'Eslogan publicitario ficticio'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Huevos y derivados',
        name: 'Huevo',
        quantity: 2,
        unit: null,
        optional: false,
      },
    ]);
    expect(result.anomalies).toHaveLength(0);
  });

  it('reports an anomaly when a text line precedes the first category header', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 720, 'Texto suelto antes de categorias'),
      at(36, 700, 'Huevos y derivados'),
      at(36, 680, '- Huevo: 2'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toHaveLength(1);
    expect(result.anomalies).toEqual([
      {
        kind: 'line-before-first-category',
        text: 'Texto suelto antes de categorias',
      },
    ]);
  });

  it('reports an anomaly when an item line has no readable amount and next line starts a new item', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 700, 'Cárnicos y derivados'),
      at(36, 680, '- Pollo sin cantidad'),
      at(36, 660, '- Pavo: 100g'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Cárnicos y derivados',
        name: 'Pavo',
        quantity: 100,
        unit: 'g',
        optional: false,
      },
    ]);
    expect(result.anomalies).toEqual([
      {
        kind: 'item-without-readable-amount',
        text: '- Pollo sin cantidad',
      },
    ]);
  });

  it('returns empty items when the page contains no categories with items', () => {
    const page = [
      at(36, 750, 'Lista de la compra'),
      at(36, 600, 'Notas generales sin items'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toHaveLength(0);
  });

  it('reads items across two columns on the same page in reading order', () => {
    const page = [
      at(200, 780, 'Lista de la compra'),
      // Left column (x < 280)
      at(36, 700, 'Bebidas (no lácteas)'),
      at(36, 680, '- Agua: 200ml'),
      // Right column (x >= 280)
      at(300, 700, 'Frutas y derivados'),
      at(300, 680, '- Manzana: 100g'),
    ];

    const result = parseShoppingListPage([page]);

    expect(result.items).toEqual([
      {
        category: 'Bebidas (no lácteas)',
        name: 'Agua',
        quantity: 200,
        unit: 'ml',
        optional: false,
      },
      {
        category: 'Frutas y derivados',
        name: 'Manzana',
        quantity: 100,
        unit: 'g',
        optional: false,
      },
    ]);
    expect(result.anomalies).toHaveLength(0);
  });

  it('can be structured as a ShoppingList domain entity', () => {
    const list: ShoppingList = {
      menuNumber: 1,
      items: [
        {
          category: 'Cárnicos y derivados',
          name: 'Pollo (pechuga)',
          quantity: 240,
          unit: 'g',
          optional: false,
        },
      ],
    };

    expect(list.menuNumber).toBe(1);
    expect(list.items).toHaveLength(1);
  });
});
