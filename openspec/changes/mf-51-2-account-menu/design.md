## Context

The visual reference is `ShellAccount` in `project/ui_kits/app/AppShell.jsx` (design system, artifact version `1791357207-74cb`), the same card as MF-51.1 in a later version of the design system. This change mounts it in the shell that `mf-51-1-app-shell-navigation` builds, so it comes after that change in the same branch; its spec adds a requirement to the `app-shell` spec that MF-51.1 creates, so MF-51.1 is archived first.

Today `SignedInUser` is `{ userId, name }` (`src/application/dto/signed-in-user.ts`); `toSignedInUser` in `BetterAuthSessionManager` copies those two fields from the library's user, which also has the email. `requireUser()` (`src/app/_session/require-user.ts`) reads the user in each page through `webContainer().currentUser()`, and `/planner` shows a `SignOutButton` that posts `signOutAction` (`src/app/_session/actions.ts`).

## Goals / Non-Goals

**Goals:**
- The account menu looks and works like the mock's: the email, "Cerrar sesión", Escape and a click outside close it.
- The layout shows the email without a second session lookup and without becoming the access check.

**Non-Goals:**
- Name or avatar in the menu, account settings, password change (MF-45 is a CLI command).
- A React context for the user: the only reader is the menu.

## Decisions

### D1. The layout reads the user only to show it; one session read per request
`SignedInUser` gains `email`, set in `toSignedInUser`. `src/app/(app)/layout.tsx` calls `currentUser()` and passes the email, with `signOutAction`, to the shell. It does not call `requireUser()` or redirect: authorization stays in each page (MF-20.3 D6), and the comment MF-51.1 left in the layout now says that the read is for the email only. Without a session the layout gives the shell no account, so the shell is in its variant with no session (D5), and the page redirects as always before the browser draws anything.

To avoid two lookups per request, `src/app/_session/` wraps the read in React's `cache()` (the pattern of Next's authentication guide, `01-app/02-guides/authentication.md`), and `requireUser()` and the layout share it. The layout does not run again on client navigation, so its email is the one of the first render: the user does not change during a session, and a revoked session is caught by the next page, which does run its own check.

`/` is the other place that mounts the shell (MF-51.1 D11: it is outside the route group, because it also serves the visitor). It already reads the user to decide what to show, so with the email in `SignedInUser` it passes `email` and `signOutAction` to its own `<AppShell>` from that same read, through the shared read of `_session` (one lookup per request). Two places wire the same two props; when MF-25 adds a third state it can extract a small server component, not before.

Alternative: each page passes the user to the shell. Rejected: every new screen would have to remember to, which is what MF-51.1 D1 avoided. Alternative: a React context. Rejected: it needs a client provider and nothing but one component reads it; the email goes by props (`layout` → `AppShell` → `AccountMenu`).

ADR-001: the layout is in `app/` and uses the web container's use case; the feature gets the data by props and the DTO type from `application/dto`; the adapter in `infrastructure` only carries one more field. No rule is broken.

### D2. The account menu is a disclosure, as in the mock
`src/features/app-shell/components/account-menu.tsx`, a client component: a button with `aria-expanded` and `aria-controls`, and a panel that is not in the DOM while closed, with the email (cut with an ellipsis when long) above a `<form action={signOutAction}>` with the "Cerrar sesión" submit button. Escape and `mousedown` outside are listened for on `document` only while it is open, and Escape returns the focus to the button. It is not an ARIA `menu` (no arrow-key roving), because it has one item. The `user-round` icon is inline SVG in `nav-icon.tsx`. The doc comment names the design system component and its version.

It needs JavaScript to open: without it "Cerrar sesión" cannot be reached, which is a step back from the old loose button (a plain form). The spec asks only for a sign-out control, and the form that must work without JavaScript is the sign-in (MF-47.2); the navigation does too (MF-51.1).

### D3. `/planner` loses its sign-out button
`SignOutButton` and its test are deleted (knip would report them unused). The heading "Hola, {name}" stays: the sign-in end-to-end test looks for it.

### D5. The shell takes its variant from the account, not from a `session` prop
MF-51.1 D10 gave `AppShell` a prop `session?: 'in' | 'out'`, `'in'` by default. With `account` added, the two props say the same thing twice and allow states that make no sense: `session="in"` without an account draws a shell with no way to sign out, and `session="out"` with an account ignores it, and the types accept both. So `session` goes: `AppShell` takes `account?: Account`, and it is signed in exactly when there is an account. This replaces the requirement "The shell has a variant for no session" of `app-shell` with "The shell takes its variant from the account" (delta in this change): the variant with a session is no longer the default when nothing is said.

Without a session, the `(app)` layout now renders the variant with no session ("Acceder") instead of the navigation without an account. The page redirects first (307), so the browser never draws it; the frame only travels in the redirect's data, as MF-51.1 D9 found. MF-25 will mount the variant with no session on `/` by rendering `<AppShell>` without an account.

Alternative: a boolean `signedIn`, `true` by default. Rejected: it keeps two sources of truth, and a boolean prop that is `true` when omitted goes against the React convention (`disabled`, `hidden` are `false` when omitted). Alternative: a discriminated union `{ session: 'in'; account } | { session: 'out' }`. Rejected: it makes the impossible states unrepresentable too, but with one more prop than needed.

### D4. End-to-end tests
`e2e/sign-in.spec.ts`: the sign-out test opens the menu "Cuenta" first, and after signing out it also checks that the redirect for `/planner` with the old cookie has no email in its body (the account exists, so a leak would show; the test needs the database). `e2e/app-shell.spec.ts` gains the menu scenarios: closed by default, open with the email of the test account on `/planner` and on `/`, Escape returns the focus, and sign-out ends on `/` with the old cookie sent to `/login`.

Not in `e2e/access.spec.ts`: it runs in CI without a database, and MF-51.1 found that the layout's frame travels in the redirect's data, so "the body has no button Cuenta" would fail and mean nothing. What must not travel is the email, and with no valid session there is no email to read.

## Risks / Trade-offs

- [Someone takes the layout's read of the user for the access check] → the comment in the layout, and `protected-pages.test.ts`, which fails for any page without `requireUser`. It only reads `page.tsx` files and looks for the call by text, so it does not cover a future route handler or server action; those do not exist yet.
- [The email reaches the client] → only the user's own; it travels in the page's data as a prop and is drawn only in the open menu (safety-first §2.1); the log lines keep the user id and never the email, checked by the existing audit-log tests.
- [The menu does not open without JavaScript] → D2; accepted.
