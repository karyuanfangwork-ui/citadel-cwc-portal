# ESM Production Readiness Remediation Design

**Status:** Approved direction — Approach A, risk-first phased program  
**Source:** `docs/esm-production-readiness/01` through `12`  
**Decision date:** 2026-07-21

## Goal

Move CWC 2.0 from a Level 2 internal platform at 38/100 readiness to an independently verifiable enterprise production candidate by closing every Critical and High access-control/isolation defect, establishing durable workflow and delivery semantics, restoring trustworthy release evidence, and proving HA and disaster recovery.

## Scope and success boundary

This program addresses all 100 audit findings through root-cause remediation rather than individual controller patches. The first 90 days target P0/P1 go-live blockers. The following three months raise the platform toward Level 4 enterprise maturity.

Production approval remains blocked until all mandatory go-live gates in `12-Production-Readiness-Assessment.md` have objective evidence. A green build alone is not an approval signal.

Out of scope for the first 90 days:

- CMDB, Problem Management and broad ITIL feature expansion.
- SMS/push channels unless a business owner funds provider, consent and delivery operations.
- Elasticsearch attachment indexing until authorization-aware indexing is designed and isolation is proven.
- General UI redesign unrelated to access, workflow correctness or production operability.

## Design decisions

### 1. One policy boundary

All business-resource access will use a central policy decision and query-scope service. Route permissions remain coarse capability checks; they never replace tenant, department, ownership, participant, approver, assignment, classification or field-level decisions.

The target contracts are:

```ts
type PolicyAction =
  | 'read' | 'create' | 'update' | 'delete'
  | 'assign' | 'transition' | 'approve'
  | 'export' | 'download' | 'manage';

interface PolicyPrincipal {
  userId: string;
  tenantId: string;
  platformRoles: string[];
  tenantRoles: string[];
  departmentMemberships: Array<{
    departmentId: string;
    roleIds: string[];
    permissions: string[];
  }>;
}

interface ResourceScope {
  tenantId: string;
  departmentId?: string;
  ownerId?: string;
  participantIds?: string[];
  approverIds?: string[];
  classification?: string;
}

interface PolicyDecision {
  allowed: boolean;
  reasonCode: string;
  allowedFields?: string[];
}
```

The service will expose an object decision and a Prisma visibility predicate. Detail queries combine resource ID and scope in one database operation and return 404 for inaccessible sensitive objects. Lists, counts, search, reports, exports, jobs and notifications must use the same predicate.

Existing patterns to reuse:

- `backend/src/services/requestAccess.service.ts::assertRequestAccess`
- `backend/src/credit/services/creditScope.service.ts::buildApplicationScopeWhere`
- `backend/src/credit/services/creditScope.service.ts::assertCanAccessApplication`
- `backend/src/credit/middleware/assertCreditDocumentAccess.middleware.ts`

### 2. Tenant, department and administration are separate dimensions

The platform will introduce a canonical `Department` security root, department memberships, tenant-owned roles/grants and explicit platform administration. `ADMIN`, `AGENT`, `agentTeam`, route names and UI visibility will not confer business-data access.

Every isolatable root must carry or unambiguously inherit `tenantId` and `departmentId`. IT, HR, Finance and future departments are configuration data with default-deny behavior.

Ordinary execution requires a tenant context. Platform operations, migrations and system jobs require explicit typed execution scopes. The current Prisma behavior that permits unrestricted operations when tenant context is absent will be removed.

### 3. Defense in depth at the database

Application policy remains mandatory, but PostgreSQL RLS will provide a second isolation boundary. Adoption is staged:

1. Generate the tenant-owned-model inventory and close missing scope coverage.
2. Reconcile Prisma schema, migrations and live constraints.
3. Backfill tenant and department ownership.
4. Validate non-null, scoped uniqueness and composite relationship constraints.
5. Introduce transaction-local tenant/department claims and forced RLS.
6. Run parity/shadow checks before enforcement.

Application connections must not own tables or carry `BYPASSRLS`. Background jobs must execute with explicit scoped identity.

### 4. Business commands are atomic and replay-safe

Request transitions, approval decisions, delegations and timer actions will use one command boundary. Each command atomically records:

- conditional state/version change;
- workflow or approval token movement;
- immutable history and audit evidence;
- durable outbox event.

Commands require `expectedVersion` and `idempotencyKey`. Published workflow definitions are immutable and versioned; instances reference the exact definition version.

Existing patterns to reuse:

