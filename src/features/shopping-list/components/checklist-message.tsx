import Link from 'next/link';

type ChecklistMessageProps = { text: string; link?: { href: string; label: string } };

/** The page when there is no list to show: the title, why, and optionally where to go. */
export function ChecklistMessage({ text, link }: ChecklistMessageProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-5 py-16 text-center">
      <h1 className="text-h2 font-extrabold text-text-strong">Lista de la compra</h1>
      <p>{text}</p>
      {link && (
        <Link
          href={link.href}
          className="inline-flex min-h-11 items-center rounded-pill border border-olive-600 bg-olive-600 px-[18px] text-[15px] font-semibold text-white hover:bg-olive-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
