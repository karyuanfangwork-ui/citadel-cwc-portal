# User Account Search Remediation Implementation Plan

> **For Hermes:** Use the development-workflow and testing skills to implement this plan task-by-task with strict RED-GREEN-REFACTOR verification.

**Goal:** Eliminate the perceived freeze while searching user accounts, prevent duplicate and stale requests, keep the table responsive during refreshes, correct filter state synchronization, and make the backend search safer and more scalable.

**Architecture:** Keep the existing `/api/v1/users` collection contract. Stabilize the React callback/data flow, add request cancellation and latest-response protection at the admin state boundary, and separate initial loading from background result refreshes. Add bounded server-side query validation and focused endpoint tests. Defer database index changes until query-plan evidence confirms they are needed; if required, add PostgreSQL trigram indexes in a separate migration.

**Tech Stack:** React 19, TypeScript, Axios, Vitest + Testing Library, Express, Prisma, PostgreSQL.

---

## Findings Being Remediated

1. `UserAccountsTab` debounces to 300 ms but still requests once per settled character.
2. `AdminSettings.tsx:204` creates an inline `onSearch` callback. Because `UserAccountsTab` includes `onSearch` in its effect dependencies, parent renders during loading can retrigger the same search before `userSearch` is updated.
3. `fetchUsers()` has no request cancellation or latest-response guard; older responses can overwrite newer results.
4. The component replaces all rows with a full loading skeleton for every search refresh.
5. The backend executes `findMany` and `count` for each query and performs seven case-insensitive substring predicates, including relation fields.
6. There is no minimum search length at the UI boundary.
7. `fetchUsers()` does not update `userStatusFilter`, so status controls can drift from the actual query.
8. Existing tests cover rendering/actions but not debounce, duplicate calls, abort behavior, stale responses, loading UX, or filter synchronization.

---

## Scope and Non-Goals

### In scope

- User-account search input and result-refresh behavior.
- User-account role/status filter state flow.
- Existing `/users` pagination/search query handling.
- Regression tests for frontend behavior and backend query validation.
- Measured query-plan review for search indexes.

### Out of scope

- Changing the `/users` response envelope.
- Replacing the search UI with a new page or global search service.
- Changing authorization or account visibility rules.
- Introducing a new search engine.
- Adding a database migration without query-plan evidence.
- Unrelated frontend bundle/code-splitting warnings.

---

## Proposed User Experience Contract

- Typing remains responsive and does not blank the current result table.
- Search begins only after the input is stable for the chosen debounce interval.
- One logical search state produces at most one active request.
- Requests for obsolete search/filter states are aborted or ignored.
- A one-character query does not issue a broad database search. The UI should either retain the current results with a clear hint or show an empty, non-loading state until at least two characters are entered. Clearing the field restores the unfiltered list.
- During a refresh, current rows remain visible with `aria-busy`/a lightweight refresh indicator; the full skeleton is reserved for the initial load.
- Search, role, status, and pagination always use the same current filter state.
- Empty, error, and no-match states remain distinguishable.

---

## Implementation Tasks

### Task 1: Add failing frontend tests for search interaction behavior

**Objective:** Capture the currently missing behavior before changing production code.

**Files:**
- Modify: `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx`
- Inspect: `frontend/src/components/admin/UserAccountsTab.tsx`
- Inspect: `frontend/src/hooks/useDebouncedValue.ts`

**Tests to add:**

1. The search callback is not called before the debounce interval.
2. A settled search value calls `onSearch` once.
3. A one-character value does not invoke `onSearch` (or follows the selected UI contract).
4. Current rows remain rendered while a background refresh is active.
5. Initial loading still renders the skeleton.
6. The input exposes an accessible label or an explicit `aria-label`.

**Run:**

```bash
cd frontend
npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
```

**Expected:** New behavior tests fail for the current implementation; existing tests remain passing.

---

### Task 2: Stabilize the search callback and filter state wiring

**Objective:** Prevent the child search effect from being retriggered by parent renders and ensure status state reflects the selected filter.

**Files:**
- Modify: `frontend/pages/AdminSettings.tsx:192-225`
- Modify: `frontend/src/components/admin/useAdminState.ts:521-536`
- Modify: `frontend/src/components/admin/useAdminState.ts:1320-1410`

