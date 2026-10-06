## Why

Roadmap item **MF-51.1**, the first of the two subtasks of MF-51 (the second is `mf-51-2-account-menu`). The app has no navigation: `/planner` is a placeholder and nothing links one screen to another. Every screen that is coming (MF-43 `/planner`, MF-23 `/menu`, MF-24 `/shopping-list`, MF-25 the dashboard) is mocked inside the design system's app shell, so the shell goes first: if it comes later, each screen has to be reopened to fit into it.

The author has made the shell in the design system ("Menu Finder Design System", `project/ui_kits/app/AppShell.jsx` and its card `project/components/AppShell/preview.html`, artifact version `1791272018-0feb`), following `context/decisiones.md` UI-design-system. `design-system/tokens.json` in the repo is identical to the one of that version, so the copy of the tokens is not refreshed.

This subtask builds the frame and the navigation. The account menu, with the user's email and "Cerrar sesión", is MF-51.2; until then `/planner` keeps its own sign-out button.

**Result:** `/planner` renders inside the shell, with its four tabs in the header on a wide screen and in a bar at the bottom on a phone, and the skip link works.

## What Changes

- **Shell around the protected pages**: a header with the wordmark and the main navigation, and the page content in `<main>`. All the routes that need a session share it; `/` and `/login` do not use it.
- **Main navigation with four tabs**, as real links: Hoy (`/`), Buscar (`/planner`), Menú (`/menu`) and Compra (`/shopping-list`). The tab of the current route is marked as current for assistive technology. From 640 px of width the tabs sit in the header; below that, in a bar at the bottom of the screen.
- **Skip link** "Saltar al contenido" as the first focusable element, and labelled landmarks.
- **`/planner` stops drawing its own `<main>` and full-height box**, which would nest a second `<main>` inside the shell's and make the page taller than the screen. It keeps its heading and its sign-out button.
- **Left out of the mock**: the account button and its menu (MF-51.2), the "por comprar" badge on Compra (it needs the shopping data, MF-24) and the signed-out variant with "Acceder" (it belongs to the informative home, MF-25 and UI-home-sin-login).

## Capabilities

### New Capabilities
- `app-shell`: the frame of the protected pages: what it holds, how the navigation behaves and adapts, the skip link, and that it is not an access control.

### Modified Capabilities
- None. `/planner` renders inside the shell and still shows the name of the user and the sign-out control, as the requirement "Protected routes require a session checked on the server" says.

## Impact

- **Code:** new `src/app/(app)/layout.tsx` (route group: URLs do not change) and `/planner` moved into it; new `src/features/app-shell/` (shell, navigation list, icons, tab list); `e2e/support/test-account.ts` (the account setup of `e2e/sign-in.spec.ts` moved out so two files use it), a new `e2e/app-shell.spec.ts`, and `e2e/access.spec.ts`.
- **Dependencies:** none new. The four navigation icons (Lucide `sun`, `search`, `calendar-days`, `shopping-basket`, ISC licence) go as inline SVG, as in MF-47.2, instead of adding an icon library.
- **Decisions relied on:** UI-design-system (the mock is the visual reference and does not decide scope), UI-estilos, UI-home-sin-login (why the signed-out variant stays out); ADR-001 §2 (Scope Rule: only the layout uses these components, so they stay in `features/app-shell/`), §3 and §5. Contradicts none. It relies on MF-20.3's design decision that the session check is in each page, not in a layout.
- **Data:** none. The shell reads, stores and logs nothing about the user.
- **Abuses and OWASP:**
  - Taking the shell for an access control (A01): a layout does not run again on client navigation, so a session check there would be skipped. The check stays in each page (`requireUser`), `protected-pages.test.ts` keeps verifying it for every page, and in this subtask the layout reads no session at all.
  - Showing the frame to someone with no session (A01): a request without a valid session still gets a redirect to `/login` and none of the shell's text or links in the response; an end-to-end test checks it.
  - Links: all internal; no external URL or redirect target is read from the request.
