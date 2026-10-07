import { useId } from 'react';
import type { RecipeDto, RecipeIngredientDto } from '@/application/dto/weekly-menu';

const EYEBROW = 'text-eyebrow uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted';

/** A recipe's times, ingredients and steps, as both the card and the panel show it (design D4 of MF-23.2). */
export function RecipeBody({ recipe }: { recipe: RecipeDto }) {
  const ingredientsId = useId();
  const stepsId = useId();
  const { total, preparation, cooking } = recipe.times;
  return (
    <div>
      <ul aria-label="Tiempos" className="flex gap-3 border-b border-border-hairline py-4">
        <Time label="Total" minutes={total} />
        <Time label="Preparación" minutes={preparation} />
        <Time label="Cocción" minutes={cooking} />
      </ul>
      <p id={ingredientsId} className={`${EYEBROW} mb-1.5 mt-[18px]`}>
        Ingredientes
      </p>
      <ul aria-labelledby={ingredientsId}>
        {recipe.ingredients.map((ingredient, index) => (
          <Ingredient key={index} ingredient={ingredient} />
        ))}
      </ul>
      <p id={stepsId} className={`${EYEBROW} mb-2 mt-[22px]`}>
        Preparación
      </p>
      <ol aria-labelledby={stepsId} className="flex flex-col gap-3">
        {recipe.preparation.map((step, index) => (
          <li key={index} className="flex gap-3.5">
            <span className="w-[18px] flex-none text-[22px] font-extrabold leading-none text-olive-500">{index + 1}</span>
            <p className="text-[15px] leading-[1.55] text-text-body">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Time({ label, minutes }: { label: string; minutes: number | null }) {
  return (
    <li className="min-w-0 flex-1">
      <span className={`block ${EYEBROW} tracking-[0.1em]`}>{label}</span>
      <span className="mt-0.5 block text-[22px] font-extrabold text-text-strong">
        {minutes === null ? '—' : minutes}
        {minutes !== null && <span className="text-[13px] font-normal text-text-muted"> min</span>}
      </span>
    </li>
  );
}

function Ingredient({ ingredient }: { ingredient: RecipeIngredientDto }) {
  return (
    <li className="flex items-baseline gap-3 border-b border-dotted border-border-strong py-[7px] text-[15px] text-text-strong">
      <span className="flex-1">
        {ingredient.name}
        {ingredient.optional && <em className="text-[13px] text-text-muted"> · opcional</em>}
      </span>
      <span className="text-right text-small tabular-nums text-text-muted">{amountOf(ingredient)}</span>
    </li>
  );
}

function amountOf({ householdMeasure, quantity, unit }: RecipeIngredientDto): string {
  const measured = quantity === null ? '' : `${quantity} ${unit ?? ''}`.trim();
  return [householdMeasure, measured].filter(Boolean).join(' · ');
}
