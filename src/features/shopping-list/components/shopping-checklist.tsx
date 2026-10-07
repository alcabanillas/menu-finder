'use client';

import { startTransition, useActionState, useOptimistic, type FormEvent } from 'react';
import type { ShoppingChecklistCategoryDto, ShoppingChecklistDto } from '@/application/dto/shopping-checklist';
import type { CheckItemsState } from '@/features/shopping-list/check-items-state';
import { CategoryToggle } from '@/features/shopping-list/components/category-toggle';
import { ChecklistRow, type TickForm } from '@/features/shopping-list/components/checklist-row';
import { ProgressBar } from '@/features/shopping-list/components/progress-bar';
import { SectionHeader } from '@/features/shopping-list/components/section-header';
import { ViewFilter, type ChecklistView } from '@/features/shopping-list/components/view-filter';
import { formatMonday } from '@/shared/format-monday';

type ShoppingChecklistProps = {
  checklist: ShoppingChecklistDto;
  view: ChecklistView;
  action: (previous: CheckItemsState, form: FormData) => Promise<CheckItemsState>;
};

type Tick = { positions: number[]; checked: boolean };

const INITIAL_STATE: CheckItemsState = { message: null, attempt: 0 };

/** The list as a form per row, ticks shown at once; a failure of the server is announced in one alert. */
export function ShoppingChecklist({ checklist, view, action }: ShoppingChecklistProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [shown, addTick] = useOptimistic(checklist, applyTick);
  const form = tickForm(formAction, addTick);
  const categories = view === 'pending' ? withPendingItems(shown.categories) : shown.categories;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pb-10 pt-1">
      <header className="flex flex-col gap-1">
        <p className="text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted">
          Menú {shown.menuNumber}
        </p>
        <h1 className="text-h2 font-extrabold text-text-strong">Lista de la compra</h1>
        <p className="text-small text-text-muted">Desde el {formatMonday(shown.startsOn)}</p>
      </header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
        <div className="min-w-0 flex-1">
          <ProgressBar value={shown.checkedCount} max={shown.total} label="Marcados" />
        </div>
        <ViewFilter view={view} />
      </div>
      {/* A new element on every answer (`attempt`), so a repeated failure is announced again. */}
      {state.message && (
        <p key={state.attempt} role="alert" className="text-terracotta-700">
          {state.message}
        </p>
      )}
      <div className="gap-12 md:columns-2 xl:columns-3">
        {categories.map((category) => (
          <section key={category.name} className="mb-7 break-inside-avoid">
            <SectionHeader eyebrow={category.name} />
            <CategoryToggle menuNumber={shown.menuNumber} category={category} form={form} />
            {visibleItems(category, view).map((item) => (
              <ChecklistRow key={item.position} menuNumber={shown.menuNumber} item={item} form={form} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * The form posts to the server action by itself (that is what works without JavaScript); with JavaScript the submit is
 * taken over to show the tick first and then send the same form.
 */
function tickForm(formAction: (form: FormData) => void, addTick: (tick: Tick) => void): TickForm {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => {
      addTick({ positions: data.getAll('position').map(Number), checked: data.get('checked') === 'true' });
      formAction(data);
    });
  }
  return { action: formAction, onSubmit };
}

function applyTick(current: ShoppingChecklistDto, tick: Tick): ShoppingChecklistDto {
  const categories = current.categories.map((category) => {
    const items = category.items.map((item) =>
      tick.positions.includes(item.position) ? { ...item, checked: tick.checked } : item,
    );
    return { ...category, items, checkedCount: items.filter((item) => item.checked).length };
  });
  const checkedCount = categories.reduce((sum, category) => sum + category.checkedCount, 0);
  return { ...current, categories, checkedCount };
}

function withPendingItems(categories: ShoppingChecklistCategoryDto[]): ShoppingChecklistCategoryDto[] {
  return categories.filter((category) => category.checkedCount < category.items.length);
}

function visibleItems(category: ShoppingChecklistCategoryDto, view: ChecklistView) {
  return view === 'pending' ? category.items.filter((item) => !item.checked) : category.items;
}
