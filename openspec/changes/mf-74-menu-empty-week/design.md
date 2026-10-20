# Design: MF-74 `/menu` for a week without a menu, at design system version v64

Source of the design: artifact «Menu Finder Design System», version `1792450792-6aa6` (v64): `project/implementacion.md` (section "Menú"), `project/ui_kits/app/MenuScreen.jsx` (`MenuEmpty`, `.mf-empty`, `MenuHeader`) and the card "Menu" (`components/Menu/preview.html`). See `proposal.md` for the motivation.

## Context

- `EmptyMenu` (`features/weekly-menu/components/empty-menu.tsx`) renders the header with the title "Menú", a grey card with one link and seven dashed `GhostDays`. It has no width box: `WeeklyMenu` has its own (`PAGE`: `max-w-[var(--spacing-content-max)]`, `@min-[800px]:max-w-[1440px]`, centred), `EmptyMenu` has none, so at 1920 px its content starts at the screen edge while the header of the shell is a 1440 px box with `px-8` (`app-shell.tsx`).
- `NoMenuNotice` (`features/dashboard/components/no-menu-notice.tsx`) is the notice of Hoy: `open` and `locked`, the locked rule comes from `weeksToChoose` through `app/page.tsx` (`emptyWeekOf`).
- `menuWeekPage` reads the user's selections from ten weeks back (`SelectionRepository.listFrom`) and keeps only the shown week's. `isLocked(week, selections, today)` (`domain/selection/week.ts`) is the rule: this week is closed once next week has a selection. It looks for next Monday in the list it is given, so the longer list `menuWeekPage` already has works.
- The week controls already do what the design says: `neighbouringWeeks` gives `next: null` on next week (the control is disabled), and `WeekNav` shows "Esta semana" whenever `shown !== current`.
- A feature does not import from another feature (ADR-001 §3). `weekly-menu` cannot use a component of `dashboard`; a piece used by two features goes to `shared/` (ADR-001 §2).

## Goals / Non-Goals

**Goals:** the four cases of the mock, with the copy of Hoy; one notice component for both pages; the same box for `/menu` with and without a menu; the closed rule written once.

**Non-Goals:** `WelcomeScreen`; the failed page ("Menú" and its message); the windows of ten weeks back and one ahead; any change to Hoy's copy or to its two cases; the recipe panel.

## Decisions

**D1. One notice, in `shared/ui/`.** `no-menu-notice.tsx` moves from `features/dashboard/components/` to `shared/ui/` with its test, and its type grows from two cases to four: `{ kind: 'past' } | { kind: 'open' } | { kind: 'locked'; nextMenuNumber; nextStartsOn } | { kind: 'future'; startsOn }`. Hoy keeps passing `open` and `locked` and its copy does not change. Colour: `open` and `future` are olive-50 with an olive-100 border (as today); `past` and `locked` are grey (`bg-surface-hover`, `border-border-hairline`, as `.mf-empty`). The outer margin is not the notice's: it takes a `className` so that Hoy keeps its `mt-5` and `/menu` sets its own. *Alternative:* a second component for `/menu`, which the author refused ("reutiliza el componente"), and which would copy the text of Hoy twice.

**D2. The closed rule is `isLocked`, not a copy.** `menuWeekPage` returns, besides `navigation` and `menu`, `lockedBy: { menuNumber: number; startsOn: LocalDate } | null`, set only when the shown week is the current one, has no menu of its own and `isLocked('current', selections, today)` holds; the number and Monday are those of next week's selection. The selections are read once and used for the shown week and for the lock (today `selectionOn` reads them and keeps one). No port changes: `SelectionRepository.listFrom` already gives them. *Alternative:* call `weeksToChoose` from the page, as Hoy does: a second read of the same rows and a second use case for a page that already has them.

**D3. The page maps the data to the notice.** `app/(signed-in)/menu/page.tsx` builds the `EmptyWeek` from `navigation.status`, `lockedBy` and `navigation.shown`: `past` → `past`; `current` with `lockedBy` → `locked` (its `startsOn` is the link target); `current` otherwise → `open`; `future` → `future` with the shown Monday, shown as `formatDayMonth` ("12 oct", `shared/format-week`). Links are `/planner?week=current`, `/planner?week=next` and `/menu?startsOn=<Monday>`, all built from the server's dates, never from the request.

**D4. `EmptyMenu` is the title plus the notice.** `WeekHeader` gets the title "Semana sin menú" and the usual eyebrow and navigation; `GhostDays` and the grey card of `NextStep` are removed. The notice has `role="status"` (already in `NoMenuNoticeProps`' markup). Below 800 px it takes the content's width; from 800 px it is at most 760 px and left-aligned (`@min-[800px]:max-w-[760px]`, no `mx-auto`). The failed page keeps its title "Menú".

**D5. One box for the page.** The width box moves out of `WeeklyMenu` into `app/(signed-in)/menu/page.tsx`, which wraps whatever it renders (the menu, the empty week and the failure) in the same classes: centred, `max-w-[var(--spacing-content-max)]` below 800 px and `@min-[800px]:max-w-[1440px]`. The header's own padding (`px-8` from 640 px) then matches the shell's. If checking the page with a menu at 1920 px by eye shows it already lines up (as the code says), this only moves the classes. *Alternative:* add the classes to `EmptyMenu` and leave `WeeklyMenu` alone: two copies of the box, which is the drift that caused the bug.

**D6. The week controls get tests, not code.** `neighbouringWeeks` and `WeekNav` already give the behaviour. The tests that pin it are checked against the scenarios of the spec, and the missing ones are added.

## Risks / Trade-offs

- **Moving `NoMenuNotice`** touches Hoy: its test moves and `app/page.tsx` changes one import. `pnpm knip` (pre-commit) fails on a leftover file, so the old path is deleted, not kept as a re-export.
- **Grey and olive in the same component** → the colour is a function of the case, and a test per case reads the classes.
- **The box moves to the page** → `WeeklyMenu`'s test of the page width, if there is one, moves with it; the sticky day bar and the recipe panel do not depend on the box (the panel is `fixed`).
- **A selection of next week with the shown week being a past one** → `lockedBy` is only for the current week, so a past week never says "closed".

## Migration Plan

No data or schema changes. Deploy with the next release; to roll back, revert the PR. The app version (`package.json`) is asked of the author before opening the PR (`AGENTS.md`).

## Open Questions

- The ID **MF-74**, the estimate and the roadmap entry are the author's to confirm.
