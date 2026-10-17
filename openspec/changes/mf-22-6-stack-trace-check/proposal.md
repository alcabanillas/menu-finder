## Why

MF-22.6 (`context/roadmap.md`, item MF-22). MF-22.2 uploads the browser source maps to Sentry and checked in production that the frame of the SDK chunk is unminified. It could not check that a stack trace names a file of `src/`: code typed in the browser console is not in the bundle (`openspec/changes/archive/2026-10-13-mf-22-2-browser-errors/design.md`, Migration Plan). The author decided on 2026-10-12 to check it with a temporary button that throws, removed in the same subtask. `/planner` has UI since MF-22.4, so the check can run now.

## What Changes

- **A temporary button in `/planner`** that throws an uncaught error with a fixed message when it is clicked. It lives in `features/menu-planner/` and the planner page renders it.
- **A production check by the author:** after the release, a click on the button produces one Sentry event whose stack trace names the button's file in `src/` with its original lines.
- **The button is removed** in this same change, with its test, and the removal is released too, so it does not stay in production.
- Two pull requests and two releases: one that adds the button and one that removes it. The version of each is asked of the author before each PR (AGENTS.md, "Versión antes de abrir la PR").

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`): the button is temporary, and when the change ends no requirement has changed. The requirement it checks, "Readable stack traces without serving source maps" in `openspec/specs/error-reporting/spec.md`, already exists.

## Impact

- **Code:** a new client component in `src/features/menu-planner/components/` with its test, and `src/app/(signed-in)/planner/page.tsx`. Both are back to their current state at the end.
- **Dependencies and configuration:** none. The source-map upload of MF-22.2 is reused as it is.
- **Size:** ~1 h of work, as in the roadmap, plus the wait for two releases.
- **Decisions it relies on:** OPS-observabilidad, SEG-datos-nutricionista, SEG-sistema-cerrado, OPS-ci-cd.
- **Release side effect:** the first release publishes everything merged into `main` since v0.4.0, MF-22.5 included.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* one error event with a fixed message and its stack trace. No request text, user data or nutritionist data: the message is a constant, and `dataCollection` stays off (SEG-datos-nutricionista).
  - *Abuses:* a signed-in user clicking the button many times to spend the Sentry quota. Only accounts created by the CLI can reach `/planner` (SEG-sistema-cerrado), Spike Protection and the free monthly quota cap the cost, and the button lives only between the two releases.
  - *Not applicable:* no endpoint, no server action, no session or authorization change (A01), no new dependency (A03), no input.
