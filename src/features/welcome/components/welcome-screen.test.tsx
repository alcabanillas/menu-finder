import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WelcomeScreen, type GlanceDay } from '@/features/welcome/components/welcome-screen';

// Fictitious dishes only (AGENTS.md: never real data).
const WEEK: GlanceDay[] = [
  { day: 'monday', lunch: 'Comida ficticia 1', dinner: 'Cena ficticia 1' },
  { day: 'tuesday', lunch: 'Comida ficticia 2', dinner: 'Cena ficticia 2' },
  { day: 'wednesday', lunch: 'Comida ficticia 3', dinner: 'Cena ficticia 3' },
  { day: 'thursday', lunch: 'Comida ficticia 4', dinner: 'Cena ficticia 4' },
  { day: 'friday', lunch: 'Comida ficticia 5', dinner: 'Cena ficticia 5' },
  { day: 'saturday', lunch: 'Comida ficticia 6', dinner: 'Cena ficticia 6' },
];

function renderWelcome() {
  return render(
    <WelcomeScreen
      search={<button type="button">Pieza de búsqueda</button>}
      week={WEEK}
      recipe={<button type="button">Pieza de receta</button>}
      shopping={<a href="/shopping-list">Pieza de compra</a>}
    />,
  );
}

describe('WelcomeScreen', () => {
  it('has the cover: heading, text, the line of the days and the way in', () => {
    renderWelcome();

    expect(screen.getByRole('heading', { level: 1, name: 'Planifica la semana sin darle vueltas' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dile qué te apetece como se lo dirías a alguien de casa. Te enseña los menús de la nutricionista que encajan y el plato que lo demuestra.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Planificador de menús')).toBeInTheDocument();
    expect(screen.getByText('36 menús · recetas con tiempos · compra por categorías')).toBeInTheDocument();
  });

  it('offers two "Acceder" links to the sign-in', () => {
    renderWelcome();

    const links = screen.getAllByRole('link', { name: 'Acceder' });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  it('has the three features and the closing block, in that order', () => {
    renderWelcome();

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'La semana, de un vistazo',
      'Cada plato, con su receta',
      'La compra, por categorías',
      '¿Qué os apetece esta semana?',
    ]);
    expect(
      screen.getByText('Menu Finder no inventa menús ni recetas: solo encuentra y ordena los que ya existen.'),
    ).toBeInTheDocument();
  });

  it('shows the six days of the week with their lunch and dinner', () => {
    const { container } = renderWelcome();

    const days = container.querySelectorAll('[data-glance-day]');
    expect([...days].map((day) => day.querySelector('[data-day-name]')?.textContent)).toEqual([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ]);
    expect(days[0]).toHaveTextContent('ComidaComida ficticia 1CenaCena ficticia 1');
  });

  it('puts every sample piece in an inert subtree hidden from screen readers', () => {
    const { container } = renderWelcome();

    const samples = container.querySelectorAll('[data-sample]');
    expect(samples).toHaveLength(4);
    samples.forEach((sample) => {
      expect(sample).toHaveAttribute('aria-hidden', 'true');
      expect(sample).toHaveAttribute('inert');
    });
    expect(within(samples[0] as HTMLElement).getByText('Pieza de búsqueda')).toBeInTheDocument();
  });

  it('reaches no control but the two "Acceder": no sign-up and no password recovery', () => {
    renderWelcome();

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Acceder', 'Acceder']);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByText(/regístrate|crear cuenta|recuperar|olvidado/i)).not.toBeInTheDocument();
  });
});