**Implementation details:**

1. Create stable callbacks for the four table operations instead of inline functions passed into `UserAccountsTab`, or adjust the component contract so the search effect does not depend on an unstable callback identity.
2. Preserve the current search, role, and status values when changing pagination.
3. Update `userStatusFilter` whenever `fetchUsers()` accepts a status filter, or centralize filter updates in dedicated handlers so state and query parameters cannot diverge.
4. Ensure role/status changes reset pagination to page 1.
5. Keep `fetchUsers` dependency-safe; do not suppress hook dependency warnings as a workaround.

**Tests to add/update:**

- Status button selection updates the active visual state.
- A status-filtered search remains status-filtered when paging.
- Parent loading rerenders do not cause duplicate `onSearch` calls.

**Run:**

```bash
cd frontend
npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
```

**Expected:** Search callback and status synchronization tests pass.

---

### Task 3: Add cancellation and stale-response protection to user loading

**Objective:** Ensure only the latest logical search/filter request can update the table.

**Files:**
- Modify: `frontend/src/components/admin/useAdminState.ts:521-536` and user-state declarations near `:378-385`
- Modify: `frontend/src/services/admin.service.ts:15-24`
- Inspect: `frontend/src/services/api.ts` for Axios configuration/interceptor behavior

**Implementation details:**

1. Extend `adminService.listUsers()` with an optional Axios request config or `AbortSignal` without changing the response shape.
2. Keep an `AbortController` ref for the current user-list request.
3. Abort the previous request before starting a new search/filter/page request.
4. Keep a monotonically increasing request sequence/ref and only apply `users`, pagination, and filter state from the latest request.
5. Ignore cancellation errors without displaying a failure toast.
6. Display a toast only for a genuine latest-request failure.
7. Abort the active request on the owning hook/page cleanup if the hook is unmounted or the active tab changes.
8. Preserve existing successful response handling and pagination semantics.

**Tests to add:**

- Starting a second request aborts the first request.
- A late response from the first request cannot overwrite the second result.
- Cancellation does not call the error toast.
- A genuine latest-request failure still calls the error toast.

**Test approach:** Mock `adminService.listUsers()` with controllable promises; resolve them out of order and assert the displayed user list comes from the latest request only.

**Run:**

```bash
cd frontend
npx vitest run src/components/admin/__tests__/useAdminState.test.ts
```

If no hook test exists, create:

```text
frontend/src/components/admin/__tests__/useAdminState.test.ts
```

Use the existing frontend test setup and avoid adding a new mocking library.

---

### Task 4: Separate initial loading from background refresh UX

**Objective:** Stop the table from appearing frozen whenever a search refresh begins.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx:171-200`
- Modify: `frontend/src/components/admin/useAdminState.ts` user loading state
- Modify: `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx`

**Implementation details:**

1. Keep the initial skeleton for the first load when there are no rows.
2. When existing rows are present and a request is refreshing results, keep the rows visible.
3. Add a compact, accessible refresh indicator near the search controls or table header, such as `role="status"` with `aria-live="polite"`.
4. Mark the table or result region `aria-busy="true"` during refresh.
5. Disable or guard pagination controls while a page request is in flight to avoid accidental request bursts.
6. Keep stale rows visually understandable during refresh without applying a misleading disabled opacity to the entire table.
7. Ensure the no-results state appears only after the latest request completes.

**Acceptance tests:**

- `usersLoading=true`, `users=[]` renders the skeleton.
- `usersLoading=true`, `users=[...]` keeps the existing user row visible and shows the refresh indicator.
- `usersLoading=false`, `users=[]`, active search renders the no-match state.

---

### Task 5: Add a minimum-query and clear-search policy

**Objective:** Avoid expensive one-character wildcard searches while keeping the control predictable.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/pages/AdminSettings.tsx` or the user-state handler, depending on where the policy is centralized
- Modify: `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx`

**Recommended policy:**

- Trim the value for query decisions.
- Empty value: request the unfiltered list.
- One-character value: do not request; show a short hint such as `Enter at least 2 characters` and retain the current result set.
- Two or more characters: debounce and request.

