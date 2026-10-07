'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { NavIcon } from '@/features/app-shell/components/nav-icon';

export type Account = { email: string; signOutAction: () => Promise<void> };

// Ported from the design system's `ShellAccount` (version 1791357207-74cb): a 44 px round button and a small panel
// under it. It is a disclosure, not an ARIA `menu`: it has one item, so there is no arrow-key roving (design D2).
const BUTTON =
  'flex size-11 items-center justify-center rounded-full border border-border-strong bg-transparent ' +
  'text-text-strong hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const PANEL =
  'absolute right-0 top-[calc(100%+6px)] z-20 min-w-[220px] max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border-hairline ' +
  'bg-surface-card p-1.5 shadow-raised';

const EMAIL = 'mb-1.5 truncate border-b border-border-hairline px-3 pb-2.5 pt-2 text-small text-text-muted';

const SIGN_OUT =
  'block min-h-11 w-full rounded-sm px-3 text-left text-[15px] font-medium text-text-strong hover:bg-gray-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * The account button of the header and its panel: the user's email and "Cerrar sesión". Escape and a press outside close
 * it; both are listened for on the document only while it is open. It gets the email and the action by props, so it
 * knows nothing of the session (design D1 of MF-51.2).
 */
export function AccountMenu({ email, signOutAction }: Account) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPressOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onPressOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPressOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Cuenta"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        className={BUTTON}
      >
        <NavIcon name="user-round" size={20} strokeWidth={1.5} />
      </button>
      {open && (
        <div id={panelId} className={PANEL}>
          <div className={EMAIL}>{email}</div>
          <form action={signOutAction}>
            <button type="submit" className={SIGN_OUT}>
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
