'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from '@/features/app-shell/components/nav-icon';
import { NAV_ITEMS } from '@/features/app-shell/components/nav-items';

type NavListProps = { placement: 'header' | 'bottom' };

// Ported from the design system's `ShellNavList` (version 1791272018-0feb). The icon is 18 px beside the label in the
// header and 22 px above it in the bottom bar; the current tab's stroke is heavier.
const ICON_SIZE = { header: 18, bottom: 22 };
const STROKE = { current: 1.9, other: 1.5 };

const LINK =
  'relative flex items-center text-text-muted transition-colors duration-[var(--dur-base)] ease-out ' +
  'hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const LAYOUT = {
  header:
    'h-full gap-2 px-3.5 text-[15px] font-medium hover:bg-gray-100 aria-[current=page]:font-semibold ' +
    'aria-[current=page]:text-text-strong aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3.5 ' +
    'aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-border-ink ' +
    "aria-[current=page]:after:content-['']",
  bottom:
    'min-h-[52px] flex-col justify-center gap-[3px] text-[11px] font-medium tracking-[0.02em] ' +
    'aria-[current=page]:font-semibold aria-[current=page]:text-olive-600',
};

/** The shell's four tabs as real links, the one of the current route marked with `aria-current` (design D6). */
export function NavList({ placement }: NavListProps) {
  const pathname = usePathname();

  return (
    <ul className={placement === 'header' ? 'flex h-full gap-1' : 'flex px-2 pb-2 pt-1.5'}>
      {NAV_ITEMS.map(({ label, href, icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <li key={href} className={placement === 'header' ? undefined : 'flex-1'}>
            <Link
              href={href}
              aria-current={current ? 'page' : undefined}
              className={`${LINK} ${LAYOUT[placement]}`}
            >
              <NavIcon name={icon} size={ICON_SIZE[placement]} strokeWidth={current ? STROKE.current : STROKE.other} />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// `/` only matches itself; any other tab also matches the routes below it, but not a route that merely starts with its text.
function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
