## 1. Main navigation (TDD, Testing Library; `next/navigation` mocked)

- [ ] 1.1 RED: `nav-list.test.tsx`: the four links in order with their destinations; "Buscar" is current for `/planner` and the others are not; no link is current for `/somewhere-else`; `/menu/anything` marks "Menú" and `/` marks only "Hoy"; see it fail
- [ ] 1.2 GREEN: `nav-items.ts`, `nav-icon.tsx` and `nav-list.tsx` (design D2, D6); the test passes

## 2. Shell, layout and `/planner`

- [ ] 2.1 RED: `app-shell.test.tsx`: the header has the wordmark as a link to `/` and the navigation "Principal"; there is one main landmark with the children in it; the skip link is the first focusable element and points to the main landmark; see it fail
- [ ] 2.2 GREEN: `app-shell.tsx` (design D2, D3, D4, D5); the test passes
- [ ] 2.3 RED: `src/app/(app)/planner/page.test.tsx`: with a signed-in user it greets by name, keeps the sign-out control and draws no main landmark of its own; see it fail on the current page
- [ ] 2.4 GREEN: move `planner/` into `src/app/(app)/`, swap its `<main>` for a plain container, and add `src/app/(app)/layout.tsx` with the shell and a comment that the session check is in each page (design D1, D8); the test passes, and `protected-pages.test.ts` still finds `(app)/planner/page.tsx` and passes without changes
- [ ] 2.5 Verify `pnpm typecheck`, `pnpm lint` (including the architecture rules and knip) and `pnpm test:run`

## 3. End-to-end (design D9)

- [ ] 3.1 Refactor, no behaviour change: move the creation and deletion of the test account from `e2e/sign-in.spec.ts` to `e2e/support/test-account.ts`, keeping the check that exactly one row is deleted; `pnpm test:e2e` still passes
- [ ] 3.2 RED: `e2e/app-shell.spec.ts` for "A protected page has the shell", "The four links", "The current route is marked", "Wide screen" (1024 px), "Narrow screen" (375 px), "The skip link is first", "The skip link moves the focus", "Navigation without JavaScript" and "The sign-in screens have no shell"; run it before 2.4 is in place and see it fail
- [ ] 3.3 In `e2e/access.spec.ts`, the 307 test and the forged-cookie test also assert that the body has none of "Saltar al contenido" or "Principal". These two assertions pass before the shell exists, so they cannot be seen failing; they are the guard against a `loading.tsx` or a `<Suspense>` turning the redirect into a 200 (design, Risks)
- [ ] 3.4 GREEN: `pnpm test:e2e` passes

## 4. Visual check and close

- [ ] 4.1 Run the app and capture `/planner` at 375 px and at 1160 px; compare with the mock's card and note any difference here (the account button is MF-51.2)
- [ ] 4.2 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` all pass; coverage of `src/features/**` stays at 80 % or more
- [ ] 4.3 Before `archive`: go through the checklist of `context/safety-first.md` §4 and record the result
