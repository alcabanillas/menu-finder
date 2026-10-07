'use client';

import { useEffect, useId, useRef } from 'react';
import type { RecipeDto } from '@/application/dto/weekly-menu';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { RecipeBody } from '@/features/weekly-menu/components/recipe-body';

/** The side of the page the panel lies on: away from the dish. */
export type PanelSide = 'left' | 'right';

type RecipePanelProps = {
  name: string;
  /** The day and meal of the dish, "Miércoles · Comida". */
  eyebrow: string;
  recipe: RecipeDto;
  side: PanelSide;
  onClose: () => void;
};

// After `RecipePanel` in the design system's `ui_kits/app/MenuScreen.jsx` (version 1791414282-6467): a non-modal
// dialog, so the day cards stay usable, below the shell header and on the side of the page away from the dish. Its
// outer edge follows the mock's 1440 px `.mf-page--wide` box (design D3 of MF-56). The body is the card's (design D4
// of MF-23.2).
const SIDES: Record<PanelSide, string> = {
  right: 'right-[max(0px,calc((100vw-1440px)/2))] border-l',
  left: 'left-[max(0px,calc((100vw-1440px)/2))] border-r',
};
const PANEL =
  'fixed top-16 bottom-0 z-10 hidden w-[360px] flex-col overflow-y-auto border-border-hairline bg-surface-card ' +
  'shadow-raised @min-[800px]:flex';
const CLOSE =
  'flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border border-border-strong ' +
  'text-text-strong hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** A dish's recipe beside the week table. It takes the focus when it opens; Escape or its button close it. */
export function RecipePanel({ name, eyebrow, recipe, side, onClose }: RecipePanelProps) {
  const headingId = useId();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), [name, eyebrow]);
  useEffect(() => closeOnEscape(onClose), [onClose]);

  return (
    <aside role="dialog" aria-labelledby={headingId} data-side={side} className={`${PANEL} ${SIDES[side]}`}>
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
  );
}

function closeOnEscape(onClose: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
