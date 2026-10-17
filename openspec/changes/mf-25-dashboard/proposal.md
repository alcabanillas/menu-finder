## Why

Roadmap item **MF-25** (`context/roadmap.md`), done as one change by the author's choice (~2.5 h). `/` is still the stopgap of MF-20.3 and MF-51.1: a visitor gets the sign-in form and a signed-in user a page "Hoy" that says nothing. `context/producto.md` §4 and `context/decisiones.md` UI-home-sin-login want two states: an informative home for the visitor and a dashboard with the active menu, what is on today and the shopping progress. The weekly flow (UI-flujo-semanal) is now complete (MF-43, MF-23, MF-24, MF-22), so the dashboard has every piece of data it shows.

## What Changes

- **`/` without a session shows the informative home** (mock `WelcomeScreen.jsx`) inside the shell's visitor variant (`<AppShell>` with no account, "Acceder" to `/login`), built by MF-51.1 and mounted by no route until now. It describes the product and shows no catalogue or user data, no version and no sign-up (SEG-sistema-cerrado). **BREAKING** for the spec: `/` no longer renders the sign-in form; the sign-in lives only at `/login`.
- **`/` with a session shows the dashboard** (mock `HomeScreen.jsx`) instead of the minimal "Hoy" page: the menu of this week with its dates and links to `/menu` and `/planner`, the lunch and dinner dishes of today with their recipes, and the progress of the current shopping list with a link to `/shopping-list`. Each block has its empty state (no menu this week, no current list) and a failure message.
- **The sign-in destination moves from `/planner` to `/`**, after a sign-in and for a signed-in user who opens `/login`. It stays fixed: never read from the URL, the form or a header (open redirect, OWASP A01), and the test that ignores `?next=…` stays.
- No new port, use case or table: the page reads the two use cases `/menu` and `/shopping-list` already use (`menuWeekPage` for this week, `shoppingChecklist`).

## Capabilities

### New Capabilities
- `home`: what `/` shows in each state, decided on the server from the session: the informative home for a visitor and the dashboard for a signed-in user, with its blocks, empty states and failure.

### Modified Capabilities
- `authentication`: "Sign-in from the browser" and "The sign-in sends the user to a fixed place" go to `/` instead of `/planner`; "The home shows the sign-in until the dashboard exists" is removed (its content moves to `home`).
- `app-shell`: `/` renders inside the shell in both states (the visitor variant without a session); the variant with no session is now mounted by `/`.

## Impact

- **Code:** `src/app/page.tsx`, `src/app/_auth/actions.ts` and `require-user.ts` (destination); new features `dashboard` and `welcome` under `src/features/`; a "today" view in `weekly-menu` and a progress card in `shopping-list`, composed by the page (ADR-001 §2 Scope Rule: the page composes features).
- **Tests:** unit tests of the new components and of the page; e2e `sign-in.spec.ts`, `app-shell.spec.ts` and `access.spec.ts` change destination or content; a new e2e for the visitor home (the warning of MF-51.1 in `context/roadmap.md`) and for the dashboard.
- **Docs:** the "Por ahora" sentence of UI-home-sin-login in `context/decisiones.md` is removed; MF-25 is marked done in `context/roadmap.md`.

## Security

- **Data touched (read only):** the signed-in user's selection of this week, its menu and recipes, and the ticks of the current shopping list. The user id comes from the session, never from the request.
- **Possible abuses:** an open redirect after sign-in (A01); a visitor reading catalogue, user data or the deployed version from `/` (A01, information disclosure); reading another user's menu or list through a request parameter (A01, IDOR: `/` reads no parameter).
- **OWASP:** A01 Broken Access Control. No input is accepted by `/`, so A03 does not apply; the sign-in input rules (A07) do not change.
