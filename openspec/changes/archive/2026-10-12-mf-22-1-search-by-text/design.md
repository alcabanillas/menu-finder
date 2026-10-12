## Context

The two halves already exist as services (ADR-001, MF-59): `decomposeText` (`src/application/services/search/decompose-text.ts`) returns `Result<Required<SearchRequestDto>, DecomposeError>`, and `findMenus` (`src/application/services/search/find-menus.ts`) takes a `SearchRequestDto` and returns `Result<SearchResultDto, SearchMenusError>`. The output type of the first is the input type of the second. The use cases `decomposeRequest` and `searchMenus` only delegate to them, and ADR-001 forbids a use case from calling another use case.

The CLI already has `search <structure.json> [--strategy …]` and `decompose "<request>"`. The container checks the variables with `requiring` before it builds any adapter, and opens a `pg.Pool` with `withPool`. The pool does not connect until its first query.

## Goals / Non-Goals

**Goals:**
- One use case that the CLI calls now and the server action of `/planner` will call in MF-22.4, so the chain is written once.
- The output of `search` and `decompose` stays exactly as it is.

**Non-Goals:**
- An automated test against the real Gemini API. The run by hand is the **Resultado** of the roadmap.
- Measuring the chain with nDCG on the golden set: that is close to the ablation of MF-30.
- Timing the steps. The latency of the decomposer is already measured in `evals/decomposer/results.md`.

## Decisions

### D1. A use case `searchByText` over the two services

`src/application/use-cases/search/search-by-text.ts` calls `decomposeText`, checks the structure has constraints, and then calls `findMenus` with it. It calls services only, never the use cases `decomposeRequest` or `searchMenus` (ADR-001, "Casos de uso y services"). Its signature is `searchByText(request, strategy, deps)`, and its deps are `DecomposeTextDeps & FindMenusDeps`.

The strategy is not chosen by the use case: it comes down as a parameter, as in `search`. `run-cli.ts` reads `--strategy` (default `hybrid`), then the container passes it on, then `searchByText`, and finally `findMenus(structure, strategy, deps)`. The decomposer does not depend on the strategy. It returns `Result<TextSearchDto, SearchByTextError>`, where `TextSearchDto = { structure, result }` and `SearchByTextError = DecomposeError | { kind: 'nothing-to-search' } | SearchMenusError`. The types go in `src/application/dto/search-result.ts`, next to `SearchResultDto`.

No new port: the decomposer and the search ports are reused as they are (AGENTS.md, "reuse a port before creating one").

*Alternative:* the CLI command calls `decomposeRequest` and then `searchMenus`. This was rejected because chaining them and deciding what an empty structure means is application logic, and the web would have to repeat it in MF-22.4.

### D2. An empty structure is its own outcome, `nothing-to-search`

`decomposeText` accepts a structure with no constraints (spec `request-decomposer`), and `parseSearchRequest` refuses it ("no constraint"). Passing it on would turn a valid decomposition into an `invalid-request` error that names a field the user never wrote. The use case stops before the search instead. The CLI exits with code 3, like a rejection: both are valid outcomes in which there is nothing to rank.

### D3. A new command `search-text`, not an option of `search`

`cli/commands/search-text.ts` is the command `search-text`, so the file and the command share a name (AGENTS.md, "name by domain concept"). It takes `<request> [--strategy lexical|semantic|hybrid]`, and `run-cli.ts` parses the option with the same rule as `search`.

*Alternative:* `search --text "<request>"`, or detecting a `.json` path. This was rejected because one command with two kinds of input needs a parsing rule to tell them apart, and its usage and error messages get harder to read.

### D4. Shared output lines, exported from the existing commands

`search.ts` exports the lines of a ranking and `decompose.ts` exports the lines of a `DecomposeError`. `search-text.ts` imports both and adds only the line of `nothing-to-search` and the JSON of the structure. Both commands keep their output, and their tests stay as they are.

*Alternative:* a new shared module `cli/commands/search-lines.ts`. This is not needed for two callers. It can be extracted if a third command appears.

### D5. Both variables checked first, then the decomposer, then the pool

In the container, `searchByText` calls `requiring(env, [DATABASE_URL, GEMINI_API_KEY], …)`: a missing variable stops the command before the model is called. The embeddings adapter is always built, because the decomposer needs the key anyway. With `--strategy lexical`, `findMenus` does not call it (spec `menu-search`). The pool is opened with `withPool`, and the use case only touches it after a structure with constraints.

**No request reaches Neon unless the search runs.** The guarantee holds at two levels:

- **The use case:** every outcome of the decomposer other than a structure with constraints returns before `findMenus`. The tests of tasks 1.4 and 1.5 prove it with search ports that fail on any call, so a query after a rejection breaks the test.
- **The container:** `withPool` creates the `pg.Pool` before the use case runs, but `pg` opens no connection until the first query, and `pool.end()` with no clients sends nothing. This is a behaviour of `pg`, not code of ours, so it is not tested. The command tests (task 3.3) use a fake `searchByText` and cannot prove it.

*Alternative:* create the pool only after the decomposition, with lazy search deps. This was rejected because it moves the decision of when to search into the container, which must stay thin. The laziness of `pg` already gives the same guarantee.

### D6. `semantic` is the default strategy of `search` and `search-text`

Both commands share one default in `run-cli.ts`. It changes from `hybrid` to `semantic`, the best strategy overall in MF-14 (`evals/search/results.md`): nDCG@5 0.64 against 0.45, and hit@5 0.85 against 0.53. With `hybrid`, attribute and fuzzy requests score 0, because a dish with no lexical match never reaches the hybrid threshold of 0.75. "cenas rápidas sin alitas" would then rank nothing, and the manual run would blame the search for the strategy. Decided by the author on 2026-10-12.

`hybrid` stays available with `--strategy` and is better on exclusions (nDCG@5 0.64 against 0.33). `evaluate-search` runs the three strategies explicitly and does not depend on the default.

*Alternative:* `semantic` for `search-text` only. This was rejected because nothing depends on the `hybrid` default of `search`, and two defaults for one search would be harder to explain.

## Risks / Trade-offs

- [The ranking is poor for attribute terms such as "rápidas", because they are matched as text and by embedding until MF-22.3 interprets them] → This is expected and is part of what the author wants to see. The run should include requests with literal terms as well as attribute terms.
- [A real run can last up to 20 s plus the search, because of the p95 of 6 s and the timeout of the decomposer] → This is acceptable for a command run by hand. What the web shows while it waits is decided in MF-22.4.
- [A request that starts with `--` is read as an option and gives the usage] → Accepted for a local command. Quoting the request does not change it.
