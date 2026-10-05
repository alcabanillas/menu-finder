## Context

The visual reference is the "Login" card of the design system (section Components), artifact version `1791192451-31e6`: `project/components/Login/preview.html`, with the screen in `project/ui_kits/app/LoginScreen.jsx`. It is JSX for React 18 with a CSS string and the design system's global components (`Button`, `Icon`), so it is ported, not imported (`context/decisiones.md` UI-design-system). The tokens it uses are already theme utilities since MF-47.1 (`bg-surface-hero`, `text-text-strong`, `rounded-md`, `text-h1`…); `tokens.json` has not changed since that snapshot.

Today `LoginForm` (`src/features/auth/components/login-form.tsx`) is a client component that receives the server action `signInAction` by props and passes it straight to `useActionState`; `SignInScreen` (`src/app/_session/sign-in-screen.tsx`) is shared by `/` and `/login`. The end-to-end tests (`e2e/sign-in.spec.ts`) find the fields by label and the message inside the form.

## Goals / Non-Goals

**Goals:**
- `/login` and `/` match the mock on a 375 px phone and on desktop.
- The form keeps working without JavaScript: the server action still receives the form and answers (progressive enhancement), which the hostile-values test relies on.

**Non-Goals:**
- "Volver al inicio" (see proposal).
- An icon component or library: one inline SVG.
- Moving anything to `src/shared/ui/`: nothing outside `features/auth` uses these components yet (ADR-001 §2).

## Decisions

### D1. Components ported into `src/features/auth/components/`
Each file's doc comment names the design system component it comes from and the version (`1791192451-31e6`).
- `button.tsx`: from `core/Button.jsx`. Only the variants the app uses: `primary` (sign-in) and `secondary` (sign-out); sizes `md` (44 px) and `lg` (52 px); `fullWidth`. Hover and press with Tailwind variants (`hover:bg-olive-700`, `active:scale-[var(--press-scale)]`), not React state, so it renders in server components (`SignOutButton` stays one). Native button props pass through.
- `text-field.tsx`: from the mock's `LoginField`: label above (small, 600, `text-text-strong`), input 48 px, `rounded-md`, `border-gray-500`, ink border and ring on focus, terracotta border and ring when invalid, message under it linked with `aria-describedby` and `aria-invalid`.
- `password-field.tsx`: a client component around `TextField` with the "Mostrar"/"Ocultar" control (`type="button"`, `aria-pressed`).
- `form-alert.tsx`: the mock's error box (`border-terracotta-300`, `bg-terracotta-50`, `text-terracotta-700`) with `role="alert"` and the Lucide `circle-alert` glyph inline (ISC licence noted in a comment).
- `sign-in-hero.tsx`: the olive panel (wordmark, eyebrow, title, text, day bars `aria-hidden`).

Alternative: keep the design system's names and inline styles. Rejected: inline styles cannot do `:hover` or `:focus-visible` without state, and they bypass the theme.

### D2. A new alert element on every answer: the server returns an attempt number
`LoginFormState` becomes `{ message: string | null; attempt: number }`. `signInAction` returns `attempt: previous.attempt + 1` with every message, and the form renders the alert with `key={state.attempt}`, so React mounts a new element on each answer and screen readers announce it.

Alternative: wrap the action on the client to count attempts. Rejected: `useActionState` would then hold a client function instead of the server action, the form would lose progressive enhancement and, with JavaScript off, would not submit at all; the hostile-values test (and any user without JavaScript) depends on it. Alternative: clear the message and set it again in an effect. Rejected: timing-dependent and announced twice by some readers.

### D3. Field checks: a pure function plus `onSubmit`
`checkSignInFields(email, password)` in `src/features/auth/sign-in-fields.ts` returns the message per field or none, with the mock's rule for the address (`/^\S+@\S+\.\S+$/` after trimming), written as plain string checks because that regex backtracks super-linearly (sonarjs/super-linear-regex, a ReDoS risk). `LoginForm` keeps the two values in state (controlled fields, as in the mock, so the email survives a failed answer), sets "submitted once" on submit and calls `preventDefault()` when a check fails, which stops React from running the action. After the first submit the messages follow what is typed. The form has `noValidate`, so the browser's own bubbles do not compete with the mock's messages; without JavaScript there are no checks and the server answers, as the spec requires.

Alternative: keep the browser's `required` and `type="email"` checks. Rejected: they are not the mock's messages and cannot be styled.

### D4. Layout with a container query, form first in the DOM
`SignInScreen` is a container (`@container`); from `@min-[640px]` it becomes a two-column grid. The `<main>` with the form comes first in the DOM and the `<aside>` hero second, moved to the left with `order-first`, so keyboard and screen-reader order start at the form and the page's first heading is its `h1` ("Accede a tu menú"). The mobile wordmark is hidden from 640 px, where the hero shows its own.

Alternative: viewport breakpoint `md:`. Rejected: the mock defines the switch by the container width, and the screen fills the viewport anyway; the container query keeps the behaviour if the screen is ever embedded.

### D5. Wording and autocomplete as in the mock
Labels "Correo electrónico" and "Contraseña"; server messages "Escribe tu correo.", "Escribe tu contraseña.", "El correo o la contraseña no coinciden." and the generic failure unchanged. The email field gets `autocomplete="username"`, `inputmode="email"`, `autocapitalize="none"`, `spellcheck={false}`.

### D6. End-to-end tests
`e2e/sign-in.spec.ts` changes the label and the wrong-credentials text. The hostile-values test runs in a context with `javaScriptEnabled: false`, instead of setting `noValidate` by script: it proves the server holds when the client checks do not run, and that the form still submits without JavaScript (D2). A new test checks the repeated message in the real browser: two wrong sign-ins in a row and a new alert element after the second.

## Risks / Trade-offs

- [The mock and the code can drift] → the version is in each component's doc comment and in this design; a later change compares them with UI-design-system's verify step.
- [Controlled fields and progressive enhancement] → without JavaScript the inputs are plain named fields in the server-rendered HTML, so the form posts them; the hostile-values e2e covers it.
- [`attempt` changes the action's state shape] → only `LoginForm` and `signInAction` use it; both change in this change.
- [Bigger than 2 h] → accepted by the author; the tasks keep TDD per scenario so it can stop at any group.
