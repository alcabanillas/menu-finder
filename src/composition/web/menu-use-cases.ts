import { currentSelections, type CurrentSelectionsInput } from '@/application/use-cases/menu/current-selections';
import { menuWeekPage, type MenuWeekPageInput } from '@/application/use-cases/menu/menu-week-page';
import { selectRandomMenu, type SelectRandomMenuInput } from '@/application/use-cases/menu/select-random-menu';
import type { Deps } from './infrastructure-deps';

/** The use cases of the weekly menu and the selections. */
export function menuUseCases(lazyDeps: () => Deps) {
  return {
    currentSelections: async (input: CurrentSelectionsInput) => currentSelections(lazyDeps(), input),
    selectRandomMenu: async (input: SelectRandomMenuInput) => selectRandomMenu(lazyDeps(), input),
    menuWeekPage: async (input: MenuWeekPageInput) => menuWeekPage(lazyDeps(), input),
  };
}
