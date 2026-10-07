# Design: Rename Route Group `(app)` to `(signed-in)` (MF-53)

## Context

See `proposal.md` for motivation.

The directory `src/app/(app)/` currently houses all routes requiring authenticated access:
- `layout.tsx` & `layout.test.tsx`: provides the navigation shell `<AppShell session="in">`
- `planner/`: `page.tsx`, `page.test.tsx`, `actions.ts`, `actions.test.ts`
- `menu/`: `page.tsx`, `page.test.tsx`
- `shopping-list/`: `page.tsx`, `page.test.tsx`, `actions.ts`, `actions.test.ts`

Outside this directory, `src/app/protected-pages.test.ts` enforces the OWASP A01 access control check by scanning files under `src/app/` starting with `(app)${sep}` to verify that every server action invokes `requireUser()`. Several tests also mock or import modules using `@/app/(app)/...`.

## Goals / Non-Goals

**Goals:**
- Move all files from `src/app/(app)/` to `src/app/(signed-in)/` while preserving git history.
- Update all internal `@/app/(app)/...` imports and vitest mocks to `@/app/(signed-in)/...`.
- Update `src/app/protected-pages.test.ts` to scan `(signed-in)${sep}`.
- Update comments in `src/app/page.tsx`.
- Ensure all quality gates pass: typecheck, lint, unit/integration tests, and e2e tests.

**Non-Goals:**
- Modify route behavior, URL structures, or UI components.
- Alter historical OpenSpec archive documents (`openspec/changes/archive/**`).
- Change server actions logic or authentication mechanism.

## Decisions

### D1: Directory naming: `(signed-in)` over `(authenticated)` or `(protected)`
- **Rationale**: The project consistently uses "signed-in" terminology for authenticated session states (`SignedInUser` DTO, `(signed-in)` in layout descriptions, session status `session="in"`). It directly conveys that these pages require an authenticated user.
- **Alternatives considered**:
  - `(app)`: Kept previously, but visually redundant with `src/app/` and looks like an actual URL prefix `/app/...`.
  - `(protected)`: Generic; "signed-in" more accurately reflects the session requirement.

### D2: Update `protected-pages.test.ts` filter
- **Rationale**: `protected-pages.test.ts` dynamically inspects the file tree to find server actions within the authenticated route group. Updating the path filter from `(app)${sep}` to `(signed-in)${sep}` preserves the automated security verification without false negatives.
- **Alternatives considered**: Hardcoding paths instead of dynamic scanning. Rejected because dynamic scanning automatically catches newly added actions.

## Risks / Trade-offs

- **[Risk] Broken vitest mocks due to path changes** → `vi.mock('@/app/(app)/...')` in `page.test.tsx` files.
  - *Mitigation*: Update all test import and mock specifiers to `@/app/(signed-in)/...`. The full Vitest suite validates that mocked actions are properly resolved.
- **[Risk] Broken E2E route resolution** → Next.js could fail to serve pages if folder renaming corrupts the App Router tree.
  - *Mitigation*: Execute Playwright E2E tests (`pnpm test:e2e`) verifying `/planner`, `/menu`, and `/shopping-list` routes respond normally.
