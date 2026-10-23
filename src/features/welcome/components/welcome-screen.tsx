import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DayDto } from '@/application/dto/weekly-menu';
import { ArrowRight } from '@/shared/ui/arrow-right';
import { buttonClasses } from '@/shared/ui/button';
import { DAY_BARS } from '@/shared/ui/day-bars';

/** A day of the sample week: the first dish of its lunch and of its dinner. */
export type GlanceDay = { day: Exclude<DayDto, 'sunday'>; lunch: string; dinner: string };

type WelcomeScreenProps = {
  /** The sample search beside the heading: the request, its chips and a card. */
  search: ReactNode;
  week: GlanceDay[];
  /** An open recipe card. */
  recipe: ReactNode;
  /** One category of a shopping list. */
  shopping: ReactNode;
};

// Ported from the design system's `ui_kits/app/WelcomeScreen.jsx` (version 1792687168-5ad7). "Acceder" is a link, not a
// button with a handler, so it works without JavaScript (design D1 of MF-25). The pieces of the app come as slots, built
// by `app/` with the components of Buscar, Menú and Compra, and are inert samples (MF-76 design D1, D2). The design's
// container widths map to the app's: 640 px for the gutter, 800 px for the columns (UI-punto-de-corte), 1100 px.
const PAGE =
  'mx-auto flex w-full max-w-[1440px] flex-col gap-14 px-gutter-mobile pt-4 pb-12 ' +
  '@min-[640px]:gap-[72px] @min-[640px]:px-8 @min-[640px]:pt-6 @min-[640px]:pb-16 @min-[800px]:gap-24';
const HERO =
  'grid items-center gap-7 rounded-lg bg-surface-hero px-[22px] py-7 text-white @min-[640px]:p-10 ' +
  '@min-[800px]:grid-cols-2 @min-[800px]:gap-12 @min-[800px]:px-12 @min-[800px]:py-14';
const EYEBROW = 'text-eyebrow font-semibold uppercase tracking-[var(--text-eyebrow--letter-spacing)]';
const H1 =
  'mt-3 text-[38px] leading-[1.04] font-extrabold tracking-[-0.02em] @min-[640px]:text-[48px] @min-[800px]:text-[56px] ' +
  '@min-[1100px]:text-[64px]';
const DEMO =
  'flex min-w-0 flex-col gap-3 rounded-lg bg-surface-card p-4 text-text-body shadow-[0_24px_60px_-28px_rgba(0,0,0,.5)]';
const H2 = 'text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text-strong';
const DAY_NAMES: Record<GlanceDay['day'], string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
};
const COVER_DAYS = Object.keys(DAY_NAMES) as GlanceDay['day'][];

/**
 * The home of a visitor, inside the shell's variant with no session: a green cover with the way in and a sample search,
 * three features each with a piece of the app, and a closing block with the way in again.
 */
export function WelcomeScreen({ search, week, recipe, shopping }: WelcomeScreenProps) {
  return (
    <div className={PAGE}>
      <Cover search={search} />
      <Feature
        number="1"
        title="La semana, de un vistazo"
        text="Lunes a sábado en una sola pantalla, con la comida y la cena de cada día. Cabe entera para hacerle una captura y mandarla a casa."
      >
        <WeekGlance week={week} />
      </Feature>
      <Feature
        number="2"
        right
        title="Cada plato, con su receta"
        text="Toca un plato y ves los tiempos, los ingredientes con sus cantidades y los pasos, tal como vienen en el menú."
      >
        {recipe}
      </Feature>
      <Feature
        number="3"
        title="La compra, por categorías"
        text="La lista de la semana agrupada como en el menú original. Vas marcando lo que tienes, o una categoría entera de una vez."
      >
        {shopping}
      </Feature>
      <Closing />
    </div>
  );
}

