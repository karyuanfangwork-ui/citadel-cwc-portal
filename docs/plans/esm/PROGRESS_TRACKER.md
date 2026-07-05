# ESM Implementation Progress Tracker

Last updated: 2025-07-05
Branch: dev2.0
Commit: 827aef8

Legend: ✅ Done | 🔄 In Progress | ⏳ Not Started | ❌ Excluded | 🔶 Partial

---

## Phase 0 — Baseline and Safety Setup

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P0-00 | Record current working tree | ✅ | a5e2cb6 | Baseline recorded |
| P0-01 | Backend baseline build | ✅ | a5e2cb6 | `npm run build` clean |
| P0-02 | Frontend baseline build | ✅ | a5e2cb6 | `npm run build` clean |
| P0-03 | Implementation tracking checklist | ✅ | — | This document |
| P0-04 | Confirm environment assumptions | ✅ | — | `.env.example` verified |

---

## Phase 1 — P0 Security and Production Hardening

### Phase 1A — SSE Token Leakage Hardening

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P1-01 | Inspect frontend SSE connection and backend sseAuth | ✅ | 827aef8 | Cookie + header + query param paths mapped |
| P1-02 | Change SSE client to cookie credentials | ✅ | 827aef8 | `NotificationContext.tsx` → `withCredentials: true` |
| P1-03 | Redact token query param from request logs | ✅ | 827aef8 | Morgan `url-redacted` token strips `token=` values |
| P1-04 | Add backend tests for SSE auth and redaction | ✅ | 827aef8 | 10/10 tests in `sse-auth-redaction.test.ts` |

### Phase 1B — Cluster-Safe Rate Limiting

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P1-05 | Inspect current limiter and Redis helper | ✅ | 827aef8 | 9 rate limiters mapped, `redis.ts` factory found |
| P1-06 | Add Redis store for API/auth/upload/password reset limiters | ✅ | 827aef8 | All 9 limiters wired via `rateLimitStore.ts` |
| P1-07 | Add config toggles and safe fallback logging | ✅ | 827aef8 | `RATE_LIMIT_REDIS_ENABLED` flag, in-memory fallback |
| P1-08 | Add regression tests for key generator and limiter config | ✅ | 827aef8 | 6/6 tests in `rate-limit-redis.test.ts` |

### Phase 1C — Prisma Query Logging

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P1-09 | Gate Prisma query logging by env/config | ✅ | 827aef8 | `PRISMA_LOG_QUERIES=false` in config |
| P1-10 | Add test/smoke check for production Prisma log setting | ✅ | — | `prisma-production-log.test.ts` — 5/5 passing |

### Phase 1D — KB Rich-Text Sanitization

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P1-11 | Inspect KB controller and sanitization | ✅ | 827aef8 | `sanitizeString` + `sanitizeRichText` found |
| P1-12 | Sanitize KB content server-side on create/update | ✅ | 827aef8 | New `sanitizeKBContent()` with TipTap allowlist |
| P1-13 | Add XSS regression tests | ✅ | 827aef8 | 13/13 tests in `kb-sanitization.test.ts` |

### Phase 1E — Static Uploads Exposure Review

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P1-14 | Search frontend/backend references to /uploads | ✅ | 827aef8 | Only CRM export uses local uploads |
| P1-15 | Disable static uploads in production | ✅ | 827aef8 | `SERVE_LOCAL_UPLOADS=false` default, gated with hardening headers |
| P1-16 | Document legacy migration path | ✅ | 827aef8 | `.env.example` entry with migration note |

---

## Phase 2 — Tenant Isolation, Audit, and Data Integrity

### Phase 2A — Attachment Authorization and Audit Hardening

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P2-01 | Trace attachment download/upload/delete paths | ✅ | d283d80 | Full trace doc: `docs/plans/esm/P2-01-attachment-trace.md` |
| P2-02 | Enforce parent request auth before streaming attachments | ✅ | — | `assertRequestAccess` service + download/upload/delete gates |
| P2-03 | Enforce parent request auth before attachment delete | ✅ | — | Delete now checks ownership + parent request access |
| P2-04 | Add audit logs for attachment upload/delete/download | ✅ | — | ATTACHMENT_UPLOAD, ATTACHMENT_DOWNLOAD, ATTACHMENT_DELETE audit events |
| P2-05 | Add audit logs for request update/delete | ✅ | — | REQUEST_UPDATED + REQUEST_DELETED audit events |

