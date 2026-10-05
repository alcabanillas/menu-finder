type WordmarkProps = { className?: string; accentClassName?: string };

/** The product's name set in Archivo 800 with "Finder" in italics: the design system has no logo, only this wordmark. */
export function Wordmark({ className, accentClassName = 'text-olive-600' }: WordmarkProps) {
  return (
    <div className={['font-extrabold leading-none tracking-[-0.01em] text-text-strong', className].filter(Boolean).join(' ')}>
      Menu <i className={accentClassName}>Finder</i>
    </div>
  );
}
