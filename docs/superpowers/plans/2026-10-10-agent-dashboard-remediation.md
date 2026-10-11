# Agent Dashboard Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Review status:** Approved by the user; implementation is underway. Verified evidence and outstanding gates are tracked in `docs/superpowers/reviews/2026-10-10-agent-dashboard-validation.md`.

**Goal:** Make the agent dashboard a reliable view of personal and team work, with consistent SLA semantics, complete search and counts, accessible interactions, and explicit loading/error states.

**Architecture:** Add an authenticated, policy-scoped dashboard read API under `/api/v1/requests/agent-dashboard`. A backend service owns queue membership, aggregate counts, pagination, sorting, and SLA classification. React consumes a typed response and separates query state, presentation, and selection behavior.

**Tech Stack:** Existing Express, TypeScript, Prisma/PostgreSQL, Zod, React, Axios, Vitest/Testing Library, Jest, and Playwright. No new dependencies.

## Global constraints

- Preserve tenant, policy visibility, confidentiality, soft-delete, and export authorization rules. Every dashboard query, including aggregates and filter options, applies the same access predicate.
- Dashboard access must not require `report:read`; do not grant additional report permissions to agents.
- Preserve existing request and report endpoint contracts. New dashboard semantics are additive.
- Use backend status classifications; remove the dashboard's hardcoded closed-status array.
- No migrations, historical backfills, workflow mutations, bulk assignment, or automatic escalation are included.
- Application code remains unchanged until this plan is approved. Proposed paths below are new unless marked existing.
- Never equate missing data, denied permission, network failure, or invalid timestamps with zero.
- Retain current visual language and existing UI primitives. Refactor only the dashboard and directly needed helpers.

## 1. Approach and alternatives

**Recommended: dedicated dashboard API plus targeted page refactor.** This avoids coordinating several partially compatible reporting/list requests and makes scope/count/filter rules testable together. It adds a bounded backend module.

**Alternative: extend the existing request list and report APIs.** Less routing work, but dashboard-specific scope and SLA behavior would affect other consumers and still require multiple independently refreshed responses.

**Alternative: frontend-only corrections.** Fastest for styling and closed-ticket warnings, but cannot solve incomplete search, full totals, reporting permissions, or authoritative SLA sorting. This is insufficient for the audit's high-priority findings.

## 2. Proposed product behavior

### Scope and queue membership

Provide an explicit scope selector: **My work**, **My team** for agents with a team, and **All accessible work** for admins. Initial scope is My work. Switching scope resets the page and selection.

- My work: policy-visible requests assigned to the current user.
- My team: policy-visible requests whose service desk code or assigned team matches the authenticated agent team. The client cannot submit another team's code.
- All accessible work: admin-only scope, still restricted by the existing policy/tenant rules.
- Tabs within scope: **Open**, **Closed**, **All**. An **Unassigned** tab is available in team/admin scopes and includes active tickets only.
- Closed includes all backend-classified terminal outcomes. Display each row's actual status; do not describe cancelled/rejected work as resolved.
- Keep personal work accessible even when assigned across teams. Users without a configured team see My work and an explanatory team-unavailable message.

### Summary cards

All cards share the selected scope and request-type filter. Search, priority, SLA filter, and tab affect the table, not the cards; a caption makes this explicit. Tab badges are full-dataset counts within the same scope/request type, before table-only filters.

| Card | Definition | Click behavior |
| --- | --- | --- |
| Open tickets | Nonterminal requests | Open tab; clear table-only filters |
| Due soon | Active, unpaused deadline within the next 24 hours | Open tab + Due soon |
| SLA breached | Active, unpaused deadline at or before server time | Open tab + Breached |
| Avg resolution | Mean elapsed created-to-resolved hours for requests resolved in the last 30 days using backend positive-resolution classification | Informational; no button |

Use a real four-column grid on wide screens, two columns on medium screens, and one on narrow screens. Show the average's sample size and “Last 30 days · elapsed time.” Return null and show “No resolution data” when the sample is empty; never round null to 0h. Unassigned counts appear in the tab rather than adding a fifth card.

The backend currently classifies only RESOLVED, COMPLETED, and PAYMENT_COMPLETED as positive resolution outcomes. Preserve this definition for compatibility and document it; expanding business classifications is a separate decision.

### SLA semantics