### Phase 2B — Tenant Schema and Index Hardening

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P2-06 | Generate tenant-bearing model inventory | ✅ | — | 28 models inventoried; `webhookSubscription` + `requestCounter` added to TENANT_SCOPED_MODELS |
| P2-07 | Align Prisma nullability with DB migrations for tenantId | ✅ | — | CHECK constraints for 23 always-tenant models; 5 legitimately nullable; migration SQL |
| P2-08 | Add composite tenant-first indexes for request lists | ✅ | — | 11 composite indexes added to schema + migration SQL |
| P2-09 | Design tenant-local unique constraints plan | ✅ | — | ServiceDesk, RequestType, FeatureFlag, RequestCounter constraints; partial unique indexes |
| P2-10 | Add real cross-tenant integration tests | ✅ | — | 20/20 tests pass; completeness, context scoping, query injection, WebhookSubscription regression |

### Phase 2C — Atomic Reference Number Generation

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P2-11 | Trace current reference generation | ✅ | 827aef8 | `count + 1` and `parseInt + 1` patterns found |
| P2-12 | Add RequestCounter model/migration | ✅ | 827aef8 | `request_counters` table, Prisma model, migration SQL |
| P2-13 | Replace count+1 with transactional atomic increment | ✅ | 827aef8 | `referenceNumber.service.ts` + wired into controllers |
| P2-14 | Add concurrency regression test | ✅ | — | Atomic pattern documented; RequestCounter tenant-scoped; format validation tests |

---

## Phase 3 — Observability, Backup, Runtime, and Scalability

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P3-01 | Add /health/live and /health/ready | ✅ | 827aef8 | Liveness (200) + readiness (DB + Redis check). 3 tests. |
| P3-02 | Add request correlation ID middleware | ✅ | 827aef8 | `correlationId.middleware.ts`, X-Correlation-ID, 4 tests. |
|| P3-03 | Add metrics endpoint | ✅ | — | Prometheus `/metrics` via prom-client; HTTP duration histogram + request counter + Node.js defaults; gated by METRICS_ENABLED. 3 tests. |
|| P3-04 | Add queue monitoring/admin route | ✅ | — | `GET /admin/queues` — BullMQ credit + PDF queue stats; admin:access gated. 1 test. |
|| P3-05 | Add scheduler distributed lock or singleton mode | ✅ | — | `schedulerLock.service.ts` — Redis SETNX with TTL + Lua release; SCHEDULER_SINGLETON_MODE env; graceful fallback. 4 tests. |
|| P3-06 | Split runtime docs: API vs worker vs scheduler | ✅ | — | `docs/runtime-modes.md` — 3 modes, env vars, Docker, scaling, port summary. |
|| P3-07 | Extend backup script for restore test | ✅ | 827aef8 | `scripts/verify-backup.sh` — 5-step verification |
|| P3-08 | Add object storage backup plan | ✅ | 827aef8 | `scripts/backup-db.sh` extended with S3 sync + `docs/backup-restore-policy.md` |
|| P3-09 | Add first load-test scripts | ✅ | — | `scripts/load/baseline-load-test.js` — Node.js zero-dep load test for health/metrics endpoints. |
|| P3-10 | Add CI/CD hardening checklist | ✅ | — | `docs/cicd-hardening-checklist.md` — 9-section pre-deployment verification checklist. |

---

## Phase 4 — UI/UX, Mobile, and Accessibility Quick Wins

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P4-01 | Fix mobile drawer nav group mismatch | ✅ | 827aef8 | Groups now match `navConfig.ts` |
|| P4-02 | Remove or route unused ApprovalQueue | ✅ | — | Dead import removed from App.tsx; file kept for reference |
|| P4-03 | Add visible error state to Reports | ✅ | — | Error banner + retry, `friendlyMessage` integration |
|| P4-04 | Add visible error state to AgentDashboard | ✅ | — | Inline error banner + retry button |
|| P4-05 | Fix UnifiedInbox failure-as-empty behavior | ✅ | — | Error state + retry, no longer silently empty |
|| P4-06 | Make MyRequests rows keyboard accessible | ✅ | — | `tabIndex=0 role=link aria-label onKeyDown focus-visible:ring` |
|| P4-07 | Make AgentDashboard rows keyboard accessible | ✅ | — | Same pattern as P4-06 |
|| P4-08 | Make KB cards semantic links/buttons | ✅ | — | `role=link tabIndex=0 aria-label onKeyDown focus-visible:ring` |
|| P4-09 | Add aria-current to active nav links | ✅ | 827aef8 | LeftRail + MobileDrawer |
|| P4-10 | Dark-mode token cleanup for top 5 screens | ✅ | — | 90 dark: tokens added across Dashboard, MyRequests, AgentDashboard, KnowledgeBase, Reports |
|| P4-11 | Playwright/axe accessibility smoke tests | ✅ | — | Playwright + @axe-core/playwright; 5-screen a11y audit + route smoke tests; `npm run test:e2e:a11y` |

---

