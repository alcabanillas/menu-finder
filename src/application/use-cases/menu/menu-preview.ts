import { positiveIntegerInput } from '@/application/dto/positive-integer-input';
import type { MenuPreviewDayDto, MenuPreviewDto, MenuPreviewFailure } from '@/application/dto/menu-preview';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { MealType, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok, type Result } from '@/shared/result';

/** What the preview form sends: the menu number is not trusted. */
export type MenuPreviewInput = { menuNumber: unknown };

type Deps = { menus: Pick<MenuRepository, 'find'> };

const DAYS: MenuPreviewDayDto['day'][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * The week of a stored menu for the planner's "Ver semana": the names of its dishes by day and meal (spec menu-planner,
 * "The week preview needs a session and trusts only the menu"). The menu is the same for every user, so nothing of the
 * session reaches here; the caller has already checked it.
 */
export async function menuPreview({ menus }: Deps, { menuNumber }: MenuPreviewInput): Promise<Result<MenuPreviewDto, MenuPreviewFailure>> {
  const parsed = positiveIntegerInput.safeParse(menuNumber);
  if (!parsed.success) return err({ kind: 'invalid-menu' });
  const found = await menus.find(parsed.data);
  if (!found.ok) return err({ kind: 'failed' });
  if (!found.value) return err({ kind: 'unknown-menu' });
  return ok(previewOf(found.value));
}

function previewOf(menu: WeeklyMenu): MenuPreviewDto {
  return { menuNumber: menu.number, days: DAYS.map((day) => ({ day, lunch: namesOf(menu, day, 'lunch'), dinner: namesOf(menu, day, 'dinner') })) };
}

function namesOf(menu: WeeklyMenu, day: MenuPreviewDayDto['day'], type: MealType): string[] {
  const meal = menu.meals.find((candidate) => candidate.day === day && candidate.type === type);
  return (meal?.dishes ?? []).map(({ name }) => name);
}
