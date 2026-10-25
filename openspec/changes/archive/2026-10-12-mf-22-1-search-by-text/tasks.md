## 1. Use case `searchByText`

- [x] 1.1 Add `TextSearchDto` and `SearchByTextError` to `src/application/dto/search-result.ts` (design D1) and verify `pnpm typecheck` passes
- [x] 1.2 RED: in `src/application/use-cases/search/search-by-text.test.ts`, with a fake decomposer and fake search ports that fail on any call, write the scenarios "Request searched" and "One call to the model", and see them fail
- [x] 1.3 GREEN: implement `searchByText` over `decomposeText` and `findMenus`, and verify 1.2 passes
- [x] 1.4 RED: write the scenarios "Rejected request", "Invalid answer", "Model failure" (the key is not in the reason) and "Request too long". In each, `menus`, `dishText`, `recipeEmbeddings` and `embeddings` fail on any call and count their calls, and the test asserts zero calls: this is the proof that no request reaches Neon (design D5). See the ones that are not yet covered fail
- [x] 1.5 RED: write "Structure with no constraints" (the outcome is `nothing-to-search`, not a rejection, with zero calls to the search ports, as in 1.4) and see it fail
- [x] 1.5b RED: write a test that passes the strategy `lexical` and asserts `findMenus` ranks with it (the result names `lexical`) and the embeddings port is never called. See it fail
- [x] 1.6 GREEN: stop before the search on an empty structure (design D2) and verify 1.4 and 1.5 pass
- [x] 1.7 RED → GREEN: write "Search failure" (an error, no ranking, no connection string), see it fail if it does, make it pass, then refactor so the exported function comes first and its helpers follow in call order

## 2. Shared output lines

- [x] 2.1 Export the ranking lines from `src/cli/commands/search.ts` and the `DecomposeError` lines from `src/cli/commands/decompose.ts` (design D4), and verify `search.test.ts` and `decompose.test.ts` pass unchanged

## 3. Command `search-text`

- [x] 3.1 RED: in `src/cli/commands/search-text.test.ts`, with a fake `searchByText`, write "Run a search from a request" (the JSON structure first, then the ranking, exit 0) and "Strategy option", and see them fail
- [x] 3.2 GREEN: implement `runSearchText` in `src/cli/commands/search-text.ts` and verify 3.1 passes
- [x] 3.3 RED: write "Rejection at the command" (exit 3), "Nothing to search at the command" (exit 3), "Invalid answer at the search-text command", "Request too long at the search-text command" and "Secret in a failure" (exit 1, connection string not printed), and see them fail. These tests check output and exit codes only: the absence of requests to Neon is proved in 1.4 and 1.5 (design D5)
- [x] 3.4 GREEN: map each outcome to its lines and exit code, every line through `redactSecrets`, and verify 3.3 passes
- [x] 3.5 RED: in `src/cli/run-cli.test.ts`, write "No request", "Two requests" and "Unknown strategy at the search-text command" (usage, exit 2), plus a valid `search-text "<request>" --strategy lexical` dispatch, and see them fail
- [x] 3.6 GREEN: parse `search-text <request> [--strategy …]` in `src/cli/run-cli.ts` with the rule of `search` (design D3), add its usage line, and verify 3.5 passes

- [x] 3.7 RED → GREEN: in `src/cli/run-cli.test.ts`, change the default-strategy tests of `search` and `search-text` to expect `semantic` and see them fail; set `DEFAULT_STRATEGY` to `semantic` in `src/cli/run-cli.ts` (design D6), update the runbook line in `context/runbooks/T0-extraccion-previa.md`, and verify the CLI tests pass

## 4. Wiring

- [x] 4.1 RED: in `src/composition/cli-container.test.ts`, write "Without the Gemini key" (with `lexical` and the default) and "Without the database URL": exit 1, the variable is named, its value is never shown, and the decomposer is not built. See them fail
- [x] 4.2 GREEN: add `searchByText` to `src/composition/cli-container.ts` with `requiring(env, [DATABASE_URL, GEMINI_API_KEY], …)` and `withPool` (design D5), wire the command in `src/cli/index.ts`, and verify 4.1 passes

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:coverage`, and verify they pass with the CI thresholds
- [x] 5.2 Run by hand `pnpm ingest search-text "cenas rápidas sin alitas"`, a literal request such as "algo con pollo y arroz", and "asdfgh". Verify the first two print the structure and a top 5 and "asdfgh" exits with code 3. Record what the author sees about the quality of the ranking, without dish names, in the PR description

## Safety review (`context/seguridad/safety-first.md` §4)

- No new endpoint or web entry point: a local CLI command, run by the owner with the credentials of `.env`. Auth, session and authorization items do not apply.
- Validation stays in the core: the length limits and the answer validation of `decomposeText`, and `parseSearchRequest` in `findMenus`, with negative tests for a long request, a rejection, an invalid answer, a model failure and an empty structure. None of them reaches the database or the embedding service.
- Prompt injection: the request reaches the model as delimited data, and any answer that does not validate is refused before the search (spec `request-decomposer`). No text of the model is printed except a validated structure.
- Queries stay parameterised: the search code is reused unchanged, and a term is never read as query syntax (spec `menu-search`).
- Data minimisation: the console prints the structure and the ranking, as `decompose` and `search` already do. Nothing is written to a file or sent to Sentry, and the request text is never stored.
- No secret in the diff: every printed line passes through `redactSecrets`, and the connection string in the tests is a made-up fixture. No new dependency.
- No daily LLM limit in the CLI, as in `decompose`: SEG-rate-limit applies it in the web adapter. No deviation from a MUST rule.
