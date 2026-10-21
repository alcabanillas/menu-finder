// What the two modal panels share, the week preview of Buscar and the recipe of Menú and Hoy: from 800 px both are a
// 400 px panel against the right edge of the window, below the 64 px header, over a backdrop that leaves the header clear.

/** Calls `onClose` on Escape; returns the cleanup of an effect. */
export function closeOnEscape(onClose: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}

/** While the backdrop shows, the page behind does not scroll; a hidden backdrop (no panel at that size) locks nothing. */
export function lockPageScroll(backdrop: HTMLElement): (() => void) | undefined {
  if (getComputedStyle(backdrop).display === 'none') return undefined;
  const page = document.documentElement;
  const before = page.style.overflow;
  page.style.overflow = 'hidden';
  return () => {
    page.style.overflow = before;
  };
}
