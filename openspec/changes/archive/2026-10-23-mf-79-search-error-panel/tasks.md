# Tasks

## 1. Design system

- [x] 1.1 Write `1792772980-f821` (v84) in `design-system/VERSION`, run `pnpm ds:tokens` and `pnpm test:run scripts/design-system`; verify `tokens.json` is unchanged and `src/app/theme.css` only changes its version line

## 2. The view of a failed search

- [x] 2.1 RED: tests in `src/features/menu-planner/search-view.test.ts` for the group of every outcome of the table in "Search messages" and for the request kept as it was sent; see them fail
- [x] 2.2 GREEN: `toSearchState` adds `group` and `request` to the failed state (design D1, D3); verify 2.1 passes and `pnpm typecheck`

## 3. The panel

- [x] 3.1 RED: tests in `src/features/menu-planner/components/planner-search.test.tsx` for the scenarios "Panel of a request to say otherwise", "Panel of a request out of the catalog", "Panel of a failure", "Panel of the daily limit", "Nothing of a search above the panel", "The row stays after a failed search" and "The request comes back after an error"; replace the test that kept "Prueba con" after a failure; see them fail
- [x] 3.2 GREEN: the four icons in `PlannerIcon` (design D4) and the shared panel in `planner-results.tsx` (design D2, D5); "Prueba con" hidden after a failed search in `planner-search.tsx`; verify 3.1 and the existing tests of "a search with no menu" pass

## 4. Checks

- [x] 4.1 By eye at 390 px and 1440 px with the dev server: the four groups and "no menu fits". Checked on 2026-10-23 with real searches: "request" ("asdfgh"), "catalog" ("tarta de queso") and "no menu fits" ("garbanzos con sardinas") at both widths, colours and padding read from the DOM, "Editar mi búsqueda" puts "asdfgh" back with the focus, no horizontal scroll, no console errors. "failure" and "limit" cannot be triggered with a real search: covered by `planner-search.test.tsx` only
- [x] 4.2 `pnpm typecheck` and `pnpm test:coverage`

## Workflow follow-up

- `/opsx:verify`, the checklist of `context/seguridad/safety-first.md` §4 and `/opsx:archive`.
- Mark MF-79 done in `context/roadmap.md`, and the row v83 of `project/implementacion.md` of the design system as implemented with the PR.

## Security checklist (`context/seguridad/safety-first.md` §4), 2026-10-23

- **Business and security decisions in the backend:** yes. The group of an error is decided on the server in `toSearchState`; the client only paints it.
- **New endpoints (auth, permissions, negative tests):** not applicable. No endpoint, server action or route is added; the search action keeps its session check.
- **User from the session:** not applicable, for the same reason.
- **Minimum data returned:** yes. The failed state adds the group and the user's own request, which the ranking state already carried; the breadcrumbs keep the outcome kind only (`planner-search.test.tsx`, "records the kind of a failed search").
- **No secrets in the diff:** yes. Checked with a `grep` of the branch diff for keys, tokens, passwords and connection strings: no match.
- **New dependencies:** none. The four icons are Lucide paths copied inline, like the others.
- **Parameterised queries:** not applicable. No new SQL.
- **Tests with unexpected values:** no new input. The request is put back as the value of the input, never as HTML; a request of only spaces is tested.
- **Sensitive actions logged:** not applicable. No sign-in or access decision changes.
- **Deviations from a MUST rule:** none.
