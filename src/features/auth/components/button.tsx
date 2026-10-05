import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
};

// Ported from the design system's `core/Button.jsx` (version 1791192451-31e6), only the variants and sizes the app uses.
// Hover and press are CSS variants, not React state, so the button also renders in server components.
const VARIANTS = {
  primary: 'border-olive-600 bg-olive-600 text-white hover:enabled:border-olive-700 hover:enabled:bg-olive-700',
  secondary: 'border-border-ink bg-transparent text-text-strong hover:enabled:bg-gray-100',
};

const SIZES = {
  md: 'h-11 px-[18px] text-[15px]',
  lg: 'h-13 px-[22px] text-base',
};

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill border font-semibold ' +
  'tracking-[var(--tracking-ui)] transition-[background-color,transform] duration-[var(--dur-base)] ease-out ' +
  'active:enabled:scale-[var(--press-scale)] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45';

/** The design system's pill button: one primary per screen. */
export function Button({ variant = 'primary', size = 'md', fullWidth = false, type = 'button', className, ...props }: ButtonProps) {
  const classes = [BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}
