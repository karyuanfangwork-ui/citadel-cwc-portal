# Agent Dashboard Validation Review

Status: Implementation and automated evidence are substantially complete, but not release-ready. This is an evidence record, not deployment approval.

## Verified behavior and evidence

- SLA pause semantics: persisted `slaDueAt` already includes completed pauses; an active pause contributes only its current elapsed interval. Fixed-time lifecycle cases cover no pause, completed/repeated pauses, currently paused, overdue-then-paused, and reopened work with an older completed clock.
- Pure TypeScript and SQL SLA classification parity includes deadline boundaries, terminal results, ambiguous/missing evidence, and reopened work.
- Isolated data fixture: guarded Jest integration test checks `current_database() = help_center_test` before writes. Seeds 243 requests, tests all dashboard SLA states, finds a distinctive old breached match beyond the first 200, verifies aggregate counts, stable pagination, created/updated sorts, critical-only filtering, full-name search, and cleans up.
- A second isolated 10,000-request fixture ran full-page, distinctive-summary search, SLA-metrics, and attention query plans: 13.715 ms, 10.673 ms, 8.021 ms, and 15.188 ms respectively. Plans used request tenant/service-desk, approval, participant, and SLA-clock indexes; sequential scans also appeared. Root shared-buffer hits were 10,425 / 10,411 / 9,609 / 37,209, with zero shared reads. This is useful 10k-row local evidence, not production-scale telemetry or a latency service-level guarantee.
- Mounted request-router security integration: 3/3 tests passed for agent access without `report:read`, tenant/confidentiality scoping across rows and aggregates, cross-team personal assignments, unassigned team work, end-user denial, admin-only scope denial, invalid query validation, and export permission denial.
- Frontend interactions: dashboard and formatting suites passed 25/25. Coverage includes summary/attention/filter/tab actions, unavailable averages, no-team scope hiding, checkbox Space, reference-link Enter, current-page selection/export, hidden-ID selection state, export feedback, pagination totals above 200, query changes, and page shrink after refresh.
- Full frontend unit suite ran: 141/142 files and 759/760 tests passed. The single failure is unrelated to this dashboard: `applicationWorkspaceAreas.test.ts` expected `repayment-capacity` for an INDIVIDUAL/PERSONAL_FAST view but received only `income`.
- Browser smoke: dedicated dashboard interaction suite passed 2/2 (old search match, Due-soon card filter, closed SLA presentation, visible-only export, refresh failure/recovery).
- Responsive browser suite passed 5/5 at 1440x900, 1280x720, 768x1024, 640x360, and 390x844. The 640x360 case is only a narrow-viewport proxy for 200% zoom.
- Dedicated dashboard accessibility suite passed 2/2 at desktop and mobile with WCAG 2.1 AA axe checks, semantic landmarks, and named controls. The full a11y project now has 13 passed/4 failed; failures are in the generic Dashboard 404 fallback, My Requests unnamed select, Knowledge Base 404 fallback, and Reports status contrast. The agent dashboard passes both dedicated tests and its existing screen axe test.
- Full smoke project passed 13 tests with 1 pre-existing workflow-designer test skipped; includes the dashboard 5-viewport responsive suite and 2 dashboard journey tests.
- Shared breadcrumb and TopBar dropdown-chevron contrast was improved after axe evidence; dedicated dashboard axe checks pass after those changes.
- Backend build passed. Focused backend query/classifier/service suites passed 43/43. The isolated 243-row suite passed 12/12. Frontend production build passed; existing Vite chunk/dynamic-import warnings remain.
- `git diff --check` passed. All work remains uncommitted on `dev2.0`; no push or deployment occurred.

## Outstanding acceptance gates

