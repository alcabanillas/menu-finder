import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountMenu, type Account } from '@/features/app-shell/components/account-menu';
import { NavList } from '@/features/app-shell/components/nav-list';

type AppShellProps = { children: ReactNode; account?: Account };

const MAIN_ID = 'contenido';

// Ported from the design system's `AppShell` (version 1791272018-0feb). The header and the bottom bar change at 640 px of
// the viewport (design D3); the one that is not shown is `display: none`, so the four links are announced once (D4).
const SKIP_LINK =
  'fixed -top-16 left-3 z-30 rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-white no-underline ' +
  'focus:top-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const WORDMARK =
  'shrink-0 whitespace-nowrap text-xl font-extrabold leading-none tracking-[-0.01em] text-text-strong no-underline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// The design system's primary `sm` button (36 px high, 14 px of padding, 14 px of text), as a link so it works without JavaScript.
const SIGN_IN_LINK =
  'ml-auto inline-flex h-9 items-center justify-center whitespace-nowrap rounded-pill border border-olive-600 ' +
  'bg-olive-600 px-3.5 text-sm font-semibold tracking-[var(--tracking-ui)] text-white no-underline ' +
  'transition-colors duration-[var(--dur-base)] ease-out hover:border-olive-700 hover:bg-olive-700 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * The frame of every page with a session: skip link, header with the wordmark and the main navigation, the content
 * area and, on a phone, the navigation as a bar at the bottom. It reads no session (design D1): the caller gives the
 * `account` (the email and the sign-out action) for the menu of the header. Without one it is the frame of a visitor:
 * the wordmark and a link to sign in, no navigation (design D5 of MF-51.2).
 */
export function AppShell({ children, account }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-page text-text-body">
      <a href={`#${MAIN_ID}`} className={SKIP_LINK}>
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-10 border-b border-border-hairline bg-surface-card">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-gutter-mobile sm:h-16 sm:px-8">
          <Link href="/" className={WORDMARK}>
            Menu <i className="text-olive-600">Finder</i>
          </Link>
          {account ? (
            <>
              <nav aria-label="Principal" className="hidden h-full flex-1 sm:block">
                <NavList placement="header" />
              </nav>
              <div className="ml-auto">
                <AccountMenu {...account} />
              </div>
            </>
          ) : (
            <Link href="/login" className={SIGN_IN_LINK}>
              Acceder
            </Link>
          )}
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="@container flex-1 focus:outline-none">
        {children}
      </main>
      {account && (
        <nav
          aria-label="Principal"
          className="sticky bottom-0 z-10 border-t border-border-hairline bg-surface-card pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <NavList placement="bottom" />
        </nav>
      )}
    </div>
  );
}
