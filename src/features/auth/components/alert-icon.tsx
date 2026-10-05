type AlertIconProps = { size: number; className?: string };

/**
 * Lucide's `circle-alert` (ISC licence, https://lucide.dev), inline: the design system uses Lucide, and one glyph does
 * not justify an icon library. Stroke 1.5 as the design system asks. Decorative: the text beside it says the same.
 */
export function AlertIcon({ size, className }: AlertIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
