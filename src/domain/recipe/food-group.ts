/**
 * The 16 canonical food groups used to classify recipe ingredients (BUS-superficie-consulta (c)).
 * Stored in `ingredient_group` and matched by `PostgresDishTextSearch`.
 */
export const FOOD_GROUPS = [
  'pollo',
  'pavo',
  'cerdo',
  'ternera',
  'conejo',
  'carne',
  'carne roja',
  'pescado',
  'pescado crudo',
  'marisco',
  'queso',
  'huevo',
  'legumbres',
  'pasta',
  'arroz',
  'verduras',
] as const;

export type FoodGroup = (typeof FOOD_GROUPS)[number];
