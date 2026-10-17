# Proposal

## Why

Two gaps in the Sentry setup, found by comparing it with the example project `mbs-front/simple-product-shop` (2026-10-18):

1. **No error boundary reports render errors.** `src/app` has no `error.tsx` or `global-error.tsx`. A React render error in the browser (a component that throws, or the root layout) reaches Next.js's default error screen and is not sent to Sentry: Next.js catches it in its own boundary, so the global `window.onerror` handler never sees it. The user also gets Next.js's generic page, not the app's.
2. **Events carry no `environment`.** Both `Sentry.init` calls omit it, so errors from a Vercel preview, production and a local `next dev` with a DSN all land in one stream.

Size: about 1.5 h, under the 2 h split threshold of `AGENTS.md`. It has no roadmap ID yet; the author assigns one.

## What Changes

- New `src/app/error.tsx`: catches errors of any page below the root layout, reports the error to Sentry and shows a fallback inside the app shell (styles and font kept), with a "Try again" button that calls `retry`.
- New `src/app/global-error.tsx`: catches errors of the root layout itself, reports them and shows a fallback with its own `<html>` and `<body>` (Next.js requirement), with a "Try again" button.
- Both fallbacks show a fixed Spanish message. They never show `error.message`, `error.stack` or `error.digest` to the user.
- Both `Sentry.init` calls (`src/instrumentation.ts`, `src/instrumentation-client.ts`) pass `environment`: `VERCEL_ENV` (`production`, `preview`, `development`), falling back to `NODE_ENV`. `next.config.ts` inlines it for the browser, as it already does with `SENTRY_DSN`.
- `NOTHING_FROM_REQUESTS` stays shared and unchanged. No Session Replay, no `setUser`.

Not copied from the example: Session Replay (open decision, `context/decisiones.md` "Lo abierto" item 4), `Sentry.setUser` (user info is off by design) and the cart breadcrumbs (we already have search and choose breadcrumbs).

## Data touched

| Datum | Goes to Sentry | Note |
|---|---|---|
| Error message and stack of a render error | Yes | Same as any browser error today. Component names and file paths are code, not user data. |
| `error.digest` | No, not added | It only matches server logs, and Sentry already has the server error |
| Component stack | Only what `captureException` adds by default | No props, no state |
| `environment` | Yes, a fixed label | `production`, `preview` or `development` |
| Request text, dish names, cookies, headers, user | No | `dataCollection` stays off |

## Possible abuses

- **Error text shown to the user.** A fallback that printed `error.message` could leak internals. The fallback is fixed text.
- **Event flood.** A render error in a loop would send one event per render. `captureException` runs once per error instance (`useEffect` keyed on `error`) and "Try again" is manual. Spike Protection (MF-22.2) and the monthly quota are the cap.
- **Wrong environment tag.** If `VERCEL_ENV` is unset in a build, the fallback is `NODE_ENV`, never an empty string, so events are never untagged.

## OWASP categories (`context/OWASP-Top10.md`)

- **A09:2025 - Fallos de registro y alertas de seguridad:** render errors were invisible; what an event carries is unchanged.
- **A10:2025 - Manejo incorrecto de condiciones excepcionales:** a render error shows a controlled screen and no internals.
- **A02:2025 - Configuración de seguridad incorrecta:** `global-error.tsx` renders outside the root layout, so it must work under the nonce-based CSP with no inline script.

## Decisions it relies on

- `context/decisiones.md` OPS-observabilidad: errors in server and browser, `dataCollection` off. This change adds a source of browser errors; it contradicts nothing.
- `context/decisiones.md` SEG-datos-nutricionista.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `error-reporting`: adds the requirements "Render errors reach Sentry" and "Events carry their environment".

## Impact

- New: `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/sentry-environment.ts` and their tests.
- Edited: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `next.config.ts` (and their tests), `context/decisiones.md` OPS-observabilidad (one sentence).
- No new dependency. No CSP change: events go to the ingest host already allowed.