The dashboard is explicitly a **resolution SLA** view. Response SLA and OLA clocks are outside this change.

| State | Rule | Presentation |
| --- | --- | --- |
| BREACHED | Active request, clock unpaused, deadline <= now | Red badge; restrained row accent |
| DUE_SOON | Active request, clock unpaused, now < deadline <= now + 24h | Amber badge |
| ON_TRACK | Active request, clock unpaused, deadline > now + 24h | Neutral/green badge |
| PAUSED | Active request, resolution clock paused | “Paused”; frozen remaining duration |
| NO_SLA | Active request, no resolution SLA | “No SLA” |
| MET | Successful terminal outcome with reliable completed-clock evidence at/before final deadline | “Met SLA”; no alert row |
| MISSED | Successful terminal outcome with reliable completed-clock evidence after final deadline | “Missed SLA at resolution”; no active overdue countdown |
| NOT_APPLICABLE | Cancelled/rejected outcome | “Not applicable” |
| UNKNOWN | Missing/invalid or inconsistent evidence, including historical resolution without a reliable final deadline | “SLA outcome unavailable” |

Boundary tests use a fixed server timestamp. States are mutually exclusive. A previously breached paused clock is shown as Paused; this screen does not assert that a historical breach has been erased.

Prefer persisted RESOLUTION clock evidence where present. For legacy requests without a resolution clock, use request-level deadlines only after Task 1 verifies pause storage behavior. Do not reconstruct a historical met/missed result from today's deadline. Do not include closed outcomes in active breach/due-soon cards.

### Filters, sorting, and attention

- Search reference, summary, requester first/last/full name and request-type name across the entire authorized dataset; 300ms debounce and maximum 200 characters.
- Server filters: request type, priority, and explicit SLA state; include Paused, No SLA, and historical outcomes.
- Default active-work sort: SLA urgency. Active breached first, earliest deadline first; due-soon next; on-track next; paused/no-SLA/unknown last. Priority breaks equal-deadline ties, then createdAt and ID provide stable ordering. Closed records sort after active records in All; closed-only defaults to latest updated.
- Also support latest created, oldest created, and latest updated with deterministic ID tie-breaks.
- Page size 25 by default; choices 25/50/100, maximum 100. Show “1–25 of 243,” not the downloaded-array length.
- Attention strip: top three active breached, due-soon, or critical/high-priority requests in the selected scope, independent of pagination/table filters. Do not include closed tickets. Show a server total and a “View open work” action that clears table-only filters and applies urgency sorting.
- Request-type options come from all authorized requests in scope before the request-type filter, not the current page. Do not expose labels for inaccessible request types.

### Table and interactions

- Columns: selection when export is allowed, reference link, summary, request type, assignee, priority, status, resolution SLA, requester, updated time. Team ownership appears as assignee subtext when relevant.
- Use a real reference link. Remove link semantics and keyboard handlers from the entire row; clicking a noninteractive row area may navigate only if accessibility testing confirms it is useful and safe.
- Summary is two lines with an accessible disclosure for full plain text. Display the original request type without destructively stripping user text prefixes.
- Selection is current-page only. Clear it on page, filter, sort, scope, tab, or result-ID change. Select-all tests visible-ID membership and supports an indeterminate state.
- Show “Export N selected tickets on this page.” Respect `request:export`; use existing server authorization and accessible toast/error UI.
- Same-height labeled filters, coherent focus indicators, semantic tabs, responsive horizontal table scrolling, and visible pagination.
- Distinguish empty queue from no filter matches. Provide Clear filters for the latter.

### Freshness and failure handling

- Successful response includes server `asOf`. All rows, counts, cards, and attention items share that calculation timestamp.
- Abort superseded requests and ignore stale responses. Initial failures show a retry state; refresh failures retain the last good view and label it stale.
- Disable only the refresh button while refreshing. Do not replace existing content with skeletons on every refresh.
- Refresh every 60 seconds while the tab is visible; refresh on return to a visible tab if data is at least 60 seconds old. Clear timers/listeners on unmount.
- A single response avoids publishing new cards with old rows. Counts may naturally change between requests; cross-query consistency is provided by a repeatable-read transaction.
- Authentication/authorization failures are not silently retried or represented as empty queues.

## 3. API contract and file map