function Cover({ search }: { search: ReactNode }) {
  return (
    <section className={HERO}>
      <div>
        <p className={`${EYEBROW} text-aceite-300`}>Planificador de menús</p>
        <h1 className={H1}>Planifica la semana sin darle vueltas</h1>
        <p className="mt-4 mb-6 max-w-[52ch] text-[17px] leading-normal text-olive-100">
          Dile qué te apetece como se lo dirías a alguien de casa. Te enseña los menús de la nutricionista que encajan y el
          plato que lo demuestra.
        </p>
        <AccessLink variant="warm" />
        <p className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-olive-100">
          {COVER_DAYS.map((day) => (
            <span key={day} aria-hidden="true" className={`h-[5px] w-6 rounded-[3px] ${DAY_BARS[day]}`} />
          ))}
          <span>36 menús · recetas con tiempos · compra por categorías</span>
        </p>
      </div>
      <Sample className={DEMO}>{search}</Sample>
    </section>
  );
}

type FeatureProps = { number: string; title: string; text: string; right?: boolean; children: ReactNode };

// The text and, beside it from 800 px (below it on a phone), a piece of the app in a grey panel; `right` puts the text on
// the right.
function Feature({ number, title, text, right = false, children }: FeatureProps) {
  const columns = right
    ? '@min-[800px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'
    : '@min-[800px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]';
  return (
    <section className={`grid items-center gap-5 @min-[800px]:gap-14 ${columns}`}>
      <div className={`flex flex-col gap-2.5 ${right ? '@min-[800px]:order-2' : ''}`}>
        <span aria-hidden="true" className="text-[34px] leading-none font-extrabold text-olive-500 italic">
          {number}
        </span>
        <h2 className={`${H2} @min-[800px]:text-[32px]`}>{title}</h2>
        <p className="max-w-[46ch] text-text-muted">{text}</p>
      </div>
      <Sample className="min-w-0 rounded-lg bg-surface-sunken p-5 @min-[800px]:p-7">{children}</Sample>
    </section>
  );
}

// A piece of the app to look at only: out of the accessibility tree, the tab order and the pointer (MF-76 design D2).
function Sample({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div data-sample aria-hidden="true" inert className={className}>
      {children}
    </div>
  );
}

function WeekGlance({ week }: { week: GlanceDay[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 @min-[640px]:grid-cols-3">
      {week.map(({ day, lunch, dinner }) => (
        <div key={day} data-glance-day className="min-w-0 rounded-[12px] border border-border-hairline bg-surface-card px-3 py-2.5">
          <p className="flex items-center gap-2 border-b border-border-ink pb-1.5 text-[15px] font-extrabold text-text-strong">
            <span className={`h-1 w-5 flex-none rounded-[2px] ${DAY_BARS[day]}`} />
            <span data-day-name>{DAY_NAMES[day]}</span>
          </p>
          <GlanceMeal label="Comida" dish={lunch} />
          <GlanceMeal label="Cena" dish={dinner} />
        </div>
      ))}
    </div>
  );
}

function GlanceMeal({ label, dish }: { label: string; dish: string }) {
  return (
    <>
      <p className="mt-2 text-[10px] font-semibold tracking-[.14em] text-olive-600 uppercase">{label}</p>
      <p className="mt-0.5 text-[13px] leading-[1.3] font-semibold text-text-strong">{dish}</p>
    </>
  );
}

function Closing() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-border-hairline px-[22px] py-7 @min-[800px]:flex-row @min-[800px]:items-center @min-[800px]:justify-between @min-[800px]:px-10 @min-[800px]:py-8">
      <div>
        <h2 className={`${H2} text-[24px]`}>¿Qué os apetece esta semana?</h2>
        <p className="mt-1.5 text-sm leading-normal text-text-muted">
          Escríbelo como te salga y te enseñamos los menús que encajan.
        </p>
      </div>
      <AccessLink variant="primary" />
    </section>
  );
}

function AccessLink({ variant }: { variant: 'warm' | 'primary' }) {
  return (
    <Link href="/login" className={buttonClasses({ variant, size: 'lg', className: 'no-underline' })}>
      Acceder
      <ArrowRight />
    </Link>
  );
}
