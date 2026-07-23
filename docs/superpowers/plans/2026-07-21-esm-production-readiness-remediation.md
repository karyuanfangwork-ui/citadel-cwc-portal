# ESM Production Readiness Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the production blockers in the ESM audit through a risk-first 90-day program, then raise the platform toward Level 4 enterprise maturity during months four through six.

**Architecture:** Introduce one fail-closed tenant/department/resource policy boundary and migrate every API, query, job and UI consumer to it. Build atomic versioned workflows with transactional outbox delivery, add database RLS as defense in depth, and require immutable releases plus proven HA/DR before production approval.

**Tech Stack:** Node.js 20, Express, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, JWT/OIDC, React 19, React Router 7, Vite, Jest, Vitest, Playwright, Docker, Prometheus and OpenTelemetry.

## Global constraints

- The approved design is `docs/superpowers/specs/2026-07-21-esm-production-readiness-remediation-design.md`.
- The audit source of truth is `docs/esm-production-readiness/01-Current-State-Baseline.md` through `12-Production-Readiness-Assessment.md`.
- Preserve the existing API prefix `/api/v1` and the current Prisma/Express layering unless a task explicitly introduces a new boundary.
- Never trust caller-supplied tenant, department, classification, S3 key, export scope or workflow authority.
- Route permissions are coarse prechecks; backend resource policy is mandatory for every object operation.
- Inaccessible sensitive objects return 404. Authenticated but disallowed functions return 403.
- Every governed root must carry or unambiguously inherit non-null `tenantId` and `departmentId`.
- Ordinary missing tenant context fails closed. Platform and system work require explicit typed execution scopes.
- Published workflow and policy versions are immutable.
- State, history, audit and outbox intent commit in one database transaction.
- All new mutations require strict input schemas, unknown-field rejection and explicit response DTOs.
- Schema changes follow expand/backfill/validate/enforce/contract sequencing.
- Use feature flags and shadow comparison for authorization, workflow and notification migrations.
- No production `prisma db push`, automatic seed, forced migration resolution, mutable image tag or shared default secret.
- No Critical or High access-control finding may be self-certified by the implementing team.

## Phase 0: documentation and execution controls

### Allowed repository patterns

- Tenant context: `backend/src/lib/tenant-context.ts::runWithTenant`, `getTenantId`.
- Authentication and coarse permission checks: `backend/src/middleware/auth.middleware.ts::authenticate`, `requirePermission`.
- Request authorization seed: `backend/src/services/requestAccess.service.ts::assertRequestAccess`.
- Preferred scoped-query pattern: `backend/src/credit/services/creditScope.service.ts::buildApplicationScopeWhere`, `assertCanAccessApplication`.
- Thin object middleware: `backend/src/credit/middleware/assertCreditDocumentAccess.middleware.ts`.
- Optimistic concurrency: `backend/src/credit/services/creditApplication.service.ts::updateApplication`, `transitionApplication`.
- Tamper-evident audit: `backend/src/credit/services/auditChain.service.ts`.
- DLP primitives: `backend/src/credit/services/dlp.service.ts`.
- Queue/worker pattern: `backend/src/queues/pdf.queue.ts`, `backend/src/workers/pdf.worker.ts`.
- Redis and queue health: `backend/src/utils/redis.ts`, `backend/src/credit/queues/index.ts::getQueueHealth`.
- Metrics cardinality control: `backend/src/middleware/metrics.ts::normalizeRoute`.
- Frontend permission guard: `frontend/src/components/ProtectedRoute.tsx`.

### Prohibited patterns

- `findUnique({ where: { id } })` followed by an authorization decision.
- Fetching broadly and filtering unauthorized rows in memory.
- Global `ADMIN` or generic `AGENT` business-data bypass.
- Raw Prisma `User` or security-bearing entities in responses.
- Inline provider delivery inside business transactions.
- Direct `Request.status` writes outside the workflow command service.
- Cron callbacks without durable ownership and idempotency.
- RLS session claims that survive pooled transactions.
- Tests that mock the isolation mechanism they claim to verify.

---

## Live implementation reconciliation — 2026-07-22

This table reconciles the task labels against the current working tree, Git
history, focused execution evidence, and the full acceptance contract below.
The task checkboxes remain unchecked unless every code, integration, evidence,
and external approval gate is complete.

**Status definitions:** Implemented = code acceptance contract is present and
verified; Partial = useful implementation exists but one or more acceptance
gates remain; Missing = the planned boundary does not exist. “Operational gate”
means repository code cannot by itself prove closure.

| Task | Status | Current evidence and remaining gate |
|---|---|---|
| 1 | **Partial / operational gate** | Typed register and tests landed in `bb599e9`, but declared registry metadata is not implementation proof while the Task 10 route verifier is broken. Release freeze, closure reviewers and independent sign-off still require retained program evidence. |
| 2 | **Gate 0 green** | Baseline repairs landed through `a83d85a`, with the Gate 0 evidence file recorded at `docs/esm-production-readiness/evidence/gate-0-test-baseline.md`. Independently reproduced in this session: backend lint 0 errors/1,505 warnings, backend `tsc` build exit 0, `npx prisma validate` exit 0, backend Jest 163/163 suites and 1,946/1,946 tests passing, frontend Vitest 27/27 files and 160/160 tests passing, frontend Vite production build exit 0. CI has no `continue-on-error` on any gate. Remaining: no live PR has yet exercised these gates end-to-end in CI itself. |
| 3 | **Partial** | DTOs, response sanitizer and `sensitive-field-stripping.test.ts` landed in `518c1f6`, but the planned list/detail/search/auth HTTP DTO integration contract is absent; recursive denylist stripping and `any`-typed DTO mapping do not prove explicit allowlists on every endpoint. |
| 4 | **Partial** | BOLA containment landed in `8a1d7cc` and focused BOLA tests pass, but the complete real-principal activity/participant/file/job matrix and stable Task 12 attachment closure remain evidence gates. |
| 5 | **Partial** | Privileged MFA landed in `6126c59`; announcement HTML rendering remains an unsanitized browser-containment gap, while the planned frontend containment suite and complete browser/SSE/draft-storage acceptance evidence are absent. Middleware tests also do not prove that every privileged account must enroll. |
| 6 | **Partial** | Explicit execution-scope infrastructure landed in `4db8f41` with follow-ups, but enforcement is warn-by-default and strict mode does not reject unscoped reads. The planned real-PostgreSQL completeness/isolation suites are absent. |
| 7 | **Partial — materially advanced** | Canonical `ServiceDesk.departmentId` and `Request.departmentId`, membership-derived principal departments, seed ownership and migration `20260722090000_canonical_department_scope` are implemented. Local migration, Prisma validation, generation, build and focused isolation tests pass. Nullable legacy reconciliation, legacy string-scope retirement, tenant-bound time-limited grant contract and the full real-DB isolation matrix remain. |
| 8 | **Partial** | Central policy decision/query-scope infrastructure landed in `c053de2` and current work adds canonical departments, entity context and attachment actions. The service still grants same-tenant `ADMIN` an unconditional business-data bypass, contrary to the plan matrix that denies an ungranted tenant admin access to HR payroll. |
| 9 | **Partial** | Request isolation landed in `162d35a`; focused request-access/department matrices pass, but they encode same-tenant ADMIN cross-department access and do not exercise the planned two-tenant real-PostgreSQL matrix across every read/mutation/export/download cell. |
| 10 | **Partial — exact registry parity implemented** | The verifier now uses the TypeScript AST for live route declarations and the executable typed registry for controls, excluding commented-out routes and detecting uncovered, extra and duplicate keys. All **883/883** live method+path operations have complete typed control records with zero extras/duplicates, and the focused registry/coverage tests pass. Route metadata parity is proven; complete middleware-behavior and per-operation denial-test evidence remains. |
| 11 | **Partial** | Authorized search/report/KB/export query scoping landed in `42f027b`; durable export scope snapshots, result reauthorization, allowed fields/classification, expiry, watermark and complete real-DB export tests remain. |
| 12 | **Implemented locally / production rollout gate** | The governed lifecycle now includes BullMQ dispatch/worker execution, durable scan/deletion reconciliation, queue-delay-safe internal transitions, exact-response ClamAV fail-closed parsing, a digest-pinned Compose service, composite request/tenant/department ownership, bound external callback replay defense, expired-retention denial and retry-safe two-phase quarantine with terminal failure evidence. Local live queued EICAR smoke proves `INFECTED`, quarantine, source deletion and download denial; focused 52-test and full 1,967-test backend suites pass. Production ClamAV/object-store permissions, monitoring and rollback verification remain release gates; see `docs/esm-production-readiness/evidence/task-12-attachment-scanner.md`. |
| 13 | **Implemented — classification metadata, shared validation and frontend validation complete** | `requestCreationPolicy.service.ts` binds type→category→desk→tenant, requires active/published catalog metadata, enforces role/entitlement, mandatory form version, required/conditional/type/option validation, and server-owned tenant/department/workflow/SLA. **Classification** is now a governed per-type `RequestClassification` enum (`INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`) replacing hardcoded desk-code logic; migration `20260722120000_request_type_classification` backfills HR/Finance → CONFIDENTIAL, everything else → INTERNAL. Frontend `requestValidation.ts` mirrors backend `validatePublishedForm` semantics with step-transition and submit validation; 21 frontend tests pass. 15 backend tests pass including classification-driven confidentiality. |
| 14 | **Implemented — frontend routes and actions consume server policy decisions** | `ProtectedRoute` now supports `requireAllPermissions` (AND logic) and `requireDepartment` (department membership gating). ADMIN bypass removed from `hasPermission`/`hasAnyPermission`/`hasAllPermissions` — permissions must be explicit. Backend `/users/me` returns `departmentIds`; new `/users/me/policy` endpoint returns `{permissions, departments, allowedActions}` with resource/action/scope tuples. Frontend `AuthContext` loads policy on auth; `isAllowed()`/`isAllowedWithScope()` helpers for action-gated UI. 204 frontend tests, 1968 backend tests pass. |
| 15 | **Implemented — versioned transactional workflow command boundary** | `workflowCommand.service.ts` provides `executeWorkflowCommand()` with optimistic concurrency (version check), idempotency (replay returns original result), atomic history/activity/outbox in `$transaction`, and BOLA tenant-scoping. `requestTransition.service.ts` delegates status update to the command service. `version` column added to `Request` model (default 1). New `WorkflowHistory`, `WorkflowCommandResult`, `OutboxEvent` models. Architecture test documents 36 known legacy direct-write sites as migration backlog. 1977 backend tests, 204 frontend tests pass. |
| 16 | **Partial** | Mutable approval policies/delegation exist, but immutable published versions, tenant-scoped approver resolution, cycle/SoD controls and Task 15 transactional runtime are absent. |
| 17 | **Partial** | SLA logic exists, but ordinary execution remains in-process cron/batch scanning without durable queue ownership/idempotency; timeout behavior is not fail-safe. |
| 18 | **Partial** | In-app/SSE/email delivery exists, but no transactional outbox, unique retryable delivery records, worker isolation or cursor replay contract exists. |
| 19 | **Missing** | No PostgreSQL `ENABLE/FORCE ROW LEVEL SECURITY` migration, scoped DB-session helper, parity report or real RLS integration suite exists. DBA ownership/BYPASSRLS and staged rollout are external gates. |
| 20 | **Partial** | Credit has a domain audit chain, but platform audit remains best-effort and failure-tolerant; no platform chain, governed retention service or legal-hold integration suite exists. Compliance/Legal policy approval remains external. |
| 21 | **Missing** | No OIDC authorization-code/PKCE service, SCIM lifecycle, scoped group mapping or deprovision/session-revocation integration exists. IdP/IAM acceptance is external. |
| 22 | **Partial** | CI runs several build/test gates, but still lacks OpenAPI parity, safe migration checks, Playwright, SAST/SCA/license/secret/container scanning, SBOM, changed-code coverage and bundle budgets; prohibited `prisma db push` remains in CI. |
| 23 | **Partial** | Multi-stage Docker and Compose foundations exist, but images/base tags are mutable, containers run as root, shared-default-secret risk remains, and no signed immutable promotion/canary/rollback proof exists. |
| 24 | **Partial** | Prometheus metrics exist; OpenTelemetry tracing, protected metrics topology proof, SLOs, readiness integration tests, runbooks and on-call/tabletop evidence remain. |
| 25 | **Partial / operational gate** | A logical backup script exists, but no HA topology, immutable off-site backup guarantee, PITR/failover proof, isolated restore script or signed DR exercise exists. |
| 26 | **Partial** | Scoped reports and basic i18n foundations exist, but no governed versioned/scheduled analytics runtime, metadata-driven department navigation, localization/bundle parity suite or approved Privacy/Terms/Support content exists. |
| 27 | **Missing / external gate** | No ITSM expansion decision or final independent certification/evidence index exists. Product Board, penetration/isolation/IAM/DBA/privacy/operations reviews and Go/No-Go signatures must be external. |

