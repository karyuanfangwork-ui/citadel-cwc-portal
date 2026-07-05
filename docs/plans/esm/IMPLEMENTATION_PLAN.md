# CWC Enterprise Service Management Audit Remediation — Implementation Plan

Date: 2026-07-05
Source audit: `docs/ESM_ARCHITECTURE_PRODUCTION_READINESS_AUDIT.md`
Purpose: Convert the audit into an executable, phase-by-phase backlog so we can tackle action items one by one without redesigning the product.

Guiding principles:

1. Fix production/security risks before new enterprise features.
2. Keep changes incremental and verifiable.
3. Prefer small, isolated PR-sized phases.
4. Do not rewrite the system or replace the current architecture.
5. Preserve the current working product while hardening it.
6. For every phase: implement, run targeted tests/build, and update this plan status.
7. Do not deploy production changes without explicit approval.

Current audit verdict:

- Overall score: 69 / 100.
- Classification: Production Ready for controlled internal deployment / pilot, not yet Enterprise Ready for multinational-scale ESM.
- Target after this plan: 82+ / 100, Enterprise Ready baseline.

---

## 1. Execution Strategy

Recommended execution order:

1. Phase 0 — Safety setup and baseline verification.
2. Phase 1 — P0 security and production hardening.
3. Phase 2 — Tenant isolation, audit, and data integrity hardening.
4. Phase 3 — Observability, backup, runtime, and scalability hardening.
5. Phase 4 — UI/UX and mobile/accessibility quick wins.
6. Phase 5 — Service catalog and approval governance.
7. Phase 6 — Workflow engine consolidation.
8. Phase 7 — Reporting, analytics, and operational dashboards.
9. Phase 8 — ITSM/HRSM/Finance enterprise module expansion.
10. Phase 9 — Enterprise platform capabilities.

Recommended sprint size:

- P0 hardening: 1–2 weeks.
- P1 platform governance: 3–6 weeks.
- P2 module expansion: 2–4 months.
- P3 enterprise enhancements: 6–12 months.

Definition of done for each item:

- Code implemented.
- Existing behavior preserved.
- Tests added/updated when the change affects business logic/security.
- `npm run build` or targeted `tsc` passes for affected app.
- Prisma schema validated if DB changes are involved.
- Manual verification notes captured.
- Audit/report docs updated if system behavior changes.

---

## 2. Phase 0 — Baseline and Safety Setup

Goal: Establish a known-good baseline before changing security/runtime behavior.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P0-00 | Record current working tree and avoid touching existing user changes | P0 | XS | Git status | `git status --short`; confirm only intended files change. |
| P0-01 | Run backend baseline checks | P0 | S | `backend/` | `npm run build`; targeted tests if full suite is too slow. |
| P0-02 | Run frontend baseline checks | P0 | S | `frontend/` | `npm run build`. |
| P0-03 | Create implementation tracking checklist | P0 | XS | This plan | Update status table after every phase. |
| P0-04 | Confirm environment assumptions | P0 | XS | `.env.example`, config | Do not read `.env`; verify required variables from `backend/.env.example`. |

Notes:

- Existing uncommitted backend credit files were present before this plan. Do not overwrite them unless the current task explicitly requires it.
- Use focused builds/tests where full test suites are noisy because of pre-existing unrelated failures.

---

## 3. Phase 1 — P0 Security and Production Hardening

Goal: Close immediate production risks that could leak tokens/data, create inconsistent controls under scaling, or weaken auditability.

### Phase 1A — SSE token leakage hardening

Audit finding:

- SSE authentication accepts JWT in query string for EventSource.
- Production request logging can log full URL/query.

Recommended approach:

