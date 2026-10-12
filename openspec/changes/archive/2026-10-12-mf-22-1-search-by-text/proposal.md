## Why

MF-22.1 (`context/roadmap.md`, item MF-22). The decomposer (MF-40.2) and the search (MF-11, MF-14) work, but only apart: `ingest decompose` turns a request into a structure, and `ingest search` ranks the menus from a structure file. MF-14 measured the search with the expected structure of the golden set, not with what the model answers, so nobody has seen a request typed by a person reach a top 5. The author wants to see that before investing in the UI of `/planner` (decided by the author on 2026-10-12): if the chain does not rank well, the UI would be built on a search that does not work.

## What Changes

- A use case that takes the text of a request, decomposes it with one call to the model and, when the answer is a structure with constraints, runs the search with it. It returns the structure together with the ranking, so the caller can show both. It reuses the services `decomposeText` and `findMenus` as they are, with no new port.
- A structure with no constraints ("platos para el finde") is a valid decomposition, but the search refuses it. The use case returns it as its own outcome, with no search and no database call.
- The CLI command `pnpm ingest search-text "<request>" [--strategy lexical|semantic|hybrid]`. It prints the structure as JSON, then the ranking in the format of `ingest search`. It needs `GEMINI_API_KEY` and `DATABASE_URL_UNPOOLED`, and uses the same exit codes as `ingest decompose`: 3 for a rejection.
- The default strategy of `ingest search` and `ingest search-text` becomes `semantic`, the best overall in MF-14 (`evals/search/results.md`): `hybrid` scores 0 on attribute and fuzzy requests. `hybrid` stays available with `--strategy` (decided by the author on 2026-10-12).
- No interpretation of the terms ("rápido" as less than 30 minutes) and no policy for an invalid term: both go to MF-22.3, and the chain shows how the search ranks without them. No web, no Sentry.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `menu-search`: adds the search from the text of a request and its command `search-text`, and changes the default strategy of `ingest search` from `hybrid` to `semantic`. The requirements of the structure and the scoring do not change.

`request-decomposer` is used as it is: its requirements do not change.

## Impact

- **Code:** a use case in `src/application/use-cases/search/`, a command in `src/cli/commands/`, and wiring in `src/composition/cli-container.ts`, `src/cli/run-cli.ts` and `src/cli/index.ts`. The lines that print a ranking and a decomposition error are shared with the commands `search` and `decompose`, whose output does not change.
- **Dependencies:** none.
- **Cost:** one call to Gemini per run, plus the embedding of the terms with `semantic` and `hybrid`, run by hand. Cents.
- **Size:** ~1,5 h, as in the roadmap.
- **Decisions it relies on:** BUS-descomponedor, BUS-superficie-consulta, ARQ-hexagonal, SEG-rate-limit, SEG-datos-nutricionista.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* the text the owner types, sent to the Gemini API as in `ingest decompose`; the menus and dishes in the database, read only. The console prints dish names, as `ingest search` already does. Nothing is written to a file or sent to Sentry: the CLI sends nothing to it (MF-40.5).
  - *Abuses:* a prompt injection in the request (A05, LLM01) reaches the model as delimited data, and the decomposer refuses any answer that does not validate before the search sees it. A term is never read as query syntax (spec `menu-search`). Unbounded consumption (LLM10): one call per run, with the 20-second timeout of the adapter. Like `ingest decompose`, the command has no daily LLM limit, which applies in the web adapter (SEG-rate-limit). The key or the connection string in an error (A02): every printed line passes through `redactSecrets`.
  - *Not applicable:* authorization (A01) and the session, because the command is local and run by the owner with the credentials of `.env`.
