## Why

Roadmap item **MF-43.2**, the second subtask of MF-43, after `mf-43-1-menu-selection`, which stores the choice and computes its Monday. `/planner` is still a placeholder ("Aquí podrás elegir el menú de la semana"). This change makes it the provisional planner of MF-43: the list of the 36 menus with "Elegir", without the search of MF-22, which replaces it. It is also the app of plan B if the search does not arrive (`context/decisiones.md` UI-flujo-semanal).

**Result:** in the browser, you choose a menu and see the Monday it starts on.

## What Changes

- **`/planner` lists every stored menu** in number order. Each one shows its number and, folded by default, its dishes by day (lunch and dinner), so the user can tell the menus apart before choosing.
- **"Elegir" on each menu** posts a server action that takes the user from the session, calls `selectMenu` (MF-43.1) and shows which Monday the menu starts on. It works without JavaScript.
- **A summary at the top**: this week's menu and the next one, from `currentSelections` (MF-43.1), each one or "sin elegir". The menu that is already chosen is marked in the list.
- **A use case to list the menus for the web**, on the existing `MenuRepository.list()`, returning a DTO the feature can read without touching the domain.
- **Left out:** the search, chips and explanation (MF-22); `/menu` and the recipe card (MF-23); the shopping list (MF-24); the dashboard (MF-25).

## Capabilities

### New Capabilities
- `menu-planner`: what the provisional `/planner` shows and how a signed-in user chooses a menu from it, with its negative cases.

### Modified Capabilities
- None. The scenario "A valid session" of `authentication` still holds: the page keeps the greeting with the user's name.

## Impact

- **Code:** `src/application/use-cases/list-menus.ts` and `src/application/dto/menu-summary.ts`; `src/app/(app)/planner/page.tsx` and new `src/app/(app)/planner/actions.ts`; new feature `src/features/menu-planner/components/` (the list, a menu card, the summary); `web-container.ts` wires `listMenus` with `PostgresMenuRepository`; `e2e/planner.spec.ts`. `Button` is in `src/features/auth/components/` and is now needed by a second feature, so it moves to `src/shared/ui/` (Scope Rule, ADR-001 §2).
- **Dependencies:** none new.
- **Decisions relied on:** UI-flujo-semanal, UI-design-system, ARQ-hexagonal and ADR-001 §2, §3 and §5, SEG-roles, SEG-sistema-cerrado; `context/safety-first.md` §2.2 (the server decides, the client only renders). It **deviates** from UI-design-system: there is no mock of this screen in the design system. It is a provisional screen that MF-22 replaces, built only from the shell and components already ported; design D1 says so, for the author to accept or to make the mock before `apply`.
- **Data:** the menus' dish names (catalogue data, shown only to a signed-in user; nothing from the nutritionist's brand reaches them, `context/decisiones.md` SEG-datos-nutricionista) and the user's own selections. The e2e test uses fictitious menus that it creates and removes.
- **Abuses and OWASP:**
  - Calling the server action without a session (A01, A07): a server action is a public POST endpoint, so it checks the session itself, before reading the form; without one it stores nothing and goes to `/login`.
  - Choosing for another user (A01): the form carries only the menu number; any user id it carries is ignored, because the user comes from the session.
  - Tampered menu numbers (A03, A04): validated by `selectMenu` (MF-43.1); the page shows a generic message and stores nothing.
  - Cross-site request forgery (A01): Next.js server actions accept only POST and check that the `Origin` matches the host; nothing here weakens it.
