const FULL = 100;

type ProgressBarProps = { value: number; max: number; label: string };

// Ported from the design system's `components/recipe/ProgressBar.jsx` (version 1791390572-4ab7), olive tone only.
/** A labelled bar with "N de M"; the fill is clamped to 0-100 %. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(FULL, (value / (max || 1)) * FULL));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-small text-text-body">
        <span>{label}</span>
        <span className="tabular-nums text-text-muted">
          <b className="font-semibold text-text-strong">{value}</b> de {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} de ${max}`}
        className="h-1.5 overflow-hidden rounded-pill bg-gray-100"
      >
        <div
          className="h-full rounded-pill bg-olive-500 transition-[width] duration-[var(--dur-slow)] ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
