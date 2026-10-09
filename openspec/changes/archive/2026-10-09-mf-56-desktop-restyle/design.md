## Context

- **Mock:** the design system "Menu Finder Design System" (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF), version `1791414282-6467`, read on 2026-10-08: `project/ui_kits/app/MenuScreen.jsx`, `ShoppingScreen.jsx` and `AppShell.jsx`, and the README's description of the four screens. Its `tokens.json` is identical to `design-system/tokens.json` (checked on 2026-10-08), so the tokens are not refreshed.
- `/menu` (MF-23): `weekly-menu.tsx` renders the header, the mobile view (`@min-[800px]:hidden`) and the desktop view (`hidden @min-[800px]:block`) from the same `WeeklyMenuDto`. The desktop view is `week-table.tsx`, a `role="table"` grid, and `columnsOf(days)` in `columns.ts` picks Monday to Saturday plus Sunday when it has dishes. `recipe-panel.tsx` is a fixed, non-modal dialog whose side comes from the dish's column index (`column < columns.length / 2`) and whose outer edge follows a 1200 px box.
- `/shopping-list` (MF-24): `shopping-checklist.tsx` lays the categories out with CSS columns (`md:columns-2 xl:columns-3`) inside `max-w-5xl`. Each category is a `SectionHeader` plus `CategoryToggle` (a form posting every position of the category, with a `role="checkbox"` button) plus one `ChecklistRow` form per item. All forms post to the same server action, so they work without JavaScript. The view comes from `?vista=por-comprar`.
- The shell (`app-shell.tsx`): sticky header, 64 px tall from 640 px, inside `max-w-[1200px]`; `main` is the size container (`@container`).
- Mock, `/menu` from 800 px of container: `.mf-wk` is a grid of day cards, 2 columns and 3 from 1100 px, 16 px gap; each card has a 1 px hairline border, 12 px radius, `14px 20px 16px` padding; its head is the 24 × 4 px day bar, the weekday (Archivo 800, 19 px), the date "7 de octubre" (13 px, muted) and, on today's card, the "Hoy" tag (aceite-500 on ink, 11 px uppercase), over an ink rule; today's card has an olive-500 border. "Comida" / "Cena" are olive-600 eyebrows; each dish row is 15 px semibold ink, the time "45 min" with a clock icon pushed to the right; a recipe dish is a `button` underlined in olive-600 (2 px) only on hover, focus or while open. A meal with no dishes is skipped; an empty day says "El menú no incluye platos para este día" in muted italic. The panel's side comes from the dish's horizontal centre against the shell's centre.
- Mock, `/shopping-list` from 800 px: the top (progress and the Todo / Por comprar chips) becomes a two-column grid over a hairline; the body is a grid `260px | 1fr` with a 48 px gap; the left is a sticky `nav` "Categorías" whose rows hold the tri-state box (a `role="checkbox"` button), the category name as a button that scrolls to it, and the count `done/total`; the right shows each category headed by its name and count, without the "Marcar todos" row, with its items in 2 columns from 1100 px (40 px column gap).
- Mock, shell: `.mf-top__in` and `.mf-page--wide` are both at most 1440 px with 32 px gutters from 640 px.

## Goals / Non-Goals

**Goals:**
- The desktop views of `MenuScreen.jsx` and `ShoppingScreen.jsx` from an 800 px container, and the 1440 px box of the shell's header and of both pages.
- Everything still rendered on the server and usable without JavaScript.

**Non-Goals:**
- Any change below 800 px, to the use cases, the DTOs, the pages in `app/`, or the server action.
- The navigation badge (MF-54), `/planner` and `/`.

## Decisions

### D1. The week as day cards: `week-cards.tsx` replaces `week-table.tsx`
A `section` per day, labelled by its weekday heading (`h2`, "Miércoles"), with the date (`formatShortDate`, "7 de octubre") and, on today's card, the tag "Hoy" in text. The days are those of today's `columnsOf`, which becomes `daysShown(days)` in `days-shown.ts`, since there are no columns any more; its rule does not change. The grid is `grid-cols-2 @min-[1100px]:grid-cols-3`. Each meal with dishes is an eyebrow ("Comida", "Cena") and its rows; a meal with none renders nothing; a day with neither says the empty-day sentence, as the mobile view does. A dish with a recipe is a `button` with `aria-haspopup="dialog"` and `aria-expanded`, and its total time (`45 min`, and the clock icon of `menu-icon.tsx`) beside it; a dish without one is a `span`. As the table did, the component holds no state: it receives the open dish and calls `onOpen(dish, trigger)`. The table's dashes, its chef-hat mark and `formatColumnDate` go, with their tests. `DishRef` moves with the component.

Alternative rejected: keeping the table and widening it. The author tried a grey background with the table in a card and it did not convince (`context/roadmap.md`, MF-56); the mock is the decision.