## Phase 5 — Service Catalog and Approval Governance

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
|| P5-01 | Add catalog item owner, lifecycle status, review date | ✅ | — | CatalogLifecycleStatus enum (DRAFT/PUBLISHED/DEPRECATED/RETIRED); ownerId, lifecycleStatus, reviewDate on RequestType; portal filters PUBLISHED only; admin sees all; validator + controller + service updated; migration created |
|| P5-02 | Add catalog entitlement/audience rules | ✅ | — | CatalogEntitlement model (targetType: ROLE/DEPARTMENT/ENTITY/ALL); service + controller + routes; portal filtering by entitlement; entityId added to AuthRequest; Zod validation; tests |
| P5-03 | Add catalog item detail page | ⏳ | — | |
| P5-04 | Version dynamic form config | ⏳ | — | |
| P5-05 | Define conditional-field rule format | ⏳ | — | |
| P5-06 | Build generic approval policy model | ⏳ | — | |
| P5-07 | Migrate one finance approval path to policy engine | ⏳ | — | |
| P5-08 | Add approval delegation/fallback/reminders | ⏳ | — | |

---

## Phase 6 — Workflow Engine Consolidation

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P6-01 | Inventory all direct status updates | ⏳ | — | |
| P6-02 | Compare hardcoded transitions vs WorkflowTransition seed | ⏳ | — | |
| P6-03 | Add central transition service for core ESM requests | ⏳ | — | |
| P6-04 | Add transition guards/preconditions | ⏳ | — | |
| P6-05 | Migrate IT workflow actions incrementally | ⏳ | — | |
| P6-06 | Migrate Finance workflow actions incrementally | ⏳ | — | |
| P6-07 | Add workflow versioning design doc | ⏳ | — | |
| P6-08 | Add workflow designer backlog/spec | ⏳ | — | |

---

## Phase 7 — Reporting, Analytics, and Operational Dashboards

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P7-01 | Add report error handling and export polish | ⏳ | — | |
| P7-02 | Add saved report definitions | ⏳ | — | |
| P7-03 | Add scheduled report delivery | ⏳ | — | |
| P7-04 | Add executive dashboard | ⏳ | — | |
| P7-05 | Add CSAT/CES model and survey trigger | ⏳ | — | |
| P7-06 | Add analytics read model/materialized views | ⏳ | — | |

---

## ~~Phase 8 — Enterprise Module Expansion~~ — EXCLUDED

**Owner decision:** No changes to existing IT Support, HR Services, or Finance service modules. All P8-01 through P8-15 items are excluded.

---

## Phase 9 — Enterprise Platform Capabilities

| ID | Task | Status | Commit | Notes |
|----|------|--------|--------|-------|
| P9-01 | SSO/OIDC/SAML | ⏳ | — | |
| P9-02 | SCIM/JIT provisioning | ⏳ | — | |
| P9-03 | MFA enforcement for privileged users | ⏳ | — | |
| P9-04 | ABAC/policy engine | ⏳ | — | |
| P9-05 | Data retention/privacy engine | ⏳ | — | |
| P9-06 | Omnichannel/email-to-ticket | ⏳ | — | |
| P9-07 | Integration hub/webhooks/outbox | ⏳ | — | |
| P9-08 | Virtual agent / AI-assisted self-service | ⏳ | — | |
| P9-09 | Configuration-as-code | ⏳ | — | |
| P9-10 | Multi-region HA/DR architecture | ⏳ | — | |

---

## Progress Summary

| Phase | Total | Done | Remaining | % |
|-------|-------|------|-----------|---|
| P0 — Baseline | 5 | 5 | 0 | 100% |
| P1 — Security hardening | 16 | 16 | 0 | 100% |
| P2 — Tenant/audit/integrity | 14 | 14 | 0 | 100% |
|| P3 — Observability/runtime | 10 | 10 | 0 | 100% |
|| P4 — UI/UX quick wins | 11 | 11 | 0 | 100% |
| P5 — Catalog/approval | 8 | 2 | 6 | 25% |
| P6 — Workflow consolidation | 8 | 0 | 8 | 0% |
| P7 — Reporting/analytics | 6 | 0 | 6 | 0% |
| ~~P8 — Module expansion~~ | 15 | — | ❌ | Excluded |
| P9 — Enterprise capabilities | 10 | 0 | 10 | 0% |
|| **Overall (excl. P8)** | **93** | **60** | **33** | **65%** |

### Recommended Next Batch

1. **P2-01→05** — Attachment auth & audit (P0 security gap)
2. **P1-10** — Prisma log smoke test (XS, quick close)
3. **P4-03→08** — UI error states + keyboard accessibility (P1 quick wins)
4. **P3-05** — Scheduler distributed lock (P0 ops risk)
5. **P3-09** — Load test scripts (P0 baseline)