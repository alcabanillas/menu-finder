## 1. The week rule in the domain

- [x] 1.1 RED: in `src/domain/selection/week.test.ts`, write the tests of `mondayOfWeek`, `isLocked` and `suggestedWeek` (design D1) from the `menu-selection` scenarios: "Choosing in a week with no menu", "Choosing on a Monday with no menu", "Choosing while a menu is active", "Choosing next week with this week empty", "Today is the date in Madrid", the three of "This week is locked once next week is chosen" and the four of "The week a choice starts on by default". See them fail
- [x] 1.2 GREEN: write the three functions and the `Week` type, and remove `startsOnFor` and its tests once nothing calls it (after task 2.2). Verify 1.1 passes

## 2. `selectMenu` with a week

- [x] 2.1 RED: in `src/application/services/selection/select-menu.test.ts`, write "A week that is not current or next" (`"2026-10-19"`, `"last"`, `"CURRENT"`, `1`, no value → `invalid-week`, no write), "Changing this week after choosing next week" and "Filling an empty week after choosing next week" (`week-locked`, no write), "Next week can still be changed", "Changing this week's menu", and "Another user's next week does not lock this week". Give the existing tests a week. See the new ones fail
- [x] 2.2 GREEN: add `weekInput` in `src/application/dto/week-input.ts` and the `week` input, the order of checks and the failures `invalid-week` and `week-locked` to `selectMenu` (design D2). Verify 2.1 and the repository tests pass
- [x] 2.3 RED: in `src/application/use-cases/menu/select-random-menu.test.ts`, write "A random menu with only next week chosen": the random menu goes to next Monday. Adapt the existing tests. See it fail
- [x] 2.4 GREEN: in `selectRandomMenu`, read the selections from this Monday and pass `suggestedWeek` to `selectMenu`. Verify 2.3 passes

## 3. The use cases of the web

- [x] 3.1 RED: in `src/application/use-cases/menu/weeks-to-choose.test.ts`, write the weeks for "Nothing chosen", "This week chosen" and "This week and next week chosen" (`startsOn`, `menuNumber`, `locked`, `suggested`) and a read failure as `failed`. See them fail
- [x] 3.2 GREEN: write `weeksToChoose` and `WeeksToChooseDto` (design D3); remove `current-selections.ts`, its test and `src/application/dto/selection-summary.ts`. Verify 3.1 passes
- [x] 3.3 RED: in `src/application/use-cases/menu/choose-menu.test.ts`, write that `chooseMenu` passes the user, the menu and the week to `selectMenu` and returns its result. See it fail
- [x] 3.4 GREEN: write `chooseMenu` (design D2). Verify 3.3 passes
- [x] 3.5 RED: in `src/composition/web-container.test.ts`, replace the `currentSelections` tests with `weeksToChoose` and add `chooseMenu`, each giving `failed` on an unreachable database on the same pool. See them fail
- [x] 3.6 GREEN: expose `weeksToChoose` and `chooseMenu` in `src/composition/web/menu-use-cases.ts` in place of `currentSelections`. Verify 3.5 passes

## 4. Dates

- [x] 4.1 RED: in `src/shared/format-week.test.ts`, write `formatDayMonth('2026-10-12')` → "12 oct", and move the `formatWeekRange` tests ("5 – 11 oct", "29 sept – 5 oct"). See them fail
- [x] 4.2 GREEN: move `formatWeekRange` to `src/shared/format-week.ts`, add `formatDayMonth`, and import it from there in `week-nav.tsx` (design D8). Verify 4.1 and the `weekly-menu` tests pass

## 5. The view of a choice and the action