### Verification recorded for the current Task 7/12/13 working tree

- Local PostgreSQL: all 83 migrations applied; schema reported up to date.
- Prisma schema validation, client generation and tenant-model generation: pass.
- Backend focused regression: 10 suites, 132 tests: pass.
- Additional Task 13 unit/HTTP/request regression after mandatory version and field-contract hardening: 3 suites, 20 tests: pass.
- Backend TypeScript build: pass.
- Frontend production build: pass, with pre-existing chunk-size/dynamic-import warnings only.
- Task 10 verifier: 883/883 bidirectional route/registry parity, zero extra or duplicate controls.
- `git diff --check`: pass.

### Late full-acceptance audit correction

- No Task 1–14 currently satisfies its **entire** plan acceptance contract; earlier “Implemented” labels for Tasks 1, 3 and 8 were code-boundary assessments and are corrected above.
- Independently reproduced in this session: backend lint fails with **1 error and 1,504 warnings**.
- The operation-control verifier parser failure is repaired; current direct execution reports **883/883 (100.0%)** bidirectional parity with zero extras/duplicates.
- The late audit reported full-suite results of backend **23 failed suites / 228 failed tests** and frontend **11 failed files / 13 failed tests**. Direct reproduction commands were not approved in this session, so these counts remain audit evidence rather than independently confirmed tracker evidence.

### Recommended implementation order from this point

1. Finish Task 13 shared schemas, metadata-driven classification and frontend validation; then implement Task 14 server-policy consumption.
2. Implement Task 15 before Tasks 16–18; it owns the transaction, version, idempotency, audit and outbox boundary.
3. Build Task 16 on Task 15, then execute Tasks 17 and 18 in parallel against the durable command/outbox contracts.
4. Complete Task 20 platform audit/retention, then isolate Task 19 RLS backfill/parity/enforcement from the workflow schema window.
5. Proceed through Tasks 21–26 in dependency order; Task 27 remains the final independent certification gate.

---

## Program P01 — Containment and trustworthy baseline, days 0–15

### Task 1: Establish the remediation control register and release freeze

**Owner:** Program Lead + QA Lead
**Findings:** All, with P0 focus on #1–#33

**Files:**
- Create: `docs/esm-production-readiness/remediation-control-register.md`
- Create: `backend/src/security/operation-control.types.ts`
- Create: `backend/src/security/operation-control.registry.ts`
- Test: `backend/src/__tests__/operation-control.registry.test.ts`

**Interfaces:**
- Produces `OperationControl` and `operationControls`, used by Task 12 to gate the 876-operation inventory.

- [ ] **Step 1: Write the failing registry test**

```ts
import { operationControls } from '../security/operation-control.registry';

it('rejects an operation without auth, policy, validation, response and audit metadata', () => {
  for (const control of operationControls) {
    expect(control.authentication).toBeDefined();
    expect(control.resourcePolicy).toBeTruthy();
    expect(control.validation).toBeTruthy();
    expect(control.responseSchema).toBeTruthy();
    expect(control.rateTier).toBeDefined();
    expect(control.auditEvent).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the test and confirm the registry is absent**

Run from `backend/`: `npm test -- operation-control.registry.test.ts --runInBand`
Expected: FAIL because `operation-control.registry` does not exist.

- [ ] **Step 3: Add the typed control contract and seed critical operations**

```ts
export interface OperationControl {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  owner: string;
  authentication: 'user' | 'platform-admin' | 'system';
  coarsePermission: string | null;
  resourcePolicy: string;
  validation: string;
  responseSchema: string;
  rateTier: 'read' | 'write' | 'sensitive' | 'auth';
  auditEvent: string;
  auditFindingIds: number[];
}
```

Seed the register with user, file download, request activity/participant, notification mutation, PDF job and request export operations. The control-register document records accountable owner, target task, evidence link and closure reviewer for findings 1–100.

- [ ] **Step 4: Run the registry test**

Run: `npm test -- operation-control.registry.test.ts --runInBand`
Expected: PASS for all seeded records.

- [ ] **Step 5: Commit**

```bash
git add docs/esm-production-readiness/remediation-control-register.md backend/src/security/operation-control.types.ts backend/src/security/operation-control.registry.ts backend/src/__tests__/operation-control.registry.test.ts
git commit -m "chore(security): establish remediation control register"
```

### Task 2: Repair the release test and lint baseline

**Owner:** QA Lead + Backend/Frontend Leads
**Findings:** #20–#22, #42, #71–#73

**Files:**
- Modify: `backend/jest.config.ts`
- Modify: `backend/src/__tests__/*.test.ts`
- Modify: `frontend/vitest.config.ts`
- Modify: `frontend/src/**/*.test.tsx`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/esm-production-readiness/evidence/gate-0-test-baseline.md`

**Interfaces:**
- Produces the zero-failure baseline required by every later task.

- [ ] **Step 1: Capture failures by category**

Run from `backend/`: `npm test -- --runInBand` and `npm run lint`.
Run from `frontend/`: `npm test -- --run` and `npm run build`.
Record suite/test/error counts and group them into runner mismatch, missing fixture/service, Redis mock, Prisma/schema drift and stale behavior expectation.

- [ ] **Step 2: Standardize backend tests on Jest**

Replace Vitest imports in backend Jest files:

```ts
import { describe, expect, it, jest } from '@jest/globals';
```

Do not introduce a second backend runner. Repair shared Redis/Prisma mocks in their existing test helper rather than per test file.

- [ ] **Step 3: Correct stale frontend expectations**

Use Vitest imports only in frontend tests:

```ts
import { describe, expect, it, vi } from 'vitest';
```

Update assertions to the approved workflow and accessible UI behavior; do not weaken access assertions or accept a redirect to login as a successful authorized flow.

- [ ] **Step 4: Make CI fail on every release gate**

Ensure `.github/workflows/ci.yml` runs backend lint, build, tests, Prisma validation, frontend tests and frontend build without `continue-on-error`.

- [ ] **Step 5: Verify and commit**

Expected: zero failing backend suites/tests, zero lint errors, zero failing frontend files/tests, both builds exit 0, and `npx prisma validate` exits 0.

```bash
git add backend/jest.config.ts backend/src/__tests__ frontend/vitest.config.ts frontend/src .github/workflows/ci.yml docs/esm-production-readiness/evidence/gate-0-test-baseline.md
git commit -m "test: restore authoritative release baseline"
```

### Task 3: Remove sensitive user fields from every API response

**Owner:** Backend Security
**Findings:** #6, #35

**Files:**
- Create: `backend/src/dto/user.dto.ts`
- Modify: `backend/src/controllers/user.controller.ts`
- Modify: controllers/services returning `User`
- Create: `backend/src/__tests__/user-response-redaction.integration.test.ts`

**Interfaces:**
- Produces `toUserSummary(user): UserSummaryDto` and `toUserProfile(user): UserProfileDto`.

- [ ] **Step 1: Write the negative serialization test**

```ts
const forbidden = ['passwordHash', 'mfaSecret', 'mfaBackupCodes', 'resetToken', 'resetTokenExpiry'];
for (const key of forbidden) expect(JSON.stringify(response.body)).not.toContain(key);
```

- [ ] **Step 2: Confirm the test fails against at least one current user endpoint**

Run: `npm test -- user-response-redaction.integration.test.ts --runInBand`
Expected: FAIL with a forbidden security field present.

- [ ] **Step 3: Implement explicit DTO mapping**