- `backend/src/services/requestTransition.service.ts::transitionRequest`
- `backend/src/credit/services/creditApplication.service.ts` optimistic-version pattern
- `backend/src/credit/services/auditChain.service.ts`
- `backend/src/credit/middleware/featureFlag.middleware.ts`

Direct request-status writes outside the command service will be prohibited by an architecture test.

### 5. Approval, SLA and escalation use governed runtime records

Approval steps use `WAITING`, `ACTIVE`, `APPROVED`, `REJECTED`, `CANCELLED` and `TIMED_OUT`. Sequential, parallel and quorum behavior is explicit. Conditions use a typed fail-closed evaluator; arbitrary JavaScript is forbidden.

Approver and delegate resolution is tenant- and department-scoped with effective authority, separation-of-duties, cycle prevention and audit evidence. Timeout defaults to non-destructive escalation.

SLA calculations use versioned policies, business calendars, time zones, response/resolution/OLA clocks and a pause ledger. Escalations create scoped escalation records; they never grant participant access as a delivery side effect.

### 6. Timers and notifications are durable

Normal cron execution will move to BullMQ repeatable/delayed jobs with dedicated workers, bounded retries, idempotency, DLQ and operator replay. Scheduler locks remain an interim control only and must fail closed.

Domain transactions write outbox events. Workers resolve and authorize recipients, apply field redaction, choose a tenant/department/locale template, persist channel delivery, call providers, and record provider outcomes. A unique `(eventId, recipientId, channel)` constraint prevents duplicates.

SSE becomes a wake-up transport over a durable inbox. Clients recover from a cursor; general JWT query strings are removed.

Existing patterns to reuse:

- `backend/src/queues/pdf.queue.ts`
- `backend/src/workers/pdf.worker.ts`
- `backend/src/utils/redis.ts`
- `backend/src/services/schedulerLock.service.ts`
- `backend/src/services/email.service.ts`
- `backend/src/utils/sseClients.ts`

### 7. Files, exports and asynchronous results are policy-bound

Raw S3-key APIs are removed. Opaque attachment/document IDs resolve a parent resource, malware state and policy before signing a key. Export and PDF jobs store actor, tenant, department, resource/filter scope, allowed-field snapshot, classification and expiry. Result access verifies owner/scope again.

The ESM export service will reuse credit DLP primitives for one-time access, redaction and watermarking, but only after shared authorization.

### 8. Frontend consumes server decisions

Frontend guards remain usability controls. Routes gain capability and department metadata, while resource DTOs return server-computed `allowedActions`. The backend still reauthorizes every mutation.

Request creation submits a canonical request-type ID, form version and values. The server derives department, confidentiality, workflow, SLA and entitlements; caller-supplied desk slugs or sensitivity flags are not authoritative.

### 9. Enterprise identity is integrated after authorization semantics stabilize

OIDC federation, mandatory privileged MFA and SCIM/JIT lifecycle management will map identities into tenant and department grants. SSO will not map external groups directly to unrestricted global roles.

### 10. Releases and operations produce evidence

The release path uses immutable signed artifacts, aligned pinned runtimes, `prisma migrate deploy`, staged promotion and tested rollback. Production seeding, `db push` and forced migration resolution are prohibited.

The target topology separates API, workers and schedulers; uses managed HA PostgreSQL and Redis; protects metrics; and adds traces, dependency readiness, queue/business/security alerts, SLOs and on-call runbooks.

Backups are encrypted, immutable, monitored and off-site with WAL/PITR. Restore and failover are timed exercises against approved RPO/RTO, not documentation-only checks.

## Root-cause program structure

| Program | Architectural defect addressed | Primary audit findings | Delivery window |
|---|---|---|---|
| P01 Containment and trustworthy baseline | Active exposure plus red release evidence | #6–#22, #28, #31–#34, #61, #73, #87 | Days 0–15 |
| P02 Tenant, department and RBAC foundation | No universal ownership/policy model | #1–#5, #19, #29–#30, #39–#42 | Days 8–35 |
| P03 Universal resource authorization | Controller-specific access and unsafe derived channels | #7–#18, #35, #55, #57–#58, #63–#65, #75–#84 | Days 20–50 |
| P04 Transactional workflow and communications | Non-atomic state, approvals, timers and delivery | #26–#27, #43–#62 | Days 31–65 |
| P05 Data governance and evidence | Weak relational isolation, audit and retention | #39–#41, #90–#93, #97 | Days 35–75 |
| P06 Release, HA, DR and operations | Mutable deployment and unproven operating model | #20–#25, #67–#72, #81, #85–#89, #100 | Days 45–90 |
| P07 Enterprise maturity | Governed analytics, internationalization and ITSM scope | #59–#60, #64–#66, #78–#80, #94–#99 | Months 4–6 |

