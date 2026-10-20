'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewState } from '@/features/menu-planner/preview-view';

const READ_FAILED: PreviewState = { status: 'failed', message: 'No se ha podido cargar la semana. Inténtalo de nuevo.' };

/**
 * The week preview of a card (MF-73 design D3): which menu is open, what has been read of each menu, and the way back
 * to the button that opened it. A menu is read once; a read that failed is not kept, so opening it again asks again.
 * `close` gives the focus back to the button; `reset` closes without moving it, as a new search does.
 */
export function useWeekPreview(read: (menu: number) => Promise<PreviewState>) {
  const [open, setOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Record<number, PreviewState>>({});
  const trigger = useRef<HTMLButtonElement | null>(null);
  const returning = useRef(false);

  useEffect(() => {
    if (open === null && returning.current) {
      returning.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const load = useCallback(
    async (menu: number) => {
      const state = await read(menu).catch(() => READ_FAILED);
      setLoaded((previous) => ({ ...previous, [menu]: state }));
    },
    [read],
  );

  return {
    open,
    /** The read of a menu, or `null` while it runs. */
    stateOf: (menu: number): PreviewState | null => loaded[menu] ?? null,
    toggle: (menu: number, button: HTMLButtonElement) => {
      trigger.current = button;
      if (open === menu) {
        returning.current = true;
        setOpen(null);
        return;
      }
      setOpen(menu);
      if (loaded[menu]?.status !== 'ready') {
        setLoaded((previous) => {
          const next = { ...previous };
          delete next[menu];
          return next;
        });
        void load(menu);
      }
    },
    close: () => {
      returning.current = true;
      setOpen(null);
    },
    reset: () => setOpen(null),
  };
}
