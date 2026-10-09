import type { ReactNode } from 'react';

// After the design system's `MenuScreen.jsx` (`.mf-mh`): the title on the left, the week controls on the right from
// 640 px, below the title on a phone.
const HEADER =
  'flex flex-col gap-3.5 px-gutter-mobile pb-2 pt-5 @min-[640px]:flex-row @min-[640px]:items-end ' +
  '@min-[640px]:justify-between @min-[640px]:px-8 @min-[640px]:pt-6';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)] text-olive-600';

type WeekHeaderProps = { eyebrow?: string; title: string; nav?: ReactNode };

/** The heading of `/menu`: the week's date and the menu's name, with the week controls beside them. */
export function WeekHeader({ eyebrow, title, nav }: WeekHeaderProps) {
  return (
    <header className={HEADER}>
      <div>
        {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
        <h1 className="mt-1 text-h1 font-extrabold">{title}</h1>
      </div>
      {nav}
    </header>
  );
}