New route: `GET /api/v1/requests/agent-dashboard`, registered before `/:id`.

```ts
type DashboardScope = 'mine' | 'team' | 'accessible';
type DashboardQueue = 'open' | 'closed' | 'all' | 'unassigned';
type DashboardSlaState = 'BREACHED' | 'DUE_SOON' | 'ON_TRACK' | 'PAUSED'
  | 'NO_SLA' | 'MET' | 'MISSED' | 'NOT_APPLICABLE' | 'UNKNOWN';
type DashboardSort = 'urgency' | 'created-desc' | 'created-asc' | 'updated-desc';
interface DashboardQuery {
  scope: DashboardScope; queue: DashboardQueue; page: number; limit: 25 | 50 | 100;
  search?: string; requestTypeId?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  slaState?: DashboardSlaState; sort: DashboardSort;
}
interface DashboardSla {
  state: DashboardSlaState; dueAt: string | null;
  remainingMs: number | null; completedAt: string | null;
  evidence: 'resolution-clock' | 'legacy-request' | 'none';
}
interface DashboardTicket {
  id: string; reference: string; summary: string; priority: string; status: string;
  isTerminal: boolean; createdAt: string; updatedAt: string;
  requester: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  assignedTeam: string | null;
  requestType: { id: string; name: string } | null; sla: DashboardSla;
}
interface AgentDashboardResponse {
  asOf: string; scope: DashboardScope; scopeLabel: string;
  availableScopes: DashboardScope[];
  metrics: { open: number; dueSoon: number; breached: number;
    avgResolutionHours: number | null; resolutionSampleSize: number;
    resolutionWindow: { from: string; to: string } };
  queueCounts: { open: number; closed: number; all: number; unassigned: number };
  requestTypes: { id: string; name: string }[];
  attention: { total: number; tickets: DashboardTicket[] };
  tickets: DashboardTicket[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```

Envelope remains `{ status: 'success', data: AgentDashboardResponse }`. Invalid parameters return 400; disallowed scope/queue returns 403. Dates are ISO strings and durations ordinary JSON numbers, never raw BigInt.

Backend new files: `src/validators/agent-dashboard.validator.ts`, `src/controllers/agent-dashboard.controller.ts`, `src/services/agent-dashboard.service.ts`, `src/services/agent-dashboard-sla.service.ts`, `src/security/request-list-scope.ts`. Modify existing `src/routes/request.routes.ts` and `src/controllers/request.controller.ts` only for additive routing and shared access predicates.

Frontend new files: `src/services/agent-dashboard.service.ts`; `src/components/agent-dashboard/{useAgentDashboard,DashboardSummary,DashboardFilters,DashboardTabs,AttentionQueue,TicketTable,DashboardPagination,slaPresentation}.ts[x]`. Modify existing `pages/AgentDashboard.tsx` as the composition entry point. Keep API DTOs in the frontend service; no new shared package.

## 4. Ordered implementation tasks

### Task 1: Lock down SLA and access invariants

**Existing files to inspect:** `backend/src/services/sla-pause.service.ts`, `backend/src/services/sla.service.ts`, `backend/src/constants/requestStatuses.ts`, `backend/src/security/policy.service.ts`, `backend/src/controllers/request.controller.ts`, `frontend/src/components/request-detail/slaDisplay.ts`.

The pause helper currently adds accumulated pause duration, while the request-detail helper states that persisted due dates are extended on resume. This is an unresolved implementation discrepancy, not proof that either can safely be reused.

- [ ] Trace pause, resume, completion, reopen, and multiple RESOLUTION-clock lifecycle paths; record how the final deadline and current clock are determined.
- [ ] Write fixed-time regression fixtures for: no pause; one completed pause; repeated pauses; currently paused; overdue then paused; completed clock; reopened request with an older completed clock.
- [ ] Prove paused time is applied exactly once. Prefer a current persisted resolution clock; treat ambiguous duplicate/current-clock selection as UNKNOWN rather than guessing.
- [ ] Extract `buildRequestListScope(principal): Prisma.RequestWhereInput` to combine existing visibility, confidentiality, and soft-delete predicates using AND. Switch the existing request list to it with parity tests.
- [ ] Test tenant isolation, team matching, personally assigned cross-team tickets, confidential owner/assignee/approver/participant exceptions, and soft-deleted records.
- [ ] Record findings in `docs/superpowers/specs/2026-10-10-agent-dashboard-data-invariants.md`; commit this bounded task after tests pass during execution.

