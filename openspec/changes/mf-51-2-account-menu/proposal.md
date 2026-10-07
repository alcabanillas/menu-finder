## Why

Roadmap item **MF-51.2**, the second and last subtask of MF-51 (after `mf-51-1-app-shell-navigation`, which builds the shell and its navigation). The shell of the mock has an account button that opens a panel with the signed-in user's email and "Cerrar sesión". Until now `/planner` has its own loose sign-out button, which cannot be on every screen of the shell.

The visual reference is the same as in MF-51.1: the design system's shell (`project/ui_kits/app/AppShell.jsx`, component `ShellAccount`, artifact version `1791272018-0feb`), following `context/decisiones.md` UI-design-system.

**Result:** the account button in the header opens a panel with the user's email and "Cerrar sesión", and `/planner` no longer has a sign-out button of its own.

## What Changes

- **Account menu**, on `/` and on every protected page: a button "Cuenta" in the header that opens a small panel with the signed-in user's email and the control "Cerrar sesión". It closes with Escape (focus goes back to the button) and with a click outside.
- **The signed-in user gains its email**: `SignedInUser` carries it, the layout reads the user only to show it in the menu, and the read is shared with each page's own check so there is one session lookup per request.
- **`/planner` loses its sign-out button**: the account menu replaces it, and `SignOutButton` is deleted with its test.
- **Left out**: the "por comprar" badge (MF-24) and the route that mounts the signed-out variant with "Acceder", which MF-51.1 builds (MF-25, UI-home-sin-login).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell` (created by MF-51.1): one new requirement, the account menu.
- `authentication`: one scenario of "Protected routes require a session checked on the server". With a valid session, `/planner` now shows the name of the user and the sign-out control is in the account menu of the shell, not on the page. The requirement itself does not change.

## Impact

- **Code:** `src/application/dto/signed-in-user.ts` and `src/infrastructure/auth/better-auth-session-manager.ts` (with their tests) add the email; `src/app/_session/` shares one session read per request; `src/app/(app)/layout.tsx` reads the user and passes the email and `signOutAction` to the shell; new `src/features/app-shell/components/account-menu.tsx` and its icon; `app-shell.tsx` mounts it; `src/app/page.tsx` (`/` with a session, which mounts the shell itself) passes the email and the action too, with its test; `src/app/(app)/planner/page.tsx` loses the sign-out button; `src/features/auth/components/sign-out-button.tsx` and its test are removed, as nothing else uses them; `e2e/sign-in.spec.ts` (the sign-out test opens the menu first) and `e2e/app-shell.spec.ts`.
- **Dependencies:** none new. The `user-round` icon (Lucide, ISC) goes as inline SVG.
- **Decisions relied on:** UI-design-system, SEG-auth, SEG-sistema-cerrado; ADR-001 §3 and §5 (the layout in `app/` reads the user through the web container's use case; the feature gets the email and the action by props; `application/dto` and `infrastructure` change only to carry one more field); `context/safety-first.md` §2.1 (minimum data in the client: the email is the user's own and travels only inside the menu). Contradicts none. It relies on MF-20.3's design decision that the session check is in each page, not in a layout.
- **Data:** the email of the signed-in user, which is the user's own, now reaches the browser inside the account menu once it is open. Nothing is stored or logged: the log lines keep carrying the user id and never the email (safety-first §4).
- **Abuses and OWASP:**
  - Taking the layout's read of the user for an access check (A01): a layout does not run again on client navigation, so a page written later without its own check would keep showing data after the session ends. The layout says so in a comment, and `protected-pages.test.ts` keeps failing for any page without `requireUser`.
  - The email in the client (A02, privacy): only the signed-in user's own, only in the open menu; a request with no valid session gets a redirect without it (checked in the sign-out end-to-end test, with the account's own email).
  - Sign-out (A07): the same server action as today, posted from a form; it only moves from one button to another.
