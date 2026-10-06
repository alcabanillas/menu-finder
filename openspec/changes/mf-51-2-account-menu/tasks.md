## 1. The user's email (TDD)

- [ ] 1.1 RED: in `better-auth-session-manager.test.ts`, `current()` and `signIn()` return the user's email besides id and name; and a test that `requireUser()` and a second read in the same request hit the session only once; see them fail
- [ ] 1.2 GREEN: `email` in `SignedInUser` and in `toSignedInUser`; a `cache()`-wrapped read in `src/app/_session/` shared by `requireUser()` and the layout (design D1); the tests pass, and the log lines still carry no email (the existing audit-log tests)

## 2. Account menu (TDD)

- [ ] 2.1 RED: `account-menu.test.tsx` for "Closed by default", "Open", "Escape closes the panel and returns the focus", "A click outside closes the panel" and "The menu shows the email and no other user data"; and that activating "Cerrar sesión" calls the sign-out action it received; see them fail
- [ ] 2.2 GREEN: `account-menu.tsx` and the `user-round` icon (design D2); the tests pass

## 3. Mount it and remove the old button

- [ ] 3.1 RED: `app-shell.test.tsx` gains the account button in the header, with the email and the action it receives; `src/app/(app)/planner/page.test.tsx` now asserts that the page has no sign-out control; see them fail
- [ ] 3.2 GREEN: `app-shell.tsx` takes `email` and `signOutAction` and mounts the menu; `(app)/layout.tsx` reads the user for the email and passes both (design D1); `planner/page.tsx` loses `SignOutButton`, which is deleted with its test (design D3); the tests pass, and `protected-pages.test.ts` passes without changes
- [ ] 3.3 Verify `pnpm typecheck`, `pnpm lint` (including the architecture rules and knip) and `pnpm test:run`

## 4. End-to-end (design D4)

- [ ] 4.1 RED: in `e2e/app-shell.spec.ts`, the menu scenarios ("Closed by default", "Open", "Escape closes the panel and returns the focus", "The menu shows the email and no other user data", "Signing out from the menu"); in `e2e/sign-in.spec.ts`, the sign-out test opens the menu first; see them fail before 3.2
- [ ] 4.2 In `e2e/access.spec.ts`, the redirect tests also assert that the body has no "Cuenta" ("No session shows no email")
- [ ] 4.3 GREEN: `pnpm test:e2e` passes

## 5. Visual check and close

- [ ] 5.1 Run the app and capture `/planner` at 375 px and at 1160 px, with the account menu open and closed; compare with the mock's card and note any difference here
- [ ] 5.2 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` all pass; coverage of `src/features/**` stays at 80 % or more
- [ ] 5.3 Before `archive`: go through the checklist of `context/safety-first.md` §4 and record the result; mark MF-51 as done in `context/roadmap.md`
