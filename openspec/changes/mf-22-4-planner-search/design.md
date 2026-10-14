## Context

See proposal.md, "Why". MF-22.3 left `webContainer().searchByText(request)`, which returns `Result<TextSearchDto, DailyLimitedSearchError>`. `TextSearchDto.structure` holds the constraints, `sameDish` and `anyOf` of the decomposer's answer. `result.menus` holds the top 5, each with one `evidence` item per unit of the request: the ids of its constraints and the dish that gave its best score, or `null`. The use case records the daily hit before it checks the length of the request, so today an empty request spends the limit (`limitedSearch` in `src/application/use-cases/search/search-by-text.ts`).

`/planner` is the page of MF-43: `SelectionSummary` and `RandomMenuForm` (`src/features/menu-planner/components/`), whose server action already follows the pattern this change reuses: `requireUser()` first, then the container, then a state for `useActionState`.

Visual source: the design system "Menu Finder Design System" (<https://claude.ai/code/artifact/2b9c8f4b-b06b-4b2d-a22a-221b23edc61a>):

- `ui_kits/app/PlannerScreen.jsx` and `ui_kits/app/RestrictionChip.jsx`, version `1791992191-0fd0`.
- `components/forms/SearchBox.jsx` and `components/recipe/MenuCandidateCard.jsx`, the same version.
- The tokens of version `1791991855-da89`, in the repository since commit `f909ba0`.

## Goals / Non-Goals

**Goals:**

- The search, the chips, the cards and the messages of the spec `menu-planner`.
- Pure functions for every rule of the screen, tested on their own, so that the components only render.
- The length check of a request ahead of the daily hit, in one place.

**Non-Goals:**

- Choosing a menu, and removing the random button and `select-random-menu`: MF-22.5.
- The temporary button that checks the stack trace in Sentry: MF-22.6.
- How many menus each hard constraint removes (`result.removedBy`, BUS-superficie-consulta (b)): deferred by the author (proposal, Impact).
- The E2E of the search and of the weekly flow: MF-22.7. No E2E can search today without calling Gemini.
- Moving `SearchBox`, `RestrictionChip` or `MenuCandidateCard` to `shared/ui/`: only `menu-planner` uses them (Scope Rule, ADR-001 §2).

## Decisions

### D1. The action returns a view of the search, built on the server

The server action turns the `Result` into a `PlannerSearchState`, a discriminated union:

- `{ status: 'idle' }`: the initial state, before any search. Nothing is shown under the box.
- `{ status: 'ranking', chips, cards, attempt }`: a search that gave a ranking, maybe empty ("No menu fits").
- `{ status: 'failed', kind, message, attempt }`: a search that gave no ranking. `kind` keeps the outcome (`llm-limit-reached`, `decomposer-failed`…), so the breadcrumb of D8 reports it without reading the message. `message` is the Spanish text of the spec `menu-planner`, "Search messages".

`attempt` counts the answers, as in `RandomMenuState`: it gives each answer a new element, so a repeated message is announced again, and it tells the breadcrumb that a new answer arrived. Nothing depends on `attempt === 0`: the `idle` status says there was no search. The state is built by pure functions in `src/features/menu-planner/search-view.ts`, which the action imports. The app may import a feature (ADR-001 §3).

*Alternative:* return the `TextSearchDto` and let the client build the view. This was rejected because the DTO carries the whole ranking with its scores (`ranked`, up to 36 menus) and the strategy, which the browser does not need. It would also put the rules of the screen in a client component, where they are harder to test without rendering.

### D2. The length check moves ahead of the daily hit

`decomposeText` checks that a request is neither empty nor longer than `MAX_REQUEST_LENGTH` (300). That check is extracted into a function of the same service, `checkRequestLength`, which `decomposeText` keeps calling. `limitedSearch` calls it before `rateLimiter.hit`. The outcomes stay the same (`request-too-short`, `request-too-long`), so the action only maps them to messages.

*Alternative:* check the length in the server action. This was rejected because it would copy the limit of 300 into the web adapter, and because the rule protects the daily limit, which is application logic (SEG-rate-limit, ADR-001 §3).

### D3. The units come from the search, not from the UI

The domain already groups the constraints into units (`toUnits` in `src/domain/search/constraint-unit.ts`), and `find-menus.ts` builds the evidence of each menu in that order. But `SearchResultDto` does not expose the units, so the order is not a contract, and the UI would have to group the constraints again. `SearchResultDto` gets `units: { kind: 'constraint' | 'sameDish' | 'anyOf'; constraints: string[] }[]`, built from the same `Unit[]` that scores the menus. The `evidence` of every menu is aligned with it by index (spec `menu-search`, "Top five and ties").

`toChips(structure, units)` only looks up each id in `structure.constraints` to get its `term`, `polarity`, `type`, `hard` and `slot`. It does not group anything. The chip keeps the domain's `kind` names. The design system's `single` is the domain's `constraint`, and its `kind` of a member is the DTO's `type`.

*Alternative:* group the constraints again in the feature, which cannot import `domain/` (ADR-001 §3). This was rejected because it would copy a rule the search already applied, and the evidence would have to be matched to the chips by ids, on an order nothing promises.

### D4. Evidence lines, by index

If a unit names an id the structure does not have, or a menu does not have one evidence item per unit, the alignment is broken. `toSearchState` then returns the `failed` state of `search-failed` instead of throwing, so the user gets the message of a system failure and not an error page. The search guarantees the alignment (spec `menu-search`); this only keeps a broken promise from reaching the screen.

Each line gets a text for screen readers built by the same function as the chip's (`describeChip` in `search-view.ts`), followed by its detail, and its visible terms are hidden from them: the separators and the colours carry meaning a screen reader would lose. An excluded term also carries a minus, so the polarity is not told by colour alone (WCAG 1.4.1). `DishDto` names its day and meal with the types of the menu (`DayDto`, `lunch` or `dinner`), so the labels of the feature are checked by the compiler.

For each card, `toEvidenceLines(chips, evidence)` pairs `evidence[i]` with `chips[i]`. A unit with no dish gives "no aparece en la semana" with a check when all its members are `exclude`, and "ningún plato" with a cross otherwise (spec `menu-planner`, "Candidate cards with evidence"). Day and meal labels ("Martes", "comida") come from a map local to the feature. `weekly-menu` has the meal labels, but it is another feature (Scope Rule).

### D5. Components ported, not imported

As UI-design-system decides, the components are ported to TypeScript and Tailwind, and each one notes the design system version it comes from:

- **`SearchBox`:** the form of the server action, with `name="request"`, `required` and the "Buscar" submit button. `required` lets the browser refuse an empty box before any event, with or without JavaScript, so no client code repeats the server's check. A request of only spaces still reaches the server, which answers "Escribe qué te apetece." (D2). The box has no `maxLength`: the browser counts UTF-16 units where the server counts characters, and it cuts pasted text without a word, so the user would search a request they did not write and never see the "too long" message.
- **`RestrictionChipList` and `RestrictionChip`:** the rules of `RestrictionChip.jsx`, with the colours as Tailwind classes of the tokens. The mixed chip uses `bg-ochre-100`, `text-ochre-700` and `border-ochre-300`; no colour is written by hand.
- **`MenuCandidateCard`:** only the rank, "Menú N" and the evidence lines. The design system still colours the evidence of an `attribute` in `ochre-700`. The author decided `olive-600`, the colour of `include`, because the ochre is kept for mixes. The app follows the author, and the design system's card is updated apart.

The icons (`plus`, `minus`, `sparkles`, `check`, `x`, `search`, `arrow-up`) are inline Lucide paths in a feature icon component, as in `weekly-menu/components/menu-icon.tsx`.

### D6. The page

The page renders a client component, `PlannerSearch`, with the action as a prop. It holds `useActionState`, the `SearchBox`, the loading status and the results. The layout of `PlannerScreen.jsx` is a single column on a phone. From an 800 px container with results, the box and the chips go in a 300 px column on the left, and the cards go on the right. `SelectionSummary` and `RandomMenuForm` stay below the search until MF-22.5. The placeholder is always "¿Qué te apetece esta semana?". The mock's second placeholder, "Añade otra condición…", is not used: it contradicts BUS-superficie-consulta (e), which wins over the mock (UI-design-system).

### D7. Without JavaScript

The form posts to the server action through `useActionState`. As with `RandomMenuForm`, React renders the returned state on the page that comes back when there is no JavaScript. The text goes in the body of the POST, never in a query string, so no URL holds it and Sentry cannot record it (MF-22.2 design D1).

### D8. Breadcrumbs in the browser

`PlannerSearch` calls `Sentry.addBreadcrumb` from `@sentry/nextjs`:

- when the form is sent: category `planner`, message `search sent`, no data;
- when a new `attempt` arrives: category `planner`, message `search answered`, with `outcome` (`ranking` or the `kind` of a `failed` state), `chips` and `menus`, which are counts.

Neither carries a term, a dish or the text. A feature may import an external library (ADR-001 §3, `eslint.config.mjs`).

*Alternative:* a breadcrumb in the server action. This was rejected because a breadcrumb on the server only reaches an event of the same request, and the failure events of that request (MF-22.3) already say what failed. The trail matters for a later error in the browser.

### D9. A message instead of `429`

SEG-rate-limit says a limit answers `429`. The search is a server action whose response React handles, so a status code would reach no one. The user gets the message of `llm-limit-reached`, and Sentry gets the warning of MF-22.3. The decision is not changed: an HTTP endpoint would still answer `429`.

### D10. Visual check against the mock

In `verify`, local `pnpm dev` with a real `GEMINI_API_KEY`, screenshots at phone and desktop widths of the golden set requests L01, A03, E02, C05, R01 and A01 (`evals/decomposer/golden-set.json`). The decomposer is a model, so a run may give another structure than the golden set's: the screenshot is then of what it gave, and the difference is noted.

## Risks / Trade-offs

- [The search takes seconds (p95 of the decomposer 6 s, `evals/decomposer/results.md`)] → The loading state. Whether it is enough is decided once it can be seen (MF-22, `context/roadmap.md`).
- [Without JavaScript there is no loading state] → The browser shows its own loading. The spec asks for the loading state only with JavaScript.
- [The design system's `MenuCandidateCard` and the app differ in the colour of an attribute] → D6 records it, and the author updates the design system.
- [Six real searches in `verify` spend six hits of the daily limit and a few cents of Gemini] → Accepted: six hits of the bucket of the database the local run uses, well under the default of 100.
- [A model answer with a term not in the request is refused whole (spec `request-decomposer`)] → The user sees "No he sabido entender la petición…". Searching without the invalid term is future work (MF-22, `context/roadmap.md`).

## Migration Plan

No migration and no new variable: `GEMINI_API_KEY` and `LLM_DAILY_LIMIT` came with MF-22.3, and `GEMINI_API_KEY` must be set in Vercel production before the release that ships this change. Rollback is a revert: the random button never left.