- [x] 5.1 RED: in `src/features/menu-planner/choice-view.test.ts`, write `toChoiceState` (design D5): a selection of menu 22 from 2026-10-12 gives `chosen` with "Menú 22 para la semana del 12 oct." and `/menu?startsOn=2026-10-12`; `invalid-menu` and `unknown-menu` give "Ese menú no existe.", `invalid-week` "Esa semana no se puede elegir.", `week-locked` "Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene." and `failed` "No se ha podido elegir el menú. Inténtalo de nuevo.", each with its `kind`. See them fail
- [x] 5.2 GREEN: write `toChoiceState` and `ChoiceState`. Verify 5.1 passes with 100 % coverage of the file
- [x] 5.3 RED: in `src/app/(signed-in)/planner/actions.test.ts`, for `chooseMenuAction`, with `requireUser`, `revalidatePath` and the container mocked: "Choosing for an empty week" (the `menu` and `week` fields reach `chooseMenu` with the session's user; `revalidatePath('/planner')`), "Choosing without a session" (no form read, no call), "A menu number that is not valid" and "A week that is not valid" (a `File` or a missing field reaches `chooseMenu` as `undefined`), "A forged choice for a locked week" (its message), "Fields in the request are ignored", and "The database fails" (no `revalidatePath`). See them fail
- [x] 5.4 GREEN: write `chooseMenuAction` and `textOf` (design D5). Verify 5.3 passes

## 6. Components

- [x] 6.1 RED: in `src/shared/ui/button.test.tsx`, assert the `sm` size and the `ghost` variant. See it fail
- [x] 6.2 GREEN: port them from `Button.jsx`, version `1792178100-1406`. Verify 6.1 passes
- [x] 6.3 RED: in `src/features/menu-planner/components/week-selector.test.tsx`, write the scenarios of "The planner shows the week's selections": the legend, the two radios named `week` with the `form` attribute, the dates and "Menú N" or "Sin menú", the selected option, the hint for an empty and a full week, the locked "Esta semana" disabled with its text tied by `aria-describedby`, the done line with "Ver semana" to its `weekHref`, and "No se ha podido cargar tu menú." with `null` weeks. See them fail
- [x] 6.4 GREEN: port `WeekSelector` from `WeekTarget` (design D6). Verify 6.3 passes
- [x] 6.5 RED: in `menu-candidate-card.test.tsx`, write the choose button: a submit with `name="menu"`, its value, the `form` attribute, "Elegir para el 12 oct" as primary and "Cambiar el menú del 5 oct" as secondary, the accessible name "Elegir para el 12 oct (Menú 22)", the selected card ("Menú del 5 oct", a check, disabled, the olive border), the disabled state while pending, and no button without `choice` ("No buttons without the weeks"). Replace the MF-22.4 test "Cards have no actions". See them fail
- [x] 6.6 GREEN: add the `choice` prop to `MenuCandidateCard` (design D6). Verify 6.5 passes
- [x] 6.7 RED: in `planner-search.test.tsx`, with fake search and choose actions and given weeks, write: the selector above the search box and the empty choose form with its id; "The buttons follow the selected week" (switching the radio changes the labels with no search call); "The card of the week's menu" and "Another week selected"; "The results stay after choosing"; "Choosing in progress" ("Eligiendo…", every button disabled); "A new search clears the message" and "Another week clears the message"; each failure message in an `alert` with the results still shown; and the breadcrumbs of "Choosing breadcrumbs without request data" (`menu chosen` with the week, `choice answered` with the outcome and the week, no request text, term or dish). See them fail
- [x] 6.8 GREEN: add the weeks, the selected week, the choose form, the choice state, the messages and the breadcrumbs to `PlannerSearch` (design D4, D5, D9). Verify 6.7 and the existing search tests pass

## 7. The page

- [x] 7.1 RED: in `src/app/(signed-in)/planner/page.test.tsx`, assert that the page reads the weeks with `weeksToChoose` and passes them, or `null` on failure, with both actions to `PlannerSearch`; that the old summary ("Menú N · desde el lunes …") is gone; and that the random button stays. See it fail
- [x] 7.2 GREEN: update the page and remove `selection-summary.tsx` and its test. Verify 7.1 passes, and `pnpm knip` and `pnpm typecheck` are clean
- [x] 7.3 In `e2e/planner.spec.ts`, make the random tests check the chosen menu in the selector ("Esta semana" or "La que viene" reads "Menú N") instead of the summary

## 8. Documents and check

- [x] 8.1 Update ARQ-modelo-datos in `context/decisiones.md`: the user chooses this week or next week, the server computes the Monday, and this week is locked once next week is chosen (decided by the author on 2026-10-16)
- [x] 8.2 Run `pnpm test:run` on the affected folders (`src/domain/selection`, `src/application`, `src/composition`, `src/features/menu-planner`, `src/features/weekly-menu`, `src/shared`, `src/app/(signed-in)/planner`) and `pnpm typecheck`
- [x] 8.3 In the browser, with `pnpm dev`: search, choose for each week, check that the results stay after `revalidatePath` (design, Risks), that the selector and the buttons follow the new menu, that the lock shows once next week is chosen, and that "Ver semana" opens the week in `/menu`; repeat a choice with JavaScript disabled. Compare captures of the selector and of a selected and a not-selected card against `project/components/Planner/preview.html` (UI-design-system)
- [x] 8.4 Before archive: update the Purpose of `openspec/specs/menu-planner/spec.md`, which still describes the provisional planner, and go through the checklist of `context/safety-first.md` §4

## 9. Design system 1792255497-a1ff

- [x] 9.1 Selector: "Cerrada" and "Si eliges otro, lo sustituye" inside the cards, no lines under the options but the hint of an empty week
- [x] 9.2 Cards: confirmation box in the card; random button as a submit of the choose form with the week (`selectRandomMenu` takes `week`), its confirmation under the options
- [x] 9.3 Page: no greeting, heading for screen readers, "¿Qué te apetece?", search row with the random button, `?week=` and the link of an empty week in Menú
- [x] 9.4 Radios checked again after the form resets (key by `attempt`); E2E updated to the new button, messages and the heading
- [ ] 9.5 Check with the author the case "confirmation open in a result card" at 390 and 1280 px (it needs a search, which needs a valid `GEMINI_API_KEY`)
- [x] 9.6 Refactor with no change of behaviour: `PlannerSearch` split into `useMenuChoice`, `choice-prompts.ts`, `planner-breadcrumbs.ts`, `RandomButton`, `ChoiceMessage` and `PlannerResults`; its tests did not change