1. Prefer HttpOnly cookie-based SSE auth where possible.
2. Keep query-token support only as a fallback if needed, but redact it in logs and document it as deprecated.
3. Add tests for SSE auth using cookie and query token.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P1-01 | Inspect frontend notification SSE connection and backend `sseAuth` | P0 | XS | `frontend/src/services/notification.service.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/src/routes/notificationSse.routes.ts` | Confirm how token is currently passed. |
| P1-02 | Change SSE client to use cookie credentials instead of query token if feasible | P0 | S | Notification service | Browser EventSource cookie behavior verified locally. |
| P1-03 | Redact `token` query param from request logs | P0 | S | `backend/src/app.ts`, logger/morgan config | Test logged URL never contains JWT. |
| P1-04 | Add backend tests for SSE auth and redaction | P0 | S | Auth/notification tests | Jest targeted tests pass. |

Acceptance criteria:

- SSE still connects for authenticated users.
- No JWT query string is logged.
- Existing notification toast/dropdown behavior remains working.

---

### Phase 1B — Cluster-safe rate limiting

Audit finding:

- `express-rate-limit` appears process-local despite Redis dependency.

Recommended approach:

1. Configure Redis-backed store using existing Redis utility/config.
2. Fail closed or fail safely depending limiter type:
   - Auth/password reset: prefer fail closed or conservative fallback.
   - General API: allow configurable fallback to avoid total outage if Redis is unavailable.
3. Add test/mocking around limiter store construction.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P1-05 | Inspect current limiter and Redis helper | P0 | XS | `backend/src/middleware/rateLimit.middleware.ts`, `backend/src/utils/redis.ts`, `backend/src/config/index.ts` | Identify integration point. |
| P1-06 | Add Redis store for API/auth/upload/password reset limiters | P0 | M | Rate-limit middleware | Unit/integration test or boot smoke test. |
| P1-07 | Add config toggles and safe fallback logging | P0 | S | `config/index.ts`, `.env.example` | Missing Redis behavior documented. |
| P1-08 | Add regression tests for key generator and limiter config | P0 | S | Rate-limit tests | Jest targeted tests pass. |

Acceptance criteria:

- Multi-instance deployments share rate-limit counters.
- Auth limiter remains keyed by email + IP.
- No secrets are logged when Redis fails.

---

### Phase 1C — Disable/redact Prisma query logging in production

Audit finding:

- Prisma client uses `log: ['query', 'info', 'warn', 'error']` globally.

Recommended approach:

1. Use query logging only in development or when explicitly enabled.
2. Preserve warn/error logs in production.
3. Add config variable for query logging.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P1-09 | Gate Prisma query logging by env/config | P0 | XS | `backend/src/lib/prisma.ts`, `backend/src/config/index.ts`, `.env.example` | Build passes. |
| P1-10 | Add test or smoke check for production log setting | P0 | XS | Prisma utility test or small unit test | Test confirms no query logging by default in production. |

Acceptance criteria:

- Production default does not log SQL queries.
- Development can still enable query logging intentionally.

---

### Phase 1D — KB rich-text sanitization

Audit finding:

- KB content create/update persistence does not clearly enforce server-side sanitization.

Recommended approach:

1. Reuse existing sanitization utilities or `sanitize-html` dependency.
2. Sanitize on create/update before persistence.
3. Preserve allowed TipTap/KB tags and links.
4. Add XSS regression tests.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P1-11 | Inspect KB controller and sanitization utilities | P1 | XS | `backend/src/controllers/kb.controller.ts`, `backend/src/utils/sanitize.ts` | Confirm current behavior. |
| P1-12 | Sanitize KB content server-side on create/update | P1 | S | KB controller/service | Script tags/event handlers stripped. |
| P1-13 | Add XSS regression tests | P1 | S | KB controller tests | Jest targeted tests pass. |

Acceptance criteria:

- `<script>`, `onerror`, `javascript:` links are removed.
- Valid rich-text formatting remains.

---

### Phase 1E — Static uploads exposure review

Audit finding:

- `/uploads` static serving remains enabled while S3 upload is used.

Recommended approach:

