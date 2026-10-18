type ArrowRightProps = { size?: number };

// The size of the icon in a large button, the welcome's "Acceder".
const LARGE = 19;

/** The design system's `arrow-right` icon, after the text of a link that moves on. Decorative: the text says where. */
export function ArrowRight({ size = LARGE }: ArrowRightProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
