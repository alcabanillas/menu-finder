import { chooseMenu, type ChooseMenuInput } from '@/application/use-cases/menu/choose-menu';
import { menuWeekPage, type MenuWeekPageInput } from '@/application/use-cases/menu/menu-week-page';
import { selectRandomMenu, type SelectRandomMenuInput } from '@/application/use-cases/menu/select-random-menu';
import { weeksToChoose, type WeeksToChooseInput } from '@/application/use-cases/menu/weeks-to-choose';
import type { Deps } from './infrastructure-deps';

/** The use cases of the weekly menu and the selections. */
export function menuUseCases(lazyDeps: () => Deps) {
  return {
    weeksToChoose: async (input: WeeksToChooseInput) => weeksToChoose(lazyDeps(), input),
    chooseMenu: async (input: ChooseMenuInput) => chooseMenu(lazyDeps(), input),
    selectRandomMenu: async (input: SelectRandomMenuInput) => selectRandomMenu(lazyDeps(), input),
    menuWeekPage: async (input: MenuWeekPageInput) => menuWeekPage(lazyDeps(), input),
  };
}
