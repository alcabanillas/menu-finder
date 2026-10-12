# Proposal: Dependency rule between use cases, and cleanup without ports (MF-59.1)

## Why

`src/application/use-cases/` has 22 implementation files, and 12 imports go from one use case to another (9 files). Nothing stops them: ESLint (`eslint.config.mjs` L80-81) lets `application` import `application`, and `eslint-plugin-boundaries` does not check imports inside one element by default. The author decided the rule on 2026-10-11 (`context/roadmap.md`, MF-59): a use case never imports another use case; shared steps with ports become services (`application/services/`); shared code without ports goes to `domain/` or next to its DTO. This change makes the rule verifiable first and removes the 8 imports that need no service. MF-59.2 removes the other 4, and MF-59.3 moves files into folders by capability.

## What Changes

- **ESLint rule (written first, seen failing with 12 errors):**
  - Add the `application/services` kind.
  - Use cases may import ports, DTOs, services, domain and shared, but never another use case.
  - Services may import ports, DTOs, services, domain and shared, but never a use case.
  - `app`, `cli` and `infrastructure` never import services.
  - Enable `import/no-cycle`, with `eslint-plugin-import` as a direct devDependency.
- **Coverage:** remove `src/application/dto/**` from the coverage exclude in `vitest.config.mts`. The DTOs now hold runtime validation, and type-only files add no statements (decided by the author on 2026-10-12).
- **Removal:** delete `active-menu.ts` and its test. It has been dead code since MF-55: it is wired in the `web-container`, but no page calls it.
- **Moves without ports:**
  - `EMBEDDING_VARIANT` → `src/domain/search/embedding-text.ts`.
  - `parseSearchRequest` and its helpers → `src/application/dto/search-request.ts`.
  - `positiveIntegerInput` → `src/application/dto/positive-integer-input.ts`.
- **Single caller:** `week-menu.ts` and `selected-week.ts` move inside `menu-week-page.ts` as helpers.
- **Evaluation metrics:** `ranking-metrics.ts` and `decomposition-score.ts` move from `domain/search/` to `domain/evaluation/`.
- **Temporary exceptions:** the 4 imports left go on a temporary exception list that points to MF-59.2: `select-random-menu` → `selectMenu`, `check-shopping-items` → `currentShoppingSelection`, `evaluate-search` → `searchMenus` and `evaluate-decomposer` → `decomposeRequest`.
- **ADR-001 §3:** add the `application/services` row and the use-case/service rule.
- **No behaviour change:** no route, command, port or stored data changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`): this is a refactor plus tooling, and no requirement changes.

## Impact

- **Code:** `src/application/use-cases/` (search-menus, embed-recipes, decompose-request, evaluate-search, evaluate-decomposer, select-menu, check-shopping-items, menu-week-page, and removal of active-menu, week-menu and selected-week), `src/application/dto/`, `src/domain/search/`, the new `src/domain/evaluation/`, `src/composition/web-container(.test).ts` and `scripts/evaluacion/similarity-floor.ts`.
- **Tooling:** `eslint.config.mjs`, `vitest.config.mts`, and `package.json` with the lockfile (`eslint-plugin-import`).
- **Docs:** `context/adr/ADR-001-arquitectura-interna.md` §3.
- **Data:** none. No user, menu or nutritionist data is read or written. Fixtures stay as they are.
- **Security and OWASP:**
  - A04 Insecure Design: the rule keeps validation (`parseSearchRequest`, `positiveIntegerInput`) on the server, behind the use cases. Moving it must not weaken it: the existing negative tests move with the code and keep running.
  - A01 Broken Access Control: deleting `activeMenu` removes an unused container entry; no access path changes.
  - A06 Vulnerable Components: one new devDependency (`eslint-plugin-import`, already present transitively through `eslint-config-next`). It is not shipped to production.
  - Possible abuse: none new. No endpoint or command changes.
- **Decisions:** ARQ-hexagonal (`context/decisiones.md` §1.1), ADR-001 §2 point 3, §3 and §6, PROC-tdd and PROC-sdd. Nothing here contradicts them; the change carries out the MF-59 decisions in `context/roadmap.md`.
