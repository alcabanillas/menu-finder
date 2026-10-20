# Proposal: MF-74 `/menu` for a week without a menu, at design system version v64

Roadmap item: **MF-74** (`context/roadmap.md`; the ID is provisional and the item is not yet in the roadmap, so the author confirms the ID and the estimate). One change, no subtasks.

## Why

The design system moved from `1792443153-9554` (v62) to `1792450792-6aa6` (v64). Its registry `project/implementacion.md` lists two rows as `diseñado` for the card "Menu": a week without a menu is a single notice, the same piece as the one in Hoy, in four cases (v64); and on desktop all of `/menu` has the same maximum width and margin as the header. Today `/menu` shows a grey card with "Elegir menú" and, below it, seven dashed day cards, also on Sunday; and the empty page has no width limit, so at 1920 px its content starts at the screen edge while the shell header is centred in 1440 px. The tokens did not change (`tokens.json` is identical), so the copy only needs its `VERSION`.

## What Changes

- **Design system copy:** `design-system/VERSION` becomes `1792450792-6aa6` (v64). `design-system/tokens.json` is not touched.
- **A week without a menu is one notice.** The seven dashed day cards go, Sunday included. The page title is "Semana sin menú" (the eyebrow "Semana del 26 de octubre" stays). The notice is the one of Hoy (`NoMenuNotice`), moved to `src/shared/ui/` because two features use it, with `role="status"`. Four cases:
  - **Past week:** grey; "No se eligió menú para esta semana" / "Las semanas pasadas no se pueden cambiar."; no button.
  - **This week, open** (next week has no menu either): olive-50; "Esta semana aún no tiene menú"; the text of Hoy; primary button "Elegir menú para esta semana →" to `/planner?week=current`.
  - **This week, closed** (next week already has a menu): grey; "Esta semana no tiene menú"; the explanation of Hoy, naming "Menú N"; secondary button "Ver el menú de la semana que viene →" to `/menu` on that week.
  - **Next week:** olive-50; "La semana que viene aún no tiene menú"; the text of the open case; primary button "Elegir menú para el 26 oct" to `/planner?week=next`.
- **Closed or open comes from the rule of Buscar:** `isLocked` (`domain/selection/week.ts`), which `weeksToChoose` and Hoy already use. It is not written a second time.
- **Desktop width:** the notice is at most 760 px and left-aligned from 800 px. The empty page gets the same box as the page with a menu: 1440 px, centred, with the margins of the header. The page with a menu is checked by eye at 1920 px and only changed if it does not line up.
- **Week selector:** the next-week control is disabled on next week, and "Esta semana" shows on every week but the current one. The code already does both; the change only adds the scenarios and the tests that pin them.
- **Not touched:** `WelcomeScreen`; the page when the menu cannot be read (it keeps the heading "Menú" and its message); the look-back and look-ahead windows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-menu`: "The page without a menu to show" and "A week without menu shows the empty state with a link to the planner" (the four cases, the title, no day placeholders, the buttons); "The page moves between weeks from its header" (the current-week control on every other week); new requirement "The page has one maximum width".
- `home`: none of its requirements change. The notice only moves to a shared place and gains a case; Hoy keeps its two cases and its copy.

## Impact

- **UI:** `features/dashboard/components/no-menu-notice.tsx` moves to `shared/ui/` (ADR-001 §2, Scope Rule: a second feature uses it) and takes the new cases; `features/weekly-menu/components/empty-menu.tsx` loses the ghost days and the grey card and renders the notice; `app/(signed-in)/menu/page.tsx` passes what the notice needs.
- **Application:** `menuWeekPage` returns, besides the navigation, the menu number and Monday of the week after the shown one when this week is closed. No new port: it already reads the selections through `SelectionRepository.listFrom`.
- **Data touched:** the user's own selections, already read by this page. Nothing new is stored, logged or sent to Sentry.
- **Abuses and OWASP:** A01 (the page still needs a session and reads only the signed-in user's selections; every link of the notice is built by the server from a validated Monday or a fixed path, never from the request). No endpoint is added.

## Decisions it relies on

- **UI-design-system:** the design system is the visual source of truth; `VERSION` is refreshed in this change (`design-system/README.md`).
- **SEG-sistema-cerrado:** no anonymous user; the page redirects to sign-in without a session.
- **Reuse of the rule of Buscar:** `isLocked` decides closed weeks for Buscar, Hoy and now `/menu` (design D2 of MF-25).
