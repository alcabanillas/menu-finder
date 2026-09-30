# Design

## Context

See proposal.md - Why. `context/roadmap.md` is already the backlog and the single source of truth for the plan. The existing tooling under `scripts/` is plain Node JS with no tests. This is project tooling, not product code, so ADR-001 (which governs `src/`) does not apply.

## Goals / Non-Goals

**Goals:**
- One command that turns the roadmap into a page, with every figure computed from the file.
- Pure, tested parsing and computation; a thin shell that reads, writes and exits.

**Non-Goals:**
- History or burndown, real hours spent, a live-updating page, a hosted page.

## Decisions

1. **Generated static HTML, not a hosted dashboard or an external tool.** It keeps `roadmap.md` as the single source and costs no duplication. Alternatives: Linear (it duplicates the backlog, and one of the two copies goes stale) and a Claude Artifact (it is only refreshed when Claude regenerates it).
2. **TypeScript under `scripts/roadmap/`, run with `tsx`.** `tsx` is already used by `pnpm ingest`, and TypeScript lets the tests share types. Three modules:
   - `parse-roadmap.ts`: markdown text → items, sprints and deadline, or a list of errors with line numbers. Pure.
   - `summarize.ts`: parsed roadmap + run date → figures. Pure; the run date is a parameter so tests are deterministic.
   - `render-html.ts`: figures → HTML string, with an `escapeHtml` helper applied to every roadmap string. Pure.
   - `index.ts`: reads the file, calls the three, writes `reports/roadmap.html` and sets the exit code. Not unit-tested; covered by running the command.
3. **One metadata block right after the ID: `(~N h · owner · tras MF-xx)`.** It is readable in the markdown, and a single anchor next to the ID avoids matching numbers or IDs mentioned in the item text. Alternatives were separate markers spread across the line (fragile) and a sidecar YAML file (it splits the backlog in two). The estimate is a single figure, not a range: a range would need a rule to add ranges up, and a midpoint is enough for a pace figure.
4. **Hours split by owner, not a "human workload" figure.** An `H→A` item is neither fully human nor fully agent, and any fixed share would be an invented number. The page shows the sums per owner and lets the author read them.
5. **Readiness computed from the dependencies.** `summarize.ts` checks that every dependency exists and detects cycles with a depth-first search; a pending item is ready when all its dependencies are done. The ready list is the view of what can run in parallel.
6. **Explicit `**Fecha límite:**` line** instead of reading the last row of the calendar table. It is less fragile, and the calendar stays prose for people.
7. **Days left include today and the deadline.** It reads naturally ("I still have today"). Past the deadline the pace is not computed, which avoids dividing by zero or by a negative number.
8. **Inline CSS, no JS and no external assets.** The page opens offline, and with no scripts there is nothing to inject into. The labels are in Spanish, like the roadmap they present; identifiers stay in English.

## Risks / Trade-offs

- [The estimates, owners and dependencies are Claude's judgment, not measurements] → The author reviews them before committing, and the page labels the hours as estimates.
- [A format change in `roadmap.md` breaks parsing] → Invalid lines fail loudly with their line number; they are never skipped silently.
- [Lines that look like items but are not] → Only lines that start with `- ✅` or `- ⬜` followed by a bold ID count as items.