**Produces:** verified deadline precedence and `buildRequestListScope`. If current lifecycle data cannot support reliable historical classification, retain UNKNOWN; do not add a migration.

### Task 2: Implement authoritative SLA classification

**Create:** `backend/src/services/agent-dashboard-sla.service.ts`, `backend/src/services/__tests__/agent-dashboard-sla.service.test.ts`.

**Interface:** `classifyDashboardSla(input: DashboardSlaInput, now: Date): DashboardSla`; input contains terminal/positive-outcome classification and verified clock/request evidence from Task 1.

- [ ] Add table-driven tests for every state and exact deadline/24-hour boundaries before implementing.
- [ ] Implement pure classification using numeric timestamps, verified pause precedence, and terminal evidence. Invalid dates produce UNKNOWN.
- [ ] Implement reusable SQL/Prisma classification expressions for full-dataset filters and sorting; validate parity against the pure classifier for all fixtures.
- [ ] Ensure paused and terminal records cannot contribute to active breach/due-soon counts.
- [ ] Run targeted tests, inspect the diff, and commit.

**Example behavioral test:**

```ts
expect(classifyDashboardSla(activeDueAt(now), now).state).toBe('BREACHED');
expect(classifyDashboardSla(activeDueAt(addHours(now, 24)), now).state).toBe('DUE_SOON');
expect(classifyDashboardSla(cancelledWithPastDeadline(), now).state).toBe('NOT_APPLICABLE');
expect(classifyDashboardSla(resolvedWithoutClockEvidence(), now).state).toBe('UNKNOWN');
```

Fixture builders live in this test file; `now` is fixed, and `addHours` performs numeric timestamp addition.

### Task 3: Build scoped, paginated dashboard queries

**Create:** `backend/src/services/agent-dashboard.service.ts`, `backend/src/services/__tests__/agent-dashboard.service.test.ts`.

**Interface:** `getAgentDashboard(principal: PolicyPrincipal, query: DashboardQuery): Promise<AgentDashboardResponse>`.

- [ ] Test scope and queue membership, aggregate definitions, full search, ordering, pagination, and options visibility using database fixtures.
- [ ] Compose access predicate → selected scope → request-type filter. Derive cards, queue counts, options, and attention from explicitly documented subsets.
- [ ] Apply remaining filters only to the table query; calculate total before skip/take. Use a stable priority CASE and ID tie-breaker for urgency ordering.
- [ ] Use parameterized Prisma queries for computed clock states/order where Prisma filters cannot express the verified effective deadline; do not interpolate client SQL or fetch the entire queue into Node.
- [ ] Run aggregates and rows with one fixed `now` in a repeatable-read transaction. Limit row/attention projections to fields in the contract; avoid N+1 clock or assignee loads.
- [ ] Average only positive outcomes resolved in `[now - 30 days, now]`; exclude null/invalid/negative duration samples and report actual sample size.
- [ ] Seed at least 243 requests with an older breached request and a distinctive search match beyond record 200. Verify both remain discoverable and counts exceed 200.
- [ ] Inspect query plans on representative fixtures. Reuse existing indexes; report a measured index requirement as a separate migration proposal if necessary.
- [ ] Run service tests and commit.

### Task 4: Expose and secure the dashboard endpoint

**Create:** validator/controller and `backend/src/__tests__/agent-dashboard.integration.test.ts`. **Modify:** `backend/src/routes/request.routes.ts`.

- [ ] Validate enums, trimmed search length, UUID request type, positive integer page, allowed page sizes, and role-compatible scope/queue combinations.
- [ ] Register static dashboard route before dynamic request routes, using existing authentication. Authorize AGENT/ADMIN access in the controller/service without granting report permissions.
- [ ] Return the agreed DTO and success envelope; use existing error middleware.
- [ ] Integration tests: agent without report:read succeeds; end user denied; cross-tenant data excluded from every response section; confidential rows/counts/options excluded; scope tampering denied; invalid query 400; export authorization remains unchanged.
- [ ] Test new helper parity against existing request-list visibility so extraction does not broaden access.
- [ ] Run targeted backend tests and build; commit.

