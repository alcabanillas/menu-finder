## Context

`/planner` (MF-22.4) renders `PlannerSearch`, a client component with `useActionState(searchMenusAction)`, and below it the provisional `SelectionSummary` and `RandomMenuForm` of MF-43. `chooseRandomMenuAction` calls the use case `selectRandomMenu`, which picks a number and calls `selectMenu`, a service in `application/services/selection/`. `selectMenu` validates the number with `positiveIntegerInput` and computes the Monday with `startsOnFor` (`domain/selection/week.ts`): this week's if the user has nothing on it, otherwise next week's. `currentSelections` and `CurrentSelectionsDto` feed `SelectionSummary` and are used by `/planner` only. Replacing a selection deletes its shopping ticks (`ON DELETE CASCADE`).

Visual source: the design system "Menu Finder Design System" (<https://claude.ai/code/artifact/2b9c8f4b-b06b-4b2d-a22a-221b23edc61a>), version `1792178100-1406`:

- `project/ui_kits/app/PlannerScreen.jsx` (`WeekTarget` and `PlannerScreen`) and `project/components/Planner/preview.html`: the fieldset "Eligiendo menú para" with two radio cards (`.mf-wt__opt`, the selected one with a 2 px olive border on `olive-50`), the hint under them (`.mf-wt__hint`, ochre when the week is full), the done line (`.mf-wt__done`, olive, a check and a ghost "Ver semana" with an arrow); the default week is the first empty one, otherwise next week.
- `project/components/recipe/MenuCandidateCard.jsx` and its README: `chooseLabel` ("Elegir para el 12 oct"), `chooseVariant` (`secondary` for "Cambiar el menú del 5 oct"), `selected` with `selectedLabel` ("Menú del 5 oct", a check, the olive double border), and `confirm`.
- `project/components/core/Button.jsx`: the `sm` size (36 px, 14 px padding, 14 px text) and the `ghost` variant.

## Goals / Non-Goals

**Goals:**

- The user chooses the week, `current` or `next`; the server computes the Monday and refuses `current` once next week has a menu.
- The week selector in place of the summary, and the card buttons that name the week.
- The results stay after choosing; the selector confirms with a "Ver semana" link.

**Non-Goals:**

- The polarity tokens (MF-22.8). No warning about lost ticks (decided by the author on 2026-10-17).
- The E2E of the full weekly flow (MF-22.7).
- Keeping the results when choosing without JavaScript (D7).

## Decisions

### D1. The week rule in the domain

`domain/selection/week.ts` replaces `startsOnFor` with three pure functions over `today` and the selections from this Monday:

```ts
export type Week = 'current' | 'next';
export function mondayOfWeek(today: LocalDate, week: Week): LocalDate;                       // this Monday or next Monday
export function isLocked(week: Week, fromThisMonday: Selection[], today: LocalDate): boolean; // current, and next Monday has a selection
export function suggestedWeek(fromThisMonday: Selection[], today: LocalDate): Week;          // current if empty and not locked, else next
```

`currentOf` stays: `/shopping-list` uses it through `services/selection/current-shopping-selection.ts`.

Alternative: send the Monday from the browser and check it is one of the two. Rejected: the spec keeps "the start date is never read from the request", and a word is easier to validate than a date.

### D2. `selectMenu` stays a service; the web calls a new use case

The roadmap planned to move `selectMenu` to `use-cases/` once the random button went. The button stays and still calls `selectMenu`, and a use case never calls another use case (ADR-001, "Casos de uso y services"). So `selectMenu` stays in `services/selection/`, and the web calls a new use case, `use-cases/menu/choose-menu.ts`, which only delegates to it. A thin use case is the price of keeping the rule; it also gives the web an entry with its own input type.

`selectMenu` takes `{ userId, menuNumber?: unknown, week?: unknown }`. In order: the menu with `positiveIntegerInput` (`invalid-menu`), the week with a `weekInput` schema in `application/dto/` (`z.enum(['current', 'next'])`, `invalid-week`), `listFrom(userId, thisMonday)` (`failed`), `isLocked` (`week-locked`), then `replace` with `mondayOfWeek` (`unknown-menu` or `failed`).

`selectRandomMenu` reads the selections from this Monday, takes `suggestedWeek` and passes it to `selectMenu`, which reads them again. One extra read on that button is simpler than threading the selections through the service.

### D3. The weeks of the selector

`currentSelections` and `CurrentSelectionsDto` give way to a use case, `use-cases/menu/weeks-to-choose.ts`, and its DTO in `application/dto/weeks-to-choose.ts`:

```ts
type WeekToChooseDto = { startsOn: string; menuNumber: number | null; locked: boolean };
type WeeksToChooseDto = { current: WeekToChooseDto; next: WeekToChooseDto; suggested: Week };
```

It reads `listFrom(userId, thisMonday)` once and builds both weeks with the functions of D1. The page calls it and passes the result, or `null` on failure, to `PlannerSearch`.

### D4. One form for the choice, fed by the selector and the cards

The radios of the selector and the buttons of the cards are far apart in the page, with the search form between them, and forms cannot nest. So the choice is one empty `<form id={chooseFormId} action={chooseFormAction}>`, and the controls join it with the `form` attribute: each radio is `<input type="radio" name="week" value="current|next" form={chooseFormId}>`, and each card button is `<button type="submit" name="menu" value={card.menu} form={chooseFormId}>`. The browser posts the checked week and the menu of the button pressed, with or without JavaScript. `chooseFormId` comes from `useId`.

The selected week is client state in `PlannerSearch`, starting on `weeks.suggested`; the radios are controlled, so the card labels follow them. A locked week's radio is `disabled`.

### D5. The action and its state

```ts
export async function chooseMenuAction(previous: ChoiceState, formData: FormData): Promise<ChoiceState> {
  const user = await requireUser();
  const result = await webContainer().chooseMenu({ userId: user.userId, menuNumber: textOf(formData, 'menu'), week: textOf(formData, 'week') });
  if (result.ok) revalidatePath('/planner');
  return toChoiceState(result, previous.attempt + 1);
}
```

`textOf` gives the field when it is a string and `undefined` otherwise. `toChoiceState` in `features/menu-planner/choice-view.ts` is pure, like `toSearchState`:

```ts
type ChoiceState =
  | { status: 'idle'; attempt: number }
  | { status: 'chosen'; menu: number; week: Week; message: string; weekHref: string; attempt: number }
  | { status: 'failed'; kind: ChooseMenuFailure['kind']; message: string; attempt: number };
```

`message` is "Menú 22 para la semana del 12 oct."; `weekHref` is `/menu?startsOn=<YYYY-MM-DD>`, which `/menu` validates again. `revalidatePath('/planner')` re-renders the page with the new weeks, so the selector shows the menu and the buttons follow it; the client state of `PlannerSearch` (the search, the selected week, the choice) survives the refresh because the tree keeps its shape. `PlannerSearch` remembers the search `attempt` and the week the choice was made on, and hides the message when either changes.

### D6. The selector and the card button

`features/menu-planner/components/week-selector.tsx` ports `WeekTarget` without the random button and the confirmation: a `fieldset` with the legend "Eligiendo menú para", two radio cards, the hint or the done line with "Ver semana" (a `next/link` styled as the ghost `sm` button), and, for a locked "Esta semana", the line "No se puede cambiar: ya has elegido la de la semana que viene." tied to the radio with `aria-describedby`. On failure to read the weeks, "No se ha podido cargar tu menú." in its place.

`MenuCandidateCard` gets an optional `choice` prop: `{ formId, label, variant, selected, disabled }`. The button is `secondary` for "Cambiar el menú del …", and `primary` otherwise; when `selected` it reads "Menú del …" with a check, is disabled, and the card gets `border-olive-500 outline outline-olive-500`. Its `aria-label` is the visible text and the menu ("Elegir para el 12 oct (Menú 22)"). Without `choice` the card has no button. `shared/ui/button.tsx` gains the `sm` size and the `ghost` variant of `Button.jsx`.

### D7. Without JavaScript the results are lost

Without JavaScript, the choice posts and Next renders `/planner` with the choice's state and the initial search state: the selector shows the new menu and the message with "Ver semana", but the chips and cards do not come back. Keeping them would mean running the search again, which spends a model call and the daily limit, or trusting a search view sent back by the browser.

### D8. Dates of the weeks

The selector needs "5 – 11 oct", already written by `formatWeekRange` in `features/weekly-menu/format-date.ts`, and "12 oct" for the labels. A second feature uses them, so `formatWeekRange` moves to `shared/format-week.ts` with a new `formatDayMonth` ("12 oct"), and `week-nav.tsx` imports it from there (ADR-001, Scope Rule).

### D9. Breadcrumbs

As the search (MF-22.4 D8): `{ category: 'planner', message: 'menu chosen', data: { week } }` in the choice form's `onSubmit`, and `{ category: 'planner', message: 'choice answered', data: { outcome, week } }` in an effect on the choice's `attempt`, where `outcome` is `chosen` or the failure kind. No menu number, term or text.

### D10. Tests

- `week.test.ts`: `mondayOfWeek`, `isLocked` and `suggestedWeek`, one test per scenario of the `menu-selection` delta, with Madrid's midnight.
- `select-menu.test.ts`: invalid week, locked week (with and without a menu this week), next week still free, and the existing cases with a week.
- `weeks-to-choose.test.ts`, `choose-menu.test.ts`, `select-random-menu.test.ts` (the suggested week).
- `choice-view.test.ts`, `actions.test.ts`, `week-selector.test.tsx`, `menu-candidate-card.test.tsx`, `planner-search.test.tsx`, `page.test.tsx`.
- `e2e/planner.spec.ts`: the random tests check the menu in the selector instead of the summary. Choosing from the cards needs a search, and CI's model key is not valid, so that path is covered by the component tests and in MF-22.7.

### D11. Design system 1792255497-a1ff (2026-10-17)

- The random button is one more submit of the choose form: `name="random" value="1" form={chooseFormId}`, once under the search box for a phone and once beside it from 800 px (two buttons in the DOM, one hidden by CSS). `chooseMenuAction` reads `random`: with `1` it calls `selectRandomMenu({ userId, week })`, which now takes the week (without one it still uses the suggested week) and refuses `invalid-week` and `week-locked` through `selectMenu`; `no-menus` becomes a `ChoiceState` failure. `RandomMenuForm`, its action and its state are removed: one state, one message, one "Ver semana" line.
- The confirmation is client state in `PlannerSearch` (`ask`: a menu number, `random` or none), closed by another week or by a submit. `ConfirmChange` is the ochre box: "Cambiar" is a submit of the choose form with `menu` or `random`, "Cancelar" a button. Without JavaScript the replace button posts at once, as before.
- `?week=current|next` is read by the page with `weekInput`; a locked week is ignored in `startWeek`.
- React resets a form when its action ends, and that unchecks a controlled radio whose state did not change: the options of the selector take the choice's `attempt` in their key, so they mount again checked as `selected` says.

## Risks / Trade-offs

- [`revalidatePath` could reset `PlannerSearch`] → Checked in the browser during `apply`; if it resets, `router.refresh()` from the client after a `chosen` answer refreshes the weeks instead.
- [The `form` attribute] → Supported by every current browser; a control outside its form is posted with it, with or without JavaScript. The component tests check the attributes; the browser check of the post is in the last task.
- [Two reads in `selectRandomMenu`] → Accepted.

## Migration Plan

No data migration: the table and its constraints do not change. `context/decisiones.md` ARQ-modelo-datos is updated with the new rule in this change. Deploy as usual.
