## Why

Roadmap item **MF-47.2**, the second and last subtask of MF-47 (after `mf-47-1-design-tokens`, which brought the design system's tokens and font into the app). The sign-in of MF-20.3 still uses plain utilities, and it fails an accessibility criterion MF-47 set: when the same error comes back twice in a row, its `<p role="alert">` keeps the same text, the DOM does not change and screen readers announce nothing the second time.

The author has made the mock of the sign-in in the design system ("Menu Finder Design System", section Components, card "Login", artifact version `1791192451-31e6`), following `context/decisiones.md` UI-design-system. The author chose to build the whole mock in this change, although it goes over the 2 h threshold (~2,5 h).

**Result:** `/login` and `/` look like the mock, and a screen reader announces a sign-in error even when it repeats.

## What Changes

- **Sign-in screen as in the mock**: on narrow screens, the wordmark, a header ("Acceso", "Accede a tu menú", a line of explanation and the ink rule) and the form; from 640 px of width, two columns, with an olive panel (wordmark, a short description of the product and the day colours) beside the form.
- **Fields and button of the design system**: rectangular fields with their label above, the primary button at full width. The email field is labelled "Correo electrónico".
- **The password can be shown**: a "Mostrar"/"Ocultar" control beside the password, hidden by default.
- **The form checks the fields before sending**: an empty email, an email without the shape of an address or an empty password get a message under that field, and nothing is sent. The server keeps validating as before (`authentication`, "The sign-in input is validated on the server"); this is help for the user, not a control.
- **Pending state**: while the sign-in is in flight, the button says "Entrando…" and the form cannot be sent again.
- **Server errors** shown in the design system's error box, and **announced every time**, also when the same message repeats.
- **Wording aligned with the mock**: the server messages say "correo" instead of "email" ("Escribe tu correo.", "El correo o la contraseña no coinciden."). Still one message for every wrong-credentials case.
- **Left out of the mock**: its "Volver al inicio" button. Today `/` shows the same sign-in (UI-home-sin-login), so it would go back to the same screen; it comes with the informative home.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `authentication`: new requirements for how the sign-in form helps and informs the user (errors announced every time, field checks before sending, showing the password, pending state). The existing requirements do not change: server validation, one message for wrong credentials, no sign-up or recovery, fixed redirect.

## Impact

- **Code:** `src/features/auth/components/` (new `button.tsx`, `text-field.tsx`, `password-field.tsx`, `form-alert.tsx`, `sign-in-hero.tsx` and the field-check function; `login-form.tsx` and `sign-out-button.tsx` restyled); `src/app/_session/sign-in-screen.tsx` (layout of the mock); `src/app/_session/actions.ts` (wording); `e2e/sign-in.spec.ts` (label, message, and the hostile-values test sent with JavaScript off, see design); `e2e/access.spec.ts` (label).
- **Dependencies:** none new. The alert icon of the mock (Lucide `circle-alert`) goes as an inline SVG instead of adding an icon library for one glyph.
- **Decisions relied on:** UI-design-system (the mock is the visual reference and does not decide scope), UI-estilos, UI-home-sin-login (why "Volver al inicio" is left out), SEG-sistema-cerrado (no sign-up or recovery), SEG-auth; ADR-001 §2 (Scope Rule: everything is used only by `features/auth`, so it stays there). Contradicts none.
- **Data:** the email and password typed by the user, as in MF-20.3. Nothing new is stored, logged or sent.
- **Abuses and OWASP:**
  - Trusting the client checks: someone can skip them (no JavaScript, a direct call). The server validation of MF-20.3 is unchanged and the hostile-values end-to-end test sends the form with JavaScript off, so it still reaches the server (A03, A07).
  - Showing the password: only on the user's own action, hidden again on each load; the control is a `type="button"`, so it never submits, and the field keeps `autocomplete="current-password"` (A07).
  - Telling apart emails with an account: the client checks only look at the shape of what was typed, never at the server; the wrong-credentials message is still one for every case (A07).
