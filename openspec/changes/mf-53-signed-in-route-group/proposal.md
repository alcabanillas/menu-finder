# Proposal: Rename Route Group `(app)` to `(signed-in)` (MF-53)

## Why

The route group folder `src/app/(app)/` is confusing: sitting directly under `src/app/`, `(app)` looks like part of the URL path (`/app/menu`) and does not express what its enclosed pages have in common. These pages are the authenticated views that require an active session and share the protected navigation shell (`AppShell`, MF-51.1 D1). Renaming the directory to `src/app/(signed-in)/` makes this boundary immediately obvious in code organization without changing any external URLs.

Now that both MF-23 (`/menu`) and MF-24 (`/shopping-list`) are merged into `main`, this refactoring can be completed cleanly without branch conflicts.

## What Changes

- Rename the directory `src/app/(app)/` to `src/app/(signed-in)/`.
- Update module import specifiers in tests and actions that explicitly referenced `@/app/(app)/...` to `@/app/(signed-in)/...`.
- Update `src/app/protected-pages.test.ts` to inspect the `(signed-in)` directory pattern.
- Update documentation comments referencing `(app)` (such as in `src/app/page.tsx`).
- Public URLs (`/planner`, `/menu`, `/shopping-list`) remain completely unchanged because Next.js route group parenthetical folders are omitted from URL path resolution.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`).

## Impact

- **Affected code**:
  - `src/app/(app)/` renamed to `src/app/(signed-in)/`
  - `src/app/protected-pages.test.ts`
  - `src/app/page.tsx`
  - Tests referencing `@/app/(app)/`: `layout.test.tsx`, `menu/page.test.tsx`, `planner/actions.test.ts`, `planner/page.test.tsx`, `shopping-list/actions.test.ts`, `shopping-list/page.test.tsx`
- **Security & OWASP**:
  - OWASP A01:2021 (Broken Access Control): Route protection must remain strictly intact for all enclosed pages. The automated structural test `src/app/protected-pages.test.ts` enforces that all Server Actions under the group call `requireUser()`.
  - No database schemas, data repositories, or session logic are altered.
- **Related Decisions**:
  - ARQ-nextjs: Next.js App Router route group conventions.
  - ARQ-hexagonal / ADR-001 §5: `src/app/` as the primary web adapter.
