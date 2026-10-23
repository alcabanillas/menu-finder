# Tasks

## 1. Design system copy

- [x] 1.1 Copy `project/tokens.json` of version `1792687168-5ad7` (identical to the repo copy), write `design-system/VERSION`, run `pnpm ds:tokens` and `pnpm vitest run scripts/design-system`; verify only the version header of `src/app/theme.css` changes and the 18 tests pass

## 2. Evidence without the minus (menu-planner)

- [x] 2.1 Test first in `menu-candidate-card.test.tsx`: the line of the week-wide exclusion `cerdo` shows ✓, "cerdo" in `text-exclude` and "no aparece en la semana" with no minus icon; the `sameDish` line of `arroz` and `marisco` shows no minus and keeps its screen reader text. See them fail
- [x] 2.2 Remove the minus from `EvidenceItem` in `menu-candidate-card.tsx`; verify 2.1 passes and `pnpm vitest related` on the file stays green

## 3. Recipe card that starts open (weekly-menu)

- [x] 3.1 Test first in `recipe-card.test.tsx`: with `defaultOpen`, the recipe is shown and the header is marked as expanded; without it, it starts folded as today. See it fail
- [x] 3.2 Add `defaultOpen` to `RecipeCard`; verify 3.1 passes
- [x] 3.3 Refactor found in 6.2: in `RecipeBody` each time column keeps at least the width of its label (`min-w-fit`), so "PREPARACIÓN" no longer runs into "COCCIÓN" in the 390 px sample; equal columns where they fit. Verify the weekly-menu tests stay green

## 4. Welcome screen (welcome)

- [x] 4.1 Test first in `welcome-screen.test.tsx`, one test per scenario of `home` it covers: the heading, the text, the days line and two "Acceder" links to `/login`; the four level-two headings in order and the closing sentence; each slot rendered inside an element with `aria-hidden="true"` and `inert`; no link or button reachable but the two "Acceder"; no sign-up or recovery text. See them fail
- [x] 4.2 Rewrite `WelcomeScreen` after `WelcomeScreen.jsx` v73 with the slots `search`, `week`, `recipe`, `shopping` (design D1, D2, D5) and the local `WeekGlance` day cards; verify 4.1 passes

## 5. Sample pieces and the home (app)

- [x] 5.1 Test first in `src/app/page.test.tsx`: a visitor's page shows the request "de cuchara, sin cerdo y con garbanzos", the chips, the card "Menú 14" with "no aparece en la semana", six day cards, an open recipe with its steps and a category with three items; still reads no data and has no version; the existing "Acceder" assertions accept two links in the main content. See them fail
- [x] 5.2 Write `src/app/_welcome/sample-pieces.tsx` (constants with invented dishes, design D4) and pass the pieces from `page.tsx`; verify 5.1 passes
- [x] 5.3 Write `scripts/welcome/check-sample-dishes.ts` and its `pnpm welcome:check-samples` script, with a unit test on its matching (fictitious names only, never catalogue data); run it locally against `data/` and verify it reports no match
- [x] 5.4 Update `e2e/home.spec.ts` for the two "Acceder" links in the main content; keep its no-data, no-email, no-version and no-sign-up checks

## 6. Checks

- [x] 6.1 `pnpm typecheck`, and `pnpm exec eslint <touched files> --rule "import/no-cycle: off"`
- [x] 6.2 Review `/` without a session by eye at 390 px and 1440 px, top to bottom, against the "Bienvenida" card, and record what differs. Reviewed on 2026-10-22 with the local dev server: no horizontal scroll, no console errors, only the two "Acceder" reachable. Differences kept: the chip "de cuchara" shows the sparkles of an attribute, as in Buscar, where the design draws a plus; the recipe card has no eyebrow (design D3)
- [x] 6.3 `pnpm test:coverage` before the PR: 1839 tests passed, thresholds met (2026-10-22)

## 7. Design system v79 (row v78)

- [x] 7.1 Copy `project/tokens.json` of version `1792741404-457d` (identical to the repo copy), write `design-system/VERSION` and run `pnpm ds:tokens`; only the version header of `src/app/theme.css` changes
- [x] 7.2 Test first in `welcome-screen.test.tsx`: the closing block says "Escríbelo como te salga y te enseñamos los menús que encajan." and no longer "no inventa menús". See it fail, then change the sentence in `welcome-screen.tsx`

## Workflow follow-up

- `"version"` goes to 1.0.0 in this PR (decided by the author on 2026-10-22).
- Mark row v73 of `project/implementacion.md` in the design system as `implementado` with the PR, and fix its version line.
- Archive the change after review, with the checklist of `context/safety-first.md` §4.

## Security checklist (`context/safety-first.md` §4), 2026-10-23

- **Business and security decisions in the backend:** yes. The home for a visitor is static; the session check that chooses it stays in `src/app/page.tsx` on the server, as in MF-25.
- **New endpoints (auth, permissions, negative tests):** not applicable. No endpoint, server action or route is added.
- **User from the session:** not applicable, for the same reason.
- **Minimum data returned:** yes. The page holds only constants with invented dishes; `pnpm welcome:check-samples` found none of the 15 among the 444 catalogue names, and `e2e/home.spec.ts` checks the response has no dish of the database, no email, no version and no sign-up, also with a forged session cookie (8 passed on 2026-10-23).
- **No secrets in the diff:** yes. Checked with a `grep` of the branch diff for keys, tokens and passwords: no match.
- **New dependencies:** none. `next` and `eslint-config-next` go from 16.4.0 to 16.4.2, a patch of existing packages for a security advisory.
- **Parameterised queries:** not applicable. No new SQL.
- **Tests with unexpected values:** not applicable. The page has no input; its only controls are the two "Acceder" links.
- **Sensitive actions logged:** not applicable. No sign-in or access decision changes.
- **Deviations from a MUST rule:** none. The evidence line loses the minus before an excluded term, a non-colour cue (WCAG 1.4.1); the screen reader text keeps "excluido", and the trade-off is in `proposal.md` and `design.md` (Risks).
