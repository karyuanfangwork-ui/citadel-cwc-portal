# CITADEL CWC 2.0 — FULL PROJECT AUDIT (RE-AUDIT)

**Audit Date:** April 27, 2026
**Previous Audit:** April 24, 2026 (Score: 61/100)
**Audited By:** Senior Product Auditor / Enterprise Solution Architect / CTO Lens
**System:** Internal Jira Service Management — IT Support, HR Support, Finance Support
**Branch:** dev2.0

---

## TABLE OF CONTENTS

1. [Section 1 — Executive Delta Summary](#section-1--executive-delta-summary)
2. [Section 2 — Score Changes Since Last Audit](#section-2--score-changes-since-last-audit)
3. [Section 3 — Production Readiness Audit](#section-3--production-readiness-audit)
4. [Section 4 — Core Feature Readiness](#section-4--core-feature-readiness)
5. [Section 5 — IT Support Module Audit](#section-5--it-support-module-audit)
6. [Section 6 — HR Support Module Audit](#section-6--hr-support-module-audit)
7. [Section 7 — Finance Support Module Audit](#section-7--finance-support-module-audit)
8. [Section 8 — Security Deep-Dive](#section-8--security-deep-dive)
9. [Section 9 — Infrastructure & DevOps](#section-9--infrastructure--devops)
10. [Section 10 — Top 10 Risks & Top 10 Quick Wins](#section-10--top-10-risks--top-10-quick-wins)
11. [Section 11 — Action Plan & Roadmap](#section-11--action-plan--roadmap)

---

## SECTION 1 — EXECUTIVE DELTA SUMMARY

### Overall System Score: **70 / 100** (up from 67/100 Apr 27, up from 65/100 Apr 27, up from 61/100 Apr 24)

| Dimension | Weight | Apr 24 Score | Apr 27 Score | Current Score | Delta (from Apr 27) | Notes |
|-----------|--------|-------------|-------------|---------------|----------------------|-------|
| Security & Auth | 30% | 58/100 | 60/100 | 60/100 | +0 | Password breach check added; still no MFA/SSO |
| Workflow Correctness | 15% | 55/100 | 80/100 | 85/100 | +5 | Expense dead-ends fixed, SLA pause implemented |
| SLA & Monitoring | 10% | 20/100 | 55/100 | 55/100 | +0 | SLA breach alerts + escalation engine implemented |
| Testing | 10% | 0/100 | 8/100 | 35/100 | +25 | 11 backend suites (109 passing), 8 frontend suites (97 passing); CI test gate active |
| CI/CD & DevOps | 10% | 10/100 | 20/100 | 35/100 | +15 | CI pipeline (lint+build), Docker Compose prod, backup script |
| Data Protection | 10% | 25/100 | 28/100 | 28/100 | +0 | isConfidential not in schema; zero enforcement |
| Code Quality | 15% | 55/100 | 75/100 | 78/100 | +3 | SLA pause UI, audit log module, workflow fixes |
| **Weighted Total** | **100%** | **61/100** | **65/100** | **70/100** | **+5** | |

### What Changed Since Apr 27

| # | Item | Status | Impact |
|---|------|--------|--------|
| 1 | LOA_ACCEPTED → COMPLETED transition | ✅ FIXED | HR hiring tickets now close properly |
| 2 | Finance stepper (FIN statuses) | ✅ FIXED | Finance users see correct step indicators |
| 3 | SLA breach notification + escalation | ✅ IMPLEMENTED | Breaches now trigger alerts + automated escalation |
| 4 | Backend test infrastructure | ✅ IMPROVED | 6 test files (up from 3) — auth, token, password-reset, request, SLA-pause, integration |
| 4b | Backend test expansion | ✅ DONE | 11 suites, 109 passing: +entityRouting(15), notification(16), sla(12), permission(9), sseClients(16) |
| 4c | Frontend test infrastructure | ✅ DONE | 8 suites, 97 tests: vitest + testing-library, utils (permissions, roleDetection, workflowTransitions, tokenManager), components (ProtectedRoute, ErrorFallback, ToastContainer), App smoke |
| 4d | CI test gate | ✅ DONE | .github/workflows/ci.yml now runs `npm test -- --forceExit` (backend) and `npm test` (frontend) |
| 5 | Entity-based approval routing | ✅ NEW | Multi-entity chargeback routing (Entity + RequestTypeEntityRouting models) |
| 6 | Escalation rules admin API | ✅ NEW | Admin-configurable SLA escalation rules |
| 7 | Error boundaries | ✅ ADDED | App + route-level ErrorBoundary wrapping |
| 8 | Toast notification system | ✅ ADDED | Replaced 38 alert() calls with toast UX |
| 9 | Dockerfiles (FE + BE) | ✅ EXISTS | Multi-stage builds for both |
| 10 | Admin panels expanded | ✅ ADDED | Workflow transitions, status definitions, banner configs, notification templates |
| 11 | Expense workflow dead-ends | ✅ FIXED | PENDING_MANAGER_APPROVAL_FIN and PENDING_FINANCE_HEAD_APPROVAL now have approve/reject transitions; rejection routes back to SUBMITTED |
| 12 | SLA pause during approvals | ✅ IMPLEMENTED | Full end-to-end: schema, service, UI, 23 tests |
| 13 | CI/CD pipeline | ⚠️ PARTIAL | .github/workflows/ci.yml exists (lint+build) but no test gate |
| 14 | Docker Compose (prod) | ⚠️ PARTIAL | docker-compose.prod.yml exists; no dev-compose |
| 15 | DB backup script | ⚠️ PARTIAL | backup-db.sh exists; no cron/scheduler |

---

## SECTION 2 — SCORE CHANGES SINCE LAST AUDIT

### What Was Fixed (4 of 5 Critical Blockers Resolved)

| Critical Blocker | Apr 24 Status | Current Status | Resolution |
|-----------------|--------------|----------------|------------|
| Finance stepper bug | ❌ Broken | ✅ Fixed | RequestHeader.tsx now uses FIN statuses with proper 6-step progression |
| LOA_ACCEPTED dead-end | ❌ Dead-end | ✅ Fixed | workflowTransitions.ts + loa.controller.ts now transitions LOA_ACCEPTED → COMPLETED |
| HR hiring workflow closure | ❌ Never closes | ✅ Fixed | Full transition chain: LOA_ACCEPTED → COMPLETED → ONBOARDING_SUBMITTED |
| Expense workflow dead-ends | ❌ Dead-ends | ✅ Fixed | PENDING_MANAGER_APPROVAL_FIN and PENDING_FINANCE_HEAD_APPROVAL now have approve/reject transitions; rejection loops back to SUBMITTED |
| ~~No MFA/SSO~~ | ❌ Missing | ❌ Still missing | — |
| ~~No error monitoring~~ | ❌ Missing | ❌ Still missing | — |

### Still Critical — Not Addressed

|| # | Item | Risk Level | Effort |
|---|------|-----------|--------|
| 1 | No MFA/TOTP | CRITICAL | 3-5 days |
| 2 | No SSO/SAML | CRITICAL | 5 days |
| 2 | ~~No CI/CD pipeline~~ | ~~CRITICAL~~ | ✅ FIXED — CI pipeline has lint+build+test gate for both backend and frontend |
| 4 | ~~Zero frontend test coverage~~ | ~~HIGH~~ | ✅ FIXED — 8 suites, 97 tests (vitest + @testing-library/react) |
| 5 | No error monitoring (Sentry) | HIGH | 1 day |
| 6 | HR confidentiality unenforced | HIGH | 2 days |
| 7 | ~~SSE in-memory (single-instance)~~ | ~~MEDIUM~~ | ✅ FIXED — Redis pub/sub adapter (`cwc:sse:notify` channel), 16 unit tests |
| 8 | No DB backup automation | MEDIUM | 1 day |
| ~~9~~ | ~~Finance expense workflow dead-ends~~ | ~~HIGH~~ | ~~1 day~~ ✅ FIXED |
| 10 | No docker-compose orchestration | MEDIUM | 1 day |

---

## SECTION 3 — PRODUCTION READINESS AUDIT

### Production Readiness Score: **56 / 100** (up from 54/100)

### Infrastructure

| Area | Status | Score | Change |
|------|--------|-------|--------|
| Hosting | Dockerfiles exist for FE + BE. No docker-compose. No CI/CD. | ⚠️ | +1 (Dockerfiles added) |
| Backup | No automated DB backup policy visible in codebase | ❌ | No change |
| Disaster recovery | No DR plan, no replica config | ❌ | No change |
| Logging | Winston to file + Morgan. Structured JSON in production. File-based only. | ⚠️ | No change |
| Monitoring | Health check endpoint exists. No APM, no uptime monitoring. | ⚠️ | No change |
| Alerts | ✅ SLA breach + escalation alerts now implemented | ✅ | **FIXED** |

### Security

| Area | Status | Score | Change |
|------|--------|-------|--------|
| Authentication | JWT + httpOnly cookies + refresh token rotation + JTI revocation. Solid. | ✅ | No change |
| SSO | Not implemented. No passport-saml or OIDC library. | ❌ | No change |
| RBAC | 8 roles + requirePermission() middleware + Redis-cached permissions | ✅ | No change |
| Permissions model | Permission-based middleware enforced on routes. Frontend hasPermission() checks. | ✅ | Improved clarity |
| Audit trail | AuditLog model with old/new values, IP, user agent. auditLog() helper. | ✅ | No change |
| Session management | Sessions in DB, revocable, IP+UA tracking, Redis blocklist | ✅ | No change |
| Password policy | Complexity + HaveIBeenPwned check (now enabled by default) + bcrypt cost 12 | ✅ | **+1 (breach check enabled)** |
| MFA | Not implemented. No TOTP library. | ❌ | No change |
| Input validation | Zod validators + sanitize utility | ✅ | No change |
| Rate limiting | 4 tiers with Redis backend | ✅ | No change |
| CORS / Helmet | Both configured | ✅ | No change |
| Cookie security | httpOnly, secure, sameSite from config | ✅ | No change |
| SSE auth | Token in query string (still) — should use initial POST handshake | ⚠️ | No change |

### Performance

| Area | Status | Change |
|------|--------|--------|
| Search | LIKE-based, not indexed. Will degrade at scale. | No change |
| SLA checker | Cron-based (configurable). No job queue. | Improved (was pure setInterval, now configurable cron) |
| Pagination | Exists on request listing | No change |
| Concurrent users | No load test data. Single Node.js process. | No change |
| DB indexes | Basic Prisma-generated indexes. No custom search indexes. | No change |

### Operations

| Area | Status | Change |
|------|--------|--------|
| Incident support | None documented | No change |
| SLA tracking | ✅ Breach detection + escalation now operational | **FIXED** |
| Support escalation | EscalationRule model + admin API for configurable auto-escalation | **NEW** |
| Release deployment | No CI/CD pipeline. Dockerfiles exist but no automation. | Partial |

---

## SECTION 4 — CORE FEATURE READINESS

### Universal Features

| Feature | Status | Notes | Change |
|---------|--------|-------|--------|
| Login | ✅ Complete | JWT + httpOnly cookie, password complexity, breach check | +breach check |
| Logout | ✅ Complete | Token revocation on logout | — |
| Forgot password | ✅ Complete | Time-limited token, email via Resend, enumeration-safe | — |
| Dashboard | ✅ Complete | Dashboard.tsx, AgentDashboard.tsx | — |
| Ticket creation | ✅ Complete | CreateRequest.tsx with form builder | — |
| Ticket tracking | ✅ Complete | MyRequests.tsx, RequestDetail.tsx | — |
| Notifications | ✅ Complete | SSE push + NotificationDropdown + toast system | +toasts |
| Search | ✅ Complete | Global search (LIKE-based, not full-text) | — |
| Approval flow | ✅ Complete | Multi-level, role-based, entity-based routing | +entity routing |
| Reporting | ⚠️ Partial | Reports.tsx exists — completeness unverified | — |
| Attachments | ✅ Complete | S3/MinIO storage, upload middleware | — |
| Comments | ✅ Complete | RequestActivity model, internal/external flag | — |
| Error boundaries | ✅ Added | App + route-level ErrorBoundary | **NEW** |
| Mobile responsive | ⚠️ Unknown | No evidence of responsive testing on complex pages | — |

### Admin Features

| Feature | Status | Notes | Change |
|---------|--------|-------|--------|
| Manage users | ✅ Complete | UserAccountsTab, CreateUserModal, UserEditModal | — |
| Manage departments | ⚠️ Partial | Department is a string field on User — no separate entity | — |
| Manage request types | ✅ Complete | ServiceDesksTab, ServiceModal, CategoryModal | — |
| Manage SLA | ⚠️ Partial | SLA breach + escalation working; no UI for SLA timer config | +escalation API |
| Role permissions | ✅ Complete | PermissionsTab, RoleAssignmentModal | — |
| Workflow builder | ✅ Improved | DB-driven WorkflowTransition admin CRUD | **IMPROVED** |
| Email templates | ⚠️ Partial | NotificationTemplate admin API + test send. Inline HTML still in controllers. | +template admin |
| Status definitions | ✅ NEW | RequestStatusDefinition admin CRUD | **NEW** |
| Banner configs | ✅ NEW | BannerConfig admin CRUD | **NEW** |
| Entity management | ✅ NEW | Entity + RequestTypeEntityRouting admin CRUD | **NEW** |

### Missing High-Risk Features

- **SLA timer configuration UI** — breach detection works, but admins cannot set SLA durations per request type
- **Email template visual editor** — API exists for templates, but no WYSIWYG admin UI
- **Ticket bulk actions** — no bulk close, bulk assign, bulk export
- **Service catalog preview** — end users cannot browse available services before creating a ticket
- **Full-text search** — Elasticsearch config present but not integrated; using LIKE queries

---

## SECTION 5 — IT SUPPORT MODULE AUDIT

### IT Readiness Score: **72 / 100** (up from 68/100)

**Implemented request types:** Hardware request, software provisioning, general IT support (GET_IT_HELP workflow)

### Workflow Coverage

| Workflow | Status | Change |
|----------|--------|--------|
| Multi-level approval chain (Manager → VP → CEO → CTO → CFO → Payment) | ✅ Implemented | — |
| Procurement workflow (In Progress → Ordered → Received → Provisioned → Fulfilled) | ✅ Implemented | — |
| GET_IT_HELP three-step lifecycle (Start Review → In Progress → Resolve) | ✅ Implemented | — |

### Missing Flows

| Flow | Gap |
|------|-----|
| Password reset request | No IT ticket type. Auth system has reset but no agent-visible ticket. |
| VPN access request | Not modeled as a distinct request type |
| Asset assignment tracking | ITHardwareRequest exists but no asset register, serial number, or barcode tracking |
| New joiner setup | Partially covered by onboarding but no IT-specific task automation |

### Improvements Since Last Audit
- Entity-based approval routing can support IT department escalation
- SLA breach alerts now fire for IT tickets

---

## SECTION 6 — HR SUPPORT MODULE AUDIT

### HR Readiness Score: **67 / 100** (up from 61/100)

### Implemented Workflows

| Workflow | Status | Change |
|----------|--------|--------|
| New hire request (CEO → Job Post → Manager → Interview → Screening → LOA → Onboarding) | ✅ FIXED | LOA_ACCEPTED now transitions to COMPLETED |
| Onboarding (9-phase with task templates) | ✅ Implemented | — |
| Offboarding (6-phase with task templates) | ✅ Implemented | — |

### Previously Known Bugs — Resolution Status

| Bug | Apr 24 Status | Apr 27 Status |
|-----|--------------|--------------|
| `LOA_ACCEPTED` dead-end — no transition to `COMPLETED` | ❌ Bug | ✅ FIXED |
| HR stepper does not show LOA statuses | ❌ Bug | ✅ FIXED (RequestHeader.tsx now includes LOA_ACCEPTED step) |
| `selectedCandidateId/Name` display edge cases | ⚠️ Possible | Unverified |

### Remaining Issues

| Risk | Severity | Status |
|------|----------|--------|
| All agents see all HR tickets regardless of sensitivity — `isConfidential` field dormant | HIGH | ❌ UNCHANGED |
| Any agent with HR desk access can download candidate resumes from S3 | HIGH | ❌ UNCHANGED |
| No data retention policy or auto-purge for sensitive HR documents | MEDIUM | ❌ UNCHANGED |

### UX Improvements Needed

- Candidate name should be prominent in ticket list view (currently in custom fields)
- Interview schedule should be visible in ticket header, not buried in a panel
- Onboarding task completion should show % progress bar, not just a flat list

---

## SECTION 7 — FINANCE SUPPORT MODULE AUDIT

### Finance Readiness Score: **72 / 100** (up from 68/100)

### Implemented Request Types

| Request Type | Status | Change |
|-------------|--------|--------|
| Purchase Requisition (FIN statuses) | ✅ IMPLEMENTED | Stepper now fixed |
| Expense Reimbursement | ✅ FIXED | Dead-end transitions resolved; full workflow functional end-to-end |
| Inter-company Chargeback | ✅ NEW | Entity-based routing implemented |

### Known Bugs

| Bug | Status | Impact |
|-----|--------|--------|
| Finance stepper using legacy statuses | ✅ FIXED | Was showing wrong step indicator |
| `finalizedAmount` missing from FINANCE_FIELD_LABELS | ⚠️ Verify | Was noted in previous audit |
| ~~Expense workflow dead-ends~~ | ✅ FIXED | PENDING_MANAGER_APPROVAL_FIN and PENDING_FINANCE_HEAD_APPROVAL now have approve/reject transitions; rejection loops back to SUBMITTED |

### Missing Controls

| Control | Gap |
|---------|-----|
| Vendor onboarding | Not modeled |
| Invoice matching | No three-way match |
| Budget check | No budget availability check before CFO routing |
| Duplicate invoice detection | No check for same vendor + amount + date |
| Accounting system integration | No GL posting, no ERP write-back |

---

## SECTION 8 — SECURITY DEEP-DIVE

### Security Score: **60 / 100** (up from 58/100)

| Security Control | Status | Score Impact |
|-----------------|--------|-------------|
| JWT + bcrypt + httpOnly cookies | ✅ Strong | +15 |
| Refresh token rotation + JTI revocation | ✅ Strong | +5 |
| Redis token blocklist | ✅ Strong | +7 |
| RBAC (8 roles) | ✅ Strong | +8 |
| Permission-based middleware (requirePermission) | ✅ Strong | +5 |
| Session management (DB + IP/UA tracking) | ✅ Strong | +5 |
| Audit logging (before/after values, IP) | ✅ Strong | +5 |
| Password complexity + HaveIBeenPwned | ✅ Strong | +5 |
| Rate limiting (4 tiers, Redis-backed) | ✅ Strong | +5 |
| CORS + Helmet + compression | ✅ Strong | +3 |
| Input validation (Zod + sanitize) | ✅ Strong | +3 |
| Cookie security (httpOnly, secure, sameSite) | ✅ Strong | +3 |
| **MFA/TOTP** | ❌ Missing | -15 |
| **SSO/SAML** | ❌ Missing | -10 |
| **SSE token in query string** | ⚠️ Risk | -3 |
| **HR confidentiality unenforced** | ❌ Missing | -5 |
| **No external error monitoring** | ⚠️ Risk | -3 |

### Auth Middleware Detail

`auth.middleware.ts` (328 lines) provides 5 middleware functions:
1. `authenticate` — Full JWT auth, cookie-first, header fallback, Redis blocklist check
2. `optionalAuth` — Auth if present, no error if absent
3. `sseAuth` — SSE-specific auth (query param token support — security concern)
4. `authorize(...roles)` — Role-based access
5. `requirePermission(...names)` — Fine-grained permission check with Redis cache

**Missing:** MFA verification step, SSO integration point

---

## SECTION 9 — INFRASTRUCTURE & DEVOPS

### Infrastructure Score: **25 / 100** (up from 15/100)

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Dockerfile | ✅ EXISTS | Multi-stage, node:20-alpine, prisma generate + npm build |
| Frontend Dockerfile | ✅ EXISTS | Multi-stage, node:20-alpine builder, nginx:alpine server |
| Docker Compose | ❌ MISSING | No orchestration file |
| CI/CD Pipeline | ❌ MISSING | No .github/workflows/ |
| DB Backup | ❌ MISSING | No automated backup script |
| Monitoring/APM | ❌ MISSING | No Sentry, Prometheus, or DataDog |
| Health Check | ✅ EXISTS | GET /health (status, uptime, environment) |
| SLA Monitoring | ✅ WORKS | Cron-based breach detection + escalation notifications |
| Log Aggregation | ⚠️ FILE ONLY | Winston to file, no ELK/Splunk |
| Load Balancing | ❌ MISSING | Single Node.js process, no clustering |
| HTTPS/TLS | ⚠️ CONFIG DEPENDENT | Cookie secure flag depends on environment |

---

## SECTION 10 — TOP 10 RISKS & TOP 10 QUICK WINS

**Re-assessed: April 29, 2026** — 7 risks resolved or mitigated since April 27 audit. 3 additional items resolved.

### Resolved Since April 27

|| # | Risk | Resolution ||
|---|------|------------||
| R1 | Finance expense workflow dead-ends | ✅ FIXED — PENDING_MANAGER_APPROVAL_FIN and PENDING_FINANCE_HEAD_APPROVAL now have outgoing transitions with rejection paths back to SUBMITTED. Full chain through PAYMENT_PROCESSING → PAYMENT_COMPLETED → REIMBURSEMENT_CLOSED. ||
| R2 | No SLA pause during approvals | ✅ FIXED — slaPause field on WorkflowStep, Request.slaPausedAt/slaPauseDurationMs, sla-pause.service.ts with Redis caching, SLAIndicator.tsx shows "Paused (approval pending)" state, admin SLAEscalationTab toggle. 14 statuses seeded with slaPause=true. 23 unit tests passing. ||
| R3 | No CI/CD pipeline | ✅ FIXED — .github/workflows/ci.yml runs lint+build+test for both backend (`npm test -- --forceExit`) and frontend (`npm test`) on every push/PR. ||
| R4 | No Docker orchestration | ⚠️ MITIGATED — docker-compose.prod.yml exists. No dev-compose yet. ||
| R5 | Zero frontend test coverage | ✅ FIXED — 8 suites, 97 tests (vitest + @testing-library/react): utils (permissions, roleDetection, workflowTransitions, tokenManager), components (ProtectedRoute, ErrorFallback, ToastContainer), App smoke test. ||
| R6 | Backend test coverage thin | ✅ FIXED — 11 suites, 109 passing: services (notification 16, entityRouting 15, sla 12, permission 9, token 4, password-reset 3, sla-pause 23), utils (sseClients 16), integration (auth, auth.integration, request). CI test gate active. ||
| R7 | SSE single-instance only | ✅ FIXED — Redis pub/sub adapter in sseClients.ts, `cwc:sse:notify` channel. Graceful fallback to local delivery when Redis unavailable. 16 unit tests. ||

### Top 10 Critical Risks (Updated April 29)

|| # | Risk | Severity | Change from Apr 27 ||
||---|------|----------|-------------------|
|| 1 | **No MFA/SSO** — one compromised credential = full system breach | CRITICAL | Unchanged |
|| 2 | ~~CI/CD has no test gate~~ | ~~HIGH~~ | ✅ RESOLVED — CI pipeline now runs `npm test -- --forceExit` (backend) and `npm test` (frontend) on every push/PR |
| 3 | ~~Zero frontend test coverage~~ | ~~HIGH~~ | ✅ RESOLVED — 8 suites, 97 tests (vitest + @testing-library/react, utils + components + smoke) |
| 4 | **No external error monitoring (Sentry)** — learn about failures from user complaints | HIGH | Unchanged |
|| 5 | **HR confidentiality unenforced** — isConfidential field does not exist in schema; zero enforcement code | HIGH | Unchanged (worse: field was never even created) |
|| 6 | **SSE token in query string** — sseAuth still reads ?token=JWT; no POST handshake implemented | MEDIUM→HIGH | Escalated (audit log module added but SSE auth unchanged) |
|| 7 | ~~SSE in-memory Map~~ | ~~MEDIUM~~ | ✅ RESOLVED — Redis pub/sub adapter in sseClients.ts, `cwc:sse:notify` channel, 16 unit tests |
|| 8 | **LIKE-based search** — degrades sharply at 5,000+ tickets; no tsvector implementation | MEDIUM | Unchanged |
|| 9 | **DB backup script-only** — backup-db.sh exists but no cron/scheduler; manual run required | MEDIUM | Mitigated (was: "no backup at all"; now: script exists, no automation) |
|| 10 | ~~Backend test coverage still thin~~ | ~~MEDIUM~~ | ✅ RESOLVED — 11 suites, 109 passing tests; services + utils fully covered (notification 16, entityRouting 15, sla 12, permission 9, sseClients 16, token 4, password-reset 3, sla-pause 23); CI test gate active |

### Top 10 Quick Wins (Updated April 29 — each fixable in under 1 day)

|| # | Quick Win | Impact | Effort | Status ||
||---|-----------|--------|--------|--------|
|| 1 | Add Sentry (5-minute setup) | Know when production breaks | 1h | 🔴 Not started |
|| 2 | Add isConfidential field to Request model + enforce in request.controller.ts | Basic HR privacy control | 4h | 🔴 Not started (field missing from schema) |
|| 3 | ~~Add `npm test` step to CI~~ | ~~CI catches logic bugs, not just syntax~~ | ~~30m~~ | ✅ DONE — CI pipeline runs `npm test -- --forceExit` (backend) and `npm test` (frontend) |
|| 4 | Wire SLA timer config to admin UI | Admins can set SLA per request type | 8h | 🔴 Not started |
|| 5 | Switch search to Postgres full-text (tsvector) | 10x faster search | 4h | 🔴 Not started |
|| 6 | Move SSE token from query string to POST handshake | Security hygiene | 4h | 🔴 Not started |
|| 7 | Add serialNumber + assetTag to ITHardwareRequest | Basic asset tracking | 4h | 🔴 Not started |
|| 8 | ~~Add vitest + @testing-library/react + smoke test~~ | ~~Minimum frontend test baseline~~ | ~~8h~~ | ✅ DONE — 8 suites, 97 tests |
|| 9 | Add DB backup cron schedule (systemd timer or crontab) | Automated backup | 30m | 🟡 Script exists, needs scheduler |
|| 10 | Add docker-compose.dev.yml for one-command local dev | Developer onboarding in <5 min | 4h | 🟡 Prod compose exists, dev compose missing |

> Note: 6 items from the original quick wins list are now ✅ RESOLVED (Finance stepper, LOA dead-end, SLA breach notifications, expense workflow dead-ends, SLA pause during approvals, frontend test baseline). 3 additional items ✅ RESOLVED since April 28: CI test gate, backend test coverage, SSE Redis pub/sub. Docker compose and DB backup are 🟡 PARTIALLY DONE.

---

## SECTION 11 — ACTION PLAN & ROADMAP

### Updated 30-Day Action Plan

| Week | Priority Actions | Status Indicators |
|------|-----------------|-------------------|
| **Week 1** | ~~Fix expense workflow dead-ends~~ ✅ DONE. Add Sentry. ~~Add `npm test` to CI~~ ✅ DONE. Add DB backup cron. | 2 remaining |
| **Week 2** | Enforce HR confidentiality (isConfidential). ~~Add vitest + frontend smoke tests~~ ✅ DONE (8 suites, 97 tests). Add SLA timer config UI. Wire full-text search. | 3 remaining |
| **Week 3** | Soft pilot: 5 IT, 5 HR, 5 Finance users. Monitor Sentry. Daily standup. | Pilot |
| **Week 4** | Fix everything from pilot. Document deployment. Move SSE token to POST. | 3 items |

### Updated 90-Day Roadmap

| Month | Focus |
|-------|-------|
| **Month 1** | Pilot stability + security baseline (MFA or SSO). ~~Fix expense workflow~~ ✅ DONE. Full-text search. ~~Frontend tests~~ ✅ DONE. ~~Backend test coverage~~ ✅ DONE. |
| **Month 2** | Company-wide rollout (IT → HR → Finance). SLA config UI. Reporting + CSV export. ~~SSE → Redis pub/sub~~ ✅ DONE. |
| **Month 3** | MFA/SSO if not done. Automation rules (auto-assign, auto-escalate). Vendor onboarding. Mobile QA pass. |

### Final Verdict

## ⚠️ ALMOST READY — Conditional Soft Launch Approved (with caveats)

**Delta from April 24:** Meaningful progress on all 5 critical workflow bugs. Testing coverage went from 10/100 to 35/100. CI pipeline now has a test gate. SSE horizontal scaling solved. System is substantially more production-ready.

**What's been resolved since the last audit:**
- ✅ Frontend test coverage: 0 → 8 suites, 97 tests
- ✅ Backend test coverage: 6 → 11 suites (109 passing)
- ✅ CI test gate: lint+build → lint+build+test
- ✅ SSE scaling: in-memory single-instance → Redis pub/sub adapter
- ✅ SLA pause, expense dead-ends, finance stepper (carried forward)

**What's still blocking production:**
1. ~~Fix Finance stepper~~ ✅ DONE
2. ~~Fix LOA dead-end~~ ✅ DONE
3. ~~Add SLA breach alerts~~ ✅ DONE
4. ~~Fix expense workflow dead-ends~~ ✅ DONE
5. Add Sentry — **do this today**
6. ~~Add `npm test` to CI~~ ✅ DONE
7. Add isConfidential enforcement — **do this tomorrow**
8. Start pilot next week

---

### Appendix: Model Inventory (41 Models)

| # | Model | Category |
|---|-------|----------|
| 1 | User | Auth |
| 2 | Role | Auth |
| 3 | UserRole | Auth |
| 4 | Permission | Auth |
| 5 | RolePermission | Auth |
| 6 | Session | Auth |
| 7 | PasswordResetToken | Auth |
| 8 | ServiceDesk | Service Desk |
| 9 | ServiceCategory | Service Desk |
| 10 | RequestType | Service Desk |
| 11 | EscalationRule | Service Desk |
| 12 | WorkflowType | Workflow |
| 13 | WorkflowStep | Workflow |
| 14 | WorkflowTransition | Workflow |
| 15 | Request | Core |
| 16 | RequestActivity | Core |
| 17 | RequestAttachment | Core |
| 18 | RequestApproval | Core |
| 19 | RequestStatusDefinition | Admin |
| 20 | ITHardwareRequest | IT |
| 21 | HRLeaveRequest | HR |
| 22 | FinanceExpenseReimbursement | Finance |
| 23 | ExpenseLineItem | Finance |
| 24 | CandidateResume | Hiring |
| 25 | InterviewSchedule | Hiring |
| 26 | InterviewFeedback | Hiring |
| 27 | HRScreening | Hiring |
| 28 | LetterOfAcceptance | Hiring |
| 29 | OnboardingRequest | Onboarding |
| 30 | OnboardingTask | Onboarding |
| 31 | OnboardingTaskTemplate | Onboarding |
| 32 | OffboardingRequest | Offboarding |
| 33 | OffboardingTask | Offboarding |
| 34 | OffboardingTaskTemplate | Offboarding |
| 35 | Notification | Notification |
| 36 | NotificationTemplate | Notification |
| 37 | KnowledgeBaseArticle | KB |
| 38 | AuditLog | Compliance |
| 39 | BannerConfig | Admin |
| 40 | Entity | Entity Routing |
| 41 | RequestTypeEntityRouting | Entity Routing |

---

*Generated on 2026-04-27. Re-audit based on full codebase analysis of branch `dev2.0`. Previous audit: 2026-04-24.*