type PlannerIconName = 'plus' | 'minus' | 'sparkles' | 'check' | 'x' | 'search' | 'arrow-up';

const DEFAULT_STROKE_WIDTH = 1.5;

type PlannerIconProps = { name: PlannerIconName; size: number; strokeWidth?: number };

// Lucide icons 0.468.0 (ISC licence), inline as in `weekly-menu/components/menu-icon.tsx`: the design system's `Icon`
// loads the same glyphs (version 1791992191-0fd0).
const PATHS: Record<PlannerIconName, string[]> = {
  plus: ['M5 12h14', 'M12 5v14'],
  minus: ['M5 12h14'],
  sparkles: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 ' +
      '.963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 ' +
      '6.135a.5.5 0 0 1-.963 0z',
    'M20 3v4',
    'M22 5h-4',
    'M4 17v2',
    'M5 18H3',
  ],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  search: ['m21 21-4.3-4.3'],
  'arrow-up': ['m5 12 7-7 7 7', 'M12 19V5'],
};

/** A decorative 24-unit stroke icon: the text next to it carries the meaning. */
export function PlannerIcon({ name, size, strokeWidth = DEFAULT_STROKE_WIDTH }: PlannerIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'search' && <circle cx="11" cy="11" r="8" />}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