1. Determine if any current feature still depends on local `/uploads`.
2. If not needed, disable by default and make it development-only behind env flag.
3. If needed for legacy migration, restrict access and add safe headers.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P1-14 | Search frontend/backend references to `/uploads` | P0 | XS | Whole repo | List dependencies. |
| P1-15 | Disable static uploads in production | P0 | S | `backend/src/app.ts`, config, `.env.example` | Production-mode smoke test. |
| P1-16 | Document legacy migration path if local files exist | P1 | S | `docs/` | Migration note complete. |

Acceptance criteria:

- Local upload directory is not publicly served in production unless explicitly enabled.
- S3 download flow remains working.

---

## 4. Phase 2 — Tenant Isolation, Audit, and Data Integrity Hardening

Goal: Reduce cross-tenant, audit, and data-race risks before scaling to large enterprises.

### Phase 2A — Attachment authorization and audit hardening

Audit finding:

- Child attachment operations can query/mutate by attachment ID and rely on separate parent checks.
- Request update/delete and attachment upload/delete audit coverage is incomplete.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P2-01 | Trace attachment download/upload/delete paths | P0 | XS | `backend/src/controllers/request.controller.ts`, file routes/services | Path map documented in PR notes. |
| P2-02 | Enforce parent request authorization before streaming/downloading attachments | P0 | S | Request controller | Cross-tenant/unauthorized test fails before and passes after. |
| P2-03 | Enforce parent request authorization before attachment delete | P0 | S | Request controller | Unauthorized delete blocked. |
| P2-04 | Add audit logs for attachment upload/delete/download where sensitive | P0 | S | Request controller, `utils/audit.ts` | Audit rows verified in tests. |
| P2-05 | Add audit logs for request update/delete | P0 | S | Request controller | Audit rows verified. |

Acceptance criteria:

- No attachment can be downloaded/deleted without verified access to the parent request.
- AuditLog captures request update/delete and attachment upload/delete.

---

### Phase 2B — Tenant schema and index hardening

Audit finding:

- Prisma schema nullable tenant IDs drift from DB migrations.
- Globally unique fields block tenant-local values and can create SaaS friction.
- Query patterns need composite tenant-first indexes.

Recommended approach:

Do this carefully as a schema/migration phase. Split into two sub-phases if needed.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P2-06 | Generate tenant-bearing model inventory from Prisma schema | P1 | S | `backend/prisma/schema.prisma` | Inventory reviewed. |
| P2-07 | Align Prisma nullability with DB migrations for tenantId where safe | P1 | M | Prisma schema + migration | `npx prisma validate`; migration review. |
| P2-08 | Add composite tenant-first indexes for request lists | P1 | M | Prisma schema | `npx prisma validate`; query explain if DB available. |
| P2-09 | Design tenant-local unique constraints plan | P1 | M | User, ServiceDesk, RequestType, FeatureFlag, Request reference | Written migration plan before applying. |
| P2-10 | Add real cross-tenant integration tests | P0/P1 | M | Tenant isolation tests | Tests prove tenant A cannot access tenant B request/attachment/catalog. |

Recommended first composite indexes:

- `Request(tenantId, status, createdAt)`
- `Request(tenantId, serviceDeskId, status)`
- `Request(tenantId, assigneeId, status)`
- `Request(tenantId, requesterId, createdAt)`
- `Request(tenantId, deletedAt, createdAt)`

Acceptance criteria:

- Tenant isolation tests cover root and child resources.
- Indexes support top request list/queue filters.
- Tenant uniqueness strategy documented before risky migration.

---

### Phase 2C — Atomic reference number generation

Audit finding:

- Request reference generation uses count + 1 while `referenceNumber` is unique, creating a race condition.

Recommended approach:

