## 1. Base components (TDD, Testing Library)

- [x] 1.1 RED: `button.test.tsx`: renders its label, defaults to `type="button"`, passes `type="submit"` and `disabled`, and applies the primary and secondary variants and `fullWidth`; see it fail
- [x] 1.2 GREEN: `button.tsx` (design D1); the test passes
- [x] 1.3 RED: `text-field.test.tsx`: the label names the input, the native props reach it, and with an error the input is `aria-invalid` and described by the message; see it fail
- [x] 1.4 GREEN: `text-field.tsx`; the test passes
- [x] 1.5 RED: `password-field.test.tsx` for "Hidden by default" and "Shown and hidden again"; see it fail
- [x] 1.6 GREEN: `password-field.tsx`; the test passes
- [x] 1.7 RED: `form-alert.test.tsx`: renders its message with the alert role; see it fail
- [x] 1.8 GREEN: `form-alert.tsx`; the test passes

## 2. Field checks (TDD)

- [x] 2.1 RED: `sign-in-fields.test.ts`: empty email, email without the shape of an address (`ana@correo`, `ana @x.es`), empty password, valid fields with surrounding spaces; see it fail
- [x] 2.2 GREEN: `checkSignInFields` (design D3); the test passes

## 3. Login form (TDD, `login-form.test.tsx`)

- [x] 3.1 Update the existing tests to the new label "Correo electrónico" and state shape `{ message, attempt }`; they pass or fail only for those reasons
- [x] 3.2 RED: "The same error twice in a row is announced again" (the second alert is not the same node as the first); see it fail on the current form
- [x] 3.3 GREEN: `attempt` in `LoginFormState` and `key={state.attempt}` on `FormAlert` (design D2); the test passes, and "An error is announced" and "No alert before the first answer" still pass
- [x] 3.4 RED: "Empty fields", "An email without the shape of an address" and "Valid fields are sent" through the form; see them fail
- [x] 3.5 GREEN: controlled fields, `noValidate`, `onSubmit` with `checkSignInFields`; the tests pass
- [x] 3.6 RED: "The control does not submit" and "Pending sign-in" (an action that does not resolve: the button says "Entrando…" and is disabled); see them fail
- [x] 3.7 GREEN: `PasswordField` in the form and the pending label; the tests pass

## 4. Server action and screen

- [x] 4.1 `signInAction` returns `attempt: previous.attempt + 1` and the mock's wording (design D2, D5); verify `pnpm typecheck`
- [x] 4.2 `SignInScreen` with the layout of design D4 and `SignInHero`; `SignOutButton` with the secondary `Button`; verify `pnpm test:run` and `pnpm lint`

## 5. End-to-end (design D6)

- [x] 5.1 RED: in `e2e/sign-in.spec.ts`, the new label and message, the hostile-values test with JavaScript off, and the repeated-message test; run `pnpm test:e2e` before 4.1 is in place, or record that it was written after (the label change makes it fail on the old screen). Written after 4.1-4.2, so not seen failing on the old screen. The run also caught `e2e/access.spec.ts`, which looked for the old label "Email"; updated
- [x] 5.2 GREEN: `pnpm test:e2e` passes, including "The server holds without the form checks"

## 6. Visual check and close

- [x] 6.1 Run the app and capture `/login` at 375 px and at 1160 px, with and without an error; compare with the mock's card and note any difference here. Done on the production build: 375 px empty, 375 px with both field messages, 1160 px with the server message. No difference from the card; the email and password stay filled after a refused sign-in, as in the mock
- [x] 6.2 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` all pass; coverage of `src/features/**` stays at 80 % or more
- [ ] 6.3 Tick MF-47.2 and MF-47 in `context/roadmap.md` with the link to the archived change
