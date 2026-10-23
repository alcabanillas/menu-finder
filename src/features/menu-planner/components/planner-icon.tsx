export type PlannerIconName =
  | 'plus'
  | 'minus'
  | 'sparkles'
  | 'check'
  | 'x'
  | 'search'
  | 'arrow-up'
  | 'arrow-right'
  | 'lock'
  | 'repeat'
  | 'dices'
  | 'pencil'
  | 'calendar-days'
  | 'message-circle-question'
  | 'utensils-crossed'
  | 'triangle-alert'
  | 'clock';

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
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  lock: ['M7 11V7a5 5 0 0 1 10 0v4'],
  repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
  dices: [
    'm17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6',
    'M6 18h.01',
    'M10 14h.01',
    'M15 6h.01',
    'M18 9h.01',
  ],
  pencil: [
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    'm15 5 4 4',
  ],
  'calendar-days': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'],
  // The icons of the search errors (MF-79 design D4).
  'message-circle-question': ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  'utensils-crossed': [
    'm16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8',
    'M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7',
    'm2.1 21.8 6.4-6.3',
    'm19 5-7 7',
  ],
  'triangle-alert': ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  // The polyline `12 6 12 12 16 14` of Lucide, as a path.
  clock: ['M12 6v6l4 2'],
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
      {name === 'lock' && <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />}
      {name === 'calendar-days' && <rect width="18" height="18" x="3" y="4" rx="2" />}
      {name === 'dices' && <rect width="12" height="12" x="2" y="10" rx="2" ry="2" />}
      {name === 'clock' && <circle cx="12" cy="12" r="10" />}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
