## Why

Roadmap item **MF-43.2**, the second subtask of MF-43, after `mf-43-1-menu-selection`, which stores the choice and computes its Monday. `/planner` is still a placeholder ("Aquí podrás elegir el menú de la semana"). The author asked for the simplest screen that lets a user get a menu: one button that chooses a menu at random, with the app's global styles and no mock (2026-10-07). The search of MF-22 replaces it. It is also the app of plan B if the search does not arrive (`context/decisiones.md` UI-flujo-semanal).

**Result:** in the browser, you press the button and see which menu you got and the Monday it starts on.

## What Changes

- **A button "Elegir un menú al azar"** on `/planner` posts a server action that takes the user from the session, picks one of the stored menus at random on the server and stores it with `selectMenu`'s rules (MF-43.1). The page says which menu it was and its Monday. It works without JavaScript.
- **A summary**: this week's menu and next week's, from `currentSelections` (MF-43.1), each one as its number and Monday or as "Sin elegir".
- **A use case `selectRandomMenu`**, on the existing `MenuRepository.list()` and `SelectionRepository`; the random number comes in as a function, so tests fix it.
- **Left out:** the list of the 36 menus and their dishes; avoiding the menu already chosen; the search (MF-22); `/menu` (MF-23); the shopping list (MF-24); the dashboard (MF-25).

## Capabilities

### New Capabilities
- `menu-planner`: what the provisional `/planner` shows and how a signed-in user gets a random menu from it, with its negative cases.

### Modified Capabilities
- None. The scenario "A valid session" of `authentication` still holds: the page keeps the greeting with the user's name.

## Impact

- **Code:** `src/application/use-cases/select-random-menu.ts`; `src/application/dto/selection-summary.ts`; `src/app/(app)/planner/page.tsx` and new `actions.ts`; new feature `src/features/menu-planner/` (the form, the summary, the Spanish date); `web-container.ts` wires `selectRandomMenu` with `PostgresMenuRepository` and `Math.random`; `protected-pages.test.ts` also checks the actions under `(app)/`; `e2e/planner.spec.ts`. `Button` moves from `src/features/auth/components/` to `src/shared/ui/`, because a second feature uses it (Scope Rule, ADR-001 §2).
- **Dependencies:** none new.
- **Decisions relied on:** UI-flujo-semanal, ARQ-hexagonal and ADR-001 §2, §3 and §5, SEG-roles, SEG-sistema-cerrado; `context/safety-first.md` §2.2. It **deviates** from UI-design-system on purpose: no mock, the app's tokens and `Button` only; the author chose it on 2026-10-07 for a provisional screen.
- **Data:** the user's own selections and menu numbers. No dish names reach the page. The e2e test uses a fictitious menu it creates and removes.
- **Abuses and OWASP:**
  - Calling the server action without a session (A01, A07): a server action is a public POST endpoint, so it checks the session first; without one it stores nothing and goes to `/login`.
  - Choosing for another user (A01): the action reads nothing from the form; any field naming a user is ignored, because the user comes from the session.
  - Choosing a menu of one's liking by tampering (A04): the menu is picked on the server; the form carries no menu number.
  - Cross-site request forgery (A01): Next.js server actions accept only POST and check that the `Origin` matches the host; nothing here weakens it.
