# Design: A DTO never imports a port (MF-59.4)

## Context

See proposal.md, Why. Current state:

- `eslint.config.mjs` has one temporary block. It lets 6 DTOs import `applicationPart('ports')` (MF-59.1 D4). The ports policy already allows `ports → dto`.
- The 10 imports:
  - `embed-recipes` → `EmbeddingError`, `EmbeddingStoreError`
  - `evaluation-report` → `QueryType`
  - `ingest-menus` → `RepositoryError`, `SourceError`
  - `ingest-recipes` → `LayoutAnomaly`, `SourceError`, `RepositoryError`
  - `ingest-shopping-lists` → `ShoppingListAnomaly`, `SourceError`, `RepositoryError`
  - `migrate` → `MigrationError`
- `src/cli/describe-source-error.ts` already works around the gap: it reads `MenuFailure['error']` because the CLI cannot import ports.
- Every one of these types is a type only. No runtime code moves.

## Goals / Non-Goals

**Goals:**
- `pnpm lint` passes with no temporary exception in `eslint.config.mjs`.
- The CLI output is the same: every kind and field keeps its name.

**Non-Goals:**
- Renaming error kinds or fields.
- Moving files into capability folders (MF-59.3).

## Decisions

### D1. Shape-identical DTO failures, translated by the compiler
Each DTO declares its own failure type, with the same kinds and fields as the port error. The use case returns the port error where the DTO failure is expected, and TypeScript checks that the two are compatible.
- If a port adds a kind, the use case stops compiling. That is where the translation is written.
- The DTO, and with it the CLI, does not change silently.

**Alternative:** an explicit `toFailure` function in each use case. Rejected for now. It copies fields one to one and adds no behaviour. It is written only where the shapes differ, which is the first time a port error changes.

### D2. Shared ingest failures in one DTO file
`SourceFailure` (the 7 kinds of `SourceError`) and `SaveFailure` (`write-failed` with `reason`) are used by three ingest DTOs. They go in `src/application/dto/ingest-failure.ts`.

`describe-source-error.ts` imports `SourceFailure` and drops the `MenuFailure['error']` workaround.

### D3. Domain concepts move, and the ports import them
- `QueryType` is `ConstraintType | 'combined'`: a category of the golden set, used by the metrics in `domain/evaluation/`. `QUERY_TYPES`, the constant it is derived from, moves with it: `evaluate-search` and the file golden-set source read it (found during apply).
- `LayoutAnomaly` and `ShoppingListAnomaly` describe what a document's layout can get wrong. They sit next to `ContentAnomaly`, which already lives in `domain/recipe/`.

The ports (`document-source`, `golden-set-source`) import these types from `domain/` and do not re-export them. Each importer points to `domain/` directly, so there is one path to each type.

### D4. Ports may import DTOs
Decided by the author on 2026-10-12. `request-decomposer`, `golden-set-source` and `session-manager` keep their imports. ADR-001 §3 states it in the MF-59 paragraph. The ports row of the §3 table already allows `dto`.

## Risks / Trade-offs

- **[Trade-off]** The DTO failures repeat the shape of the port errors: 7 kinds for `SourceFailure`, one kind each for the rest. → This is what the rule asks for. The compiler keeps the copies in step.
- **[Risk]** A multi-line import of a moved type is missed. → **Mitigation:** `pnpm typecheck` fails on any importer left behind.