1. Actual browser zoom at 200% remains unverified. A headed Playwright shortcut attempt left the CSS viewport at 1280 pixels; keyboard input did not change browser zoom. The 640x360 proxy must not be represented as equivalent evidence.
2. Query performance now has a 10,000-row isolated local baseline; larger production-like data volume, representative data distribution/statistics, and live telemetry are still unverified.
3. Browser role coverage is incomplete. The new smoke journey uses the existing authenticated `CREDIT_ANALYST` login helper and mocked dashboard API responses; backend mounted-route coverage supplies the actual agent/no-report-permission checks, and component tests cover no-team scope hiding. No dedicated browser journey yet exercises a no-team agent or an agent without export permission.
4. One local non-deleted request summary contains nested entity encoding. Aggregate-only inspection found 13 rows with `&amp;` and one with `&amp;amp;`; raw request text was not emitted. The dashboard now decodes a normal entity layer and strips markup as plain text. Further decoding is deferred because the nested sequence could be literal user text.
5. The full frontend suite was run and has one unrelated baseline failure. The full backend suite was not run because repository integration tests may write to shared `help_center`; relevant dashboard tests were run in isolation or against `help_center_test`. A complete final diff review is still pending.
6. Frontend `npx tsc --noEmit` reports unrelated existing diagnostics in `pages/CrmOpportunities.tsx` and `src/components/credit/detail/ApplicationPartiesWorkspace.tsx`; Vite build passes. These should be recorded as baseline or resolved separately before treating typecheck as green.
7. A focused backend Jest run passed assertions but logged BullMQ/ioredis teardown errors from shared test setup. Resolve or clearly classify this harness warning before using it as clean full-suite evidence.

## Commands/results recorded

Backend (`backend/`):

- `npm run build` — passed.
- `npm test -- src/services/__tests__/agent-dashboard-query.service.test.ts src/services/__tests__/agent-dashboard-sla-query-parity.test.ts src/services/__tests__/agent-dashboard.service.test.ts src/services/__tests__/agent-dashboard-sla.service.test.ts --runInBand` — 4 suites, 43 tests passed.
- Isolated `agent-dashboard-243-fixture.integration.test.ts` via guarded child-process database-target rewrite to `help_center_test` — 1 suite, 12 tests passed.
- Isolated `agent-dashboard-10k-query-plan.integration.test.ts` via the same guard — 1 suite, 1 test passed; the 10,000-row page/metrics/attention plan timings and buffer counts are recorded above.
- Mounted `src/__tests__/agent-dashboard.integration.test.ts` via the same exact-database guard — 1 suite, 3 tests passed.
- Read-only cleanup checks on `help_center_test` reported zero dashboard fixture tenants and zero requests after the 243-row run, and zero performance fixture tenants/requests after the 10,000-row run.

Frontend (`frontend/`):

- `npm test -- src/components/agent-dashboard src/utils/__tests__/format.test.ts` — 5 files, 25 tests passed.
- `npm test` — 141/142 files passed, 759/760 tests passed; the unrelated failure is `src/components/credit/detail/__tests__/applicationWorkspaceAreas.test.ts`.
- `npm run build` — passed with existing Vite chunk/dynamic import warnings.
- `npm run test:e2e:smoke -- --workers=1` — 13 passed, 1 skipped (workflow designer).
- `npm run test:e2e:a11y -- --workers=1` — 13 passed, 4 failed in unrelated existing screens (generic Dashboard 404 fallback contrast, My Requests unnamed select, Knowledge Base 404 fallback contrast, and Reports status contrast). Agent Dashboard passes its dedicated and existing screen audits.
- `npx playwright test --project=a11y e2e/a11y/agent-dashboard.a11y.spec.ts --workers=1` — 2 passed after shared contrast fixes.
- `npx tsc --noEmit` — failed only on the two unrelated files listed above in the recorded run.

## Release decision

Not ready to push/deploy based solely on this review. Complete the outstanding gates, review the full diff, then commit when explicitly requested. Push and production deployment are separate actions; deployment requires a separate explicit approval and the production backup-first preflight.