1. Add a counter table keyed by tenant + service desk code/year or tenant + service desk.
2. Generate references inside a transaction using atomic increment.
3. Preserve existing reference format unless intentionally changed.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P2-11 | Trace current reference generation | P1 | XS | `request.controller.ts` create path | Current behavior documented. |
| P2-12 | Add `RequestReferenceCounter` model/migration | P1 | M | Prisma schema/migration | Prisma validate/generate. |
| P2-13 | Replace count+1 with transactional atomic increment | P1 | M | Request create service/controller | Concurrent create test. |
| P2-14 | Add concurrency regression test | P1 | M | Request tests | N parallel creates produce unique refs. |

Acceptance criteria:

- Concurrent request creates never collide.
- Reference format remains predictable for users.

---

## 5. Phase 3 — Observability, Backup, Runtime, and Scalability Hardening

Goal: Make the platform operable by enterprise IT operations.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P3-01 | Add `/health/live` and `/health/ready` | P0 | S | `backend/src/app.ts`, health utility | Ready checks DB/Redis/S3/queue. |
| P3-02 | Add request correlation ID middleware | P0 | S | Middleware, logger, error responses | Logs include correlation ID. |
| P3-03 | Add metrics endpoint | P1 | M | Express middleware, metrics package | Prometheus scrape works locally. |
| P3-04 | Add queue monitoring/admin route or dashboard | P1 | M | BullMQ PDF queue, scheduler admin | Queue status visible. |
| P3-05 | Add scheduler distributed lock or singleton deployment mode | P0 | M | Scheduler service, Redis lock, docs | Two API instances do not duplicate job work. |
| P3-06 | Split runtime docs: API vs worker vs scheduler | P1 | S | Docker/deployment docs | Clear run commands. |
| P3-07 | Extend backup script for restore test | P0 | M | `scripts/backup-db.sh`, new restore verification script | Restore verification documented. |
| P3-08 | Add object storage backup plan | P0 | M | docs/scripts | Attachments covered by backup policy. |
| P3-09 | Add first load-test scripts | P0 | M | `tests/load` or `scripts/load` | Baseline results captured. |
| P3-10 | Add CI/CD hardening checklist | P0 | S | docs + pipeline config if present | Build/test/audit steps documented or automated. |

Acceptance criteria:

- Ops can tell whether app is live vs ready.
- Logs are traceable by request ID.
- Backups include DB and attachments.
- Scheduled jobs are safe in horizontal deployments.

---

## 6. Phase 4 — UI/UX, Mobile, Accessibility Quick Wins

Goal: Fix high-impact usability and compliance issues without redesigning the UI.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P4-01 | Fix mobile drawer nav group mismatch | P1 | S | `frontend/src/components/layout/MobileDrawer.tsx`, `navConfig.ts` | Mobile shows IT/HR/Finance/Assets/CRM/Credit/KB where permitted. |
| P4-02 | Remove or route unused `ApprovalQueue` | P2 | XS | `frontend/App.tsx`, `pages/ApprovalQueue.tsx` | No dead import. |
| P4-03 | Add visible error state to Reports | P1 | S | `frontend/pages/Reports.tsx` | Failed API call displays friendly error. |
| P4-04 | Add visible error state to AgentDashboard | P1 | S | `frontend/pages/AgentDashboard.tsx` | Failed queue load displays retry/error. |
| P4-05 | Fix UnifiedInbox failure-as-empty behavior | P1 | S | `frontend/pages/UnifiedInbox.tsx` | API failure not shown as “Nothing here”. |
| P4-06 | Make MyRequests rows keyboard accessible | P1 | S | `frontend/pages/MyRequests.tsx` | Row navigation works with keyboard/screen reader. |
| P4-07 | Make AgentDashboard rows keyboard accessible | P1 | S | `frontend/pages/AgentDashboard.tsx` | Row navigation works with keyboard/screen reader. |
| P4-08 | Make KB cards semantic links/buttons | P1 | S | `frontend/pages/KnowledgeBase.tsx` | Cards accessible by keyboard. |
| P4-09 | Add `aria-current` to active nav links | P1 | XS | `LeftRail.tsx`, `MobileDrawer.tsx` | Screen readers identify current page. |
| P4-10 | Start dark-mode token cleanup for top 5 ESM screens | P2 | M | Dashboard, IT/HR/Finance, Reports, AgentDashboard | Visual smoke in light/dark. |
| P4-11 | Add Playwright/axe accessibility smoke tests for top journeys | P1 | M | Frontend tests | Accessibility checks run. |

