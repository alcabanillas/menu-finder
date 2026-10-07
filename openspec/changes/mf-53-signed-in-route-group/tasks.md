## 1. Directory Migration and Imports

- [x] 1.1 Move `src/app/(app)` directory to `src/app/(signed-in)` via git and verify `src/app/(app)` no longer exists while `src/app/(signed-in)` is populated.
- [x] 1.2 Update module import paths and test mocks from `@/app/(app)/...` to `@/app/(signed-in)/...` in `src/app/(signed-in)/` and verify typechecking passes with `pnpm typecheck`.
- [x] 1.3 Update route group documentation comments in `src/app/page.tsx` and verify no obsolete `(app)` references remain in `src/app/`.

## 2. Security Test & Quality Gates

- [x] 2.1 Update the route group directory filter in `src/app/protected-pages.test.ts` from `(app)` to `(signed-in)` and verify the test passes with `pnpm test:run src/app/protected-pages.test.ts`.
- [x] 2.2 Run complete test and lint verification (`pnpm lint`, `pnpm test:run`, `pnpm test:e2e`) and verify all suites pass with zero errors.