```ts
export interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
}

export const toUserSummary = (user: User): UserSummaryDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  department: user.department,
  jobTitle: user.jobTitle,
  isActive: user.isActive,
});
```

Map every controller/service response; never use object spread or omission destructuring on a Prisma user.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- user-response-redaction.integration.test.ts --runInBand`
Expected: PASS for list, detail, search and authentication response shapes.

```bash
git add backend/src/dto/user.dto.ts backend/src/controllers backend/src/services backend/src/__tests__/user-response-redaction.integration.test.ts
git commit -m "fix(security): allowlist user response fields"
```

### Task 4: Contain object-level exposure in files, jobs, notifications and requests

**Owner:** API Security
**Findings:** #7, #13–#18, #83–#84

**Files:**
- Modify: `backend/src/controllers/file.controller.ts`
- Modify: `backend/src/controllers/notification.controller.ts`
- Modify: `backend/src/controllers/requestPdf.controller.ts`
- Modify: `backend/src/services/pdfJob.service.ts`
- Modify: `backend/src/routes/pdfJob.routes.ts`
- Modify: `backend/src/routes/request.routes.ts`
- Test: `backend/src/__tests__/critical-bola.integration.test.ts`

**Interfaces:**
- Temporarily consumes `assertRequestAccess` until Task 9 supplies `authorize`.
- Produces actor-bound PDF jobs and owner-filtered notification mutations.

- [ ] **Step 1: Write cross-user and cross-request denial tests**

```ts
expect(await apiAs(userB).put(`/notifications/${userANotification}/read`)).toMatchObject({ status: 404 });
expect(await apiAs(userB).get(`/pdf-jobs/${userAJob}`)).toMatchObject({ status: 404 });
expect(await apiAs(financeAgent).get(`/files/download/${hrAttachmentId}`)).toMatchObject({ status: 404 });
```

- [ ] **Step 2: Confirm the tests expose the current paths**

Run: `npm test -- critical-bola.integration.test.ts --runInBand`
Expected: at least notification, PDF result or generic file assertion fails.

- [ ] **Step 3: Bind mutations and jobs to actor/tenant/resource**

Use compound filters:

```ts
const result = await prisma.notification.updateMany({
  where: { id, userId: req.user!.id, tenantId: req.user!.tenantId! },
  data: { isRead: true, readAt: new Date() },
});
if (result.count !== 1) throw new AppError('Notification not found', 404);
```

Extend PDF job data with `actorId`, `tenantId`, `departmentId`, `resourceType`, `resourceId`, `expiresAt`; authorize the parent request before enqueue and before returning the result. Disable raw S3-key signing and accept opaque attachment IDs only.

- [ ] **Step 4: Apply parent request checks to activities and participants**

Every activity read/write and participant mutation calls `assertRequestAccess`. Participant changes additionally require assignment/manage capability; generic `AGENT` is insufficient.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- critical-bola.integration.test.ts --runInBand`
Expected: all foreign-object paths return 404 and authorized owners still succeed.

```bash
git add backend/src/controllers backend/src/services/pdfJob.service.ts backend/src/routes backend/src/__tests__/critical-bola.integration.test.ts
git commit -m "fix(security): contain critical object authorization gaps"
```

### Task 5: Close browser-side containment gaps and enforce privileged MFA

**Owner:** Frontend Security + IAM
**Findings:** #28, #33–#34, #37, #61, #75–#77

**Files:**
- Modify: `frontend/pages/AnnouncementDetail.tsx`
- Modify: `frontend/pages/Announcements.tsx`
- Modify: `frontend/pages/credit/CreditApplicationCreate.tsx`
- Modify: `frontend/src/context/NotificationContext.tsx`
- Modify: `backend/src/middleware/auth.middleware.ts`
- Modify: privileged credit/admin/export routes
- Test: `frontend/src/security/containment.test.tsx`
- Test: `backend/src/__tests__/privileged-mfa.integration.test.ts`

**Interfaces:**
- Produces sanitized announcement rendering, cookie-auth SSE and enforced `requireMfa` routing.

- [ ] **Step 1: Add XSS, storage, SSE and MFA failing tests**

```ts
expect(screen.queryByRole('img', { name: /xss/i })).not.toBeInTheDocument();
expect(localStorage.getItem('creditApplicationDraft')).toBeNull();
expect(eventSourceUrl).not.toContain('token=');
```

The backend test calls a privileged operation with a valid non-MFA session and expects 403.

- [ ] **Step 2: Sanitize HTML and remove sensitive local fallback**

Render announcement HTML through the repository sanitizer or DOMPurify:

```tsx
const safeHtml = DOMPurify.sanitize(announcement.content, { USE_PROFILES: { html: true } });
<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
```

Remove plaintext sensitive draft fallback; use the existing server draft path with expiry.

- [ ] **Step 3: Use cookie SSE and mount MFA middleware**

Remove general query-token fallback from `sseAuth`; construct the SSE connection without a JWT URL parameter. Mount `requireMfa` on platform administration, privileged credit decisions and sensitive exports.

- [ ] **Step 4: Verify and commit**

Run frontend: `npm test -- --run containment.test.tsx`.
Run backend: `npm test -- privileged-mfa.integration.test.ts --runInBand`.
Expected: all containment tests pass.

```bash
git add frontend/pages frontend/src backend/src/middleware/auth.middleware.ts backend/src/routes backend/src/credit/routes backend/src/__tests__/privileged-mfa.integration.test.ts
git commit -m "fix(security): close browser containment and MFA gaps"
```

**Gate 0 evidence:** Tasks 1–5 complete; tests/lint/build green; Critical exposures disabled or policy-bound; Security and QA sign-off recorded.

---

## Program P02 — Tenant, department and RBAC foundation, days 8–35

### Task 6: Introduce explicit execution scope and exhaustive tenant metadata

**Owner:** Platform Architecture
**Findings:** #3–#4, #19, #41–#42

**Files:**
- Modify: `backend/src/lib/tenant-context.ts`
- Modify: `backend/src/lib/prisma.ts`
- Create: `backend/src/lib/execution-scope.ts`
- Create: `backend/scripts/generate-tenant-models.ts`
- Create: `backend/src/generated/tenant-models.ts`
- Test: `backend/src/__tests__/tenant-scope-real-db.integration.test.ts`

**Interfaces:**
- Produces `runWithExecutionScope<T>(scope, fn)`, `requireTenantScope()` and generated `TENANT_SCOPED_MODELS`.

- [ ] **Step 1: Write a real-database fail-closed test**

```ts
await expect(prisma.request.findMany()).rejects.toThrow('TENANT_SCOPE_REQUIRED');
await runWithExecutionScope({ kind: 'tenant', tenantId: tenantA }, async () => {
  const rows = await prisma.request.findMany();
  expect(rows.every(row => row.tenantId === tenantA)).toBe(true);
});
```

- [ ] **Step 2: Define explicit scope types**

```ts
export type ExecutionScope =
  | { kind: 'tenant'; tenantId: string; actorId?: string }
  | { kind: 'platform'; actorId: string; reason: string }
  | { kind: 'system'; tenantId: string; jobName: string; runId: string };
```

Ordinary tenant-scoped models reject missing scope. Platform scope is accepted only by an explicit platform client/service, not the default Prisma export.

- [ ] **Step 3: Generate model coverage from `schema.prisma`**

The generator emits every model containing `tenantId`, including `ApprovalPolicy` and `CatalogEntitlement`, and the completeness test compares generated output against Prisma DMMF.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tenant-scope-real-db.integration.test.ts tenant-isolation-completeness.test.ts --runInBand`
Expected: missing scope denied; tenant A cannot observe tenant B; generated coverage exact.

```bash
git add backend/src/lib backend/src/generated backend/scripts/generate-tenant-models.ts backend/src/__tests__
git commit -m "feat(tenancy): make execution scope exhaustive and fail closed"
```

### Task 7: Add canonical department and tenant-owned RBAC schema

**Owner:** IAM + DBA
**Findings:** #1–#2, #5, #29–#30, #39–#40

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260721000100_department_scoped_rbac/migration.sql`
- Create: `backend/src/services/departmentMembership.service.ts`
- Modify: `backend/src/services/permission.service.ts`
- Test: `backend/src/__tests__/department-rbac.integration.test.ts`

**Interfaces:**
- Produces `Department`, `DepartmentMembership`, tenant-owned roles/grants and `getPrincipalGrants(userId, tenantId)`.

- [ ] **Step 1: Write isolation and platform-admin tests**

```ts
expect(await grants(tenantAAdmin, tenantB)).toEqual([]);
expect(await canManageTenant(tenantAAdmin, tenantB)).toBe(false);
expect(await canReadDepartment(itAgent, hrDepartment)).toBe(false);
```

- [ ] **Step 2: Add expand-only schema models**

```prisma
model Department {
  id        String   @id @default(uuid())
  tenantId  String
  code      String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  memberships DepartmentMembership[]
  @@unique([tenantId, code])
  @@index([tenantId, isActive])
}

model DepartmentMembership {
  id           String   @id @default(uuid())
  tenantId     String
  departmentId String
  userId       String
  roleId       String
  validFrom    DateTime @default(now())
  validUntil   DateTime?
  department   Department @relation(fields: [departmentId], references: [id])
  @@unique([tenantId, departmentId, userId, roleId])
}
```

Add tenant ownership to mutable role/grant records. Preserve an immutable platform permission catalog and separate platform-superadmin identity from tenant roles.

- [ ] **Step 3: Backfill and reconcile**

Create IT, HR and Finance department records per tenant. Map current service desk codes and agent teams, emit an exception report for ambiguous users/resources, and require business-owner resolution before non-null enforcement.

- [ ] **Step 4: Verify and commit**

Run: `npx prisma validate && npm test -- department-rbac.integration.test.ts --runInBand`
Expected: tenant admins cannot manage platform/other-tenant data; memberships are time- and department-scoped.

```bash
git add backend/prisma backend/src/services/departmentMembership.service.ts backend/src/services/permission.service.ts backend/src/__tests__/department-rbac.integration.test.ts
git commit -m "feat(iam): add tenant-owned department RBAC"
```

### Task 8: Implement the central policy decision and query-scope service

