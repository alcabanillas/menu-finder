import Link from 'next/link';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';

// Ported from the design system's `ui_kits/app/WelcomeScreen.jsx` (version 1792255497-a1ff). "Acceder" is a link, not
// a button with a handler, so it works without JavaScript (design D1 of MF-25). Static copy only: a visitor gets no data
// from the catalogue or of any user.
const PAGE =
  'mx-auto grid w-full max-w-[1440px] items-start gap-8 px-gutter-mobile pt-5 pb-10 ' +
  '@min-[680px]:grid-cols-[1.1fr_1fr] @min-[680px]:gap-10 @min-[680px]:px-8 @min-[680px]:pt-12 @min-[680px]:pb-14';
const HERO = 'rounded-lg bg-surface-hero p-6 text-white @min-[680px]:p-9';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const FEATURES = [
  ['Busca como hablas', 'Escribe «de cuchara, sin cerdo y con garbanzos» y verás los menús que encajan, con el plato que lo demuestra.'],
  ['Cada plato, con su receta', 'Tiempos, ingredientes y pasos, tal como aparecen en el menú.'],
  ['La compra, por categorías', 'La lista de la semana agrupada como en el menú original, para ir marcando.'],
] as const;

/** The home of a visitor: what the product does and the way in, inside the shell's variant with no session. */
export function WelcomeScreen() {
  return (
    <div className={PAGE}>
      <section className={HERO}>
        <p className={EYEBROW}>Planificador de menús</p>
        <h1 className="mt-2.5 text-h1">Planifica la semana sin darle vueltas</h1>
        <p className="mt-3.5">
          Elige entre 36 menús pensados por una nutricionista, consulta la receta de cada plato y marca la lista de la
          compra.
        </p>
        <Link href="/login" className={buttonClasses({ variant: 'warm', size: 'lg', className: 'mt-[22px] no-underline' })}>
          Acceder
          <ArrowRight />
        </Link>
      </section>
      <ul className="m-0 flex list-none flex-col gap-[22px] p-0">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="border-t border-border-ink pt-3">
            <h2 className="text-h3 text-text-strong">{title}</h2>
            <p className="mt-1.5 text-text-muted">{text}</p>
          </li>
        ))}
      </ul>
      <p className="text-small text-text-muted @min-[680px]:col-span-full">
        Menu Finder no inventa menús ni recetas: solo encuentra y ordena los que ya existen.
      </p>
    </div>
  );
}
