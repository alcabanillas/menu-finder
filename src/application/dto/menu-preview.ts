import type { DayDto } from '@/application/dto/weekly-menu';

/** One day of a previewed menu: only the names of the dishes of its two meals. */
export type MenuPreviewDayDto = { day: DayDto; lunch: string[]; dinner: string[] };

/** A stored menu as the planner previews it: its number and the seven days, Monday to Sunday. No recipes and no dates. */
export type MenuPreviewDto = { menuNumber: number; days: MenuPreviewDayDto[] };

/** Why a preview gave nothing: `invalid-menu` is not a positive integer, `unknown-menu` no menu has that number, `failed` a fault of the system. */
export type MenuPreviewFailure = { kind: 'invalid-menu' } | { kind: 'unknown-menu' } | { kind: 'failed' };
