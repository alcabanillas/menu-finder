import { Wordmark } from '@/features/auth/components/wordmark';

type SignInHeroProps = { className?: string };

// The week from Monday to Saturday in the design system's day colours; Sunday, usually empty, is an outlined bar.
const DAYS = ['bg-day-mon', 'bg-day-tue', 'bg-day-wed', 'bg-day-thu', 'bg-day-fri', 'bg-day-sat'];

/**
 * The olive panel beside the sign-in form on wide screens, from the design system's Login mock (version
 * 1791192451-31e6). Static copy only: no data from the catalogue or the user reaches a screen without a session.
 */
export function SignInHero({ className }: SignInHeroProps) {
  return (
    <aside
      className={['flex-col justify-between gap-12 bg-surface-hero p-10 text-white @min-[960px]:p-14', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Wordmark className="text-[28px] text-white" accentClassName="text-white" />
      <div>
        <p className="text-eyebrow uppercase">36 menús del archivo</p>
        <hr className="mt-2.5 border-0 border-t border-white opacity-90" />
        <h2 className="mt-[18px] max-w-[16ch] text-h1">Un menú para cada semana</h2>
        <p className="mt-3.5 max-w-[34ch]">
          Busca entre menús pensados por una nutricionista, abre la receta de cada plato y marca la lista de la compra.
        </p>
      </div>
      <div aria-hidden="true" className="flex gap-1.5">
        {DAYS.map((day) => (
          <span key={day} className={`h-1 w-7 rounded-[2px] outline outline-1 outline-white/70 ${day}`} />
        ))}
        <span className="h-1 w-7 rounded-[2px] border border-white" />
      </div>
    </aside>
  );
}
