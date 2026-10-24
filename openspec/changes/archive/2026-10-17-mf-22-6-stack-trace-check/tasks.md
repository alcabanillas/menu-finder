# Tasks

## 1. Temporary button (PR 1)

- [x] 1.1 RED: in `src/features/menu-planner/components/stack-trace-check-button.test.tsx`, write that the button "Lanzar error de prueba" renders and that clicking it raises an uncaught `Error` with the message `MF-22.6 stack trace check` (design D1). See it fail
- [x] 1.2 GREEN: write `stack-trace-check-button.tsx` as a client component with `Button` from `src/shared/ui/` (design D2), and verify 1.1 passes
- [x] 1.3 Render it in `src/app/(signed-in)/planner/page.tsx` below `PlannerSearch`, and verify `src/app/(signed-in)/planner/page.test.tsx` and `pnpm typecheck` pass
- [x] 1.4 Run `pnpm test:coverage`, ask the author for the version of PR 1, and open it

## 2. Production check (author)

- [x] 2.1 Author, after merging PR 1: `pnpm release`, then sign in on production, open `/planner`, reload, and click the button
- [x] 2.2 Author: in Sentry, verify the event `MF-22.6 stack trace check` arrived with no cookies, headers or request data, and that its top frame names `src/features/menu-planner/components/stack-trace-check-button.tsx` with the line of the `throw`. If it is minified, read the Sentry lines of the Vercel build log and record the cause here before archiving. Result on 2026-10-17, v0.4.1: the event arrived unhandled through `auto.browser.global_handlers.onerror`, with its top frame `src/features/menu-planner/components/stack-trace-check-button.tsx:17:13` in `throwCheckError` and the original source around it

## 3. Removal (PR 2)

- [x] 3.1 Delete `stack-trace-check-button.tsx` and its test, and the line in `page.tsx`. Verify `git diff 7a392d1 -- src/app/(signed-in)/planner/page.tsx src/features/menu-planner/components/` shows nothing of the button, and `page.test.tsx` and `pnpm typecheck` pass
- [x] 3.2 Mark MF-22.6 done in `context/roadmap.md`
- [x] 3.3 Go through `context/seguridad/safety-first.md` §4 and record the result below
- [x] 3.4 Run `pnpm test:coverage`, ask the author for the version of PR 2, archive the change and open PR 2
- [ ] 3.5 Author, after merging PR 2: `pnpm release`, and verify `/planner` in production has no "Lanzar error de prueba" button
  - Found after PR 2: PR #60 (MF-22.7 and MF-22.8), merged after it, brought back the button, its test and the line in `page.tsx`, so v0.4.2 still showed it. PR 3 removes them again, with version 0.4.3

## 4. Release script (PR 2)

Found in task 2.1: `pnpm release` pushed the tag `v0.4.1` and showed nothing while the pre-push hook ran, about 5 minutes per push, so it looked stuck and the push of `production` was cut. `production` was moved to `d1bf6e9` by hand with `--no-verify`, and the `release` check passed.

- [x] 4.1 RED: in `scripts/release/publish-steps.test.ts`, write that `publishSteps` tags the commit, pushes the tag and moves `production`, in that order, each with a label, and that both pushes carry `--no-verify`. See it fail
- [x] 4.2 GREEN: write `scripts/release/publish-steps.ts`, and make `publish` in `scripts/release/index.ts` print each label and run each step with its output in the terminal. Verify 4.1 and `release-problems.test.ts` pass, and `pnpm typecheck` and `pnpm knip`
- [x] 4.3 Explain in `context/runbooks/despliegue.md` ("Publicar una versión") that the script says what each step does and that the pushes skip the pre-push hook, decided by the author on 2026-10-17

## Safety review (`context/seguridad/safety-first.md` §4)

- Business and security decisions in the backend: not applicable. The button only threw in the browser, and it is gone.
- New endpoint: none. No server action either.
- User and permissions from the session: not applicable. `/planner` kept `requireUser`.
- Negative tests: not applicable, no new input or endpoint.
- Minimum data returned: the event carried a fixed message and its stack trace; `dataCollection` stays off.
- Secrets: none in the diff.
- New dependencies: none.
- Database queries: none.
- Unexpected input: none. Nothing reaches the LLM.
- Sensitive actions logged: not applicable.
- Deviation from a rule: the release pushes skip the pre-push hook (`--no-verify`), decided by the author on 2026-10-17 and explained in `context/runbooks/despliegue.md` ("Publicar una versión"). The commit has already passed `checks` and `e2e` in CI.

## Workflow follow-up

- Archive (`/opsx:archive`) goes in PR 2, after task 2.2 is recorded.