**Important:** The policy must not prevent search by a valid two-character name, email fragment, department, job title, or entity code.

**Tests:**

- Whitespace-only input behaves as empty.
- One-character input does not call the API.
- Two-character input calls the API after debounce.
- Clearing the input restores the unfiltered query.

---

### Task 6: Harden and bound the backend `/users` query parameters

**Objective:** Prevent malformed or unbounded query parameters from amplifying the frontend issue and make endpoint behavior deterministic.

**Files:**
- Modify: `backend/src/controllers/user.controller.ts:324-406`
- Modify or create: backend user-controller test location discovered from the repository's existing Jest conventions
- Inspect: `backend/src/middleware/validate.middleware.ts` and existing query validators before introducing a new validator

**Implementation details:**

1. Parse `page` safely and clamp it to a minimum of 1.
2. Parse `limit` safely and clamp it to a bounded maximum appropriate for this table (for example, 50); preserve the current frontend page size of 15.
3. Trim the search string before using it in Prisma filters.
4. Decide whether the backend should reject one-character searches or return an empty result. The endpoint must remain safe even for direct callers that bypass the UI.
5. Use one shared `where` object for `findMany` and `count`.
6. Preserve stable ordering by `createdAt` and a deterministic tie-breaker if supported by the current schema/query conventions.
7. Avoid exposing a different response shape as part of this remediation.
8. Preserve authorization and tenant scoping behavior already applied by Prisma/middleware; do not weaken the user population boundary.

**Tests:**

- Invalid page/limit values resolve to safe bounded values.
- Excessive limit is capped.
- Trimmed search is used consistently in the Prisma predicate.
- Search and count receive equivalent filters.
- Existing role/status/entity/name search behavior remains covered.
- The endpoint never returns sensitive fields; retain the existing `sanitizeUsers` expectation.

**Run:** Use the repository's backend package test command and targeted Jest pattern after identifying the exact existing test file/location.

---

### Task 7: Add backend query-performance evidence before changing indexes

**Objective:** Determine whether the database requires search-specific indexes instead of guessing.

**Files:**
- Inspect: `backend/prisma/schema.prisma:79-278`
- Inspect: existing Prisma migration/index conventions
- Potentially create: `backend/prisma/migrations/<timestamp>_user_search_trigram_indexes/migration.sql` only if evidence justifies it

**Procedure:**

1. Use a representative local dataset and run `EXPLAIN (ANALYZE, BUFFERS)` for the generated search shape at 2-, 3-, and 10-character queries.
2. Measure both the `findMany` and `count` paths.
3. Check whether the current email index is used. Ordinary B-tree indexes are not expected to help leading-wildcard `contains` searches.
4. If sequential scans are material at the current/expected account volume, evaluate PostgreSQL `pg_trgm` GIN/GiST indexes for the scalar fields actually searched.
5. Do not add relation-field indexes blindly; entity name/code searches may require a denormalized searchable field or a separate join strategy. Document this tradeoff before implementation.
6. If indexes are added, include an idempotent migration, verify extension availability in the target environment, and run the endpoint tests plus query-plan comparison.

**Decision gate:** Index migration is optional and must be justified by measured query plans. The UI/request correctness work does not wait on this gate.

---

### Task 8: Add endpoint and integration-level regression coverage

**Objective:** Verify that frontend assumptions and backend behavior remain aligned.

**Files:**
- Modify/create: existing backend user-controller integration/unit test file discovered during implementation
- Modify: `frontend/src/services/admin.service.ts` tests if a service test pattern exists
- Modify: `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx`

**Coverage matrix:**

| Area | Required case |
|---|---|
| Debounce | One request after a settled valid query |
| Minimum length | One-character query does not hit API |
| Cancellation | Older request is aborted/ignored |
| Race safety | Older response cannot overwrite newer results |
| Loading UX | Existing rows remain visible during refresh |
| Empty state | No-match state only appears after latest response |
| Status state | Active/disabled selection and subsequent pagination agree |
| Backend pagination | Invalid/excessive values are bounded |
| Backend search | Scalar and relation search fields remain functional |
| Error handling | Cancellation is silent; latest genuine error is visible |

---

### Task 9: Perform authenticated browser verification

