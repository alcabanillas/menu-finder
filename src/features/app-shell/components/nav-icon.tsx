export type NavIconName = 'sun' | 'search' | 'calendar-days' | 'shopping-basket';

type NavIconProps = { name: NavIconName; size: number; strokeWidth: number };

// Lucide icons (ISC licence), inline so that the app needs no icon library for four glyphs. The design system loads the
// same glyphs through its `Icon` component (version 1791272018-0feb).
const GLYPHS: Record<NavIconName, string[]> = {
  sun: [
    'M12 2v2',
    'M12 20v2',
    'm4.93 4.93 1.41 1.41',
    'm17.66 17.66 1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'm6.34 17.66-1.41 1.41',
    'm19.07 4.93-1.41 1.41',
  ],
  search: ['m21 21-4.3-4.3'],
  'calendar-days': [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M8 14h.01',
    'M12 14h.01',
    'M16 14h.01',
    'M8 18h.01',
    'M12 18h.01',
    'M16 18h.01',
  ],
  'shopping-basket': [
    'm15 11-1 9',
    'm19 11-4-7',
    'M2 11h20',
    'm3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4',
    'M4.5 15.5h15',
    'm5 11 4-7',
    'm9 11 1 9',
  ],
};

/** A decorative 24-unit stroke icon: the link next to it carries the accessible name. */
export function NavIcon({ name, size, strokeWidth }: NavIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'sun' && <circle cx="12" cy="12" r="4" />}
      {name === 'search' && <circle cx="11" cy="11" r="8" />}
      {name === 'calendar-days' && <rect width="18" height="18" x="3" y="4" rx="2" />}
      {GLYPHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
