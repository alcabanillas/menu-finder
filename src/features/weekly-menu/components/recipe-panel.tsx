'use client';

import { useEffect, useId, useRef } from 'react';
import type { RecipeDto } from '@/application/dto/weekly-menu';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { RecipeBody } from '@/features/weekly-menu/components/recipe-body';
import { closeOnEscape, lockPageScroll } from '@/shared/ui/modal-panel';

type RecipePanelProps = {
  name: string;
  /** The day and meal of the dish, "Miércoles · Comida". */
  eyebrow: string;
  recipe: RecipeDto;
  onClose: () => void;
};

// After `RecipePanel` in the design system's `ui_kits/app/MenuScreen.jsx` (version 1791414282-6467). From 800 px it is a
// modal dialog in the place of the week preview of Buscar: 400 px against the right edge of the window, below the shell
// header, over a backdrop that leaves the header clear, with the page still behind it (decided by the author on
// 2026-10-21; before, a non-modal panel on the side away from the dish). Below 800 px the recipe opens in the page, so
// neither the panel nor the backdrop shows. The body is the card's (design D4 of MF-23.2).
const BACKDROP = 'fixed inset-x-0 top-16 bottom-0 z-30 hidden bg-ink/40 animate-backdrop-in motion-reduce:animate-none @min-[800px]:block';
const PANEL =
  'fixed top-16 right-0 bottom-0 z-[31] hidden w-[400px] flex-col overflow-y-auto overscroll-contain border-l ' +
  'border-border-hairline bg-surface-card shadow-raised [scrollbar-width:thin] @min-[800px]:flex';
const CLOSE =
  'flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border border-border-strong ' +
  'text-text-strong hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** A dish's recipe over the page. It takes the focus when it opens; Escape, its button or the backdrop close it. */
export function RecipePanel({ name, eyebrow, recipe, onClose }: RecipePanelProps) {
  const headingId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  useEffect(() => close.current?.focus(), [name, eyebrow]);
  useEffect(() => closeOnEscape(onClose), [onClose]);
  useEffect(() => (backdrop.current ? lockPageScroll(backdrop.current) : undefined), []);

  return (
    <>
      <div ref={backdrop} data-backdrop onClick={onClose} aria-hidden="true" className={BACKDROP} />
      <aside role="dialog" aria-modal="true" aria-labelledby={headingId} className={PANEL}>
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600">
              {eyebrow}
            </p>
            <h2 id={headingId} className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] text-text-strong">
              {name}
            </h2>
          </div>
          <button ref={close} type="button" aria-label="Cerrar receta" onClick={onClose} className={CLOSE}>
            <MenuIcon name="x" size={18} />
          </button>
        </div>
        <div className="px-5 pb-7">
          <RecipeBody recipe={recipe} />
        </div>
      </aside>
    </>
  );
}