### Task 5: Add frontend API and query lifecycle

**Create:** frontend service, `useAgentDashboard.ts`, and adjacent `__tests__/useAgentDashboard.test.tsx`.

**Interfaces:** `agentDashboardService.get(query, signal): Promise<AgentDashboardResponse>` and `useAgentDashboard(query)` returning data, initialLoading, refreshing, error, stale, and refresh.

- [ ] Write tests for initial load, debounce, superseded responses, cancellation, initial failure, refresh failure, recovery, visible-tab refresh and cleanup.
- [ ] Use existing Axios client and `useDebouncedValue`. Keep scope, tab, filters, sort, page and page size explicit; reset page on query changes.
- [ ] Preserve last good response during refresh, publish a new response atomically, and show stale status after failed refresh. Clear error on success.
- [ ] Add a visible-tab 60-second refresh lifecycle. Cancel requests and timers on unmount; do not retry 401/403 in a polling loop.
- [ ] Remove dashboard dependencies on reportsService and four simultaneous list requests.
- [ ] Run hook/service tests and commit.

### Task 6: Compose scope, cards, tabs, filters and attention

**Create:** summary, filters, tabs, attention components and their behavior tests. **Modify:** `frontend/pages/AgentDashboard.tsx`.

- [ ] Implement exact scope/card/tab definitions and labels from section 2. Cards that navigate clear conflicting table filters.
- [ ] Use numeric SLA-state options. Request-type options and badges come from the response, never current-page rows.
- [ ] Add accessible tab semantics, visible filter labels, equal-height controls, explicit active-filter clearing, and four-card responsive grid.
- [ ] Display sample/window information for averages and differentiate no data, unavailable data, and loading.
- [ ] Render attention from server results; show active urgency labels and count; use an accurate View open work action.
- [ ] Test scope switching, permission-dependent controls, request-type/card consistency, null averages, empty states and attention navigation.
- [ ] Run component tests and commit.

### Task 7: Implement accessible table, pagination and export

**Create:** TicketTable, DashboardPagination, slaPresentation and adjacent tests.

- [ ] Render actual reference links and independently operable checkboxes; remove row-level keyboard navigation.
- [ ] Add assignee/team/updated information, two-line summaries, full-summary disclosure, and restrained SLA styling. Historical closed tickets receive no active red row background.
- [ ] Present SLA labels from the backend state; use days/hours/minutes for active durations and an absolute deadline in disclosure. Do not locally reclassify only some rows while cards retain an older server snapshot.
- [ ] Implement current-page selection with visible-ID membership, indeterminate select-all, and reset on all query/result changes.
- [ ] Gate export controls using existing permission checks; retain existing export endpoint and show accessible success/failure feedback.
- [ ] Implement real pagination and totals, reset after filters, and handle a page becoming empty after refresh by moving once to the last available page.
- [ ] Tests: checkbox Space does not navigate; link Enter navigates; hidden selections cannot export; count equality with different IDs does not mark select-all; export denied/failed; page changes; total >200.
- [ ] Run component tests and commit.

### Task 8: Validate summary encoding and viewport layout

**Existing files:** `frontend/src/utils/format.ts`, `frontend/App.tsx`. **Create:** dashboard browser checks in Task 9.

- [ ] Reproduce the visible `&amp;` artifact against representative API text. Current stripHtml already decodes basic entities; do not rewrite it without a failing fixture.
- [ ] If double encoding is confirmed, add a bounded plain-text normalization helper with explicit double-encoding fixtures. Render as React text, never raw HTML; preserve literal user text when evidence does not justify further decoding.
- [ ] Inspect footer/table scrolling at 1440x900, 1280x720, 768x1024 and 390x844. The current footer is normal-flow `mt-auto`, so screenshot clipping alone is not evidence that it is fixed or overlapping.
- [ ] Adjust only demonstrated container/overflow defects. Ensure the final row and pagination can be reached and controls remain usable at 200% zoom.
- [ ] Verify summary disclosure, horizontal overflow, dark-mode contrast and focus visibility; commit any demonstrated corrections.

### Task 9: End-to-end acceptance and release evidence

**Create:** `frontend/e2e/smoke/agent-dashboard.smoke.spec.ts`, `frontend/e2e/a11y/agent-dashboard.a11y.spec.ts`, `docs/superpowers/reviews/2026-10-10-agent-dashboard-validation.md`.

