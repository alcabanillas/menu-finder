# Proposal

Implements **MF-79** of `context/roadmap.md`: the search errors of `/planner` at version v83 of the design system (row v83 of `project/implementacion.md`, design system version `1792772980-f821`, v84).

## Why

When a search gives no ranking, `/planner` shows one line of terracotta text under "Prueba con". It is easy to miss, and it looks nothing like the panel of a search with no menu ("Ningún menú encaja con lo que has pedido"), so the two answers of a search that found nothing do not read as the same thing. MF-71 made it visible: a request for a dessert now gets a rejection, and its message was lost under the suggestions.

## What Changes

- A search error is shown in the same panel as "no menu fits", with a round icon and a heading for its group, the message of the server unchanged, and the actions of the group:
  - rejected, not understood or too long: "Hay que decirlo de otra forma", "Editar mi búsqueda", the tip and the suggestions;
  - out of the catalog: "Eso no está en los menús", "Editar mi búsqueda" and the suggestions;
  - a failure of the system: "Algo ha fallado", only "Editar mi búsqueda";
  - the daily limit: "Has llegado al límite de hoy", no action, with a grey icon.
- With an error, "Prueba con" is no longer shown above, and neither is the strip "Lo que has pedido". The panel is an alert labelled by its heading.
- "Editar mi búsqueda" works from an error too: it puts back the text exactly as the user wrote it.
- The padding of both panels grows only from 800 px.
- `design-system/VERSION` goes to `1792772980-f821` (v84); `tokens.json` does not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-planner`: "Search messages" (the error panel), "Suggestions to try" (the row goes after a failed search) and "Editing the last request" (also from the error panel).

## Impact

- **Code:** `src/features/menu-planner/` only: the view of a failed search gets its group and its request, the results show the panel, and the icon set gets four Lucide icons. No server, use case or port changes; the messages and the outcome kinds stay as they are.
- **Design system:** UI-design-system, row v83. Current tokens (`terracotta-50`, `terracotta-300`, `terracotta-600`), none new.

### Security (safety-first P1, SEG-owasp)

- **Data touched:** the text of the user's own request, which already comes back in the state of the page to fill the box; it is shown only in the box, never in the panel, and never reaches a log or Sentry (the breadcrumbs keep the outcome kind only).
- **Possible abuses:** none new. The heading comes from a fixed table by outcome; no text of the model is shown.
- **OWASP:** A03 Injection: the request is put back as the value of the input, never as HTML, as with "no menu fits".
