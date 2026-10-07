## Context

- MF-23.1 left `/menu` with its data complete: `WeeklyMenuDto` has the seven days with their dates, `today`, and each dish with its recipe or `null`. The page (`src/app/(app)/menu/page.tsx`) and everything behind it stay as they are.
- `src/features/weekly-menu/` has `weekly-menu.tsx` (client: header, `DayTabs`, the day panel), `recipe-card.tsx` (whose private `RecipeBody` draws times, ingredients and steps), `day-tabs.tsx`, `menu-icon.tsx`, `empty-menu.tsx` and `format-date.ts`. The page wrapper is `max-w-[var(--spacing-content-max)]` (440 px).
- The shell's `main` is already a size container (`@container` in `app-shell.tsx`), and `sign-in-screen.tsx` already switches layouts with `@min-[640px]:`. The shell header is sticky, 64 px tall from 640 px (`sm:h-16`), inside a 1200 px wide box.
- **Mock:** `project/ui_kits/app/MenuScreen.jsx` of the design system "Menu Finder Design System" (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF), version `1791390572-4ab7`, newer than the `1791384225-1eab` MF-23.1 ported from. Its `tokens.json` is identical to `design-system/tokens.json` (checked on 2026-10-07). From an 800 px container: `.mf-wk`, a `role="table"` grid (`72px` label column plus one per day, Sunday only with dishes), today's column in `gray-100` with "· hoy" in its header, a dash for a meal with no dishes, dishes with a recipe as `button`s with `aria-haspopup="dialog"` and `aria-expanded`; and `RecipePanel`, an `aside role="dialog"` 360 px wide over the side of the grid opposite the dish, which focuses its close button, closes on Escape or the X ("Cerrar receta") and gives the focus back to the dish.

## Goals / Non-Goals

**Goals:**
- The desktop view of the mock from an 800 px container, with the mobile view of MF-23.1 below it.
- Both views in the server-rendered HTML, so the table needs no JavaScript to show the week.

**Non-Goals:**
- Any change to the use case, the DTO or the page.
- A modal dialog that blocks the grid (D3).

## Decisions

### D1. Both views rendered, the container width chooses
`weekly-menu.tsx` renders the header once, then the mobile view (the sticky `DayTabs` and the day panel) with `@min-[800px]:hidden`, and the week table with `hidden @min-[800px]:grid`. The width is the content's (`main` is the container), as in the mock's `@container (min-width:800px)` and in `sign-in-screen.tsx`. The page wrapper widens from 440 px to the shell's 1200 px at 800 px. Alternative rejected: choosing the view in JavaScript with `matchMedia`; the server would not know which to render, and without JavaScript one width would get the wrong view. A hidden view (`display: none`) is out of the accessibility tree, so assistive technology meets only one. In jsdom both are present, so component tests scope their queries to the `tabpanel` or the `table`.

### D2. The week table: `week-table.tsx`
A grid with `role="table"` and the label "Menú de la semana", rows with `display: contents`, as in the mock. The columns are a pure function in the feature, `columnsOf(days)`: Monday to Saturday, and Sunday only when it has a dish. The grid template is one of two whole class names (six or seven day columns), so Tailwind finds them. Each column header has the day's colour bar, the weekday (`formatWeekday`, "Miércoles") and the short date (`formatColumnDate`, "7 oct"), plus " · hoy" in text on today's column; today's header and cells are `bg-gray-100`. A meal with no dishes shows "—". A dish with a recipe is a `button` with `aria-haspopup="dialog"`, `aria-expanded` and the chef-hat icon; one without is plain text. The table calls `onOpen(dish, trigger)` and receives which dish is open; it holds no state of its own.

### D3. The panel: `recipe-panel.tsx`, a non-modal dialog
An `aside` with `role="dialog"`, labelled by its heading (the dish name, an `h2`), with the eyebrow "Miércoles · Comida". On open, and whenever the dish changes, it focuses its close button "Cerrar receta" (the `x` glyph, added to `menu-icon.tsx`). A `keydown` listener on `document`, while it is open, closes it on Escape. `weekly-menu.tsx` keeps the open dish (day, meal, index) and the button that opened it, and on close sets the dish to `null` and focuses that button.

It is not modal, as in the mock: the table stays usable, so another dish can be opened while the panel shows one (a spec scenario), and there is no focus trap or `aria-modal`. Alternative rejected: the native `<dialog>` with `showModal()`; it makes the rest of the page inert, which rules out opening another dish, and with `show()` the browser gives no Escape handling, so it would add nothing to the `aside`.

Placement: `position: fixed` below the shell header (`top-16`, `bottom-0`), 360 px wide, scrolling on its own, on the right when the dish's column is in the left half of the columns and on the left otherwise. Its outer edge follows the 1200 px box of the page, `max(0px, (100vw - 1200px) / 2)` from the viewport edge, so on a wide screen it lies over the table and not at the edge of the window. It is `hidden @min-[800px]:flex`, so below 800 px it does not show even if left open.

### D4. Deviation from the mock: the panel shows the recipe as the card does
The mock's panel leaves out an unknown time instead of showing a dash, and shows the household measure **or** the quantity, while its own `RecipeCard` shows a dash and joins both ("1 cucharada · 10 ml"). Here the same recipe reads the same at both widths: `RecipeBody` moves out of `recipe-card.tsx` into `recipe-body.tsx`, exported, without the card's border and padding, and both the card and the panel use it. Only the panel's frame and header follow the mock. This changes nothing visible in the card.

### D5. Ported files and their version
`week-table.tsx` and `recipe-panel.tsx` note that they come from `MenuScreen.jsx` of version `1791390572-4ab7`, as the files of MF-23.1 note theirs. The mobile view is not re-ported from the newer version; any difference between the two versions of the mobile view is out of this change.

### D6. End-to-end test at desktop width
`e2e/menu.spec.ts` gets a `describe` at a 1280 × 800 viewport with the same fictitious menu 9002, which has dishes every day: the table with seven columns and today's marked "hoy", opening the recipe (dialog named after the dish, focus inside), closing with Escape (focus back on the dish), and the table without JavaScript. The existing tests keep the 375 px viewport. "Sunday without dishes is left out", the side of the panel and "Opening another dish" are covered by component tests, where the menu can be shaped freely.

## Risks / Trade-offs

- [The dish names appear twice in the HTML, once per view] → a hidden view is out of the accessibility tree and not shown; the HTML grows by one copy of the week's names, a few hundred bytes.
- [A non-modal dialog lets the focus leave with Tab] → intended (D3); Escape and the close button still return the focus to the dish.
- [`100vw` includes the scrollbar, so on a wide screen the panel's edge can sit a scrollbar's width off the content box] → accepted; it stays over the table.
- [The panel stays open, hidden by CSS, if the container narrows below 800 px while it is open (a window resized or a tablet turned): Escape still closes it and the focus can stay in the hidden panel] → accepted; closing it at the threshold would need `matchMedia` logic for a rare case, and the next Escape or a reload clears it.
- [The Escape listener on `document` also fires when the focus has left the panel] → it closes the panel, which is what Escape asks for; nothing else on the page uses Escape while the panel is open.
