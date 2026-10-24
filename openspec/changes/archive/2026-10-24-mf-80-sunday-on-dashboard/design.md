# Design

## Context

See `proposal.md` (Why). What is there today:

- `src/app/page.tsx` (84 lines) decides the state from `sessionUser()`, builds the visitor's home with its sample slots, reads `menuWeekPage`, `weeksToChoose` and `shoppingChecklist` in parallel, renders `DashboardLayout`, and holds `TodayBlock`, `dashboardWeeksOf`, `emptyWeekOf` and `listProgressOf`. `src/app/page.test.tsx` covers both states through `Home()`.
- `TodayMeals` (`features/weekly-menu`) gets the whole `WeeklyMenuDto`, finds today by `menu.today` and takes tomorrow as `days[index + 1]`, which on Sunday is `undefined`.
- `menuWeekPage` builds the week of a selection with the private steps `selectedWeek` and `recipeFilesOf`. The dashboard calls it with `startsOn: undefined` only to get this week and `today`.
- `weeksToChoose` already reads the selections from this Monday on and knows next week's menu number.

## Goals / Non-Goals

**Goals:**
- `src/app/page.tsx` holds only the state decision: about 15 lines, no reads, no mappers.
- One use case answers "what is on today and tomorrow", so the Sunday rule lives in `application/`, tested with a fake clock, and not in the UI.
- The refactor lands first with the current tests green and unchanged in what they assert.

**Non-Goals:**
- No change on Sunday when this week has no menu: the notice of `NoMenuNotice` stays as it is.
- No change to `/menu`, `/planner` or the weeks card.
- No date fake, environment variable or demo switch for the clock.
- No port for "today": `Clock` already exists.

## Decisions

### D1. `page.tsx` is a router with one shell and five imports

After the author's sketch (2026-10-24): one `AppShell` for both states, and the content of each state from its own module.

```tsx
import { sessionUser } from '@/app/_auth/session-user';
import { shellAccountOf } from '@/app/_auth/shell-account';
import { dashboardContent } from '@/app/_dashboard/dashboard-content';
import { WelcomeContent } from '@/app/_welcome/welcome-content';
import { AppShell } from '@/features/app-shell/components/app-shell';

export default async function Home() {
  const user = await sessionUser();
  return (
    <AppShell account={shellAccountOf(user)}>
      {user ? await dashboardContent(user) : <WelcomeContent />}
    </AppShell>
  );
}
```

`page.tsx` goes from 15 imports to 5:

- `src/app/_auth/shell-account.ts`: `shellAccountOf(user: SignedInUser | null): Account | undefined`, the account of the shell's menu with `APP_VERSION` and `signOutAction`, or none without a user. `(signed-in)/layout.tsx` builds the same object inline today and uses it too, so `APP_VERSION` and `signOutAction` are imported in one place.
- `src/app/_welcome/welcome-content.tsx`: `WelcomeContent`, a sync component, `WelcomeScreen` with `SAMPLE_WEEK` and the sample pieces already in `_welcome/`.
- `src/app/_dashboard/dashboard-content.tsx`: `dashboardContent(user)` runs the reads in parallel and returns `DashboardLayout` with its blocks.
- `src/app/_dashboard/dashboard-blocks.tsx`: `TodayBlock`, `dashboardWeeksOf`, `emptyWeekOf` and `listProgressOf`, moved as they are.

The modules stay in `app/`, not in `features/`: they call the `web-container` (ADR-001 §5, "Solo `app/` toca el `web-container`"), and `TodayBlock` combines `weekly-menu` and `shared/ui`, which a feature cannot do (ADR-001 §3). The `_` prefix keeps them out of routing, as `_welcome/` and `_auth/` already do.

`dashboardContent` is async and called with `await`, not rendered as `<DashboardContent />`. Next.js would render either; Testing Library cannot render an async Server Component nested in JSX. With the call, `render(await Home())` still renders the whole page, and `src/app/page.test.tsx` keeps its tests where they are. `WelcomeContent` is sync, so it is plain JSX.

*Alternative:* `<DashboardContent user={user} />` as JSX, with `page.test.tsx` mocking both modules and testing only the routing, and the dashboard tests moved to their own file. Rejected: more mocks for the same coverage, and the refactor would move every test.

*Alternative:* move `TodayBlock` into `features/dashboard/`. Rejected: it would import `TodayMeals` from `features/weekly-menu`, which ESLint `boundaries` forbids; moving `TodayMeals` and its recipe pieces to `shared/ui/` is scope this change does not need.

### D2. A use case `todaysMenu` for the dashboard

`src/application/use-cases/menu/todays-menu.ts`, input `{ userId }` (from the session), output `TodaysMenuDto` in `src/application/dto/todays-menu.ts`:

