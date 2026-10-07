## Context

The visual reference is the shell of the design system (section Components, card "AppShell"), artifact version `1791272018-0feb`: `project/components/AppShell/preview.html`, with the code in `project/ui_kits/app/AppShell.jsx`. It is JSX for React 18 with a CSS string and the design system's global components (`Icon`, `Button`), so it is ported, not imported (`context/decisiones.md` UI-design-system). The tokens it uses are theme utilities since MF-47.1 (`bg-surface-card`, `border-border-hairline`, `text-text-muted`…); `design-system/tokens.json` is identical to the one of that version, so nothing is refreshed.

Today there is no layout besides the root one (`src/app/layout.tsx`: font and `<body>`). `/planner` is `src/app/planner/page.tsx`: it calls `requireUser()`, draws its own `<main>` with `min-h-screen`, and holds a `SignOutButton`. `requireUser()` is in each page and not in a layout on purpose (MF-20.3, design D6: a layout does not run again on client navigation; Next's own authentication guide says the same, `01-app/02-guides/authentication.md`, "Layouts and auth checks"), and `src/app/protected-pages.test.ts` reads every page under `src/app/` to check that it calls it.

The shell of the mock also has an account button with a menu. That is `mf-51-2-account-menu`, which comes after this change in the same branch.

## Goals / Non-Goals

**Goals:**
- `/planner` looks like the mock's signed-in shell, without the account button, on a 375 px phone and on desktop.
- MF-43, MF-23, MF-24 and MF-25 can mount their screen in the shell by adding a page inside the route group, with nothing to change in the shell.

**Non-Goals:**
- The account button and menu (MF-51.2), the "por comprar" badge (MF-24), and the route that mounts the signed-out variant with "Acceder" (MF-25, UI-home-sin-login); the variant itself is built here (D10).
- The width of the page (`mf-page` and its `wide` variant in the mock): each screen sets its own, because only the screen knows if it is a column or a grid.
- Moving anything to `src/shared/ui/`: only `features/app-shell` uses these components (ADR-001 §2).
- An icon library: four inline SVGs.

## Decisions

### D1. A route group `src/app/(app)/` with a layout that reads nothing
`src/app/(app)/layout.tsx` renders the shell around its children, and `planner/` moves into `src/app/(app)/planner/`. A route group does not change URLs. The layout is a server component that imports the shell from `features/app-shell`. It does not call `requireUser()` or `currentUser()` and does not redirect: authorization stays in each page (MF-20.3 D6), and a comment in the layout says so.

`protected-pages.test.ts` keeps working without change: it lists every `page.tsx` under `src/app/` and exempts only the two public ones by path, so `(app)/planner/page.tsx` is still checked.

Alternative: wrap each page in `<AppShell>` itself. Rejected: every new screen would have to remember to do it, and a page that forgot would be a protected page without navigation. Alternative: check the session in the layout and drop it from the pages. Rejected: a layout does not run again on navigation, which is the reason for MF-20.3 D6.

### D2. Components ported into `src/features/app-shell/components/`
Each file's doc comment names the design system component it comes from and the version (`1791272018-0feb`).
- `app-shell.tsx`: from `AppShell.jsx`. A server component: skip link, `<header>` with the wordmark link (to `/`) and the navigation, `<main id="contenido" tabIndex={-1}>` and the bottom navigation. It takes `children`.
- `nav-list.tsx`: from `ShellNavList`. A client component that reads `usePathname()` to mark the current tab, rendered twice (header and bottom bar, D4). Links are `next/link`.
- `nav-icon.tsx`: the four Lucide glyphs as inline SVG (ISC licence noted in a comment), stroke 1.5 and 1.9 for the current tab, as in the mock.
- `nav-items.ts`: the four tabs (label, icon, `href`).
- The wordmark: `features/auth/components/wordmark.tsx` already draws it, but a feature cannot import another (Scope Rule), and the shell's is a link at 20 px. It is a three-line element in `app-shell.tsx`; when a third place needs it, it moves to `shared/ui/`.

Alternative: one client component for the whole shell. Rejected: only the navigation (current route) needs the client; the frame is static and stays on the server.

### D3. Header and tab bar by viewport width; the content area is the container for the screens
The header and the bottom bar change at 640 px of the **viewport** (`sm:`), not of a container: the shell is the whole page, so they are the same width, and a container query would need `container-type` on the page root, which applies layout and inline-size containment to everything in it. The `<main>` is the `@container`, so the screens of the mocks (the week grid at 800 px, the shopping columns at 800 and 1100 px) can keep using container queries as the mock does, measured on the content area.

### D4. Two navigations, one of them `display: none`
The mock renders the tab list twice, in the header (from 640 px) and at the bottom (below it). The one that is not shown is `display: none`, so it is out of the accessibility tree and the four links are announced once (spec: "The navigation adapts to the width"). Both come from the same `NavList`, with a `placement` prop for the icon size and the layout. jsdom does not apply CSS, so the component tests see both lists; the width behaviour is checked in the end-to-end tests with Playwright, which does not return hidden elements from role queries.

Alternative: one `<nav>` moved with CSS from top to bottom. Rejected: the visual order would differ from the keyboard order.

### D5. Sticky bars and the page scrolls
The mock fixes the shell to the height of its frame and scrolls only `main`. In the app, the page scrolls: the header is `sticky top-0` and the bottom bar `sticky bottom-0` (with `env(safe-area-inset-bottom)` padding), in a column of `min-h-dvh`, so they stay in view as in the mock without an inner scroll (which breaks scroll restoration and the collapsing browser bar on phones). The page's own `min-h-screen` box goes, as it would make the shell taller than the screen.

### D6. The current tab comes from the path
`usePathname()`; a tab is current if the path equals its `href`, or starts with it followed by `/` (so `/menu/anything` marks Menú), except `/`, which only matches exactly. Server rendering gives the same answer as the client, so it also holds without JavaScript.

### D7. The four tabs are always shown, and each leads to a page
Hoy, Buscar, Menú and Compra are in the tab list from the start, as in the mock and in the roadmap's description of MF-51. `/` has a minimal page for a signed-in user (D11). `/menu` and `/shopping-list` do not have their screens until MF-23 and MF-24, so this change adds a placeholder page for each (`src/app/(app)/menu/page.tsx`, `src/app/(app)/shopping-list/page.tsx`): a heading and a line, calling `requireUser()` first like every protected page. MF-23 and MF-24 replace their contents.

Why: with the tabs pointing to missing routes, Next prefetches them and gets a 404 on every render; the network never goes quiet (it broke `waitForLoadState('networkidle')` in the sign-in e2e) and a click lands on a 404. Alternative: list only the tabs whose route exists and let each change add its own. Rejected: the shell would not show what the author mocked and each later change would touch the shell.

### D8. `/planner` keeps its sign-out button for now
`/planner` swaps its `<main>` for a plain container (the shell's `<main>` is the page's only one) and keeps the heading "Hola, {name}" and the `SignOutButton`, so the user can still sign out while the account menu does not exist. MF-51.2 removes it.

### D9. End-to-end tests
- `e2e/access.spec.ts`: the existing test that `/planner` answers 307 without the body of the page (no "Hola,") keeps that assertion, and the same with a forged cookie. It does not assert that the shell is absent from the body: the layout runs before the page, so Next sends the empty frame inside the data that accompanies the redirect, which the browser never draws. What matters is the 307 and that no content or user data goes with it. `/menu` and `/shopping-list` without a session also answer 307 to `/login`.
- A new `e2e/app-shell.spec.ts` (signed in): the shell on `/planner`, the tabs and the current one at 1024 px and at 375 px (one navigation exposed in each), the skip link, the tabs with JavaScript off, and no shell on `/` and `/login`. The creation and deletion of the test account in `sign-in.spec.ts` moves to `e2e/support/test-account.ts` so both files use it, keeping MF-49's check that exactly one row is deleted.

### D10. The variant for no session is a prop of `AppShell`
`AppShell` takes `session?: 'in' | 'out'`, `'in'` by default, as the mock's `AppShell` does. With `'out'` the header shows the wordmark and a link "Acceder" (`next/link` to `/login`, styled as the design system's primary `sm` button: 36 px high, 14 px of padding, 14 px of text, pill), and the two navigations are not rendered. The link is a link, not the mock's button with `onSignIn`, so it works without JavaScript. The state comes from the caller, not from the shell, which still reads no session (D1).

