# Design

## Context

See `proposal.md` (Why). A failed search reaches the client as `{ status: 'failed', kind, message, attempt }` (`src/features/menu-planner/search-view.ts`), built on the server by `toSearchState`; `PlannerResults` paints it as one `<p role="alert">`, and `PlannerSearch` keeps "Prueba con" above it. The panel of "no menu fits" is `NoMenuFits` in `planner-results.tsx`, after `.mf-plan__empty` of `PlannerScreen.jsx`. The reference of this change is the block `state === 'error'`, `SEARCH_ERRORS` and `ERROR_GROUPS` of `PlannerScreen.jsx`, design system version `1792772980-f821` (v84).

## Goals / Non-Goals

**Goals:** the panel of v83 for the four groups, at 390 px and 1440 px, with the request back in the box from an error.

**Non-Goals:** new messages or outcome kinds; changes on the server; a shared `shared/ui/` panel (only the planner uses it, ADR-001 §2 Scope Rule).

## Decisions

### D1. The group is part of the view, decided on the server

`toSearchState` adds `group: 'request' | 'catalog' | 'failure' | 'limit'` and the `request` as it was sent to the failed state, next to `message`. The group follows the table of spec `menu-planner`, "Search messages", and needs the category of a rejection, which only the server has. Alternative: map `kind` to a group in the component. Rejected: a rejection would need its category on the client just to pick a heading, and the mapping would live in two places.

### D2. One panel component for "no menu" and for an error

`NoMenuFits` becomes the content of a panel that both share (`SearchPanel`, local to `planner-results.tsx`): the sunken box, the heading, the text, the actions. The error panel adds the round icon before the heading and is `role="alert"`; "no menu" stays `role="status"`. The heading, the icon and which actions show come from one table by group, as `ERROR_GROUPS` in the mock.

### D3. The empty request is in the group "request"

The mock has no case for "Escribe qué te apetece."; it is a request to say otherwise, so it takes that group. A request of only spaces is still a last request, so "Editar mi búsqueda" puts the spaces back, as the spec "Editing the last request" says.

### D4. Four Lucide icons inline

`message-circle-question`, `utensils-crossed`, `triangle-alert` and `clock` join `PlannerIcon`, from Lucide 0.468.0 like the rest, at 18 px and stroke 2 as in the mock.

### D5. The padding grows from 800 px, by the container

`px-5 py-[22px]`, and from an 800 px container `px-8 py-7` (`@container (min-width:800px)` of the mock), for both panels.

## Risks / Trade-offs

- [The heading of the empty request does not fit it as well as the others] → it is the group the mock is closest to; the message under it says what to do.
- [Without JavaScript there is no "Editar mi búsqueda"] → as in "no menu fits"; the box still holds what the browser kept.
