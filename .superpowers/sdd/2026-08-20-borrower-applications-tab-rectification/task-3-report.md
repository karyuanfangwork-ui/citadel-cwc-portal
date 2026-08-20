# Task 3 — Borrower Applications tab verification report

## Status

DONE_WITH_CONCERNS

Commit: `27eb177 test: cover borrower applications tab`

The existing demo fixture seeds applications for all borrower profiles. The new Playwright assertion opens Applications, verifies `?tab=applications`, and checks for a visible application-detail link without hard-coding an application number or changing fixture data.

## Files changed

- Committed test change: `frontend/e2e/credit/borrower-workspace.spec.ts`
- This report: `.superpowers/sdd/2026-08-20-borrower-applications-tab-rectification/task-3-report.md` (committed with the Fix round 2 fixture correction)

No backend application-filtering file was modified. All other dirty borrower-workspace files were left untouched and unstaged.

## Verification commands and results

| Command | Result |
| --- | --- |
| `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx` | PASS — 2 files, 4 tests passed. |
| `cd frontend && npm run build` | PASS — Vite production build completed successfully (2,157 modules; 3.72s). |
| `cd backend && npm test -- src/credit/services/__tests__/creditApplication.list.test.ts` | PASS — 1 suite, 8 tests passed. |
| `git diff --check` (before commit) | PASS — no whitespace errors. |
| `git diff --cached --check` | PASS — no whitespace errors in the staged test. |
| `git diff --check` (after commit) | PASS — no whitespace errors. |
| `git status --short --branch` (before commit) | Confirmed the known pre-existing borrower-workspace modifications/untracked files plus the scoped untracked Playwright spec. |
| `git diff HEAD~1 -- frontend/pages/BorrowerProfileDetail.tsx frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx frontend/src/components/credit/borrower360/BorrowerOverview.tsx` (before test commit) | Reviewed the intended rectification diff: Applications is URL-backed and API-loaded in `BorrowerProfileDetail`; `BorrowerApplicationSummary` is the shared summary component; `BorrowerOverview` was an existing untracked workspace file. |
| `git status --short --branch` (after commit) | `dev2.0...origin/dev2.0 [ahead 7]`; the scoped Playwright spec is no longer dirty. The pre-existing borrower-workspace changes remain present and unstaged. |
| `git diff HEAD~1 -- frontend/pages/BorrowerProfileDetail.tsx frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx frontend/src/components/credit/borrower360/BorrowerOverview.tsx` (after test commit) | PASS — no output, as the new HEAD contains only the Playwright test. |
| `git show --check --stat --oneline HEAD` | PASS — `27eb177` contains one new file, `frontend/e2e/credit/borrower-workspace.spec.ts`, with no whitespace errors. |
| Final `git diff --check`, `git diff --no-index --check /dev/null .superpowers/sdd/2026-08-20-borrower-applications-tab-rectification/task-3-report.md`, and `git status --short --branch` | PASS — no whitespace errors in tracked changes or this report; final status remains ahead 7 with only the known pre-existing borrower-workspace files dirty. |
| `cd frontend && npx playwright test --project=credit e2e/credit/borrower-workspace.spec.ts -g "shows borrower readiness, next actions, and applications"` | BLOCKED before test execution — sandboxed Chromium launch failed with `bootstrap_check_in ... Permission denied (1100)`; all five `credit-setup` workers failed and the selected test did not run. |
| Same focused Playwright command with browser-launch permission | BLOCKED by seeded credit authentication — Chromium launched and the frontend/API responded, but `admin@test.local` (`password123`) and both E2E SOD users stayed on `/login` with the UI message `Invalid email or password`. The non-credit setup account passed; four credit setup tests failed and the selected borrower test did not run. |
| Fix round 2: same focused Playwright command after aligning `admin@test.local` to `abc@123` | BLOCKED only by absent SOD identities — credit analyst, credit approver, and non-credit setup passed; `e2e-analyst@test.local` and `e2e-approver@test.local` each remained on `/login`; 3 setup tests passed, 2 failed, and the selected borrower test did not run. |

## Concerns

- The production build exited successfully but printed pre-existing dynamic/static import chunking warnings, a >500 kB chunk warning, and `pyenv: cannot rehash ... isn't writable`. None caused a non-zero exit.
- The backend Jest command passed but printed its existing forced-exit/open-handles advisory after completion.
- Fix round 1 attempted the narrowest configured browser command for the new assertion. Browser-launch permission was granted; no browser, frontend availability, or backend-reachability issue remains.
- Fix round 2 corrected the in-repo fixture mismatch: `backend/prisma/seed.ts` hashes `abc@123` for `admin@test.local`, so both admin-backed E2E defaults now use `abc@123`. Credit analyst and approver authentication now pass.
- The selected borrower test remains unexecuted because the `credit` project runs every `credit-setup` test first. The live database does not contain the SOD identities: `backend/prisma/seed.ts` never creates them, while `backend/prisma/seed-credit.ts --e2e` does. Their configured `abc@123` passwords are therefore rejected. No seed or production auth logic was changed, as required.
- Initial `git add` failed because the workspace sandbox could not create `.git/index.lock`; there was no stale lock. The same single-file stage/check/commit succeeded after the required repository-write permission was granted.
