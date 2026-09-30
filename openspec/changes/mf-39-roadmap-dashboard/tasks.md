## 1. Setup

- [x] 1.1 Add `scripts/**/*.test.ts` to the Vitest `unit` project, `/reports/` to `.gitignore`, and `"roadmap": "tsx scripts/roadmap/index.ts"` to `package.json`; verify that `pnpm test:run` still passes

## 2. Parsing (TDD: each test seen failing first)

- [x] 2.1 Write tests for the "Item with all fields", "Partial metadata" (including decimal comma) and "Item without metadata" scenarios, and for sprint assignment; run them and see them fail
- [x] 2.2 Implement `parse-roadmap.ts` until the 2.1 tests pass
- [x] 2.3 Write tests for the malformed estimate, unknown owner, missing or invalid deadline and duplicate ID scenarios, checking that each error names its line; see them fail
- [x] 2.4 Extend `parse-roadmap.ts` until the 2.3 tests pass

## 3. Figures and readiness (TDD)

- [x] 3.1 Write tests for "Summary figures" (including the split by owner), the counts of items without estimate or owner, and "Deadline passed"; see them fail
- [x] 3.2 Implement the figures in `summarize.ts` until the 3.1 tests pass
- [x] 3.3 Write tests for "Ready item", "Blocked item" (naming the blocking IDs), "Unknown dependency", "Self-dependency" and "Dependency cycle"; see them fail
- [x] 3.4 Implement dependency validation and readiness in `summarize.ts` until the 3.3 tests pass

## 4. Page (TDD)

- [x] 4.1 Write tests for "Sprint blocks" (order, per-sprint progress, owner and dependencies per item), the list of ready items, the page loading no external resource, and "Markup in an item"; see them fail
- [x] 4.2 Implement `render-html.ts` with `escapeHtml` until the 4.1 tests pass

## 5. Command

- [x] 5.1 Implement `index.ts` (read, parse, summarize, render, write, exit code); verify by running `pnpm roadmap` once on a missing path (non-zero exit, no page) and once on the real roadmap (page written)

## 6. Roadmap data

- [x] 6.1 Add MF-39, the `**Fecha límite:** 2026-10-25` line and the Sprint 4 calendar row ending on 2026-10-25 to `context/roadmap.md`; verify with `pnpm roadmap`
- [ ] 6.2 Propose the metadata block (estimate, owner, dependencies) for every pending item and have the author review it before committing; verify that `pnpm roadmap` succeeds and the page reports 0 pending items without an estimate or an owner

## 7. Close

- [x] 7.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, all green; open `reports/roadmap.html` and check it visually
- [ ] 7.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result
