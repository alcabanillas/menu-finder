# Design: Use cases in folders by capability (MF-59.3)

## Context

- 18 use cases, each with its test, in `src/application/use-cases/`. No use case imports another one: ESLint forbids it since MF-59.2.
- Every import uses the alias `@/application/use-cases/<name>`. There are no relative imports between these files.
- `eslint.config.mjs` declares `application` per folder of `src/application/*` (capture `kind`). A file in `use-cases/search/` is still in the `use-cases` kind.

## Goals / Non-Goals

**Goals:**
- `use-cases/` has no loose files.
- Each folder name is a domain concept or a capability, never an OpenSpec change (AGENTS.md naming rule).

**Non-Goals:**
- Subdividing `services/`, `dto/` or `ports/`. The roadmap scopes MF-59.3 to `use-cases/`. They hold 4, 17 and 17 non-test files. `dto/` and `ports/` are past the ~15 of ADR-001 §2 point 3. The author decided on 2026-10-12 not to subdivide them: the work left in the plan is not expected to add new DTOs or ports.
- Renaming any use case or export.

## Decisions

### D1. The six folders of the roadmap
The six folders are the ones listed in the proposal and in `context/roadmap.md` (MF-59.3). `migrate` goes in `ingest/` (decided by the author on 2026-10-12): it prepares the database for the ingest, and `cli` cannot import ports, so it stays a use case.

### D2. One scripted move, not parallel tracks
The move is mechanical. A script does it:
- `git mv` for each file and its test
- one replace of `@/application/use-cases/<name>'` with `@/application/use-cases/<folder>/<name>'` across `src/` and `scripts/`

Parallel agents would all edit the same containers.

**Alternative:** a barrel `index.ts` per folder. Rejected. The project imports files directly everywhere, and barrels hide cycles from `import/no-cycle`.

### D3. The ADR threshold applies per folder
ADR-001 §6, "Revisar si", now says: when a capability folder passes about 15 files. The six folders hold 2 to 5 use cases each.

## Risks / Trade-offs

- **[Risk]** An import outside `src/` (e2e, scripts) still points to an old path. → **Mitigation:** `pnpm typecheck` covers `src/` and `scripts/`, and a search for the old paths runs before the commit.
- **[Risk]** The web breaks at runtime even though typecheck passes. → **Mitigation:** `pnpm test:e2e`.
