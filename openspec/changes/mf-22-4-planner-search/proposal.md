## Why

Roadmap item **MF-22.4** (`context/roadmap.md`). MF-22.3 left a web search entry point, `searchByText(request)`, with the daily LLM limit and the failure reports, but nothing calls it: `/planner` still offers only the provisional random button of MF-43. This change lets a signed-in user search from `/planner` and see how the request was understood and which five menus fit best (UI-planner-buscador). Choosing one of them is MF-22.5.

## What Changes

- `/planner` gets the search box of the design system's `PlannerScreen.jsx` mock, with a fixed placeholder, "¿Qué te apetece esta semana?". A server action checks the session and calls `searchByText` of the web container. The request text travels in the body of a POST, never in the URL, and the form works without JavaScript. While the search runs, the page shows a loading state.
- Above the results, one restriction chip per unit of the request, after the design system's `RestrictionChip`. A unit is a single constraint, a `sameDish` group or an `anyOf` group. The chips are for guidance only: they cannot be clicked or removed (BUS-superficie-consulta (e)). Each member of a chip shows its `term` as written, an icon from its polarity (a sparkles icon for an included attribute), a solid or dashed border for hard or soft, and the meal as a suffix. Olive marks include, terracotta exclude, and ochre a chip that mixes both.
- The top 5 as `MenuCandidateCard`s: the rank, "Menú N" and one evidence line per unit, made of the chip's terms and the dish that best covers them ("Martes, comida · …"). There is no title, no explanation (MF-61) and no buttons (choosing is MF-22.5).
- When no menu fits, the page says so.
- One message for each outcome that gives no ranking: a request that is empty or too long, a rejected request, an answer that does not validate, nothing to search, the daily limit reached, and a failure of the system.
- An empty or too-long request is refused before the daily LLM bucket is hit, so it does not spend the limit. Today the hit comes first.
- One Sentry breadcrumb in the browser when a search is sent and one when its answer arrives, with no request text and no terms.
- The random button and its summary stay until MF-22.5 removes them.
- Not in this change: the "Prueba con" suggestions of the mock (if they come back, their texts come from the search golden set, with measured results), the "Añade otra condición…" placeholder (the request does not accumulate), the menu title, the "Ver semana" button, the eyebrow with the number of menus, how many menus tie with the first, and how many menus each hard constraint removes when fewer than five are left (see Impact, "Decisions relied on").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-planner`: new requirements for searching from a request, the restriction chips, the candidate cards, an empty ranking, the search messages and the session check of the search.
- `rate-limiting`: an empty or too-long request is not counted in the daily LLM limit.
- `error-reporting`: the browser breadcrumbs of a search carry no request data.
- `menu-search`: the result gives the units of the request, and the evidence of each menu follows their order, so the web does not group the constraints again.

## Impact

- **Code:** `src/app/(signed-in)/planner/` (the page and a new server action), `src/features/menu-planner/` (the search form, the restriction chips, the candidate cards and the pure functions that turn the `TextSearchDto` into units, evidence lines and messages), `src/application/use-cases/search/search-by-text.ts`, with the length check moved ahead of the hit, and `src/application/dto/search-result.ts` with `src/application/services/search/find-menus.ts`, which add the units to the result. The components are ported from the design system, version `1791991855-da89`. Its tokens were refreshed in commit `f909ba0`, which adds `ochre-300`.
- **Data touched:** the request text of the user, which is never stored, never in the URL and never sent to Sentry, and the names of dishes in the evidence lines. The dish names are allowed by SEG-datos-nutricionista.
- **Abuse:** a server action is a public POST endpoint. Without a session it redirects to `/login` before reading the form. A request with no text, a value that is not text, or a text longer than 300 characters is refused without calling the model, so it costs neither credits nor the daily limit. Extra form fields are ignored. Repeated searches are bounded by the daily limit of MF-22.3. Each term of the decomposer's answer must come from the request, so a prompt injection cannot make a chip show text the user did not write (spec `request-decomposer`). React escapes the terms when it renders them.
- **OWASP:** A01 Broken Access Control (the session check of the action), A03 Injection (the text reaches the model only as data, and the terms are escaped on render), A04 Insecure Design (unbounded consumption: the length check before the hit), and A09 (breadcrumbs without request data).
- **Decisions relied on:** UI-planner-buscador, UI-design-system, BUS-superficie-consulta (e), BUS-descomponedor, SEG-rate-limit, OPS-observabilidad, SEG-datos-nutricionista. Three deviations:
  - SEG-rate-limit says a limit answers `429`. A server action has no status code of its own, so the user gets a message instead.
  - The mock shows chips with × and the placeholder "Añade otra condición…". Both contradict BUS-superficie-consulta (e), and the decision wins over the mock (UI-design-system).
  - BUS-superficie-consulta (b) says that when a hard constraint leaves fewer than five menus, the chip says how many it removes. This change leaves that out: hard constraints are rare (two of the decomposer golden set requests have one), and the author defers it to a later roadmap item, estimated then (decided by the author on 2026-10-14). Until then, the user sees fewer than five cards with no reason given.
