type MenuIconName = 'clock' | 'chef-hat' | 'chevron-down' | 'sun' | 'x';

type MenuIconProps = { name: MenuIconName; size: number };

// Lucide icons 0.468.0 (ISC licence), inline as in `app-shell/nav-icon.tsx`: the design system's `Icon` loads the same
// glyphs (version 1791384225-1eab).
const PATHS: Record<MenuIconName, string[]> = {
  clock: [],
  'chef-hat': [
    'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 ' +
      '7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z',
    'M6 17h12',
  ],
  'chevron-down': ['m6 9 6 6 6-6'],
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
  x: ['M18 6 6 18', 'm6 6 12 12'],
};

/** A decorative 24-unit stroke icon: the text next to it carries the meaning. */
export function MenuIcon({ name, size }: MenuIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </>
      )}
      {name === 'sun' && <circle cx="12" cy="12" r="4" />}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