- [ ] Browser fixtures cover agent, admin, no-team agent, lack of report permission, lack of export permission, paused and terminal tickets, 243-ticket dataset, and refresh failure/recovery.
- [ ] Assert cards/rows agree for the same active SLA population, late resolved/cancelled rows have no countdown, search finds old matches, filters are mutually exclusive, and urgency orders by actual deadline.
- [ ] Verify keyboard navigation/selection/export, screen-reader labels, automated accessibility checks, and all four viewport sizes.
- [ ] Run focused backend Jest suites; frontend component tests; backend and frontend builds. Run existing SLA/policy/request-list regression suites after shared-helper changes.
- [ ] Run existing smoke and accessibility Playwright projects with the new specs, using isolated test data and existing authentication patterns.
- [ ] Record actual commands/results, fixture definitions, screenshots and any pre-existing failures. Do not claim readiness from mocked component tests alone.
- [ ] Review the complete diff for visibility leakage, query performance, stale-response handling and unresolved audit coverage. Commit validation evidence.

## 5. Verification commands

Run from `backend/`:

```sh
npm test -- agent-dashboard-sla.service.test.ts agent-dashboard.service.test.ts agent-dashboard.integration.test.ts --runInBand
npm test -- slaPredicates.test.ts sla-pause.service.test.ts policy.service.test.ts --runInBand
npm run build
```

Run from `frontend/`:

```sh
npm test -- src/components/agent-dashboard
npm run build
npx playwright test --project=smoke e2e/smoke/agent-dashboard.smoke.spec.ts
npx playwright test --project=a11y e2e/a11y/agent-dashboard.a11y.spec.ts
```

During execution, add the exact existing request-list regression suite discovered in Task 1. If Jest exhibits the repository's known teardown-handle problem, document it and use the established forceExit convention only after assertions finish; do not hide assertion failures.

## 6. Acceptance criteria

- An agent without report:read receives complete authorized dashboard metrics.
- Missing metrics never appear as healthy zeros; unavailable historical outcomes remain explicit.
- All queries apply tenant/visibility/confidentiality/soft-delete predicates; no aggregate or option leaks inaccessible data.
- Paused requests show frozen SLA time; cancelled/rejected/resolved requests have no growing overdue clock.
- SLA cards and rows use the same state classifier and server timestamp; Due soon and On track are exclusive.
- Search, SLA filters, urgency sorting and total counts cover records beyond the first 200.
- Every card, badge and tab has a clear scope; Closed is not mislabeled Resolved.
- Selection includes only visible-page rows; checkbox keyboard actions never open a request.
- Refresh failures show stale content explicitly; recovery clears errors; superseded responses never overwrite current queries.
- The complete table and pagination are reachable at the specified viewports and 200% zoom.
- Backend and frontend builds, focused regression tests, browser acceptance and accessibility checks pass with evidence recorded.

## 7. Rollout and boundaries

Deploy the additive backend endpoint first, validate it with an authorized agent account, then deploy the frontend consumer. A frontend rollback can restore the previous dashboard while the unused additive endpoint remains deployed. Do not publish changes to production as part of implementation without deployment authorization.

Collect existing server error/timing telemetry for the new route and check that realistic dataset query plans avoid unbounded application-side scans. Review failed fetches, unusual UNKNOWN SLA rates, and database query cost during staging acceptance.

Exclude from this work: expanding positive-resolution status definitions, repairing workflow clock history, report-wide semantic changes, response/OLA SLA redesign, automated reassignment, new notification flows and historical SLA backfills.

## 8. Review choices and dependencies

Proposed defaults for approval: scope selector with Open/Closed/All tabs; 24-hour Due soon threshold; four consistent cards; 30-day elapsed average; page-only selection; 60-second visible-tab refresh; server-classified historical results with UNKNOWN fallback.

Task 1 is a required evidence checkpoint: the current pause/deadline helpers disagree about storage semantics. Task 2 must use the verified lifecycle rather than copying either helper blindly. If the checkpoint reveals a workflow defect requiring data repair or a migration, present that separately while continuing dashboard work with explicit unknown outcomes.

Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. UI presentation work can run alongside backend work once the contract and Task 1 invariants are fixed; security/SLA decisions remain sequential.