### D2. The panel's side from the dish's position
With 2 or 3 cards per row, a day's column depends on the width, so the column index no longer says where the dish is. `weekly-menu.tsx`, in `openDish`, compares the centre of the dish's button (`getBoundingClientRect`) with the centre of the viewport (`document.documentElement.clientWidth / 2`): right half → panel on the left, left half → panel on the right. The page box is centred in the viewport, so its centre and the viewport's are the same. The side is kept with the open dish, so it does not jump on a re-render. The mock measures against the shell's box; the viewport is the same here and needs no reference to the shell. Component tests stub `getBoundingClientRect` and `clientWidth`.

### D3. One 1440 px box
`app-shell.tsx`'s header box goes from `max-w-[1200px]` to `max-w-[1440px]`; `weekly-menu.tsx`'s page from `@min-[800px]:max-w-[1200px]` to `@min-[800px]:max-w-[1440px]`; `recipe-panel.tsx`'s outer edge from `(100vw - 1200px) / 2` to `(100vw - 1440px) / 2`; `shopping-checklist.tsx` from `max-w-5xl px-5` to `max-w-[1440px] px-gutter-mobile @min-[640px]:px-8`, as the mock's `.mf-shop`. The value is written in those four places, each with a comment naming the mock's `.mf-page--wide`. Alternative rejected: a theme variable for it. The theme is generated from `design-system/tokens.json` (UI-design-system), which has no such token; adding one by hand would be overwritten by `pnpm ds:tokens`.

### D4. The category index: `category-index.tsx`
A `nav` labelled "Categorías", `hidden @min-[800px]:block`, `sticky top-20` (below the 64 px header), with one row per category of the current view: the tick form, a link and the count. The tick form is `CategoryToggle`'s: its hidden fields (`menuNumber`, every `position`, `checked`) move into a small `CategoryTickForm` shared by both, so the index posts exactly what the "Marcar todos" row posts, to the same action, with the same optimistic tick. In the index the button shows only the box, keeps the label "Marcar todos: <category>" and the `aria-checked` state; the visible count sits beside the link. The link is `<a href="#categoria-N">` with the category's full name; N is the category's position in the whole list (1-based), so it does not change with the view and carries none of the category's text. The `section` of each category gets that `id` and `scroll-mt-20`, so the sticky header does not cover it. A plain anchor works without JavaScript; the mock's `scrollIntoView({ behavior: 'smooth' })` is left out (no motion the user did not ask for).

The index lists the categories the list shows in the current view (`withPendingItems` already decides them), so in "Por comprar" a category with every item ticked leaves both the list and the index. The mock lists every category in both views; a link to a category that is not on the page would lead nowhere.

### D5. The list beside the index
At 800 px the checklist's body becomes `grid-cols-[260px_minmax(0,1fr)] gap-12 items-start`; the CSS columns go. Each category's `SectionHeader` takes an optional `count` ("1/2"), shown from 800 px; its "Marcar todos" row is wrapped in `@min-[800px]:hidden`, so at any width one tick-every-item control per category is exposed (the hidden one is `display: none`, out of the accessibility tree). From 1100 px the items of a category are `grid-cols-2 gap-x-10`. The top (progress and filter) gets a hairline under it from 800 px. Below 800 px the page is as it is now.

### D6. Deviation from the mock: full category names in the index
The mock shortens the names in the index (`shortCat` drops ", y derivados" and " (no lácteas)"). The design system's README says category names come verbatim from the PDF and are never rewritten, and the spec of MF-24 shows them as the list has them. The index uses the full name and lets it wrap. Raised with the author as a contradiction inside the design system.

### D7. Ported files and their version
`week-cards.tsx`, `category-index.tsx` and the changed parts of `shopping-checklist.tsx`, `recipe-panel.tsx` and `app-shell.tsx` note that they follow version `1791414282-6467`.

### D8. End-to-end tests
`e2e/menu.spec.ts`: the desktop `describe` (1280 × 800, fictitious menu 9002) checks the day cards instead of the table (seven cards, today's says "Hoy", a recipe dish opens the dialog, Escape returns the focus), and the no-JavaScript test checks the cards. `e2e/shopping-list.spec.ts` gains a desktop `describe` (1280 × 800): the index with its counts, ticking a category from the index, one tick-every-item control per category, following a link, and ticking from the index without JavaScript. The narrow tests stay at their viewport and add the scenario "No index on a narrow screen". The side of the panel, Sunday left out, empty meals and days, and the index in "Por comprar" are covered by component tests, where the data can be shaped freely.

## Risks / Trade-offs

- [The dish names and the category controls appear twice in the HTML, once per width] → as in MF-23.2: the hidden copy is `display: none`, out of the accessibility tree; a few hundred bytes more.
- [Component tests in jsdom see both copies of a control] → tests scope their queries to the `nav` "Categorías" or to a category's `section`; "one control per category" is asserted in the e2e test, where CSS applies.
- [`clientWidth / 2` assumes the page box is centred] → true for both pages from 800 px (`mx-auto`); a page that is not centred would place the panel by the viewport, still on the side away from the dish.
- [A long index on a short screen] → the sticky `nav` gets `max-h-[calc(100dvh-6rem)] overflow-y-auto`, so the 13 categories of the PDF stay reachable.
- [The 1440 px value is repeated in four files] → accepted (D3); each says where it comes from.
