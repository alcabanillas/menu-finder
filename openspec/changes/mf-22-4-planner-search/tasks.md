## 1. Length check before the daily hit

- [x] 1.1 RED: in `src/application/use-cases/search/search-by-text.test.ts`, for `searchByTextWithinDailyLimit`, write "An invalid request is not counted": a request of only spaces gives `request-too-short` and one of 301 characters gives `request-too-long`, both with no hit on the fake `RateLimiter` and no call to the decomposer. See it fail
- [x] 1.2 GREEN: extract `checkRequestLength` in `src/application/services/search/decompose-text.ts`, keep `decomposeText` calling it, and call it in `limitedSearch` before `rateLimiter.hit` (design D2). Verify 1.1 and the existing `decompose-text` and `search-by-text` tests pass

## 2. The units in the search result

- [x] 2.1 RED: in `src/application/services/search/find-menus.test.ts`, write "Units of the result" (spec `menu-search`): `arroz` and the exclusion `marisco` in a `sameDish` group and `pollo` apart give `units` `[{ kind: 'sameDish', constraints: [<arroz>, <marisco>] }, { kind: 'constraint', constraints: [<pollo>] }]`, and every returned menu has two evidence items in that order. See it fail
- [x] 2.2 GREEN: add `units` to `SearchResultDto` and fill it in `toResultDto` from the `Unit[]` that scores the menus (design D3). Verify 2.1 passes and `pnpm typecheck` is clean, fixing the test fixtures that build a `SearchResultDto`

## 3. The view of a search (pure functions)

- [x] 3.1 RED: in `src/features/menu-planner/search-view.test.ts`, write the unit tests of `toChips(structure, units)` (design D3) from the scenarios of "Restriction chips": a `constraint` unit, the `sameDish` unit of `arroz` and `marisco` with `pollo` apart, and an `anyOf` unit, each member with the `term`, `polarity`, `type`, `hard` and `slot` of its id, and the chips in the order of `units`. See them fail
- [x] 3.2 GREEN: write `toChips` in `src/features/menu-planner/search-view.ts`, with no grouping of its own. Verify 3.1 passes
- [x] 3.3 RED: in the same file, the tests of `toEvidenceLines` (design D4) from "Candidate cards with evidence": a unit covered by a dish ("Martes, comida · Garbanzos con espinacas"), a week-wide exclusion ("no aparece en la semana", check), and a soft constraint no dish covers ("ningún plato", cross), each paired with its chip by index. See them fail
- [x] 3.4 GREEN: write `toEvidenceLines` with the local day and meal labels. Verify 3.3 passes
- [x] 3.5 RED: the tests of `toSearchState(result, attempt)` (design D1): one `failed` state for each row of "Search messages", with its `kind` and its message; the kinds `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` and `invalid-request` all with the failure message and their own `kind`; a `ranking` state with chips and cards; and an empty ranking as a `ranking` state with chips and no cards ("No menu fits"). See them fail
- [x] 3.6 GREEN: write `toSearchState`, the `PlannerSearchState` union and its `idle` initial state (design D1). Verify 3.5 passes and the file has 100 % coverage (`pnpm test:coverage src/features/menu-planner`)

## 4. The server action

- [x] 4.1 RED: in `src/app/(signed-in)/planner/actions.test.ts`, for `searchMenusAction`, with `requireUser` and the container mocked, write:
  - "Searching shows the chips and the top 5": the action passes the trimmed `request` field to `searchByText` and returns its view;
  - "Searching without a session": `requireUser` rejects, and neither the form nor `searchByText` is read or called;
  - "A field that is not text": a `File` and a missing field each give "Escribe qué te apetece." with no call;
  - "Extra fields are ignored": `searchByText` is called once, with only the request.

  See them fail
- [x] 4.2 GREEN: write `searchMenusAction(previous, formData)` in `src/app/(signed-in)/planner/actions.ts`: `requireUser()` first, read only `request`, call `webContainer().searchByText`, map with `toSearchState`. Verify 4.1 and the existing tests of the random button pass

## 5. Components

- [x] 5.1 RED: in `src/features/menu-planner/components/restriction-chip-list.test.tsx`, render the units of the "Restriction chips" scenarios and assert the list name "Lo que has pedido", the screen reader texts, the tone and border classes (`bg-olive-100`, `bg-terracotta-50`, `bg-ochre-100`/`border-ochre-300`, `border-dashed`/`border-solid`), the dashed underline of a soft member in a mixed-hardness group, the single and the per-member meal suffix, the `o` separator, icons and separators with `aria-hidden`, and that no chip is a button, link or input. See them fail
- [x] 5.2 GREEN: port `RestrictionChipList` and `RestrictionChip` from `RestrictionChip.jsx` version `1791992191-0fd0`, with the icon component of design D5. Verify 5.1 passes
- [x] 5.3 RED: in `menu-candidate-card.test.tsx`, assert the rank, "Menú N", one line per evidence with check or cross and its detail, the term colours (`text-olive-600` for include and attribute, `text-terracotta-600` for exclude), and no title, explanation or button ("Cards have no actions"). See it fail
- [x] 5.4 GREEN: port `MenuCandidateCard` from the design system, version `1791992191-0fd0`, with the attribute colour of design D5. Verify 5.3 passes
- [x] 5.5 RED: in `planner-search.test.tsx`, with a fake action, assert:
  - the search box with the placeholder "¿Qué te apetece esta semana?" and the field `request`;
  - "The request text is not in the URL" and "Searching without JavaScript": the form's `action` is the server action itself (so React posts it as a POST body, also without JavaScript) and the form has no `method="get"`;
  - "Searching in progress": while the action is pending, the status "Buscando…" is shown and the button is disabled;
  - nothing under the box in the `idle` state;
  - the chips and the cards of a `ranking` state, and the message of "No menu fits" when it has no cards;
  - the message of a `failed` state shown with `role="alert"`, with no chips or cards;
  - "A new search replaces the previous one";
  - the breadcrumbs of "Search breadcrumbs without request data", with `@sentry/nextjs` mocked: one when the form is sent and one per answer with `outcome` (`ranking` or the `kind` of a `failed` state) and the counts, with no term, dish or text in any field.

  See it fail
