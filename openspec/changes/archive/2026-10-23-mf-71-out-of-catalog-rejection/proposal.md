# Proposal

Implements **MF-71** of `context/roadmap.md`: piece (1) of «Decir "no hay" cuando lo pedido no está en los menús».

## Why

The search never answers "there is nothing": it rescales the similarity of each term, so the closest dish of the catalog always scores 1 and the card marks it ✓. A request for something the catalog cannot hold, such as a dessert, returns a confident wrong answer ("Pastel de limón" gives "Pastel de verduras"). The menus have only lunches and dinners, with no desserts, breakfasts or drinks, so the decomposer can tell these requests apart before any search, as it already does for gibberish (BUS-descomponedor).

## What Changes

- The decomposer gets a fifth rejection category, `out-of-catalog`: the request only asks for a kind of food the menus do not have (desserts, breakfasts, drinks). A request that also asks for something the menus can have stays a search.
- `/planner` shows its own message for that rejection, which tells the user what the menus hold, instead of the generic "Eso no parece una petición de menús".
- The decomposer golden set gains rejected requests of the new category, generated blind as the first ten were, and trap requests: searches that sound out of the catalog but name dishes that exist ("tostadas de calabaza", "agridulce"). A trap the model rejects counts as a search rejected by mistake.
- `pnpm ingest evaluate-decomposer` reports the new category in its per-category table, and the results are re-run and committed to `evals/decomposer/results.md`.
- `context/decisiones.md` (BUS-descomponedor) lists the fifth category. This updates a recorded decision; the author decided it on 2026-10-18 (`context/roadmap.md`, MF-71).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `request-decomposer`: the rejection categories include `out-of-catalog`.
- `decomposer-golden-set`: the new category, a new origin for trap requests, and the new composition.
- `decomposer-evaluation`: the rejection table includes `out-of-catalog`, and a rejected trap is a search rejected by mistake.
- `menu-planner`: the message for an `out-of-catalog` rejection.

## Impact

- **Code:** the rejection category type and the schemas that list it (decomposer port, golden set source, evaluation), the decomposer prompt, the planner view messages. No new port, no migration, no new dependency.
- **Data:** `evals/decomposer/golden-set.json`, `evals/decomposer/rejected-requests.md`, `evals/decomposer/labelling-guide.md`, `evals/decomposer/results.md`. Trap requests name dishes of the catalog, as the reused retrieval queries already do; nothing of the nutritionist (brand, email, slogan) is written (SEG-datos-nutricionista).
- **Cost:** one evaluation run with Gemini over the larger golden set (IA-proveedor).

### Security (safety-first P1, SEG-owasp)

- **Data touched:** the text of the user's request, which already goes to the decomposer as delimited data (`context/safety-first.md` §2.6). No new stored data.
- **Possible abuses:** a prompt injection that forces the `out-of-catalog` rejection only produces a fixed message: the category is validated against a closed list and no text of the model reaches the page. A false rejection of a valid search is a quality risk, not a security one; the trap requests measure it.
- **OWASP:** A03 Injection (LLM01 prompt injection): unchanged mitigations (delimited data, schema validation, no model text shown). A04 Insecure design: the category set stays closed and validated on the server.