**Owner:** Security Architecture
**Findings:** #8–#12, #16–#17, #35, #55, #78

**Files:**
- Create: `backend/src/security/policy.types.ts`
- Create: `backend/src/security/policy.service.ts`
- Create: `backend/src/security/resource-scope.service.ts`
- Create: `backend/src/middleware/authorizeResource.middleware.ts`
- Test: `backend/src/security/__tests__/policy.service.test.ts`

**Interfaces:**
- Produces `authorize(principal, action, resource): PolicyDecision`.
- Produces `buildVisibleWhere(principal, resourceType): Prisma.*WhereInput`.
- Produces `authorizeResource(loadScope, action)` middleware.

- [ ] **Step 1: Write the policy decision table as parameterized tests**

```ts
it.each([
  ['requester reads own IT request', requester, 'read', ownIt, true],
  ['IT agent reads HR request', itAgent, 'read', hrRequest, false],
  ['Finance approver approves assigned request', financeApprover, 'approve', assignedFinance, true],
  ['tenant admin reads HR payroll without grant', tenantAdmin, 'read', hrPayroll, false],
])('%s', (_name, principal, action, resource, allowed) => {
  expect(authorize(principal, action as PolicyAction, resource).allowed).toBe(allowed);
});
```

- [ ] **Step 2: Implement pure policy and query scope**

Use exact types approved in the design. `authorize` must return stable reason codes and optional allowed fields. `buildVisibleWhere` must express tenant plus department/contextual relationships at query time.

- [ ] **Step 3: Add thin middleware**

```ts
export const authorizeResource = (loadScope: ScopeLoader, action: PolicyAction) =>
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const principal = await principalService.fromRequest(req);
    const resource = await loadScope(req, principal);
    const decision = policyService.authorize(principal, action, resource);
    if (!decision.allowed) return next(new AppError('Resource not found', 404));
    req.policyDecision = decision;
    next();
  };
```

- [ ] **Step 4: Verify and commit**

Run: `npm test -- policy.service.test.ts --runInBand`
Expected: complete role × tenant × department × ownership × classification matrix passes.

```bash
git add backend/src/security backend/src/middleware/authorizeResource.middleware.ts
git commit -m "feat(security): add central resource policy boundary"
```

### Task 9: Migrate request access and prove tenant/department isolation

**Owner:** Requests Team + Security QA
**Findings:** #8, #10–#12, #16–#17, #42, #55

**Files:**
- Modify: `backend/src/services/requestAccess.service.ts`
- Modify: `backend/src/routes/request.routes.ts`
- Modify: HR/IT/Finance/ESM workflow routes/controllers
- Create: `backend/src/__tests__/department-isolation-matrix.integration.test.ts`

**Interfaces:**
- Replaces hardcoded request access with Task 8 policy contracts.
- Produces `getAuthorizedRequest(principal, requestId, action)`.

- [ ] **Step 1: Generate the negative matrix fixture**

Create two tenants; IT, HR and Finance departments; requester, agent, manager, approver, auditor, tenant admin and platform admin principals; public, confidential and payroll requests.

- [ ] **Step 2: Assert every cross-boundary action is denied**

```ts
for (const action of ['read', 'update', 'assign', 'transition', 'approve', 'export', 'download']) {
  await expectAction(itAgent, action, hrPayrollRequest, 404);
}
```

- [ ] **Step 3: Replace controller-specific checks**

```ts
const where = policyService.buildVisibleWhere(principal, 'request');
const request = await prisma.request.findFirst({ where: { id: requestId, AND: [where] } });
if (!request) throw new AppError('Request not found', 404);
```

Remove generic `ADMIN`/`AGENT` bypasses and unscoped global role lookups.

- [ ] **Step 4: Verify and commit**

Run with real PostgreSQL: `npm test -- department-isolation-matrix.integration.test.ts --runInBand`
Expected: all denied cells return 404; allowed contextual actions succeed; tenant B never appears.

```bash
git add backend/src/services/requestAccess.service.ts backend/src/routes backend/src/controllers backend/src/__tests__/department-isolation-matrix.integration.test.ts
git commit -m "feat(security): enforce request department isolation"
```

**Gate 1 evidence:** Tasks 6–9 complete; two-tenant/three-department matrix green; platform and tenant administration separated; Security independently verifies no generic role bypass.

---

## Program P03 — Universal resource authorization, days 20–50

### Task 10: Migrate all endpoint families to operation controls and resource policy

**Owner:** API Governance + Domain Leads
**Findings:** #8–#18, #35, #63, #75–#84

**Files:**
- Modify: all 118 files under `backend/src/routes/` and `backend/src/credit/routes/`
- Modify: `backend/src/security/operation-control.registry.ts`
- Create: `backend/scripts/verify-operation-controls.ts`
- Test: `backend/src/__tests__/operation-control.coverage.test.ts`

**Interfaces:**
- Consumes Task 8 policy middleware and Task 1 registry.

- [ ] **Step 1: Generate the Express operation inventory**

The script parses route declarations/mount prefixes and emits method + full path. The test compares it to `operationControls` and reports missing/duplicate records.

- [ ] **Step 2: Confirm the initial test reports uncovered operations**

Run: `npm test -- operation-control.coverage.test.ts --runInBand`
Expected: FAIL with uncovered operation count.

- [ ] **Step 3: Migrate in bounded batches**

Batch order: identity/admin; requests/activities/participants; HR; IT; Finance; ESM; files/exports/jobs; assets/KB/reports/search; CRM; Credit. Each route uses:

```ts
router.get(
  '/:id',
  authenticate,
  requirePermission('request:read'),
  validate(requestIdSchema),
  authorizeResource(loadRequestScope, 'read'),
  RequestController.getById,
);
```

Every batch updates the registry, adds denial tests and passes before the next batch starts.

- [ ] **Step 4: Verify and commit each batch**

Run: `npm test -- operation-control.coverage.test.ts --runInBand` plus the batch’s integration tests.
Expected at completion: every live operation (currently 883/883) has complete control metadata and zero duplicate route keys.

Use these bounded commits in order: `fix(authz): migrate identity and admin operations`, `fix(authz): migrate request operations`, `fix(authz): migrate ESM domain operations`, `fix(authz): migrate file and reporting operations`, `fix(authz): migrate CRM operations`, and `fix(authz): migrate credit operations`.

### Task 11: Apply authorized query scope to search, KB, reports and exports

**Owner:** Search/Reporting + Security
**Findings:** #11–#15, #57–#58, #63–#66, #78, #96–#97

**Files:**
- Modify: `backend/src/controllers/search.controller.ts`
- Modify: `backend/src/controllers/reports.controller.ts`
- Modify: KB services/controllers
- Modify: request export/PDF services
- Create: `backend/src/services/authorizedExport.service.ts`
- Test: `backend/src/__tests__/search-report-export-isolation.integration.test.ts`

**Interfaces:**
- Consumes `buildVisibleWhere` and DLP primitives.
- Produces policy-bound `createExport(principal, query): ExportJob`.

- [ ] **Step 1: Write cross-desk search, aggregation and export tests**

Assert IT principals cannot find HR titles, KB articles, counts, agent emails, drill-down rows or attachment/export contents. Assert total/count and row data use identical scopes.

- [ ] **Step 2: Replace confidentiality-only filters**

```ts
const visible = policyService.buildVisibleWhere(principal, 'request');
const [rows, total] = await prisma.$transaction([
  prisma.request.findMany({ where: { AND: [visible, searchWhere] }, take: limit, skip }),
  prisma.request.count({ where: { AND: [visible, searchWhere] } }),
]);
```

Bound page/limit centrally. Add KB audience classification and department entitlement.

- [ ] **Step 3: Bind exports to actor and query snapshot**

Persist actor, tenant, department scope, normalized filters, allowed fields, classification, row count, expiry and audit ID. Re-authorize result access and apply credit DLP watermark/redaction patterns.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- search-report-export-isolation.integration.test.ts --runInBand`
Expected: zero cross-desk rows/counts/content; bounded pagination; authorized exports watermarked and audited.

```bash
git add backend/src/controllers backend/src/services backend/src/__tests__/search-report-export-isolation.integration.test.ts
git commit -m "fix(authz): scope search reporting and exports"
```

### Task 12: Build a governed attachment and malware-quarantine lifecycle

**Owner:** File Security
**Findings:** #7, #64, #83–#84

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/services/attachmentAccess.service.ts`
- Modify: `backend/src/controllers/file.controller.ts`
- Modify: `backend/src/middleware/upload.middleware.ts`
- Test: `backend/src/__tests__/attachment-lifecycle.integration.test.ts`

**Interfaces:**
- Produces `registerUpload`, `markScanResult`, `getAuthorizedDownloadUrl`.

- [ ] **Step 1: Write lifecycle tests**

Test `PENDING_SCAN` cannot download, forged callback cannot change state, foreign department receives 404, `CLEAN` authorized download succeeds, and `INFECTED` never signs.

- [ ] **Step 2: Add governed metadata**

Attachment rows store tenant, department, parent resource, owner, classification, immutable S3 key, hash, size, MIME, scan job ID/state, callback nonce/hash, timestamps and retention state.

- [ ] **Step 3: Implement policy and scan binding**

```ts
if (attachment.scanStatus !== 'CLEAN') throw new AppError('Attachment not found', 404);
const decision = policyService.authorize(principal, 'download', scopeOf(attachment));
if (!decision.allowed) throw new AppError('Attachment not found', 404);
return s3Service.getPresignedUrl(attachment.storageKey, 0.25);
```