- [x] 5.6 GREEN: write `SearchBox` (from `SearchBox.jsx`) and `PlannerSearch`, with the layout of `PlannerScreen.jsx` from an 800 px container (design D6, D8). Verify 5.5 passes

## 6. The page

- [x] 6.1 RED: in `src/app/(signed-in)/planner/page.test.tsx`, assert that the page renders the search with `searchMenusAction`, above the selection summary and the random button, which stay. See it fail
- [x] 6.2 GREEN: render `PlannerSearch` in `src/app/(signed-in)/planner/page.tsx`. Verify 6.1 and the existing page tests pass

## 7. Close

- [x] 7.1 Run `pnpm typecheck` and `pnpm test:run` on the affected files, and lint only the touched files with `pnpm exec eslint <files> --rule "import/no-cycle: off"` (`AGENTS.md`). Verify all pass
- [ ] 7.2 Manual check "Searching without JavaScript" and "The request text is not in the URL": in local `pnpm dev`, with JavaScript disabled in the browser, search "garbanzos". Verify the results come back and the URL has no query string
- [ ] 7.3 Screenshots at phone and desktop widths of L01, A03, E02, C05, R01 and A01 from `evals/decomposer/golden-set.json` (design D10), compared with `PlannerScreen.jsx` and shown to the author; note any structure that differs from the golden set's Status (2026-10-14): pending. The six requests were searched with the real model and database and compared by eye with `PlannerScreen.jsx`, and the structures the model gave were not checked against the golden set's. The author considers the behaviour fine, but does not approve the visual design yet: the design system has changed since version `1791992191-0fd0` and the author will change the UI. How this task closes is for the author to decide.
- [x] 7.4 Update `context/roadmap.md` MF-22.4: estimate ~3 h (decided by the author on 2026-10-14), the restriction chip per unit, and the "Prueba con" suggestions left out. Add MF-65, how many menus a hard constraint removes when fewer than five are left (BUS-superficie-consulta (b), deferred by the author on 2026-10-14), with no estimate yet. Verify it reads as decided
- [x] 7.5 Before the PR, run `pnpm test:coverage` (`AGENTS.md`) and ask the author whether the PR bumps `"version"` in `package.json`. Result (2026-10-14): `pnpm test:coverage` passes its thresholds (159 files, 1477 tests; statements 98.44 %, branches 94.29 %, functions 99.38 %, lines 98.84 %). The functions left uncovered are all in `src/infrastructure/` (Genkit embeddings, the shopping list PDF page and the Postgres migration runner, transaction and schema setup; the Postgres ones need `DATABASE_URL_TEST`, which is unset locally): none in a file of this change, which are at 100 %. The author decided `0.4.0` and `package.json` goes from `0.3.1` to `0.4.0` in this PR.
- [x] 7.6 Before archive, go through `context/safety-first.md` §4 and record the result in this file. Result (2026-10-14), item by item:
  - Business and security decisions in the backend: yes. The length check is in the use case (`checkRequestLength`), and the web only maps outcomes to messages.
  - Auth, permissions and input shape in the new endpoint: yes. `searchMenusAction` calls `requireUser()` first and reads one field, which must be text; the length and the structure are validated on the server.
  - User and permissions from the session: yes. The action reads no user, strategy or other field from the form.
  - Negative authorization tests in CI: yes. `actions.test.ts` ("Searching without a session": no form read, no search) and `e2e/access.spec.ts` (`/planner` without a session and with a forged cookie), run by `pnpm test:coverage` and the E2E job.
  - Minimum data returned: yes. The state has the chips, and for each card the rank, the menu number and the evidence lines. The scores, the whole ranking, the strategy and `removedBy` do not leave the server.
  - No secret in the diff: yes. Checked by searching the diff and the new files for keys, passwords, connection strings and the Sentry DSN; none found.
  - New dependencies: none. `package.json` changes only the version.
  - Parameterised queries: no query was added or changed.
  - Unexpected values: empty, 301 characters (and 300 emojis at the limit, in `decompose-text.test.ts`), a `File` and a missing field, extra fields, and, added in this task, terms and dish names with HTML metacharacters, rendered as text. Prompt injection into the model is covered by the decomposer tests of MF-40.2 (a term not in the request is refused), not repeated here.
  - Sensitive actions logged: yes. The daily limit is reported to Sentry as a warning and a system failure as an error (MF-22.3). Seen in Sentry on 2026-10-14: the event carries the failure kind and the URL without a query string. A search is not a login or an access denial, which `requireUser` and the auth use cases already log.
  - Deviations from a DEBE rule: one, SEG-rate-limit asks for `429` and a server action answers with a message. It is justified in `design.md` (D9) and in the proposal.
  - Observed, outside this change: Sentry may group the failure kinds in one issue (`context/decisiones.md` §2, item 5), and Replay stays off on purpose (item 4).
