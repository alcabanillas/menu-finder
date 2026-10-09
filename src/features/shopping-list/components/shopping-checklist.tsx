'use client';

import { startTransition, useActionState, useId, useOptimistic, type FormEvent } from 'react';
import type {
  ShoppingChecklistCategoryDto,
  ShoppingChecklistDto,
  ShoppingChecklistItemDto,
} from '@/application/dto/shopping-checklist';
import type { CheckItemsState } from '@/features/shopping-list/check-items-state';
import { CategoryIndex, type IndexEntry } from '@/features/shopping-list/components/category-index';
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

// After `.mf-shop` in the design system's `ui_kits/app/ShoppingScreen.jsx` (version 1791414282-6467): from 800 px a
// sticky category index beside the list (design D4 and D5 of MF-56), in the mock's 1440 px `.mf-page--wide` box (D3).
const PAGE = 'mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-gutter-mobile pb-10 pt-1 @min-[640px]:px-8';
// Below the 64 px shell header; its own scroll keeps the 13 categories of a list reachable on a short screen.
const INDEX = 'hidden @min-[800px]:sticky @min-[800px]:top-20 @min-[800px]:block @min-[800px]:max-h-[calc(100dvh-6rem)] @min-[800px]:overflow-y-auto';

/** The list as a form per row, ticks shown at once; a failure of the server is announced in one alert. */
export function ShoppingChecklist({ checklist, view, action }: ShoppingChecklistProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [shown, addTick] = useOptimistic(checklist, applyTick);
  const form = tickForm(formAction, addTick);
  const entries = indexEntries(shown.categories, view);
  return (
    <div className={PAGE}>
      <header className="flex flex-col gap-1">
        <p className="text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted">
          Menú {shown.menuNumber}
        </p>
        <h1 className="text-h2 font-extrabold text-text-strong">Lista de la compra</h1>
        <p className="text-small text-text-muted">Desde el {formatMonday(shown.startsOn)}</p>
      </header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-12 @min-[800px]:border-b @min-[800px]:border-border-hairline @min-[800px]:pb-4">
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
      <div className="@min-[800px]:grid @min-[800px]:grid-cols-[260px_minmax(0,1fr)] @min-[800px]:items-start @min-[800px]:gap-12">
        <div className={INDEX}>
          <CategoryIndex menuNumber={shown.menuNumber} entries={entries} form={form} />
        </div>
        <div className="flex min-w-0 flex-col gap-6 @min-[800px]:gap-8">
          {entries.map(({ category, anchor }) => (
            <CategorySection
              key={anchor}
              anchor={anchor}
              menuNumber={shown.menuNumber}
              category={category}
              items={visibleItems(category, view)}
              form={form}
            />
          ))}
        </div>
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

type CategorySectionProps = {
  anchor: string;
  menuNumber: number;
  category: ShoppingChecklistCategoryDto;
  items: ShoppingChecklistItemDto[];
  form: TickForm;
};

// The "Marcar todos" row is the narrow screen's: from 800 px the index holds it (design D5 of MF-56).
function CategorySection({ anchor, menuNumber, category, items, form }: CategorySectionProps) {
  const headingId = useId();
  return (
    <section id={anchor} aria-labelledby={headingId} className="scroll-mt-20">
      <SectionHeader
        id={headingId}
        eyebrow={category.name}
        count={`${category.checkedCount}/${category.items.length}`}
      />
      <div className="@min-[800px]:hidden">
        <CategoryToggle menuNumber={menuNumber} category={category} form={form} />
      </div>
      <div className="@min-[1100px]:grid @min-[1100px]:grid-cols-2 @min-[1100px]:gap-x-10">
        {items.map((item) => (
          <ChecklistRow key={item.position} menuNumber={menuNumber} item={item} form={form} />
        ))}
      </div>
    </section>
  );
}

/**
 * The categories of the view, each with the anchor of its section. The anchor counts the category in the whole list,
 * so it does not change with the view and carries none of the category's text (design D4 of MF-56).
 */
function indexEntries(categories: ShoppingChecklistCategoryDto[], view: ChecklistView): IndexEntry[] {
  const entries = categories.map((category, index) => ({ category, anchor: `categoria-${index + 1}` }));
  return view === 'pending' ? entries.filter(({ category }) => hasPendingItems(category)) : entries;
}

function hasPendingItems(category: ShoppingChecklistCategoryDto): boolean {
  return category.checkedCount < category.items.length;
}

function visibleItems(category: ShoppingChecklistCategoryDto, view: ChecklistView) {
  return view === 'pending' ? category.items.filter((item) => !item.checked) : category.items;
}