Acceptance criteria:

- Mobile navigation exposes all permitted major modules.
- Core tables/cards are keyboard accessible.
- Failed API calls show visible errors.
- Accessibility test baseline exists.

Recommended first UI task: P4-01, because it is high-impact, likely small, and visibly fixes module access on mobile.

---

## 7. Phase 5 — Service Catalog and Approval Governance

Goal: Move from hardcoded/request-type behavior toward governed enterprise catalog and approval configuration.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P5-01 | Add catalog item owner, lifecycle status, review date | P1 | M | `RequestType` schema, admin UI, service desk service | Admin can edit; portal shows only published. |
| P5-02 | Add catalog entitlement/audience rules | P1 | M/L | Schema, serviceDesk service, frontend portal | Users only see entitled catalog items. |
| P5-03 | Add catalog item detail page | P2 | M | Frontend route/page | Users can view SLA/owner/details before request. |
| P5-04 | Version dynamic form config | P1 | L | RequestType form version, Request snapshot | In-flight requests preserve submitted form version. |
| P5-05 | Define conditional-field rule format | P1 | M | Form builder/wizard/backend validation | Rule spec documented and validated. |
| P5-06 | Build generic approval policy model | P1 | L | Prisma schema, approval service | Can define sequential/parallel/conditional approval. |
| P5-07 | Migrate one finance approval path to policy engine | P1 | L | Finance workflow | Behavior parity tests pass. |
| P5-08 | Add approval delegation/fallback/reminders | P1 | M/L | User delegation, approval service, scheduler | OOO/delegated approver works. |

Acceptance criteria:

- Catalog has lifecycle and ownership.
- Approval policy can handle at least one existing flow without hardcoding.
- Existing IT/HR/Finance flows remain functional.

---

## 8. Phase 6 — Workflow Engine Consolidation

Goal: Reduce split-brain risk between DB transitions and hardcoded workflow controllers.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P6-01 | Inventory all direct status updates | P1 | M | Controllers/services | List every `status` update path. |
| P6-02 | Compare hardcoded transitions vs `WorkflowTransition` seed | P1 | M | Workflow seed, controllers | Drift report generated. |
| P6-03 | Add central transition service for core ESM requests | P1 | L | New workflow transition service | One status-update API uses service. |
| P6-04 | Add transition guards/preconditions | P1 | M | Transition service | Invalid transitions blocked uniformly. |
| P6-05 | Migrate IT workflow actions incrementally | P1 | L | IT workflow controller | Parity tests. |
| P6-06 | Migrate Finance workflow actions incrementally | P1 | L | Finance workflow controller | Parity tests. |
| P6-07 | Add workflow versioning design doc | P2 | M | docs + schema proposal | Reviewed before implementation. |
| P6-08 | Add workflow designer backlog/spec | P2 | M | docs | Future feature scoped. |

Acceptance criteria:

- New workflow changes go through a central service.
- DB transition config and controller behavior do not drift silently.

---

## 9. Phase 7 — Reporting, Analytics, and Operational Dashboards

Goal: Upgrade from basic operational reports to enterprise management analytics.