```ts
type TomorrowDto =
  | { kind: 'day'; day: WeekDayDto }                                           // a weekday: the next day of the same week
  | { kind: 'next-week'; day: WeekDayDto; menuNumber: number; startsOn: string } // Sunday: Monday of next week, its menu and its Monday
  | { kind: 'no-menu'; startsOn: string }                                      // Sunday: next week has no menu; `startsOn` is its Monday
  | { kind: 'none' };                                                          // no dishes, or next week's menu could not be read
type TodaysMenuDto = { today: string; day: WeekDayDto | null; tomorrow: TomorrowDto }; // `day` null: no menu this week
```

Steps: `clock.today()`; `selections.listFrom(userId, mondayOf(today))`, one read for both weeks; this week's selection → `selectedWeek` → today's `WeekDay`; tomorrow is `addDays(today, 1)`. When it is in this week, it is that day of the same week. When it is a Monday (today is Sunday), it is next week's selection → `selectedWeek` → its Monday, or `no-menu`; `next-week` carries the menu number and the Monday for the heading "Menú 31" and the link to `/menu`. A failure reading the selections or this week's menu is `err({ kind: 'failed' })`. A failure reading next week's menu gives `tomorrow: none`, so today still shows (spec scenario "Next week cannot be read").

The dashboard calls `todaysMenu` instead of `menuWeekPage`. `DashboardLayout` takes `today` from it.

*Alternative:* keep `menuWeekPage` and call it a second time with `startsOn = next Monday` from `app/`. Rejected: the Sunday rule would sit in `app/`, which ADR-001 §5 keeps free of logic, and `app/` would compute a date with `domain/`, which it cannot import.

*Alternative:* extend `menuWeekPage` with next Monday. Rejected: `/menu` does not need it, and that use case already mixes navigation and locking.

### D3. `selectedWeek` becomes a service

`selectedWeek` and `recipeFilesOf` move from `menu-week-page.ts` to `src/application/services/menu/selected-week.ts`. `menuWeekPage` and `todaysMenu` both call it. ADR-001 §3: a step with ports shared by two use cases is a service, and a use case never calls another. Its deps are `menus`, `recipes` and `clock`, the same ports as today. Its own test covers what `menu-week-page.test.ts` covered of it; those tests stay.

### D4. `TodayMeals` gets the two days, not the week

`TodayMeals({ today, tomorrow })`, with `today: WeekDayDto` and `tomorrow: TomorrowDto`. It no longer looks for today in a week or computes `index + 1`. After the design system v90 (row v89 of its `implementacion.md`, `HomeScreen.jsx` `offDay` and `sunNext`):

- **Rest day** (`today.day === 'sunday'` with no dishes): a grey card (`surface-sunken`, `border-hairline`, radius 14) with a sun icon in a 44 px circle, the title "Domingo libre" and the text "¡Día libre! Hoy la cocina queda a vuestro gusto." (the author chose it over the design system's more formal text, 2026-10-24). No "Ver menú". The sun icon is a new inline SVG next to the other icons of `weekly-menu`.
- **`next-week`**: the existing `Tomorrow` block with the heading "Mañana · Lunes 26 · Menú 31" (weekday capitalised, as the mock writes it) and a ghost link "Ver el menú de la semana que viene" to `/menu?startsOn=<Monday>`.
- **`no-menu`**: `NoMenuNotice` with the `future` case (olive-50, title "La semana que viene aún no tiene menú", primary button "Elegir menú para el 26 oct" to `/planner?week=next`), reused as it is in `/menu`. It gets a new optional `intro` that opens its text with "Mañana empieza otra semana."; no component of its own.
- **Sunday's bar**: `DAY_BARS.sunday` already has `border border-border-strong`, used by `TodayMeals`, the week cards and the preview panel. The date in the header of `DashboardLayout` has its own `DAY_COLOURS` with a bare `bg-day-sun`; it takes its classes from `DAY_BARS` (it needs the day name, not the `getUTCDay` index) so the header bar shows too.

## Risks / Trade-offs

- [The refactor and the feature in one PR make the diff harder to review] → The tasks put the refactor first, in its own commit, with `page.test.tsx` moved but asserting the same thing. The feature comes after.
- [On Sunday the dashboard reads two menus and their recipes] → One more `menus.find` and `recipes.findByFiles`, only on Sundays with a menu next week. Acceptable.
- [The e2e Sunday branch runs only when CI happens to run on a Sunday] → The rule is covered by the use-case tests with a fake clock, and the e2e is updated to the new expectation for that branch.
- [`menu-week-page.test.ts` and the service test overlap] → The overlap is kept: `menuWeekPage` keeps its behaviour tests, and the service has its own small ones.

## Open Questions

None. The visuals and copy of the Sunday states come from the design system v90 (`1792837273-291e`, row v89 of its `implementacion.md`).
