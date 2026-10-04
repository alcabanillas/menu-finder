## 1. Checks before coding

- [x] 1.1 The author confirms D2 to D5 of `design.md` (port, use case, wiring with a fixed base URL, arguments); verify: the answer is in the chat and `design.md` says "decided" for each
- [x] 1.2 Check that `knip` and the ESLint boundary rules accept a port, a use case and a command that nothing imports yet (the container and `index.ts` import them only in section 4); verify: the order of sections 2 to 4 keeps `pnpm lint` and `pnpm knip` green at each commit, or the exception is written here

## 2. Port and use case (tests first)

- [x] 2.1 Write the use-case tests with a fake `AccountCreator`: the name defaults to the part of the email before the `@` (`ana@example.test` gives `ana`), a given name is kept, and each `AccountError` of the port comes back unchanged; verify: they fail because the use case does not exist
- [x] 2.2 Create `src/application/ports/account-creator.ts` (with `NewAccount` and `AccountError` moved from the infrastructure file) and `src/application/use-cases/create-account.ts`, and make `infrastructure/auth/create-account.ts` implement the port importing those types; verify: the tests of 2.1 pass, the tests of `create-account.test.ts` of MF-20.1 still pass, and `pnpm typecheck` is clean

## 3. The command (tests first)

- [x] 3.1 Write the `runCreateAccount` tests with fakes for the use case, `readPassword` and `print`: success prints `Created account <email>`, exits 0 and no line contains the password; `email-taken`, `invalid-input` (names the field) and `failed` exit 1 with one line each and no password in any line; an empty password prints that a password is required, exits 1 and creates nothing; missing variables are named and exit 1 (reuse `missing-variables.ts`); verify: they fail because the command does not exist
- [x] 3.2 Write the `runCli` tests: `account <email>` and `account <email> <name>` reach the command, `account` alone, `account a b c` and `account a b <password>`-shaped third and fourth arguments print the usage and exit 2 without reading a password, and `migrate extra` is still a usage error; verify: they fail
- [x] 3.3 Implement `src/cli/commands/create-account.ts` and the arguments handling of `src/cli/run-cli.ts` (each command declares how many arguments it takes) with the minimum code for 3.1 and 3.2, the password read only after the arguments and variables are valid, and every printed error line through `redactSecrets`; verify: the tests of 3.1 and 3.2 pass and the existing `run-cli` and command tests still pass

## 4. Wiring and the real password reading (tests first)

- [x] 4.1 Write the container test: `createAccount` with a missing `DATABASE_URL_UNPOOLED` or `BETTER_AUTH_SECRET` returns `missing-variables` naming each one, without connecting (pattern of `cli-container.test.ts`); verify: it fails
- [x] 4.2 Add `createAccount` to `createCliContainer` (variables checked first, `withPool`, `AuthAccountCreator` with the secret and the fixed base URL of D4, a named constant with the comment that D4 explains), and wire the command and `readPassword` in `src/cli/index.ts`: no-echo prompt with `readline` when `process.stdin.isTTY`, one line of stdin otherwise; verify: the test of 4.1 passes, `account-creation-boundary.test.ts` still passes (only `cli-container.ts` imports the open setup) and `pnpm lint` shows no boundary error
- [x] 4.3 Write the integration test (skipped without `DATABASE_URL_TEST`, as in MF-20.1): through the container, create an account, then sign in with the closed setup of `createAuth` and get a session; a second creation with the same email fails and the first password still signs in; hostile email and name values (`' OR 1=1; --`, emoji, 10 000 characters, null byte) end in a result, not a throw, with no other row changed; verify: it fails before 4.2 is wired and passes after, against the Neon development branch

## 5. Run it for real and close

- [ ] 5.1 Update the usage lines of `run-cli.ts`, `context/tareas/T0-extraccion-previa.md` (the command in the local runbook, and whether the demo account needs a line: the open question of `design.md`) and `context/roadmap.md` (MF-20.2 ✅ with the archive link; new item "change a password from the CLI", with the author's agreement); verify: `grep` of the codes and a read of the changed lines
- [ ] 5.2 On the development branch, run `pnpm ingest account <test-email>` by hand in the Windows terminal (prompt with no echo), then `echo <password> | pnpm ingest account <other-email>`, then a repeated email, then with a variable unset; verify: the password is never visible on screen or in the shell history, the repeated email and the unset variable give their messages and exit codes, and a sign-in with the first account works (the **Result** of the roadmap item)
- [ ] 5.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm knip`; verify: all pass
- [ ] 5.4 Update `context/decisiones.md` §1.8 (SEG-auth or SEG-sistema-cerrado: the CLI creates accounts with `pnpm ingest account`, the password comes from a prompt or stdin, an existing email is an error), only after the author confirms the wording; verify: a read of the changed lines
- [ ] 5.5 Go through the checklist of `context/safety-first.md` §4 before archiving and record the answers at the end of this file, with the CI deviation (MF-44) and the sign-in log (MF-20.3) stated; verify: every item has an answer and a reason where it is "not applicable"
