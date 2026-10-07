import type { NavIconName } from '@/features/app-shell/components/nav-icon';

export type NavItem = { label: string; href: string; icon: NavIconName };

/**
 * The four tabs of the shell, from the design system's `SHELL_ITEMS` (version 1791272018-0feb). All four are always
 * listed, although `/menu` and `/shopping-list` come with MF-23 and MF-24 (design D7).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Hoy', href: '/', icon: 'sun' },
  { label: 'Buscar', href: '/planner', icon: 'search' },
  { label: 'Menú', href: '/menu', icon: 'calendar-days' },
  { label: 'Compra', href: '/shopping-list', icon: 'shopping-basket' },
];
