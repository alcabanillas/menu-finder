# Design

## Context

The browser starts Sentry in `src/instrumentation-client.ts` and reports uncaught exceptions and unhandled rejections through the SDK's global handlers (MF-22.2). A production build with `SENTRY_AUTH_TOKEN` uploads the source maps and deletes them from the output. `/planner` is a server component that renders the client component `PlannerSearch` (`src/app/(signed-in)/planner/page.tsx`). Merging into `main` does not deploy: `pnpm release` publishes a tagged commit of `main` (`context/runbooks/despliegue.md`).

## Goals / Non-Goals

**Goals:**
- One Sentry event whose top frame is the button's file in `src/`, with its original line.
- Nothing of the check left in the code or in production when the change ends.

**Non-Goals:**
- No spec scenario and no permanent test: the check is manual and runs once.
- No change to the Sentry configuration, the CSP or the source-map upload.

## Decisions

### D1. Throw in the click handler

The button's `onClick` throws `new Error('MF-22.6 stack trace check')`. React does not catch errors thrown in event handlers, so the error reaches `window.onerror` and the SDK's global handler reports it, which is the path MF-22.2 set up.

Alternative rejected: throwing during render. A render error goes to the nearest React error boundary, so whether it reaches Sentry would depend on that boundary, not on the global handler under test.

### D2. A client component of its own in the feature

`StackTraceCheckButton`, in `src/features/menu-planner/components/stack-trace-check-button.tsx`, with `'use client'`, rendered by `page.tsx` below `PlannerSearch`. A file of its own gives the stack trace a file name that says what it is, and the removal deletes one file and one line. It uses `Button` from `src/shared/ui/` with the `secondary` variant and the text "Lanzar error de prueba".

Alternative rejected: adding it inside `PlannerSearch`. The removal would touch a component that MF-22.7's other session may be changing.

### D3. The removal is a second PR and a second release

The button must be in production for the check, and must not stay there. The first PR adds it and is released; after the check, the second PR deletes it, archives the change and is released too. Each PR asks the author for its version before `gh pr create`.

## Risks / Trade-offs

- [The first release publishes everything merged since v0.4.0, MF-22.5 included] → The author decides when to release; the proposal says so.
- [A signed-in user clicks the button in the window between releases] → Only CLI-created accounts exist (SEG-sistema-cerrado). The event carries a fixed message and no request data.
- [The stack trace is still minified] → The check fails, and the removal still ships. The cause is looked for in the Sentry lines of the Vercel build log, as in MF-22.2 task 7.4, before archiving.

## Migration Plan

1. PR 1 with the button, merged, and released by the author with `pnpm release`.
2. The author signs in on production, opens `/planner`, reloads, clicks the button, and checks in Sentry that the event's top frame names `src/features/menu-planner/components/stack-trace-check-button.tsx` with the line of the `throw`.
3. PR 2 deletes the button and its test and archives the change. Released by the author, and `/planner` checked without the button.

Rollback: Vercel's Instant Rollback to the previous deployment, or merging PR 2 earlier.
