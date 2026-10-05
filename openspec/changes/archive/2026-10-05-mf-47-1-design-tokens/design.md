## Context

`src/app/globals.css` is only `@import "tailwindcss"`; `src/app/layout.tsx` loads no font. The design system ("Menu Finder Design System", artifact version `1791096508-606b`) publishes `project/tokens.json`: colour tokens (palette plus semantic aliases written `{ink}`), spacing, radius, shadow and type styles. Motion, tracking and the base `html, body` rule live only in its `components/bundle.css`. Project tooling already lives in `scripts/<tool>/` as a thin `index.ts` over pure, tested modules (`scripts/roadmap/`, MF-39), and Vitest's `unit` project already runs `scripts/**/*.test.ts`.

## Goals / Non-Goals

**Goals:**
- One command turns the snapshot into the theme, deterministically (same input, same bytes).
- The theme only uses the design system's colours: Tailwind's default palette is reset.
- A broken or tampered snapshot fails loudly and writes nothing.

**Non-Goals:**
- Fetching the snapshot automatically: the artifact is private, so no script or CI job can read it. Refreshing is a Claude session step (D8).
- Porting components (MF-47.2) and dark mode (the design system has only a light theme).
- Generating `bundle.css` values: they are few and outside `tokens.json`.

## Decisions

### D1. Snapshot in `design-system/`, outside `src/`
`design-system/tokens.json` (verbatim) and `design-system/VERSION` (one line). It is source data, not app code, like `evals/`. Alternative: inside `src/app/`. Rejected: it would look like something the app loads at runtime.

### D2. Generator in `scripts/design-system/`, pure core plus thin shell
- `generate-theme.ts`: `generateTheme(snapshot: unknown, version: string): Result<string, TokenError[]>` — validates, then renders. Pure, no IO. Uses the project's `Result` from `src/shared/result.ts`.
- `index.ts`: reads both files, calls `generateTheme`, writes `src/app/theme.css` or prints the errors and sets a non-zero exit code. Wired as `"ds:tokens": "tsx scripts/design-system/index.ts"`.
- No port: it is build-time tooling, not a runtime boundary (ADR-001 §4).

Functions top-down (AGENTS.md): `generateTheme` first, then `validateSnapshot`, `renderTheme` and one render function per section in call order.

### D3. Mapping to Tailwind v4 theme namespaces
| Snapshot | Theme variable | Utility example |
|---|---|---|
| `color.tokens[name]` | `--color-<name>`; alias `{x}` → `var(--color-x)` | `bg-olive-600`, `text-text-strong` |
| `radius.tokens["radius-<n>"]` | `--radius-<n>` | `rounded-pill` |
| `shadow.tokens["shadow-<n>"]` | `--shadow-<n>` | `shadow-raised` |
| `spacing.tokens["space-<n>"]` / other | `--spacing-<n>` / `--spacing-<name>` | `p-5`, `max-w-content-max`, `min-h-tap-min` |
| `type.groups[].styles[name]` | `--text-<name>` + `--text-<name>--line-height`, `--font-weight`, `--letter-spacing` | `text-h1` |

The block opens with `--color-*: initial;` so only design system colours exist (a stray `bg-blue-500` produces nothing). `type.families` and `color.themes` are not emitted: the font comes from `next/font` (D5) and there is one theme. Variables are written in snapshot order, so the output is stable.

Alternative: keep the design system's own names (`--olive-600`, `--radius-pill`) as plain `:root` variables and use arbitrary values (`bg-[var(--olive-600)]`). Rejected: no utilities, no autocompletion, and typos are silent.

### D4. Allow-list validation (A03, A08)
Names: `^[a-z0-9]+(-[a-z0-9]+)*$`. Values per kind: hex colour `^#[0-9a-f]{3,8}$`i; alias `^\{[a-z0-9-]+\}$` pointing to a colour defined in the snapshot; length `^(0|-?\d*\.?\d+(px|rem|em))$`; unitless number `^\d*\.?\d+$`; weight integer 100–900; shadow `none` or a comma-free list of lengths plus an optional `rgba(n,n,n,n)` or hex colour. Every error is collected (not just the first) with the section and token name. Unknown top-level keys are ignored. The validated shape is described with zod (already a dependency) so the parse and the types come from one schema.

Alternative: escape values instead of rejecting them. Rejected: CSS has no general escaping for values, and an unexpected value is a mistake to fix in the design system, not to paper over.

### D5. Font with `next/font/google`
Archivo as a variable font (Google Fonts serves it with a `wght` axis, so one file covers the 400/600/800 the design system uses and no weights are listed), normal and italic, `display: 'swap'`, exposed as `--font-archivo` on `<html>` in `src/app/layout.tsx`. `globals.css` maps it with `@theme inline { --font-sans: var(--font-archivo), "Helvetica Neue", system-ui, sans-serif; }`, the fallback stack of the design system. Next.js downloads the files at build time and serves them from the app. Check the Next.js 16 font guide in `node_modules/next/dist/docs/` before writing it (AGENTS.md).

Alternative: the design system's `@import url(fonts.googleapis.com…)`. Rejected: a third-party request from every browser, and a layout shift.

### D6. `globals.css` keeps the hand-copied part
```
@import "tailwindcss";
@import "./theme.css";
@theme inline { --font-sans: … }
:root { motion and tracking from bundle.css, with the version in a comment }
@layer base { html, body: surface-page background, text-body colour, body size and line height; ::selection aceite-100 }
```
Motion (`--ease-out`, `--ease-in-out`, `--dur-*`, `--press-scale`) and `--tracking-ui` go as plain `:root` variables: Tailwind has a `--ease-*` namespace, so the two easings go in `@theme` as `--ease-out`/`--ease-in-out`; durations and press scale have no namespace and stay plain.

### D7. Coherence test
`scripts/design-system/theme.test.ts` reads the committed snapshot, version and `src/app/theme.css`, generates, and expects equality, failing with "run pnpm ds:tokens". The hand-edit scenario is covered by the same comparison on a modified string.

### D8. Refresh runbook in `design-system/README.md`
Short, in Spanish (project documentation): when to refresh (in the `propose` of a screen whose mock uses tokens that changed, `context/decisiones.md` UI-design-system), and the steps: read `project/tokens.json` from the artifact with the Artifact tool, copy it verbatim to `design-system/tokens.json`, write the version the read reports to `design-system/VERSION`, run `pnpm ds:tokens`, `pnpm test:run scripts/design-system`, and show the theme diff to the author before committing. The artifact URL goes in the runbook.

Alternative: an automated download. Rejected: no public endpoint; it would need the author's claude.ai credentials in a script or CI secret.

## Risks / Trade-offs

- [The snapshot goes stale when the author changes the design system] → `VERSION` and the header make the gap visible; refreshing is copying one file and running one command.
- [Some `bundle.css` values are copied by hand and can drift] → only eight values, with the version beside them; if they grow, move them into the generator.
- [`next build` needs Google Fonts reachable] → CI has network; if the download fails the build fails visibly, it does not ship a wrong font.
- [Resetting `--color-*` breaks any existing utility with a default colour] → the only ones are in the MF-20.3 login (`border`, no colour); MF-47.2 restyles it anyway.