Finding overlap is intentional where one control must be implemented by one program and consumed or verified by another. Each finding has one accountable owner in the implementation plan.

## Delivery and release gates

### Gate 0 — containment

- No raw user authentication or MFA fields serialize.
- Generic key downloads and unscoped exports/jobs are disabled or policy-bound.
- Notification/activity/participant owner checks and privileged MFA are enforced.
- Stored XSS and sensitive local-draft persistence are removed.
- Backend/frontend tests and lint are green on the release branch.

### Gate 1 — isolation

- Real PostgreSQL negative tests cover two tenants, IT/HR/Finance, every principal class and read/write/export/search/file actions.
- No generic `ADMIN`/`AGENT` business-data bypass remains.
- Platform administration and tenant administration are separate.
- New departments default to no visibility and no actions.

### Gate 2 — workflow and delivery

- Concurrency, retry, duplicate, crash/restart and replay tests pass.
- Published definitions are immutable and in-flight instances are reproducible.
- No direct status write, inline provider send or unlocked normal scheduler callback remains.

### Gate 3 — release candidate

- Immutable promotion, migration, rollback, SAST/SCA/secret/container scans, SBOM, role/department E2E tests and performance gates pass.
- Protected telemetry, SLOs, alerts, on-call and runbooks are exercised.
- Independent API penetration and isolation reviews close all Critical/High findings.

### Gate 4 — production approval

- Multi-instance capacity and failure tests meet targets.
- Timed HA failover and full restore meet approved RPO/RTO.
- Privacy, retention, incident response, change/release and support procedures are approved.
- Zero Critical or High broken-access-control/isolation findings remain.

## Rollout strategy

- Use feature flags for the policy engine, workflow runtime and notification workers.
- Start in shadow mode: calculate new decisions/results without enforcing, compare against the legacy path, and alert on divergence.
- Enforce by tenant and department after negative tests and business-owner sign-off.
- Dual-write only where rollback requires it; every dual-write has reconciliation metrics and a removal date.
- Keep schema changes expand/contract compatible. Do not combine destructive cleanup with first enforcement.
- Stop rollout automatically on authorization divergence, cross-scope access, command-version conflicts above threshold, outbox backlog breach or failed reconciliation.

## Verification strategy

The implementation plan will use TDD and require, at minimum:

- unit tests for policy decisions, workflow guards, conditions and DTO redaction;
- real PostgreSQL integration tests for tenant/department isolation and RLS;
- endpoint matrix tests for all operation families;
- concurrency and idempotency tests for transitions, approvals, timers and deliveries;
- contract tests for email/SSE/identity providers;
- Playwright tests for real cookie authentication, role/department navigation and denied actions;
- migration/backfill/reconciliation tests on production-shaped data;
- load, soak, worker-failure and provider-outage tests;
- executable backup, restore, failover and rollback drills;
- independent penetration testing and operational readiness review.

## Organizational model

An executive sponsor owns the No-Go decision and risk acceptance. A program lead coordinates seven accountable workstream owners: Security/IAM, Platform Architecture, ESM Workflow, Data/DBA, Frontend, DevSecOps/SRE and QA. HR, Finance, IT, Credit, Privacy/Legal and Production Support provide mandatory control-owner sign-off at relevant gates.

No workstream may self-certify its own Critical access-control closure; QA/Security must independently verify it.

## Anti-pattern guards

- No UI-only isolation or generic-role authorization.
- No missing tenant context that becomes unrestricted access.
- No fetch-all-then-filter or ID-only lookup followed by authorization.
- No caller-controlled tenant, department, classification, S3 key or export scope.
- No raw Prisma response entities or mass assignment.
- No application RLS bypass, table ownership or pooled session claim leakage.
- No mutable published workflows or all-steps-pending approval runtime.
- No direct status writes, best-effort audit or inline notification provider calls.
- No cron execution without durable ownership and idempotency.
- No `db push`, production seed, forced migration resolution or mutable-host release.
- No backup, HA or DR claim without timed execution evidence.

## Design acceptance

Approach A is accepted when this design is approved as the basis for a detailed, file-level implementation plan. The plan will decompose each program into independently reviewable tasks with exact files, interfaces, failing tests, implementation steps, verification commands, ownership, dependencies, commits and gate evidence.
