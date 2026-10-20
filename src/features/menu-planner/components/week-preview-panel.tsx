'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { MenuPreviewDayDto } from '@/application/dto/menu-preview';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import type { PreviewState } from '@/features/menu-planner/preview-view';
import { DAY_NAMES, type EvidenceMark } from '@/features/menu-planner/search-view';
import { DAY_BARS } from '@/shared/ui/day-bars';

type WeekPreviewPanelProps = {
  menu: number;
  /** The rank of the card; `null` when the cards have none (a request with only exclusions). */
  rank: number | null;
  /** The read of the menu, or `null` while it runs. */
  state: PreviewState | null;
  /** The dishes that are evidence of a unit of the request. */
  marks: EvidenceMark[];
  /** The choose button of the card, and the question when it replaces a menu. */
  footer: ReactNode;
  onClose: () => void;
};

// After `WeekPreviewPanel` of the design system's `PlannerScreen.jsx` (version 1792443153-9554), with the anatomy of the
// recipe panel of Menú: a bottom sheet over a backdrop on a phone, from 800 px a 400 px panel on the right below the 64 px
// header. Like the recipe panel it is non-modal, so the cards stay usable beside it (MF-73 design D5).
const BACKDROP = 'fixed inset-0 z-30 bg-ink/40 @max-[799px]:animate-backdrop-in motion-reduce:animate-none @min-[800px]:hidden';
const PANEL =
  'fixed inset-x-0 bottom-0 z-[31] flex h-[85dvh] flex-col rounded-t-lg bg-surface-card shadow-sheet @max-[799px]:animate-sheet-in motion-reduce:animate-none ' +
  '@min-[800px]:inset-x-auto @min-[800px]:top-16 @min-[800px]:right-[max(0px,calc((100vw-1440px)/2))] @min-[800px]:w-[400px] ' +
  '@min-[800px]:h-auto @min-[800px]:rounded-none @min-[800px]:border-l @min-[800px]:border-border-hairline @min-[800px]:shadow-raised';
const CLOSE =
  'flex size-10 flex-none cursor-pointer items-center justify-center rounded-full border border-border-strong ' +
  'text-text-strong hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const MEALS = [
  ['lunch', 'Comida'],
  ['dinner', 'Cena'],
] as const;
const MARK_COLOURS = { met: 'text-olive-600', similar: 'text-ochre-700' };
const MARK_SYMBOLS = { met: '✓', similar: '≈' };

/** The week of a candidate menu beside the results: its days and dishes, the ones that answer the request marked. */
export function WeekPreviewPanel({ menu, rank, state, marks, footer, onClose }: WeekPreviewPanelProps) {
  const headingId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  useEffect(() => close.current?.focus({ preventScroll: true }), [menu]);
  useEffect(() => closeOnEscape(onClose), [onClose]);
  useEffect(() => (backdrop.current ? lockPageScroll(backdrop.current) : undefined), []);

  return (
    <>
      <div ref={backdrop} data-backdrop onClick={onClose} aria-hidden="true" className={BACKDROP} />
      <aside role="dialog" aria-labelledby={headingId} className={PANEL}>
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 flex-none rounded-xs bg-border-strong @min-[800px]:hidden" />
        <div className="flex flex-none items-start gap-3 border-b border-border-hairline px-5 pt-3.5 pb-3 @min-[800px]:pt-5 @min-[800px]:pb-3.5">
          <div className="min-w-0 flex-1">
            <p className={`${EYEBROW} text-olive-600`}>{rank === null ? 'Vista previa' : `Candidato #${rank}`}</p>
            <h2 id={headingId} className="mt-1 text-[24px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text-strong">
              Menú {menu}
            </h2>
          </div>
          <button ref={close} type="button" aria-label="Cerrar vista semanal" onClick={onClose} className={CLOSE}>
            <PlannerIcon name="x" size={18} />
          </button>
        </div>
        <div data-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-4">
          <Body state={state} marks={marks} />
        </div>
        <div data-footer className="flex-none border-t border-border-hairline bg-surface-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </aside>
    </>
  );
}

function Body({ state, marks }: { state: PreviewState | null; marks: EvidenceMark[] }) {
  if (state === null) {
    return (
      <p role="status" className="py-3 text-text-muted">
        Cargando…
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <p role="alert" className="py-3 text-terracotta-700">
        {state.message}
      </p>
    );
  }
  return (
    <>
      {state.preview.days.filter(isShown).map((day) => (
        <Day key={day.day} day={day} marks={marks} />
      ))}
    </>
  );
}

// Sunday only when it has dishes.
function isShown({ day, lunch, dinner }: MenuPreviewDayDto): boolean {
  return day !== 'sunday' || lunch.length > 0 || dinner.length > 0;
}

function Day({ day, marks }: { day: MenuPreviewDayDto; marks: EvidenceMark[] }) {
  const empty = day.lunch.length === 0 && day.dinner.length === 0;
  return (
    <section aria-label={DAY_NAMES[day.day]} className="border-b border-border-hairline py-3 last:border-b-0">
      <div className="flex items-center gap-2.5 text-base leading-[1.2] font-extrabold tracking-[-0.02em] text-text-strong">
        <span data-day-bar aria-hidden="true" className={`h-1 w-[22px] flex-none rounded-[2px] ${DAY_BARS[day.day]}`} />
        {DAY_NAMES[day.day]}
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-text-muted italic">Sin platos este día.</p>
      ) : (
        MEALS.map(([meal, label]) => (
          <Meal key={meal} label={label} names={day[meal]} marks={marks.filter((mark) => mark.day === day.day && mark.meal === meal)} />
        ))
      )}
    </section>
  );
}

function Meal({ label, names, marks }: { label: string; names: string[]; marks: EvidenceMark[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className={`${EYEBROW} mt-2 mb-0.5 text-[10.5px] text-olive-600`}>{label}</p>
      {names.map((name, index) => (
        <p key={`${name}-${index}`} className="mt-0.5 text-[14.5px] leading-[1.35] font-semibold text-text-strong">
          {name}
          {marks
            .filter((mark) => mark.name === name)
            .map((mark) => (
              <span key={mark.label} data-mark className={`ml-2 inline-flex gap-[3px] text-xs whitespace-nowrap ${MARK_COLOURS[mark.state]}`}>
                {MARK_SYMBOLS[mark.state]} {mark.label}
              </span>
            ))}
        </p>
      ))}
    </div>
  );
}

function closeOnEscape(onClose: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}

// As a bottom sheet over a backdrop the page behind must not scroll with the sheet; as a side panel (no backdrop) it does.
function lockPageScroll(backdrop: HTMLElement): (() => void) | undefined {
  if (getComputedStyle(backdrop).display === 'none') return undefined;
  const page = document.documentElement;
  const before = page.style.overflow;
  page.style.overflow = 'hidden';
  return () => {
    page.style.overflow = before;
  };
}
