import type { RecipeDto } from '@/application/dto/weekly-menu';
import type { CandidateCard, Chip, ChipMember } from '@/features/menu-planner/search-view';
import type { GlanceDay } from '@/features/welcome/components/welcome-screen';

// The sample data of the visitor's home (MF-76 design D4), after `ui_kits/app/data.js` of the design system (version
// 1792687168-5ad7). Every dish is invented: `pnpm welcome:check-samples` checks that none is a dish or a recipe of the
// local catalogue. A visitor gets no data from the database or of any user.
export const SAMPLE_REQUEST = 'de cuchara, sin cerdo y con garbanzos';
// The dish of the evidence, of Monday's lunch and of the open recipe.
const LENTEJAS = 'Lentejas estofadas';

const CUCHARA: ChipMember = { term: 'de cuchara', polarity: 'include', type: 'attribute', hard: true };
const CERDO: ChipMember = { term: 'cerdo', polarity: 'exclude', type: 'exclusion', hard: true };
const GARBANZOS: ChipMember = { term: 'garbanzos', polarity: 'include', type: 'literal', hard: true };
export const SAMPLE_CHIPS: Chip[] = [CUCHARA, CERDO, GARBANZOS].map((member) => ({ kind: 'constraint', members: [member] }));

export const SAMPLE_CARD: CandidateCard = {
  rank: 1,
  menu: 14,
  summary: 'Cumple las 3 cosas que pides.',
  lines: [
    { kind: 'constraint', terms: [CUCHARA], state: 'met', detail: `Lunes, comida · ${LENTEJAS}`, dish: { day: 'monday', meal: 'lunch', name: LENTEJAS } },
    { kind: 'constraint', terms: [CERDO], state: 'met', detail: 'no aparece en la semana', dish: null },
    { kind: 'constraint', terms: [GARBANZOS], state: 'met', detail: 'Lunes, comida · Garbanzos con espinacas', dish: { day: 'monday', meal: 'lunch', name: 'Garbanzos con espinacas' } },
  ],
};

export const SAMPLE_WEEK: GlanceDay[] = [
  { day: 'monday', lunch: LENTEJAS, dinner: 'Tortilla de patata y cebolla' },
  { day: 'tuesday', lunch: 'Pollo al limón', dinner: 'Judías verdes con patata' },
  { day: 'wednesday', lunch: 'Salmón al papillote', dinner: 'Pisto con huevo' },
  { day: 'thursday', lunch: 'Macarrones con atún', dinner: 'Crema de puerros' },
  { day: 'friday', lunch: 'Arroz con alcachofas', dinner: 'Sardinas a la plancha' },
  { day: 'saturday', lunch: 'Paella de verduras', dinner: 'Pizza casera de verduras' },
];

export const SAMPLE_RECIPE: RecipeDto = {
  title: LENTEJAS,
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [
    { name: 'Lentejas pardinas', householdMeasure: null, quantity: 240, unit: 'g', optional: false },
    { name: 'Zanahoria', householdMeasure: '1 unidad', quantity: 80, unit: 'g', optional: false },
    { name: 'Pimiento verde', householdMeasure: '½ unidad', quantity: 60, unit: 'g', optional: false },
    { name: 'Cebolla', householdMeasure: '½ unidad', quantity: 70, unit: 'g', optional: false },
    { name: 'Pimentón dulce', householdMeasure: '1 cucharadita', quantity: null, unit: null, optional: false },
    { name: 'Aceite de oliva virgen extra', householdMeasure: '1 cucharada', quantity: 10, unit: 'ml', optional: false },
    { name: 'Laurel', householdMeasure: 'al gusto', quantity: null, unit: null, optional: true },
  ],
  preparation: [
    'Pica la cebolla, la zanahoria y el pimiento en dados pequeños.',
    'Sofríe las verduras en el aceite a fuego medio durante 8 minutos, hasta que estén tiernas.',
    'Añade las lentejas, el pimentón y el laurel. Cubre con agua y cuece a fuego suave 35 minutos.',
  ],
};

export const SAMPLE_SHOPPING = {
  category: 'Legumbres, semillas, frutos secos y derivados',
  items: [
    { name: 'Garbanzos cocidos', amount: '800 g', checked: true, optional: false },
    { name: 'Lentejas pardinas', amount: '240 g', checked: false, optional: false },
    { name: 'Piñones', amount: '20 g', checked: false, optional: true },
  ],
};

/** Every dish the samples name, for the check against the catalogue. */
export const SAMPLE_DISHES: string[] = [
  ...SAMPLE_WEEK.flatMap(({ lunch, dinner }) => [lunch, dinner]),
  ...SAMPLE_CARD.lines.flatMap(({ dish }) => (dish ? [dish.name] : [])),
  SAMPLE_RECIPE.title,
];
