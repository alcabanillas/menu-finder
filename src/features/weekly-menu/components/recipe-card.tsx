'use client';

import { useId, useState } from 'react';
import type { RecipeDto } from '@/application/dto/weekly-menu';
import { MenuIcon } from '@/features/weekly-menu/components/menu-icon';
import { RecipeBody } from '@/features/weekly-menu/components/recipe-body';

type RecipeCardProps = { name: string; recipe: RecipeDto | null };

// Ported from the design system's `recipe/RecipeCard.jsx` (version 1791384225-1eab). A dish without a recipe is not a
// button there either in look, but here it is not a control at all: it has nothing to unfold (design D6).
const CARD = 'overflow-hidden rounded-md border border-border-hairline bg-surface-card transition-shadow duration-[var(--dur-slow)] ease-out';
const HEADER = 'flex w-full items-center gap-3 py-4 pl-5 pr-[18px] text-left';
const NAME = 'text-[21px] font-extrabold leading-[1.2] text-text-strong [text-wrap:pretty]';
const META = 'mt-1.5 flex items-center gap-3 text-[13px] text-text-muted';

/** A dish of the menu. With a recipe, its header unfolds and folds the recipe in place. */
export function RecipeCard({ name, recipe }: RecipeCardProps) {
  const [open, setOpen] = useState(false);
  const recipeId = useId();

  if (!recipe) {
    return (
      <article className={`${CARD} shadow-card`}>
        <div className={HEADER}>
          <div className="min-w-0 flex-1">
            <p className={NAME}>{name}</p>
            <p className={META}>
              <span className="italic">Sin receta</span>
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`${CARD} ${open ? 'shadow-raised' : 'shadow-card'}`}>
      <button
        type="button"
        className={`${HEADER} cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink`}
        aria-expanded={open}
        aria-controls={recipeId}
        onClick={() => setOpen(!open)}
      >
        <span className="block min-w-0 flex-1">
          <span className={`block ${NAME}`}>{name}</span>
          <span className={META}>
            {recipe.times.total !== null && (
              <span className="inline-flex items-center gap-1">
                <MenuIcon name="clock" size={14} />
                {recipe.times.total} min
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MenuIcon name="chef-hat" size={14} />
              Receta
            </span>
          </span>
        </span>
        <span
          className={`text-text-muted transition-transform duration-[var(--dur-slow)] ease-out ${open ? 'rotate-180' : ''}`}
        >
          <MenuIcon name="chevron-down" size={20} />
        </span>
      </button>
      <div id={recipeId} hidden={!open}>
        {open && (
          <div className="border-t border-border-hairline px-5 pb-[22px]">
            <RecipeBody recipe={recipe} />
          </div>
        )}
      </div>
    </article>
  );
}