**Objective:** Confirm the real user-visible behavior, not only mocked component behavior.

**Prerequisites:**

- Start the local backend and frontend using repository commands.
- Use a permitted local test account; do not print or commit credentials.

**Steps:**

1. Authenticate through the normal login UI.
2. Open `/admin/settings?tab=users`.
3. Open browser DevTools/network tracing or use Playwright request listeners.
4. Type a multi-character query quickly and slowly.
5. Confirm no request is sent for the first character.
6. Confirm at most one request is active for the latest settled query.
7. Confirm the table remains visible during refresh.
8. Type a new query before the previous response completes and confirm the old result cannot overwrite the new result.
9. Test clearing the input, role filter, Active, Disabled, and pagination combinations.
10. Capture console errors, failed requests, response timings, and any visible layout/accessibility regression.

**Evidence to record:**

- Request count for a sample query.
- Whether cancelled requests are handled without a toast.
- Latest-result correctness under out-of-order responses.
- Approximate time from settled input to visible result.
- Browser console/network error status.

---

### Task 10: Run final verification and diff hygiene

**Objective:** Establish fresh evidence for the complete remediation.

**Commands:**

```bash
cd frontend
npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
npm test
npm run build
npx tsc --noEmit

cd ../backend
npm test -- <targeted-user-test-pattern>
npm run build

cd ..
git diff --check
git status --short
```

Use the project's actual backend Jest flags and existing test conventions. Do not use Jest-only flags with Vitest. If the backend suite requires `--forceExit`, report that separately and investigate open handles rather than presenting it as natural process verification.

**Final acceptance criteria:**

- No duplicate search requests caused by parent rerenders.
- No stale response can replace the latest query result.
- Search input remains responsive.
- Current rows remain visible during refresh.
- One-character queries do not trigger broad searches.
- Status filter state remains synchronized through search and pagination.
- Backend page/limit inputs are bounded.
- Focused frontend/backend tests pass.
- Frontend build and TypeScript check pass.
- Browser verification confirms the behavior using the authenticated local UI.
- No unrelated files or working-tree changes are introduced.

---

## Recommended Implementation Order

1. Tasks 1-2: frontend regression tests and callback/filter-state stabilization.
2. Tasks 3-5: cancellation, stale-response protection, refresh UX, and minimum-query policy.
3. Task 6: backend parameter hardening and endpoint tests.
4. Task 7: query-plan measurement and optional index decision.
5. Task 8: cross-stack regression coverage.
6. Task 9: authenticated browser verification.
7. Task 10: full verification and final handoff.

This order addresses the user-visible freeze first, then protects the API and database path without mixing an unmeasured schema/index change into the initial bug fix.

## Risks and Mitigations

- **Risk: cancellation support differs across Axios versions.** Mitigation: inspect `frontend/src/services/api.ts`, use the installed Axios `signal` contract, and test the actual request config.
- **Risk: changing loading state breaks initial empty-state behavior.** Mitigation: add explicit tests for initial loading, refreshing with rows, and completed no-results.
- **Risk: status filter state changes affect entities tab reuse.** Mitigation: trace all `fetchUsers` callers before editing and test both `users` and `entities` tab activation paths.
- **Risk: backend lower-bound search policy breaks direct callers.** Mitigation: preserve empty-query behavior and document the response semantics for short queries; verify all known callers.
- **Risk: trigram indexes increase storage/write cost.** Mitigation: require EXPLAIN evidence and a measured benefit before creating a migration.
- **Risk: response race protection hides legitimate latest errors.** Mitigation: track request sequence explicitly and surface only the latest non-cancellation failure.

## Open Decisions to Resolve During Implementation

1. Use a 2-character or 3-character minimum for remote search. Recommended default: 2 characters because entity codes and short names may be valid.
2. Whether short-query behavior should show a hint while retaining current results or clear the table. Recommended: retain current results and show a hint.
3. Whether to use a dedicated `usersRefreshing` state or derive refresh status from `usersLoading && users.length > 0`. Recommended: dedicated state if the hook has multiple user-loading paths; otherwise the derived approach is acceptable for the first slice.
4. Whether query-plan evidence warrants PostgreSQL trigram indexes. This requires local/staging data and must not be guessed from source alone.
