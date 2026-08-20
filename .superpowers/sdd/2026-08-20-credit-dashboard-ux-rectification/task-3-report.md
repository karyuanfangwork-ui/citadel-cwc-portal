# Task 3: ManagerLane dashboard cards

## Scope delivered

- Replaced the raw manager-lane sections with responsive pipeline, team-performance, operational-alert, and recent-activity cards.
- Built the five pipeline cards from `buildPipelineStages` and used `formatPipelineState` for the bottleneck label, keeping the existing props/API shape unchanged.
- Added accessible names and descriptions for the dashboard regions and metrics. Pipeline cards expose application count, percentage of total, and average days when available.
- Added the required exact empty and unavailable states, without rendering empty lists.
- Added alert descriptions and review links, plus actor/action/application/relative-time activity entries.

## TDD evidence

1. Initial focused run: 4 existing ManagerLane contract tests failed against the raw renderer.
2. Added coverage for the exact unavailable states and populated activity details; focused run then failed 6/6 for the missing presentation behavior.
3. Implemented the compact card layout and reran the focused suite. One semantic definition-list naming failure remained.
4. Added explicit accessible names to the metric terms and values; focused suite passed 6/6.

## Verification

- `cd frontend && npm test -- --run src/components/credit/dashboard/__tests__/ManagerLane.test.tsx` — 1 file passed, 6 tests passed.
- `git diff --check` and `git diff --cached --check` — completed with no whitespace errors.

## Scope protection

Only `ManagerLane.tsx` and `ManagerLane.test.tsx` are staged for the Task 3 commit. The shared working tree contains unrelated in-flight changes that were left untouched. This report is intentionally not staged because the task's prescribed commit includes only the assigned source and test files.

## Handoff completion

- Commit: `29ad3fcedde6d40342402e0582733e11a2539f46` — `feat: redesign credit manager dashboard lane`
- Commit scope: `frontend/src/components/credit/dashboard/ManagerLane.tsx` and `frontend/src/components/credit/dashboard/__tests__/ManagerLane.test.tsx` only (232 insertions, 3 deletions).
- Fresh focused verification: `cd frontend && npm test -- --run src/components/credit/dashboard/__tests__/ManagerLane.test.tsx` — 1 file passed, 6 tests passed (478 ms).
- `git show --check 29ad3fc` and `git diff 29ad3fc^ 29ad3fc --check` for the assigned files completed with no whitespace errors.

---

## Fix round 1: Preserve backend alert filter URLs

### Review finding and root cause

`ManagerLane` discarded each alert's backend-provided `filterUrl`, then constructed `/credit/applications?alert=<id>` locally. Those `alert` query parameters are not the supported application-list filters.

### Remediation

- Extended `AlertsData` so `highDsr`, `expiredBureau`, and `amlReview` retain their `filterUrl` fields.
- Passed those URLs through the active alert presentation data and used them directly for each **Review applications** link.
- Added a focused regression test covering the High DSR, expired-bureau, and AML URLs.

### TDD and verification

1. Added the regression expectation and ran the focused suite: it failed as expected because High DSR rendered `/credit/applications?alert=high-dsr` instead of `/credit/applications?filter=highDsr`.
2. Implemented the data-preserving link change.
3. Ran `cd frontend && npm test -- --run src/components/credit/dashboard/__tests__/ManagerLane.test.tsx`: 1 file passed, 7 tests passed.

### Scope protection

- Changed only `ManagerLane.tsx`, `ManagerLane.test.tsx`, and this Task 3 report.
- Did not modify legacy `CreditDashboard` markup.
- Left the optional **Other** pipeline stage unchanged.