Sign callbacks with job ID, attachment ID, content hash, timestamp and nonce; reject replay and mismatch.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- attachment-lifecycle.integration.test.ts --runInBand`
Expected: all lifecycle and isolation assertions pass.

```bash
git add backend/prisma backend/src/services/attachmentAccess.service.ts backend/src/controllers/file.controller.ts backend/src/middleware/upload.middleware.ts backend/src/__tests__/attachment-lifecycle.integration.test.ts
git commit -m "feat(files): enforce governed attachment lifecycle"
```

### Task 13: Make request type, form and catalog enforcement server-authoritative

**Owner:** Catalog/Forms Team
**Findings:** #19, #31–#32, #78–#79

**Files:**
- Modify: request creation validator/controller/service
- Modify: `backend/src/services/requestAccess.service.ts`
- Modify: `frontend/pages/CreateRequest.tsx`
- Modify: `frontend/src/components/create-request/useCreateRequestWizard.ts`
- Modify: `frontend/src/components/request/RequestFormFields.tsx`
- Test: `backend/src/__tests__/request-create-policy.integration.test.ts`
- Test: `frontend/src/components/create-request/request-validation.test.tsx`

**Interfaces:**
- Produces `createRequest(principal, { requestTypeId, formVersion, values })`.

- [ ] **Step 1: Write desk mismatch, entitlement and required-field tests**

Reject HR request-type IDs submitted through an IT URL, hidden/disabled catalog types, false client confidentiality flags and missing conditionally required fields.

- [ ] **Step 2: Validate from published server configuration**

The service resolves request type, department, tenant, catalog entitlement, form version, classification, workflow and SLA. The client cannot override them.

- [ ] **Step 3: Share validation semantics**

Backend owns the definitive Zod/schema evaluation. Frontend uses the published form schema for early feedback and validates on step transition plus final submit.

- [ ] **Step 4: Verify and commit**

Run backend: `npm test -- request-create-policy.integration.test.ts --runInBand`.
Run frontend: `npm test -- --run request-validation.test.tsx`.
Expected: all mismatch/bypass cases fail closed; valid department-entitled requests succeed.

```bash
git add backend/src frontend/pages/CreateRequest.tsx frontend/src/components backend/src/__tests__/request-create-policy.integration.test.ts
git commit -m "fix(catalog): enforce server-authoritative request creation"
```

### Task 14: Make frontend routes and actions consume server policy decisions

**Owner:** Frontend Lead
**Findings:** #75–#79

**Files:**
- Modify: `frontend/App.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/utils/permissions.ts`
- Modify: request, asset, CRM and Credit pages
- Create: `frontend/src/types/policy.ts`
- Test: `frontend/src/components/__tests__/ProtectedRoute.test.tsx`
- Create: `frontend/e2e/department-access.spec.ts`

**Interfaces:**
- Consumes backend `allowedActions` and authenticated department memberships.

- [ ] **Step 1: Add route/action denial tests**

Test direct navigation and visible actions for IT agent, HR agent, Finance approver, read-only asset user and Credit users with narrow capabilities.

- [ ] **Step 2: Extend route metadata**

```ts
interface ProtectedRouteProps {
  requirePermission?: string | string[];
  requireAllPermissions?: string[];
  requireDepartment?: string | string[];
  children: React.ReactNode;
}
```

Remove unconditional frontend `ADMIN` bypass. Generate navigation from authorized department metadata. Render object actions only when `allowedActions.includes(action)`.

- [ ] **Step 3: Preserve backend authority**

Denied UI actions must still have E2E tests that call the API directly and receive 403/404. Frontend hiding is never the acceptance criterion.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run ProtectedRoute.test.tsx` and `npx playwright test e2e/department-access.spec.ts`.
Expected: route/action matrix matches server policy; direct API bypass is denied.

```bash
git add frontend/App.tsx frontend/src frontend/pages frontend/e2e/department-access.spec.ts
git commit -m "feat(frontend): consume scoped policy decisions"
```

---

## Program P04 — Transactional workflow and communications, days 31–65

### Task 15: Create the versioned transactional workflow command boundary

