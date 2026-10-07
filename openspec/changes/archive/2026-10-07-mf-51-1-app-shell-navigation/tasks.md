## 1. Main navigation (TDD, Testing Library; `next/navigation` mocked)

- [x] 1.1 RED: `nav-list.test.tsx`: the four links in order with their destinations; "Buscar" is current for `/planner` and the others are not; no link is current for `/somewhere-else`; `/menu/anything` marks "Menú" and `/` marks only "Hoy"; see it fail
- [x] 1.2 GREEN: `nav-items.ts`, `nav-icon.tsx` and `nav-list.tsx` (design D2, D6); the test passes

## 2. Shell, layout and `/planner`

- [x] 2.1 RED: `app-shell.test.tsx`: the header has the wordmark as a link to `/` and the navigation "Principal"; there is one main landmark with the children in it; the skip link is the first focusable element and points to the main landmark; see it fail
- [x] 2.2 GREEN: `app-shell.tsx` (design D2, D3, D4, D5); the test passes
- [x] 2.3 RED: `src/app/(app)/planner/page.test.tsx`: with a signed-in user it greets by name, keeps the sign-out control and draws no main landmark of its own; see it fail on the current page
- [x] 2.4 GREEN: move `planner/` into `src/app/(app)/`, swap its `<main>` for a plain container, and add `src/app/(app)/layout.tsx` with the shell and a comment that the session check is in each page (design D1, D8); the test passes, and `protected-pages.test.ts` still finds `(app)/planner/page.tsx` and passes without changes
- [x] 2.5 Verify `pnpm typecheck`, `pnpm lint` (including the architecture rules and knip) and `pnpm test:run`

## 3. End-to-end (design D9)

- [x] 3.1 Refactor, no behaviour change: move the creation and deletion of the test account from `e2e/sign-in.spec.ts` to `e2e/support/test-account.ts`, keeping the check that exactly one row is deleted; `pnpm test:e2e` still passes
- [x] 3.2 RED: `e2e/app-shell.spec.ts` for "A protected page has the shell", "The four links", "The current route is marked", "Wide screen" (1024 px), "Narrow screen" (375 px), "The skip link is first", "The skip link moves the focus", "Navigation without JavaScript" and "The sign-in screens have no shell"; run it before 2.4 is in place and see it fail
- [x] 3.3 In `e2e/access.spec.ts`, the 307 test and the forged-cookie test assert the 307 and that the body has no "Hola,". The assertions about the shell's text are removed (design D9): they were wrong, the empty frame travels in the redirect's data. The 307 is the guard against a `loading.tsx` or a `<Suspense>` turning the redirect into a 200 (design, Risks)
- [x] 3.4 Placeholder pages (design D7): `src/app/(app)/menu/page.test.tsx` and `src/app/(app)/shopping-list/page.test.tsx` (heading "Menú" / "Compra", a line, no `<main>` of their own); see them fail
- [x] 3.5 GREEN: `menu/page.tsx` and `shopping-list/page.tsx`, each with `await requireUser()` first; the tests pass and `protected-pages.test.ts` finds them
- [x] 3.6 `e2e/app-shell.spec.ts`: "The Menú and Compra tabs lead to a page"; `e2e/access.spec.ts`: "The new pages need a session" (307 to `/login` for both)
- [x] 3.7 GREEN: `pnpm test:e2e` passes, including `sign-in.spec.ts` without changes

## 4. Variant for no session (design D10)

- [x] 4.1 RED: in `app-shell.test.tsx`, with `session="out"` the header has the wordmark and a link "Acceder" to `/login`, there is no navigation "Principal", the skip link and one main landmark remain; with no `session` there is the navigation and no "Acceder"; see them fail
- [x] 4.2 GREEN: the `session` prop of `AppShell` (design D10); the tests pass and the existing ones still do

## 5. Home with a session (design D11)

- [x] 5.1 RED: in `src/app/page.test.tsx`, with a session `/` renders the heading "Hoy" and a line inside the shell (the navigation "Principal", one main landmark) and does not redirect; without a session it still shows the sign-in form; see the first one fail
- [x] 5.2 GREEN: `src/app/page.tsx` reads the session and wraps the minimal page in `<AppShell>` (design D11); the tests pass
- [x] 5.3 E2E: in `e2e/sign-in.spec.ts`, "`/` and `/login` send a signed-in user to `/planner`" becomes: `/` stays on `/` with the heading "Hoy" and "Hoy" marked as current, `/login` still goes to `/planner`; in `e2e/app-shell.spec.ts`, "Hoy" is current on `/`; see them fail before 5.2 and pass after
- [x] 5.4 Docs: the "Por ahora" sentence of UI-home-sin-login in `context/decisiones.md` and the description of MF-25 in `context/roadmap.md` (done with the artifacts); the archive of this change syncs the `authentication` delta

## 6. Visual check and close

- [x] 6.1 Run the app and capture `/planner` at 375 px and at 1160 px; compare with the mock's card and note any difference here (the account button is MF-51.2; the variant for no session has no route, so it is compared in the component test only). Checked against the test branch with a temporary account (deleted afterwards): at 1160 px the header has the wordmark and the four tabs with "Buscar" underlined; at 375 px the header has only the wordmark and the bar at the bottom has the four tabs with "Buscar" in olive. The account button is missing, as planned (MF-51.2)
- [x] 6.2 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` all pass again; coverage of `src/features/**` stays at 80 % or more (a first run was green before group 4) Repeated after groups 4 and 5: 810 unit tests, build, lint, typecheck and 34 e2e pass; the coverage thresholds pass.
- [x] 6.3 Before `archive`: go through the checklist of `context/safety-first.md` §4 and record the result Result: (1) no business or security decision is in the shell, each page checks the session on the server with `requireUser()` and `/` reads it; (2) no new endpoint or server action: only pages and links; (3) no user or permission comes from the client, there are no parameters; (4) the negative authorization tests exist and run in CI: `/planner`, `/menu` and `/shopping-list` answer 307 with no session or with a forged cookie, and the protected-pages test checks `requireUser` in every page; (5) the shell shows no user data, `/planner` keeps the name it already showed; (6) no secret in the diff; (7) no new dependency, the icons are inline SVG; (8) no query was added; (9) no new input; (10) no new sensitive action, the existing sign-in and sign-out logs are unchanged; (11) no deviation from a MUST rule. Not applicable: the logging of denied access, which is MF-20.3 and is not changed.
