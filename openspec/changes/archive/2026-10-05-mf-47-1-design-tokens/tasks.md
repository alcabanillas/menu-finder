## 1. Snapshot

- [x] 1.1 Copy the design system's `project/tokens.json` verbatim to `design-system/tokens.json` and write `1791096508-606b` to `design-system/VERSION`; verify the file's sha256 is `0f824d447a1b80a532856cccc692fa20467a494c65fdbeeb3718beeaae2ccff0`

## 2. Generation (TDD, `scripts/design-system/generate-theme.test.ts`)

- [x] 2.1 RED: tests for "a colour token becomes a colour variable" and "an alias refers to the aliased colour", plus the `--color-*: initial` reset; run `pnpm test:run scripts/design-system` and see them fail
- [x] 2.2 GREEN: `generateTheme` renders colours (design D2, D3); the tests pass
- [x] 2.3 RED: test for "radius, shadow and spacing tokens become theme variables"; see it fail
- [x] 2.4 GREEN: render radius, shadow and spacing; the test passes
- [x] 2.5 RED: test for "a type style becomes a font size with its properties"; see it fail
- [x] 2.6 GREEN: render type styles; the test passes
- [x] 2.7 RED: test for "the theme names its origin"; see it fail
- [x] 2.8 GREEN: render the header with the version; the test passes

## 3. Validation (TDD, negative scenarios)

- [x] 3.1 RED: tests for "a value that is not a colour is rejected", "an alias to a colour that does not exist is rejected", "a name that is not kebab-case is rejected" and "a shadow with a url is rejected", each expecting an error naming the token; see them fail
- [x] 3.2 GREEN: zod schema with the allow-lists of design D4, every error collected; the tests pass
- [x] 3.3 RED: test for "an unknown section is ignored"; see it fail (it passed on the first run: the zod parse of 3.2 already drops unknown sections)
- [x] 3.4 GREEN: ignore unknown sections; the test passes

## 4. Command and coherence

- [x] 4.1 `scripts/design-system/index.ts` (thin shell: read, generate, write or print errors with exit code 1) and `"ds:tokens"` in `package.json`; verify `pnpm ds:tokens` writes `src/app/theme.css`, and that a tampered copy of the snapshot (temporary, not committed) exits 1 and leaves the theme unchanged
- [x] 4.2 RED: `scripts/design-system/theme.test.ts` for "committed theme matches the snapshot" and "a hand edit of the theme is caught", before `theme.css` exists; see it fail
- [x] 4.3 GREEN: run `pnpm ds:tokens` and commit `src/app/theme.css`; the coherence test passes and a second run leaves `git diff` empty
- [x] 4.4 `scripts/design-system/command.test.ts` runs the real command in a temporary directory: an invalid value exits non-zero, names the token and leaves `theme.css` unchanged; a valid snapshot writes the committed theme. Added at verify (the shell part of the scenario was only checked by hand); seen failing by making the command write before checking errors

## 5. App styles and font

- [x] 5.1 Read the font guide in `node_modules/next/dist/docs/`; load Archivo with `next/font/google` in `src/app/layout.tsx` (design D5); verify `pnpm typecheck`
- [x] 5.2 `src/app/globals.css` as design D6 (theme import, font mapping, motion and tracking from `bundle.css` with the version, base layer); verify `pnpm build` passes
- [x] 5.3 Visual check: run the dev server and screenshot `/` at 375 px: white page, ink-grey text, Archivo

## 6. Docs and close

- [x] 6.1 Runbook `design-system/README.md` (design D8); verify it names the artifact URL, the version source and `context/decisiones.md` UI-design-system
- [x] 6.2 `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` all pass
- [x] 6.3 Tick MF-47.1 in `context/roadmap.md` with the link to the archived change after `/opsx:archive`

## Security checklist (`context/safety-first.md` §4), 2026-10-05

- **Business and security decisions in the backend:** not applicable. No business logic; build-time tooling and styles only.
- **New endpoints (auth, permissions, negative tests):** not applicable. No endpoint; the only entry point is `pnpm ds:tokens`, run locally by the author.
- **User from the session:** not applicable.
- **Minimum data returned:** not applicable. The command writes a stylesheet and prints errors naming section and token.
- **No secrets in the diff:** yes. Checked the pending diff: no secret, key or `.env` file; the local `BETTER_AUTH_SECRET` lives only in the gitignored `.env.local`.
- **New dependencies:** none. `zod`, `tsx` and `next/font/google` were already there.
- **Parameterised queries:** not applicable. No database access.
- **Tests with unexpected values:** yes. The snapshot is the only input: CSS injection through a value (`red;} body{background:url(...)}`), a `url()` in a shadow, a name with `}`, an alias to a missing colour, a font size with `calc()`, several errors at once and an unknown section; plus the real command exiting non-zero and writing nothing.
- **Sensitive actions logged:** not applicable.
- **Deviations from a MUST rule:** none.
