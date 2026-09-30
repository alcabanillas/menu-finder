# Proposal

## Why

Roadmap item **MF-39**. The author wants to see the state of the plan at a glance: what is done, what is pending, how many hours remain and whether the pace fits the deadline. Today those figures only exist in chat answers, so they get lost and have to be asked for again. A small page generated from `context/roadmap.md` makes them reproducible without a separate tool that would duplicate the backlog.

## What Changes

- `context/roadmap.md` gains the data that the page reads:
  - a **metadata block per item**, right after its bold ID, with an estimate, an owner and dependencies, all optional: `**MF-16** (~10 h · A · tras MF-14)`. The owner is `H` (human), `A` (agent) or `H→A` (the human decides, then an agent executes);
  - a **deadline line**, `**Fecha límite:** 2026-10-25`. The deadline moves from 2026-10-22 to 2026-10-25, and the Sprint 4 row of the calendar changes with it.
- A new command, `pnpm roadmap`, reads `context/roadmap.md` and writes one self-contained HTML page to `reports/roadmap.html` (gitignored). The page shows:
  - summary figures: items done out of total, remaining estimated hours (also split by owner), days left until the deadline and the hours per day needed;
  - the pending items that are ready (all their dependencies done), listed together, so the work that can run in parallel is visible;
  - one block per sprint, with a progress bar and its items (ID, status, estimate, owner, dependencies, and what blocks it).
- The estimates, owners and dependencies of the pending items are proposed by Claude and reviewed by the author before they are committed.
- `context/roadmap.md` gets the item MF-39.

Out of scope: burndown over time (there is no history of estimates), real hours spent, editing the roadmap from the page, and any external project-management tool.

## Capabilities

### New Capabilities
- `roadmap-dashboard`: the item metadata and deadline notation in `context/roadmap.md`, and the page generated from it with its figures and ready/blocked items.

### Modified Capabilities
_None._

## Impact

- **Code:** a small TypeScript script under `scripts/roadmap/`, run with `tsx`, with its Vitest tests. The Vitest `unit` project also includes `scripts/**/*.test.ts`. Nothing in `src/` changes, and no dependency is added.
- **Data:** only `context/roadmap.md`, which holds no nutritionist data (SEG-datos-nutricionista). The page is written locally and never committed.
- **Security (safety-first P1, SEG-owasp):** no endpoint, network access or credentials. Abuses considered:
  - text from the roadmap injected into the HTML (A03, injection). All roadmap text is escaped before it is written.
  - malformed metadata (estimate, owner, unknown or cyclic dependencies) or a missing deadline that silently produces wrong figures (A08, data integrity). The command fails and names the line.
- **Decisions relied on:** PROC-sdd, PROC-tdd, OPS-calidad. No decision in `context/decisiones.md` is contradicted. The new deadline is a planning date that lives in `context/roadmap.md`, not a decision.
- **Docs:** `context/roadmap.md` (MF-39, estimates, deadline and calendar), plus the search scope review below in `context/decisiones.md`, `context/producto.md` and `context/roadmap.md`.

## Consequences: search scope review

Putting hours on the pending items showed that the search chain (MF-14 → MF-16 → MF-17 → MF-18) ran in series and carried pieces with a high cost and little weight in the four pillars of PROC-enfoque (`context/producto.md` §1). On 2026-09-30 the author reviewed the search scope and decided:

- **The search shows the top 5 menus**, and the user picks one. It still scores all 36. This replaces the ranking of the 36 with a counter of menus tied at the top (BUS-superficie-consulta (e), UI-planner-buscador, `/planner` in `context/producto.md` §4). Top-k is the usual pattern of a search engine, and the author wants a design that can be reused outside this project.
- **The whole catalog is not placed in the LLM context.** At 36 menus it would fit, but it does not scale and teaches nothing that can be reused.
- **No throwaway spike.** MF-14 becomes production code in the hexagon, run from the CLI (ADR-001 already makes the CLI a primary adapter for evaluation). The spike only existed to be cheap to get wrong; the decomposer golden set (MF-13) now covers most of that risk.
- **The search (MF-14) and the decomposer (new MF-40) are split.** The search takes the typed structure, not text, so it is built and evaluated without an LLM: the input is the expected structure from MF-13, and the output is measured against MF-12. A bad ranking then points at the search, not at a misread request. MF-18 is absorbed into MF-14.
- **Automatic relaxation is deferred as future work** (BUS-descomponedor). Its original design is kept in `context/producto.md` §5. The loop only ran when a `hard` constraint, which is opt-in, emptied the list. With a top 5 and soft scoring by default, the user loosens the chip instead. The estimated saving is ~8–13 h, not measured: the loop, a new blind golden set to evaluate its decisions, and chip messages. The design keeps it addable: `searchMenus` takes the structure and returns how many menus each hard constraint removes.
- **The ingredient → food group table is generated by an LLM without manual curation** (BUS-superficie-consulta (c)). It must not see `evals/retrieval/ingredient-groups.json`, which grades the exclusion queries; otherwise the search would be evaluated against its own answers. The exclusion queries in MF-14 show its quality.
- **Overlapping items are merged and every pending item is re-estimated.** MF-28 (decomposer precision/recall) goes into MF-40, and MF-31 (parser vs. LLM extraction) goes into MF-15, which already produces those figures. MF-16 and MF-17 shrink because MF-14 does the minimal load, and enrichment only enters if MF-14 shows it is needed. Pending hours go from 123.5 h to 110 h. These are estimates, not measurements.
- **Rate limits and authentication shrink.** The per-user search limit is dropped for now: the system is closed, with two accounts, and the global daily LLM cap already covers abuse of the demo account (SEG-rate-limit). Authentication uses Better Auth (new SEG-auth): its defaults already match the session the author wanted (database session, 7-day sliding window, revocable), it disables sign-up, it follows safety-first P8 (no home-made session or hashing), and its login rate limit covers the login level of SEG-rate-limit when its counters are stored in Neon. MF-20 goes from 7 h to 5 h and MF-21 from 4.5 h to 1.5 h. Pending hours end at 105 h.
- **Cost accepted:** under IA-criterio-agente the project goes from two full agents to one, the extractor. The decomposer becomes a pipeline step.
