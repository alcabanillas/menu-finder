## Why

Roadmap item **MF-47.1**, the first of the two subtasks of MF-47 (the second is `mf-47-2-login-design`). The app has no visual language yet: `src/app/globals.css` only imports Tailwind and the login of MF-20.3 uses plain utilities. The author's design system ("Menu Finder Design System", a claude.ai artifact) defines the palette, type scale, radii, shadows and motion, but it lives outside the repo and no script or CI job can read it (it needs the author's claude.ai session). Without a defined way in, every later screen would copy values by hand and drift from the design system.

Decided by the author on 2026-10-05 (`context/decisiones.md` UI-design-system): **one-way sync, with the design system as the source of truth.** A versioned copy of its `tokens.json` lives in the repo, and a script generates the Tailwind theme from it. The artifact is private, so only a Claude session with the author's account can read it: refreshing the copy is a step of the `propose` of the screen that needs it, written down as a runbook.

**Result:** `pnpm ds:tokens` regenerates the theme, and the page background, text colour and font of the app are the design system's.

## What Changes

- **Snapshot of the design system tokens** in the repo: its `tokens.json`, verbatim, plus the artifact version it was taken from.
- **`pnpm ds:tokens`**: reads the snapshot and writes the theme file the app imports, as Tailwind v4 theme variables (colours, semantic colour aliases, radii, shadows, spacing and the type scale), so they are available as utilities (`bg-surface-accent`, `rounded-pill`, `text-h1`…). The generated file says it is generated and from which design system version.
- **Validation of the snapshot**: a token whose name or value does not have the expected shape stops the script with an error naming the token, and nothing is written. Sections the generator does not know are ignored.
- **Coherence check in the test suite**: the committed theme must be what the script produces from the committed snapshot, so neither can change without the other.
- **Values outside `tokens.json`** (motion easing and durations, press scale, tracking) are copied once from the design system's `components/bundle.css` into `src/app/globals.css`, with the version noted.
- **Base styles**: white page, body text colour and Archivo as the font of the whole app, loaded with `next/font` (self-hosted at build time, no request to Google from the browser).
- **Runbook** `design-system/README.md`: how to refresh the snapshot from a Claude session (read `project/tokens.json` from the artifact, copy it verbatim, write the version the read reports, run `pnpm ds:tokens` and the tests, review the theme diff).

## Capabilities

### New Capabilities
- `design-tokens`: how the design system's tokens become the app's theme: the snapshot, the generation, the validation of the snapshot and the coherence between snapshot and theme.

### Modified Capabilities
- None.

## Impact

- **Code:** `design-system/tokens.json`, `design-system/VERSION` and `design-system/README.md` (new); `scripts/design-system/` (generator and tests, new, following `scripts/roadmap/`); `src/app/theme.css` (generated, new); `src/app/globals.css`; `src/app/layout.tsx` (font). No change in `src/domain`, `src/application` or `src/infrastructure`; no port (no runtime boundary: the generator is build-time tooling).
- **Line endings:** `.gitattributes` pins LF for `design-system/**` and `src/app/theme.css`. The coherence check compares bytes, and with `core.autocrlf=true` a fresh Windows checkout would get CRLF and fail it.
- **Dependencies:** none new. `next/font/google` ships with Next.js; `tsx` already runs the scripts.
- **Build:** `next build` downloads Archivo from Google Fonts once to self-host it; the CI build needs network access to Google Fonts (it already has network access for `pnpm install`).
- **Decisions relied on:** UI-design-system (recorded before this proposal), UI-estilos (Tailwind CSS v4), ADR-001 (no port for build-time tooling; nothing outside `app/` changes). Contradicts none.
- **Data:** none. The snapshot is public style data from the author; nothing from the nutritionist (SEG-datos-nutricionista) and no user data.
- **Abuses and OWASP:** the only input is the snapshot, written by the author but copied from an artifact others could edit. A malicious value could try to inject CSS (for example a `url(...)` that calls out, or a `}` that closes the theme block) into a stylesheet every page loads: A03 Injection and A08 Software and Data Integrity Failures. Mitigation: the generator accepts only kebab-case names and values matching an allow-list per kind (hex colour, alias to an existing colour, length, unitless number, font weight, shadow); anything else fails the script. No endpoint, no authentication change.