| ID | Task | Priority | Effort | Files / areas | Verification |
|---|---|---:|---:|---|---|
| P7-01 | Add report error handling and export polish | P1 | S | Reports page/service | Visible errors and XLSX/CSV exports. |
| P7-02 | Add saved report definitions | P2 | M | Schema/routes/frontend | Save/load report filters. |
| P7-03 | Add scheduled report delivery | P2 | M/L | Scheduler, reports service, email | Scheduled report email test. |
| P7-04 | Add executive dashboard | P2 | M/L | Reports/Insights backend + page | SLA, MTTA/MTTR, backlog, trends. |
| P7-05 | Add CSAT/CES model and survey trigger | P2 | M | Schema, notification, portal | Resolved request triggers survey. |
| P7-06 | Add analytics read model/materialized views if load tests require | P2 | L | DB/reporting | Large report queries improved. |

Acceptance criteria:

- Managers can save and schedule reports.
- Executives get high-level operational metrics.
- Report pages handle failure gracefully.

---

## 10. ~~Phase 8 — Enterprise Module Expansion~~ — EXCLUDED

**Owner decision:** No changes to the existing IT Support, HR Services, or Finance service modules. The current service desk workflows, categories, and request types remain as-is. This phase is strikethrough and will not be implemented.

Goal: Close major enterprise ESM capability gaps after the foundation is hardened.

### ITSM expansion

| ID | Task | Priority | Effort | Outcome |
|---|---|---:|---:|---|
| P8-01 | Incident Management depth | P1 | L | Impact/urgency, major flag, affected service, incident tasks. |
| P8-02 | Problem Management | P1 | L | Problem record, RCA, workaround, known error, linked incidents. |
| P8-03 | Change Management | P1 | XL | Standard/normal/emergency change, CAB, calendar, risk, backout. |
| P8-04 | Major Incident | P1 | L | Declare major incident, comms, bridge, timeline, postmortem. |
| P8-05 | CMDB v1 | P1/P2 | XL | CI classes, relationships, services, asset-to-CI mapping. |

### HRSM expansion

| ID | Task | Priority | Effort | Outcome |
|---|---|---:|---:|---|
| P8-06 | Confidential HR cases | P1 | M | Restricted case types, masked fields, stricter assignment. |
| P8-07 | HR document request workflow | P1 | M | Employment letter, verification, secure delivery. |
| P8-08 | Employee transfer workflow | P2 | M | Transfer request, approvals, effective date, IT/HR tasks. |
| P8-09 | Promotion/compensation workflow | P2 | M/L | Approval, effective date, document trail. |
| P8-10 | Payroll/benefits inquiry workflows | P2 | M | First-class HRSM cases beyond KB articles. |

### Finance Ops expansion

| ID | Task | Priority | Effort | Outcome |
|---|---|---:|---:|---|
| P8-11 | Enable/harden expense claims | P1 | M | Policy checks, receipts, approval, payment status. |
| P8-12 | Vendor request workflow | P1 | M/L | Vendor onboarding, duplicate/sanctions, bank verification. |
| P8-13 | Invoice inquiry workflow | P2 | M | Invoice status, attachments, finance responses. |
| P8-14 | Payment request/status workflow | P2 | M | Payment stages, remittance evidence. |
| P8-15 | Finance analytics | P2 | M | Spend/category/entity/approval bottleneck metrics. |

Acceptance criteria:

- ITSM covers incident/problem/change/major incident/CMDB baseline.
- HRSM covers confidential cases and common employee lifecycle cases.
- Finance covers expense/vendor/invoice/payment workflows.

---

## 11. Phase 9 — Enterprise Platform Capabilities

Goal: Reach enterprise platform maturity comparable to major ESM products.

| ID | Task | Priority | Effort | Outcome |
|---|---|---:|---:|---|
| P9-01 | SSO/OIDC/SAML | P0/P1 | L | Enterprise login and identity integration. |
| P9-02 | SCIM/JIT provisioning | P1 | L | User lifecycle automation. |
| P9-03 | MFA enforcement for privileged users | P0/P1 | M | Admin/agent/approver step-up auth. |
| P9-04 | ABAC/policy engine | P1 | L | Tenant/entity/department/confidentiality access rules. |
| P9-05 | Data retention/privacy engine | P1 | M/L | Retention, export/delete/anonymize/legal hold. |
| P9-06 | Omnichannel/email-to-ticket | P2 | L | Email/Teams/Slack request creation/updates. |
| P9-07 | Integration hub/webhooks/outbox | P2 | XL | Reliable outbound events and connectors. |
| P9-08 | Virtual agent / AI-assisted self-service | P3 | L | Deflection after KB/catalog maturity. |
| P9-09 | Configuration-as-code | P2 | M/L | Export/import workflows/catalog/permissions across envs. |
| P9-10 | Multi-region HA/DR architecture | P2/P3 | XL | Enterprise continuity target. |