**Owner:** Workflow Backend
**Findings:** #43–#46, #53
**Status:** Implemented and verified on 2026-07-23; commit pending explicit authorization.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/services/workflowCommand.service.ts`
- Modify: `backend/src/services/requestTransition.service.ts`
- Test: `backend/src/services/__tests__/workflowCommand.integration.test.ts`
- Create: `backend/src/__tests__/no-direct-request-status-write.test.ts`

**Interfaces:**
- Produces `executeWorkflowCommand(command): Promise<WorkflowCommandResult>`.

- [x] **Step 1: Write concurrency, idempotency and rollback tests**

Two commands with the same expected version must yield one success and one conflict. Repeating an idempotency key returns the original result. Injected outbox/audit failure rolls back state.

- [x] **Step 2: Add version and idempotency schema**

Add request/workflow instance version, immutable workflow history, command idempotency and outbox models with scoped unique constraints.

- [x] **Step 3: Implement the transaction**

```ts
return prisma.$transaction(async tx => {
  const changed = await tx.request.updateMany({
    where: { id: command.requestId, tenantId: command.tenantId, status: command.fromStatus, version: command.expectedVersion },
    data: { status: command.toStatus, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ConflictError('WORKFLOW_VERSION_CONFLICT');
  await tx.workflowHistory.create({ data: historyFrom(command) });
  await tx.auditLog.create({ data: auditFrom(command) });
  await tx.outboxEvent.create({ data: eventFrom(command) });
  return resultFrom(command);
});
```

- [x] **Step 4: Migrate callers and prohibit direct writes**

Migrate `request.controller.ts`, `approval.controller.ts`, `loa.controller.ts`, HR/Finance/IT/ESM workflow controllers and services. The architecture test scans AST/source and permits request status writes only in `workflowCommand.service.ts` and migrations/tests.

- [x] **Step 5: Verify**

Run: `npm test -- workflowCommand.integration.test.ts no-direct-request-status-write.test.ts --runInBand`
Expected: concurrency/replay/rollback pass and no production direct write remains.

Verification evidence (2026-07-23):
- Task 15 focused gate: 4 suites, 62/62 tests passed, including true simultaneous concurrency, tenant-scoped fingerprinted idempotency, injected rollback, transactional SLA pause/resume, stale-CAS protection, immutable history, transition guards and zero direct production status writes.
- Approval runtime compatibility: 23/23 integration tests passed.
- Full backend regression: 171/171 suites and 2009/2009 tests passed.
- Prisma client generation, schema validation and migration status passed; all 87 migrations are applied.
- Backend TypeScript build, frontend production build, ESLint (0 errors; 1552 warnings), and `git diff --check` passed.

Commit when explicitly authorized:

```bash
git add backend/prisma backend/src/services backend/src/controllers backend/src/__tests__
git commit -m "feat(workflow): make request commands atomic and versioned"
```

### Task 16: Version workflow definitions and build the approval runtime

**Owner:** Approval Team + Product Architecture
**Findings:** #46–#51

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/services/approvalPolicy.service.ts`
- Modify: `backend/src/services/approvalDelegation.service.ts`
- Create: `backend/src/services/approvalRuntime.service.ts`
- Create: `backend/src/services/conditionEvaluator.service.ts`
- Test: `backend/src/services/__tests__/approvalRuntime.integration.test.ts`

**Interfaces:**
- Produces immutable definition versions, `startApprovalInstance`, `decideApproval`, `delegateApproval`, `evaluateCondition`.

**Status:** Implemented and verified (2026-07-23). During final audit, `decideApproval()` was tightened so final approval-runtime step/instance writes execute through Task 15 `transactionMutations`; workflow-command failure now rolls back the approval decision instead of being swallowed.

- [x] **Step 1: Write sequential, parallel, condition and delegation tests**

Verify later sequential steps remain `WAITING`; parallel branches activate together; quorum joins once; invalid condition fails closed; self/cyclic/out-of-scope delegation is rejected; published versions cannot mutate.

- [x] **Step 2: Add lifecycle and runtime models**

Definitions use `DRAFT`, `PUBLISHED`, `RETIRED` plus version/effective dates. Runtime steps use `WAITING`, `ACTIVE`, `APPROVED`, `REJECTED`, `CANCELLED`, `TIMED_OUT` and reference a definition version.

- [x] **Step 3: Implement deterministic authority and conditions**

Resolve approvers by tenant, department, effective authority and separation-of-duties; never `findFirst` on a global role. Conditions accept a typed AST of approved operators and fields; arbitrary JavaScript is rejected.

- [x] **Step 4: Route all decisions through Task 15**

Approval activation, decision, delegation history and emitted events participate in the same transaction. Timeout defaults to reminder/escalation and cannot reject without an explicit published policy.

- [x] **Step 5: Verify and commit**

Run: `npm test -- approvalRuntime.integration.test.ts --runInBand`
Expected: all runtime, immutability, SoD and replay assertions pass.

Verification evidence:
- `npx jest src/services/__tests__/approvalRuntime.integration.test.ts --runInBand --no-coverage --forceExit` — 23/23 tests passed.
- `npm test -- --runInBand --forceExit` — 171/171 suites and 2009/2009 tests passed.
- `npm run build && npm run lint` — TypeScript build passed; ESLint reported 0 errors and 1559 warnings.
- `npm run prisma:generate && npx prisma validate && npx prisma migrate status` — Prisma client generation, schema validation, and migration status passed; 87 migrations found and database schema was up to date.

```bash
git add backend/prisma backend/src/services backend/src/services/__tests__/approvalRuntime.integration.test.ts
git commit -m "feat(approvals): add governed versioned approval runtime"
```

### Task 17: Replace batch SLA scans and unlocked cron with durable timers

**Owner:** Platform + ESM Product
**Findings:** #26–#27, #53–#55

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/queues/timer.queue.ts`
- Create: `backend/src/workers/timer.worker.ts`
- Modify: `backend/src/jobs/sla-checker.ts`
- Modify: `backend/src/services/scheduler.service.ts`
- Modify: `backend/src/services/sla.service.ts`
- Test: `backend/src/services/__tests__/sla-timer.integration.test.ts`

**Interfaces:**
- Produces versioned SLA calendars/clocks and idempotent delayed timer jobs.

**Status:** Implemented and verified (2026-07-23). Task 17 now has durable SLA policy/clock/timer persistence, BullMQ delayed timer ownership with DB idempotency, locked interim SLA callbacks, no escalation participant grants, and restart/duplicate/calendar regression coverage.

- [x] **Step 1: Write calendar, pause, duplicate and failover tests**

Test Malaysia timezone/holiday boundary, response vs resolution clocks, pause/resume ledger, duplicate delivery, worker restart and escalation without participant membership.

- [x] **Step 2: Add policy and clock records**

Persist SLA policy version, calendar/timezone, priority, response/resolution/OLA target, clock due time, pause ledger, escalation level and idempotency key.

- [x] **Step 3: Implement BullMQ timer ownership**

Use delayed/repeatable jobs with tenant/department/request/policy context, bounded exponential retry and DLQ. Dedicated workers call Task 15 commands. Interim cron callbacks must wrap exported fail-closed locking.

- [x] **Step 4: Remove access-grant side effects**

Escalation creates an escalation record and notification intent; it never adds global-role users as request participants.

- [x] **Step 5: Verify and commit**

Run: `npm test -- sla-timer.integration.test.ts scheduler-lock.test.ts --runInBand`
Expected: timing/idempotency/restart assertions pass and no normal unlocked callback remains.

**Verification evidence (2026-07-23):**
- `npx prisma format && npm run prisma:generate && npx prisma migrate deploy` — migration `20260723020000_sla_durable_timers` applied successfully; Prisma client generated.
- `npx prisma validate && npx prisma migrate status` — schema valid; 88 migrations found; database schema up to date.
- `npx jest src/services/__tests__/sla.service.test.ts src/services/__tests__/sla-timer.integration.test.ts src/__tests__/scheduler-lock.test.ts --runInBand --no-coverage --forceExit` — 3 suites / 22 tests passed.
- `npm run build` — TypeScript build passed.
- `npm run lint` — ESLint passed with 0 errors and 1568 warnings.
- `npm test -- --runInBand --forceExit` — 172 suites / 2014 tests passed.

```bash
git add backend/prisma backend/src/queues backend/src/workers backend/src/jobs backend/src/services
git commit -m "feat(sla): move clocks and escalation to durable timers"
```

### Task 18: Implement transactional notification outbox, delivery and inbox replay

**Owner:** Notifications Platform
**Findings:** #52, #56–#62

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/queues/notification.queue.ts`
- Create: `backend/src/workers/notification.worker.ts`
- Modify: `backend/src/services/notification.service.ts`
- Modify: `backend/src/utils/sseClients.ts`
- Modify: `frontend/src/context/NotificationContext.tsx`
- Test: `backend/src/services/__tests__/notification-delivery.integration.test.ts`
- Test: `frontend/src/context/NotificationContext.test.tsx`

**Interfaces:**
- Produces `publishDomainEvent(tx, event)`, `resolveRecipients(event)`, `deliverNotification(deliveryId)` and cursor-based inbox API.

- [x] **Step 1: Write outage, retry, duplicate, leakage and replay tests**

Provider failure leaves retryable delivery; duplicate event produces one channel row; HR content is never materialized for an IT recipient; client reconnect recovers missed inbox rows by cursor.

- [x] **Step 2: Add outbox/delivery uniqueness**

Persist event ID/key, tenant, department, classification, resource, event/payload version and occurrence time. Delivery has unique `(eventId, recipientId, channel)`, attempt count, next attempt, provider ID and terminal state.

- [x] **Step 3: Authorize before materializing content**

Workers resolve scoped recipients, call policy per recipient, redact allowed fields, select template by tenant + department + locale + version, persist delivery, then call email/in-app adapters. Remove fallback tenant UUID and top-level swallowed success.

- [x] **Step 4: Make SSE a wake-up channel**

Commit inbox state before publish. Add cursor/replay and connection/backpressure metrics. Frontend reconnects using cookie authentication and fetches persisted rows after the cursor.

- [x] **Step 5: Verify**

Run backend: `npm test -- notification-delivery.integration.test.ts --runInBand`.
Run frontend: `npm test -- --run NotificationContext.test.tsx`.
Expected: retry, idempotency, recipient isolation and replay pass.

**Status (2026-07-23): Implemented and verified.**
- Durable notification domain event + delivery schema added in migration `20260723040000_notification_durable_delivery`, including event key uniqueness and `(eventId, recipientId, channel)` delivery uniqueness.
- `notification.service.ts` now publishes durable events with explicit tenant context, resolves scoped/authorized recipients before materializing content, records retryable delivery state, persists inbox rows before SSE wake-up, and bounds legacy wrapper event keys by SHA-256 digest.
- Added BullMQ notification queue/worker scaffolding and cursor replay API at `GET /api/v1/notifications/replay`; operation-control registry updated for route parity.
- Frontend NotificationContext treats SSE as a cookie-authenticated wake-up and replays persisted inbox rows by cursor on connect/reconnect.
- Focused backend verification: `npx jest src/services/__tests__/notification.service.test.ts src/services/__tests__/notification-delivery.integration.test.ts --runInBand --no-coverage --forceExit` — 2 suites / 9 tests passed.
- Task 18 failure regression: `npx jest src/__tests__/crm-import.integration.test.ts src/__tests__/operation-control.coverage.test.ts src/services/__tests__/notification.service.test.ts src/services/__tests__/notification-delivery.integration.test.ts --runInBand --no-coverage --forceExit` — 4 suites / 19 tests passed.
- Frontend verification: `npm test -- --run src/context/NotificationContext.test.tsx` — 1 suite / 1 test passed; `npm run build` passed.
- Backend verification: `npx prisma validate && npx prisma migrate status` passed with 89 migrations and DB up to date; `npm run build` passed; `npm run lint` passed with 0 errors and 1587 warnings; `npm test -- --runInBand --forceExit` passed 173 suites / 2007 tests; `git diff --check` passed.

```bash
git add backend/prisma backend/src/queues backend/src/workers backend/src/services/notification.service.ts backend/src/utils/sseClients.ts frontend/src/context
git commit -m "feat(notifications): add durable authorized delivery pipeline"
```

**Gate 2 evidence:** Tasks 15–18 complete; crash/restart/concurrency/replay suites green; published versions immutable; no direct status write, inline provider send or unlocked normal scheduler callback.

---

## Program P05 — Data governance and evidence, days 35–75

### Task 19: Enforce tenant and department isolation with PostgreSQL RLS

**Owner:** DBA + Security Architecture
**Findings:** #3–#5, #39–#41

**Files:**
- Create: `backend/prisma/migrations/20260721000200_tenant_department_rls/migration.sql`
- Create: `backend/src/lib/database-scope.ts`
- Modify: `backend/src/lib/prisma.ts`
- Test: `backend/src/__tests__/rls-isolation.integration.test.ts`
- Create: `docs/esm-production-readiness/evidence/rls-parity-report.md`

**Interfaces:**
- Produces `withDatabaseScope(scope, fn)` using transaction-local claims.

- [x] **Step 1: Backfill and validate ownership before enforcement**

Produce zero-orphan reports for governed roots and children. Add non-null/check/composite constraints in validated stages. Stop if any resource has ambiguous tenant/department ownership.

- [x] **Step 2: Write direct SQL isolation tests**

Using the application DB role, set tenant/department claims transaction-locally and verify tenant A/IT cannot read or mutate tenant B/HR even when SQL names the target ID.

- [x] **Step 3: Add forced RLS policies**

```sql
ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY request_scope ON "requests"
USING (
  "tenant_id" = public.app_current_tenant_id()
  AND "department_id" = ANY(public.app_current_department_ids())
);
```

Use transaction-local `set_config(..., true)`. Application roles do not own tables and do not have `BYPASSRLS`.

- [x] **Step 4: Shadow, compare and enforce**

Compare application policy and RLS result counts per resource type/tenant/department. Require zero unauthorized widening and reviewed explanations for narrowing before enabling by tenant.

- [x] **Step 5: Verify**

Run: `npm test -- rls-isolation.integration.test.ts tenant-scope-real-db.integration.test.ts --runInBand`
Expected: direct SQL, Prisma, worker and system-scope matrices pass; claims do not leak between pooled transactions.

**Status (2026-07-23): Implemented and verified for the governed `Request` root.**
- Added staged Request RLS migration `20260721000200_tenant_department_rls`: ownership backfill, stop-the-line orphan/inconsistent ownership checks, validated non-null ownership constraints, transaction-local claim helper functions, forced RLS policy, and non-BYPASSRLS local app role `cwc_app_rls`.
- Added `backend/src/lib/database-scope.ts` with `withDatabaseScope(scope, fn)` using transaction-local `set_config(..., true)` claims and optional `DATABASE_RLS_ROLE` for local/test verification under a non-owner app role.
- Extended `ExecutionScope` tenant scope with optional `departmentIds` so app execution context can carry the same department scope that DB claims enforce.
- Added `backend/src/__tests__/rls-isolation.integration.test.ts`: direct SQL read denial, direct SQL mutation denial, Prisma scoped query parity, and pooled transaction claim-clear verification.
- Added evidence report: `docs/esm-production-readiness/evidence/rls-parity-report.md`.
- Local DB state verified: `requests.relrowsecurity=true`, `requests.relforcerowsecurity=true`, `cwc_app_rls.rolbypassrls=false`, ownership constraints validated, 37/37 live requests fully owned with 0 inconsistent department links.
- Note: no `tenant-scope-real-db.integration.test.ts` file exists in the repo, so verification used the new RLS integration plus adjacent existing scope suites.
- Verification: `npx jest src/__tests__/rls-isolation.integration.test.ts src/__tests__/execution-scope.test.ts src/__tests__/system-scope.test.ts src/__tests__/department-scope-wiring.test.ts --runInBand --no-coverage --forceExit` — 4 suites / 25 tests passed.
- Full backend regression: `npm test -- --runInBand --forceExit` — 174 suites / 2010 tests passed.
- Backend gates: `npx prisma migrate status` up to date with 90 migrations; `npm run build` passed; `npm run lint` passed with 0 errors and 1594 warnings; `git diff --check` passed.

```bash
git add backend/prisma backend/src/lib backend/src/__tests__/rls-isolation.integration.test.ts docs/esm-production-readiness/evidence/rls-parity-report.md
git commit -m "feat(database): enforce tenant and department RLS"
```

### Task 20: Make audit, retention and export evidence tamper-evident

**Owner:** Compliance + Data Governance
**Findings:** #90–#93, #97

**Files:**
- Modify: `backend/src/utils/audit.ts`
- Create: `backend/src/services/platformAuditChain.service.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260721000300_audit_retention_controls/migration.sql`
- Create: `backend/src/services/retentionPolicy.service.ts`
- Test: `backend/src/services/__tests__/audit-retention.integration.test.ts`

**Interfaces:**
- Extends credit audit-chain/DLP patterns to platform operations.

- [x] **Step 1: Classify models and cascade behavior**

Record each model’s owner, data class, retention period, legal-hold behavior, deletion/anonymization rule and FK delete action. Replace destructive cascades on audit/evidence/business history with Restrict or explicit archival.

- [x] **Step 2: Write transaction and tamper tests**

Privileged mutation without audit must roll back. Audit update/delete must be denied. Chain verification detects modified event. Legal hold blocks retention action.

- [x] **Step 3: Implement append-only scoped audit**

Adapt `AuditChainService.appendEvent`/`verifyChain` with tenant, department, actor, action, resource, correlation ID, old/new value hashes and previous hash. Remove best-effort catch behavior from privileged command paths.

- [x] **Step 4: Verify and commit**

Run: `npm test -- audit-retention.integration.test.ts --runInBand`
Expected: rollback, tamper detection, legal hold, retention and DLP audit tests pass.

**Status:** ✅ Complete on 2026-07-23.

Implemented:
- Added append-only platform audit evidence model/table `PlatformAuditEvent` / `platform_audit_events` with tenant/department scope, actor identifiers, action/resource/correlation fields, old/new value hashes, event hash and hash version.
- Added DB trigger `trg_platform_audit_events_append_only` denying direct UPDATE/DELETE on audit evidence.
- Added `PlatformAuditChainService.appendEvent()`, `verifyChain()`, and `runPrivilegedAuditedMutation()` so privileged mutations and audit evidence commit/roll back in the same transaction.
- Upgraded `backend/src/utils/audit.ts` from best-effort-only legacy `AuditLog` writes to mandatory platform-chain append plus compatibility `audit_logs` row.
- Added `RetentionPolicyService.evaluateRetentionAction()` and `recordDlpExportAudit()` for legal-hold blocking and immutable export/DLP evidence.
- Actor evidence is denormalized (`actorId`, `actorEmail`) instead of FK-linked to `User`, because user deletion/anonymization must not mutate append-only audit rows.
- Added evidence report: `docs/esm-production-readiness/evidence/audit-retention-evidence.md`.

Verification:
- `npx prisma validate` — passed.
- `npx prisma generate` — passed.
- `npx prisma migrate status` — up to date with 91 migrations.
- Focused Task 20 test: `npx jest src/services/__tests__/audit-retention.integration.test.ts --runInBand --no-coverage --forceExit` — 1 suite / 3 tests passed.
- Adjacent regression: `npx jest src/services/__tests__/audit-retention.integration.test.ts src/__tests__/execution-scope.test.ts src/__tests__/tenant-isolation-completeness.test.ts src/credit/services/__tests__/auditChain.test.ts --runInBand --no-coverage --forceExit` — 4 suites / 43 tests passed.
- Cleanup/regression suites that initially caught actor-FK append-only conflict: `npx jest src/__tests__/request.test.ts src/__tests__/announcement.test.ts src/__tests__/request-create-policy.integration.test.ts src/services/__tests__/audit-retention.integration.test.ts --runInBand --no-coverage --forceExit` — 4 suites / 45 tests passed.
- Full backend regression: `npm test -- --runInBand --forceExit` — 175 suites / 2013 tests passed.
- Backend gates: `npm run build` passed; `npm run lint` passed with 0 errors and 1603 warnings.

```bash
git add backend/prisma backend/src/utils/audit.ts backend/src/services backend/src/services/__tests__/audit-retention.integration.test.ts docs/esm-production-readiness/evidence/audit-retention-evidence.md docs/superpowers/plans/2026-07-21-esm-production-readiness-remediation.md
git commit -m "feat(compliance): enforce audit and retention evidence"
```

### Task 21: Integrate OIDC, SCIM and hardened session controls

**Owner:** IAM
**Findings:** #29–#30, #36–#38

**Files:**
- Modify: `backend/src/config/index.ts`
- Create: `backend/src/services/oidc.service.ts`
- Create: `backend/src/controllers/scim.controller.ts`
- Create: `backend/src/routes/scim.routes.ts`
- Modify: authentication/session/password-reset services
- Test: `backend/src/__tests__/enterprise-identity.integration.test.ts`

**Interfaces:**
- Produces OIDC authorization-code + PKCE login, SCIM Users/Groups provisioning and atomic reset consumption.

- [ ] **Step 1: Write federation and lifecycle contract tests**

Test issuer/audience/nonce/PKCE validation, group-to-scoped-grant mapping, deprovision session revocation, atomic one-use reset and CSRF rejection.

- [ ] **Step 2: Implement identity mappings**

External groups map to reviewed tenant/department grant templates, never unrestricted global roles. SCIM operations are tenant-bound, authenticated with rotated credentials or mTLS, idempotent and audited.

- [ ] **Step 3: Harden tokens and mutations**

Keep access tokens out of JSON/localStorage, use secure HttpOnly cookies, CSRF token plus origin checks, atomic reset transaction and session revocation on password/security changes.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- enterprise-identity.integration.test.ts --runInBand`
Expected: federation, lifecycle, reset, CSRF and revocation tests pass.

```bash
git add backend/src/config backend/src/services backend/src/controllers/scim.controller.ts backend/src/routes/scim.routes.ts backend/src/__tests__/enterprise-identity.integration.test.ts
git commit -m "feat(iam): add enterprise identity lifecycle"
```

### Task 22: Add API contract and DevSecOps release gates

**Owner:** DevSecOps + API Governance
**Findings:** #20–#22, #71–#73, #80–#82, #86

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `backend/openapi.yaml`
- Create: `backend/scripts/verify-openapi-controls.ts`
- Modify: `backend/src/app.ts`
- Modify: frontend build configuration
- Test: CI workflow and contract verification

**Interfaces:**
- Consumes Task 10 operation registry and produces immutable release evidence/SBOM.

- [ ] **Step 1: Generate/verify OpenAPI operation controls**

Each operation records auth, coarse permission, object policy, department scope, validators, response schema, rate tier and audit event. CI fails if registry, OpenAPI and route inventory differ.

- [ ] **Step 2: Add security and quality stages**

Gate lint, types, unit/integration/PostgreSQL/Playwright tests, Prisma validate/migration check, SAST, dependency/license scan, secret scan, container scan, SBOM and changed-code coverage.

- [ ] **Step 3: Enforce runtime safety limits**

Require Redis-backed rate limiting in production, lower global JSON body size and opt up only named import routes, add frontend bundle budgets and lazy-loaded domain routes.

- [ ] **Step 4: Verify and commit**

Run the complete CI workflow on a release candidate. Expected: all gates pass, SBOM retained, no Critical/High unresolved scan result, OpenAPI coverage 876/876 and bundle within approved budget.

```bash
git add .github/workflows/ci.yml backend/openapi.yaml backend/scripts/verify-openapi-controls.ts backend/src/app.ts frontend
git commit -m "ci: enforce API and software supply chain gates"
```

### Task 23: Replace mutable deployment with hardened immutable promotion

**Owner:** DevOps + DBA
**Findings:** #23, #81, #85–#89

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `frontend/Dockerfile`
- Modify: `deploy.sh`
- Modify: `docker-compose.prod.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `infrastructure/kubernetes/api-deployment.yaml`
- Create: `infrastructure/kubernetes/worker-deployment.yaml`
- Create: `infrastructure/kubernetes/scheduler-deployment.yaml`
- Create: `infrastructure/kubernetes/frontend-deployment.yaml`
- Create: `infrastructure/kubernetes/network-policies.yaml`
- Create: `docs/runbooks/deployment-and-rollback.md`
- Create: `backend/src/config/__tests__/production-config.test.ts`

**Interfaces:**
- Produces signed digest-pinned API/frontend/worker images and reviewed migration promotion.

- [ ] **Step 1: Write production configuration tests**

Startup rejects `changeme`, empty required secrets, local-only Redis rate limits, disabled singleton/durable scheduler settings and mismatched runtime versions.

- [ ] **Step 2: Harden containers**

Use pinned Node 20 digest, non-root user, minimal runtime layer, read-only root filesystem compatibility, dropped capabilities and explicit health checks. Build API and worker entrypoints from the same signed source artifact.

- [ ] **Step 3: Implement staged promotion**

Build once, sign and scan, deploy by digest to staging, run smoke/migration checks, require approval, run `prisma migrate deploy`, canary, observe, promote. Prohibit `db push`, seed and forced migration resolution.

- [ ] **Step 4: Test rollback**

Exercise application rollback to prior digest and forward-compatible database recovery. Record elapsed time and data reconciliation in the runbook.

- [ ] **Step 5: Verify and commit**

Expected: config tests pass, containers run non-root, staged deploy/canary succeeds, rollback exercise meets target.

```bash
git add backend/Dockerfile frontend/Dockerfile backend/src/config docs/runbooks deploy.sh docker-compose.prod.yml .github/workflows/deploy.yml infrastructure/kubernetes
git commit -m "feat(devops): add immutable hardened deployment"
```

### Task 24: Build production observability, SLOs and operating runbooks

**Owner:** SRE + Production Support
**Findings:** #67–#70, #100

**Files:**
- Modify: `backend/src/middleware/metrics.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/observability/tracing.ts`
- Create: `docs/runbooks/*.md`
- Create: `docs/slo/esm-service-slos.md`
- Test: `backend/src/__tests__/production-readiness.integration.test.ts`

**Interfaces:**
- Produces protected metrics, traces, dependency readiness, alerts, SLOs and L1–L3 ownership.

- [ ] **Step 1: Write readiness and metrics exposure tests**

Readiness fails or explicitly degrades when mandatory DB, Redis revocation, queues or object storage are unavailable. Unauthenticated `/metrics` is denied outside the monitoring network identity.

- [ ] **Step 2: Instrument critical paths**

Add OpenTelemetry spans/correlation for auth, policy denial, workflow command, outbox, notification delivery, queue latency, file scan and export. Preserve `normalizeRoute` to control label cardinality.

- [ ] **Step 3: Define SLOs and alerts**

Specify availability, API latency/error, workflow age, SLA timer delay, outbox backlog, notification delivery, queue failure and backup freshness objectives with paging thresholds, owners and error-budget policy.

- [ ] **Step 4: Create and drill runbooks**

Cover access-control incident, token compromise, queue backlog, provider outage, failed migration, RLS denial spike, DB/Redis failure, backup failure, restore, failover and rollback. Record L1/L2/L3 escalation and communications.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- production-readiness.integration.test.ts --runInBand` and execute alert tabletop drills. Expected: dependency and metrics tests pass; every alert reaches an accountable responder.

```bash
git add backend/src/middleware/metrics.ts backend/src/observability backend/src/__tests__/production-readiness.integration.test.ts docs/runbooks docs/slo
git commit -m "feat(sre): establish observable production operations"
```

### Task 25: Prove HA, backup, PITR and disaster recovery

**Owner:** Infrastructure + DBA + SRE
**Findings:** #24–#25, #68, #100

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `infrastructure/kubernetes/api-deployment.yaml`
- Modify: `infrastructure/kubernetes/worker-deployment.yaml`
- Modify: `infrastructure/kubernetes/scheduler-deployment.yaml`
- Create: `infrastructure/kubernetes/pod-disruption-budgets.yaml`
- Modify: `scripts/backup-db.sh`
- Modify: `scripts/verify-backup.sh`
- Create: `scripts/restore-db.sh`
- Create: `docs/runbooks/disaster-recovery.md`
- Create: `docs/esm-production-readiness/evidence/dr-exercise.md`

**Interfaces:**
- Produces multi-instance API/workers, managed HA PostgreSQL/Redis, immutable backup and timed restore/failover evidence.

- [ ] **Step 1: Approve measurable targets**

Record business-approved RPO, RTO, availability target, peak/soak load, data-retention region and recovery authority before topology procurement.

- [ ] **Step 2: Implement monitored immutable backup**

Encrypt logical/base backups, WAL/PITR and object versions with separate keys; copy off-site/immutable; fail the job and alert on any upload/verification error. Retain manifest, checksum and restore prerequisites.

- [ ] **Step 3: Require real isolated restore**

`verify-backup.sh` must create an isolated target, restore data, run schema/app consistency checks, sample tenant/department counts and destroy only the validated temporary target. A skipped restore returns nonzero.

- [ ] **Step 4: Exercise HA and DR**

Run API/worker loss, Redis failover, PostgreSQL failover, region/host loss, full restore and PITR-to-timestamp tests under load. Validate scheduler/notification idempotency and RLS after recovery.

- [ ] **Step 5: Verify and commit**

Expected: timed exercises meet approved RPO/RTO, checksums and isolation pass, alerts/on-call execute correctly, evidence is signed by DBA/SRE/business owner.

```bash
git add scripts docs/runbooks/disaster-recovery.md docs/esm-production-readiness/evidence/dr-exercise.md docker-compose.prod.yml infrastructure/kubernetes
git commit -m "feat(platform): prove high availability and disaster recovery"
```

**Gate 3 evidence:** Tasks 19–25 complete; CI/security/contract gates green; RLS and identity integration verified; immutable deployment and rollback exercised; telemetry/on-call/SLO evidence retained.

**Gate 4 evidence:** Task 25 complete; capacity, failover and full restore meet approved targets; independent penetration/isolation review has zero open Critical/High findings; Privacy, Legal, Compliance and Production Support approve procedures.

---

## Program P07 — Enterprise maturity, months 4–6

### Task 26: Deliver governed analytics, localization and metadata-driven departments

**Owner:** Product + Reporting + Frontend
**Findings:** #59–#60, #64–#66, #74, #78–#80, #96–#99

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/services/governedReport.service.ts`
- Create: `backend/src/services/reportSchedule.service.ts`
- Create: `backend/src/queues/report.queue.ts`
- Create: `backend/src/workers/report.worker.ts`
- Modify: `backend/src/controllers/reports.controller.ts`
- Modify: `frontend/App.tsx`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/i18n/index.ts`
- Create: `frontend/src/config/departmentNavigation.ts`
- Create: `frontend/pages/Privacy.tsx`
- Create: `frontend/pages/Terms.tsx`
- Create: `frontend/pages/Support.tsx`
- Test: `backend/src/__tests__/governed-report.integration.test.ts`
- Test: `frontend/src/__tests__/localization-and-bundle.test.tsx`

**Interfaces:**
- Consumes central policy, DLP export jobs, department metadata and notification delivery.

- [ ] **Step 1: Add governed saved/scheduled reports**

Persist immutable report definition version, owner, tenant/department scope, permitted fields, recipient policy, schedule/timezone, format, retention and audit ID. Re-evaluate authorization at execution and download.

- [ ] **Step 2: Move expensive analytics to database aggregates**

Replace in-memory average-resolution calculations with scoped SQL aggregates/materialized facts; validate counts/drill-down parity and performance on production-shaped data.

- [ ] **Step 3: Make departments and locale metadata-driven**

Navigation, labels, time zones, currency/date formats, templates and request catalogs come from active department/locale configuration with default-deny access. Lazy-load domain routes and enforce bundle budgets.

- [ ] **Step 4: Publish legal/support content and verify**

Privacy, terms, retention and support notices are approved by owners and no longer render “Coming soon.” Scheduled-report leakage, locale deadline and bundle tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend frontend docs
git commit -m "feat(esm): add governed enterprise reporting and localization"
```

### Task 27: Make the ITSM expansion decision and complete independent certification

**Owner:** ESM Product Board + Security/Compliance
**Findings:** #94–#95 and final production decision

**Files:**
- Create: `docs/esm-production-readiness/itsm-scope-decision.md`
- Create: `docs/esm-production-readiness/final-go-live-evidence-index.md`
- Update: `docs/esm-production-readiness/remediation-control-register.md`

**Interfaces:**
- Produces the signed Go/No-Go evidence package.

- [ ] **Step 1: Decide product scope explicitly**

Choose whether Incident/Major Incident and Change are required for the declared ESM product. Fund CMDB/Problem only where service-impact and root-cause requirements justify them; do not relabel the current asset registry as a CMDB.

- [ ] **Step 2: Run the complete release-candidate verification**

Run backend lint/build/tests, Prisma validation/migration tests, frontend tests/build, Playwright role/department matrix, API contract/security scans, load/soak, rollback, restore and failover suites on the immutable candidate.

- [ ] **Step 3: Commission independent reviews**

Independent teams perform API/web penetration testing, two-tenant/department isolation validation, IAM review, database/RLS review, privacy/compliance review and operational readiness review. Every Critical/High observation maps to a closed control-register entry with retest evidence.

- [ ] **Step 4: Re-score readiness and obtain signatures**

Update all 15 audit dimensions using evidence. Production approval requires zero Critical/High access-control/isolation findings, green release gates, approved RPO/RTO evidence and sign-off from Security, IAM, DBA, SRE, QA, Privacy/Legal, HR, Finance, IT and Production Support.

- [ ] **Step 5: Commit the evidence index**

```bash
git add docs/esm-production-readiness/itsm-scope-decision.md docs/esm-production-readiness/final-go-live-evidence-index.md docs/esm-production-readiness/remediation-control-register.md
git commit -m "docs: record ESM production approval evidence"
```

---

## Program governance and sequencing

| Program | Accountable owner | Start condition | Exit gate | Target |
|---|---|---|---|---|
| P01 | Program/QA/Security Leads | Executive launch freeze | Gate 0 | Day 15 |
| P02 | Architecture/IAM/DBA | Task 3 containment available | Gate 1 | Day 35 |
| P03 | API Governance/Domain Leads | Task 8 policy contract stable | Consumer isolation evidence | Day 50 |
| P04 | Workflow/Platform Leads | Task 8 policy + Task 15 schema window | Gate 2 | Day 65 |
| P05 | DBA/Compliance | Ownership backfill and policy parity | RLS/audit evidence | Day 75 |
| P06 | DevSecOps/SRE/IAM | Gate 0 baseline and target topology approved | Gates 3–4 | Day 90 |
| P07 | Product/Reporting/Compliance | Gate 4 candidate controls stable | Level 4 reassessment | Month 6 |

Maximum parallel work is four streams: containment/baseline, schema/policy, workflow/notification and platform operations. Schema migrations, central policy contracts and shared queue changes require named integration owners and cannot be merged concurrently without coordination.

## Finding coverage

- Findings #1–#5: Tasks 6–9 and 19.
- Findings #6–#19: Tasks 3–4 and 8–13.
- Findings #20–#34: Tasks 2, 5, 17, 21, 23 and 25.
- Findings #35–#42: Tasks 3, 6–10 and 19.
- Findings #43–#62: Tasks 15–18.
- Findings #63–#66: Tasks 11 and 26.
- Findings #67–#73: Tasks 2, 22 and 24.
- Findings #74–#84: Tasks 5 and 10–14.
- Findings #85–#89: Tasks 22–23.
- Findings #90–#93: Task 20.
- Findings #94–#100: Tasks 11, 20, 24–27.

## Final verification checklist

- [ ] Every operation-control record maps to a route, owner, policy, validator, response schema, rate tier, audit event and passing denial test.
- [ ] `rg` finds no production raw S3-key download, generic business-data `ADMIN`/`AGENT` bypass, direct request-status write, general SSE query token, unlocked normal scheduler callback, `prisma db push` deployment or default `changeme` secret.
- [ ] Two-tenant × IT/HR/Finance × principal × action × classification tests pass against real PostgreSQL and forced RLS.
- [ ] Workflow/approval/timer/outbox concurrency, idempotency, provider outage, crash/restart and replay tests pass.
- [ ] Backend lint/build/tests, Prisma validation/migrations, frontend tests/build and Playwright suites pass with zero failures.
- [ ] OpenAPI and operation-control coverage matches the complete live inventory (currently 883/883); SAST/SCA/secret/container/license scans and SBOM gates pass.
- [ ] Load/soak, immutable deployment, canary, rollback, backup, PITR, restore and failover exercises meet signed targets.
- [ ] Independent penetration, isolation, IAM, DBA/RLS, compliance and operational reviews have no open Critical/High findings.
- [ ] The control register contains owner, remediation commit/PR, test evidence, independent verifier and closure date for all 100 findings.
- [ ] The enterprise review board signs the final Go decision; no delivery team self-approves its own Critical control.
