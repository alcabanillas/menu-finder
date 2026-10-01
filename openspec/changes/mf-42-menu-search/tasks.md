## 1. Checks before coding

- [ ] 1.1 The author reviews the decisions D4 and D6 of `design.md` (full-text search, scoring) and confirms or changes them; verify: the confirmation is in the chat and `design.md` is updated if anything changed
- [ ] 1.2 On a temporary Neon branch (created with an expiry), run `CREATE EXTENSION unaccent` and a `to_tsvector('spanish', unaccent('Salmón'))` query; verify: both succeed, and the branch is deleted afterwards

## 2. Domain: scoring (tests first, each seen failing before its code)

- [ ] 2.1 Write the tests of the request structure rules of `menu-search` (blank, long and unknown-key terms, 13 constraints, unknown and repeated group ids, polarity rules, zero constraints) against the Zod schema in `application/dto/search-request`; verify: they fail, then pass once the schema exists
- [ ] 2.2 Write the tests of the term scores: semantic rescaling (0.4, 0.6, 0.8 give 0, 0.5, 1), a constant-similarity term, hybrid mean (1 and 0.5 give 0.75); verify: they fail, then pass with `domain/search/term-score`
- [ ] 2.3 Write the tests of the unit and menu scores: ungrouped constraints, `sameDish` (same dish and different dishes), exclusion inside a group, `anyOf`, week-wide exclusion (`1/(1+n)`, 0.25 for three), slot, uncovered constraint (0.5); verify: they fail, then pass with `domain/search/score-menu`
- [ ] 2.4 Write the tests of hard constraints: the menus a constraint removes on its own (31 of 36), an empty ranking (36), two hard constraints counted separately and applied together, a hard member in a group; verify: they fail, then pass with `domain/search/hard-constraints`
- [ ] 2.5 Write the tests of the ranking: five of twelve, order by score then menu number, tie count, fewer than five, evidence dish per unit, six-decimal comparison; verify: they fail, then pass with `domain/search/rank-menus`
- [ ] 2.6 Run `pnpm test:coverage`; verify: `domain/search/` and the new DTOs are at 100 %

## 3. Application: use case with fake ports (tests first)

- [ ] 3.1 Write the `searchMenus` tests: rejected structure makes no port call, each strategy uses the right port calls, `lexical` works when the embedding fake always fails, a term repeated in two constraints is embedded once, no embeddings gives the "load first" error, port failure gives an error with no ranking, the same search twice gives equal results; verify: they fail, then pass with `use-cases/search-menus`

## 4. Infrastructure

- [ ] 4.1 Write the migration and `SearchIndex` adapter tests on the temporary branch: the new migration applies on top of `001-search-schema.sql`, whole-word and accent rules (`salmón` / `salmonete` / `SALMON`, `garbanzo` / `garbanzos`), several words in the same dish text, a hostile term (`& | ! ' ; --`, emoji, combining accent, 90-character word) neither fails nor changes the data, `similarities` order by cosine, `catalog` has 14 meals per menu; verify: they fail, then pass with `infrastructure/postgres/` (parameterised queries only)
- [ ] 4.2 Extend the Genkit `EmbeddingsPort` adapter test with the query task prefix; verify: it fails, then passes

## 5. CLI and composition

- [ ] 5.1 Write the CLI tests with a fake container for `search`: extra arguments give the usage and exit 2, a missing file, non-JSON or invalid structure exits 1 naming file and field, an unknown `--strategy` exits 2, a valid search prints the top five, the tie count and the removed-menus counts; verify: they fail, then pass with `cli/commands/search` and `run-cli`
- [ ] 5.2 Wire the adapters in `composition/cli-container.ts`; verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 6. Run it for real

- [ ] 6.1 Run `pnpm ingest migrate`; verify: it applies the new migration only
- [ ] 6.2 Run `pnpm ingest search` with the structure of three golden requests (a literal one, a `sameDish` one and one with `hard: true` set by hand, because no golden request has a hard constraint) and `--strategy` each of the three; verify: the output is a top five, a tie count and the removed-menus counts, and a hostile term in the file does not change the database

## 7. Close

- [ ] 7.1 Update `context/decisiones.md` (D4 and D6 once confirmed in 1.1; IA-criterio-agente if it changes), `context/roadmap.md` (MF-42 done, with the archive link) and `context/tareas/T0-extraccion-previa.md` (the `search` command); verify: `grep` of the task and decision codes and a read of the changed lines
- [ ] 7.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