Nothing mounts it in this change: `(app)/layout.tsx` uses the default, and `/` and `/login` stay outside the shell, as the mock says of the login screen. MF-25 builds the informative home and mounts it there (UI-home-sin-login). It is built now because the author asked for the shell to have both states; it is covered by unit tests only, since no route shows it.

Alternative: leave it to MF-25. Rejected by the author. Alternative: a separate `PublicShell` component. Rejected: the two states share the skip link, the header and the main landmark, and the mock keeps them in one component.

### D11. `/` has a minimal page for a signed-in user, and mounts the shell itself
Until now `/` sent a signed-in user to `/planner` (MF-20.3), so the tab "Hoy" would have been a second link to "Buscar". The author chose a minimal page: `/` with a session renders a heading "Hoy" and a line saying what will be there, as `/menu` and `/shopping-list` do (D7). MF-25 replaces it with the dashboard.

`/` is not in the route group `(app)`: it also serves the visitor with the sign-in form, outside the shell. So its page reads the session (`webContainer().currentUser()`) and wraps the minimal page in `<AppShell>` itself, which is what the `session` prop is for (D10): MF-25 will wrap the informative home in `<AppShell session="out">` in the same place. This is the one page that mounts the shell by hand; D1's alternative (every page wraps itself) was rejected for protected pages, and `/` is not one. `protected-pages.test.ts` does not list it (it is public by path), and it does not need to: the page decides by the session it reads.

This changes the requirement "The home shows the sign-in until the dashboard exists" of `authentication` (delta in this change), the "Por ahora" sentence of UI-home-sin-login in `context/decisiones.md`, and the description of MF-25 in the roadmap. After a sign-in the destination stays `/planner` (a fixed one, MF-20.3); MF-25 decides whether it moves to `/`. `/login` still sends a signed-in user to `/planner`.

## Risks / Trade-offs

- [A `loading.tsx` or a `<Suspense>` around the pages would flush the shell before the page redirects, and the answer for a request with no session would become a 200 with a redirect meta tag] → the layout has none; the e2e test of D9 (status 307) fails if one appears.
- [Two placeholder pages that MF-23 and MF-24 throw away] → D7; each is a heading and a line, with its test.
- [The mock and the code can drift] → the version is in each component's doc comment and in this design; the verify step compares a capture with the mock (UI-design-system).
- [Two navigations in the DOM] → D4; covered at both widths in the e2e.