---

## 12. Recommended First 10 Action Items

If we start implementation immediately, tackle these in this order:

1. P1-09 — Gate Prisma query logging by env/config.
2. P1-01 to P1-04 — Harden SSE token leakage.
3. P1-05 to P1-08 — Configure Redis-backed rate limiting.
4. P2-01 to P2-05 — Secure and audit attachment/request mutation paths.
5. P1-11 to P1-13 — Add KB server-side sanitization.
6. P4-01 — Fix mobile drawer nav group mismatch.
7. P3-01 — Add live/ready health checks.
8. P3-02 — Add request correlation IDs.
9. P2-11 to P2-14 — Replace reference count+1 generation with atomic counter.
10. P3-07/P3-08 — Backup restore verification and attachment backup plan.

Why this order:

- Items 1–5 close concrete security/data leakage risks.
- Item 6 fixes a visible high-impact UX bug.
- Items 7–8 improve production operability.
- Item 9 prevents data integrity issues under concurrency.
- Item 10 addresses business-continuity risk.

---

## 13. Phase Tracking

|| Phase | Status | Notes |
|---|---|---|
| Phase 0 — Baseline | ✅ Done | Baseline build verified. |
| Phase 1 — P0 security hardening | ✅ Done | P1-01 through P1-16 completed. |
| Phase 2 — Tenant/audit/data integrity | 🔄 Partial | P2-11→14 (atomic refs) done. P2-01→05 and P2-06→10 remaining. |
| Phase 3 — Observability/runtime | 🔄 Partial | P3-01, P3-02, P3-07, P3-08 done. P3-03→06, P3-09, P3-10 remaining. |
| Phase 4 — UI/UX quick wins | 🔄 Partial | P4-01, P4-09 done. P4-02→08, P4-10→11 remaining. |
| Phase 5 — Catalog/approval governance | Not started | Requires schema and admin UI work. |
| Phase 6 — Workflow consolidation | Not started | Requires careful regression testing. |
| Phase 7 — Reporting/analytics | Not started | After operational reports are stable. |
| ~~Phase 8 — Module expansion~~ | ❌ Excluded | No changes to existing IT/HR/Finance services per owner decision. |
| Phase 9 — Enterprise capabilities | Not started | Long-term roadmap. |

---

## 14. Implementation Notes for Each Work Item

For every item, use this execution template:

1. Inspect current code paths.
2. Identify exact files and existing tests.
3. Write or update regression test first when practical.
4. Implement smallest safe change.
5. Run targeted tests.
6. Run build/typecheck for affected package.
7. Update docs/plan status.
8. Summarize exact files changed and verification output.

Standard verification commands:

Backend:

```bash
cd backend
npm run build
npm test -- --runInBand <target-test-file-or-pattern>
npx prisma validate
```

Frontend:

```bash
cd frontend
npm run build
npm test -- <target-test-file-or-pattern>
```

Repo hygiene:

```bash
git status --short
git diff -- <changed-files>
```

---

## 15. Recommended Next Step

Start with Phase 0, then implement P1-09 first:

`P1-09 — Gate Prisma query logging by env/config`

Rationale:

- Very small change.
- Low business-risk.
- Directly closes a production data-leak/log-volume risk.
- Good first patch to establish the implementation rhythm.

After that, proceed to SSE token hardening and Redis-backed rate limiting.
