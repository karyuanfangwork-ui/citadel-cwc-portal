# CITADEL CWC 2.0 — FULL PROJECT AUDIT

**Audit Date:** April 24, 2026
**Audited By:** Senior Product Auditor / Enterprise Solution Architect / CTO Lens
**System:** Internal Jira Service Management — IT Support, HR Support, Finance Support
**Branch:** dev2.0

---

## TABLE OF CONTENTS

1. [Section 1 — Project Development Roadmap](#section-1--project-development-roadmap)
2. [Section 2 — Production Readiness Audit](#section-2--production-readiness-audit)
3. [Section 3 — Core Feature Readiness](#section-3--core-feature-readiness)
4. [Section 4 — IT Support Module Audit](#section-4--it-support-module-audit)
5. [Section 5 — HR Support Module Audit](#section-5--hr-support-module-audit)
6. [Section 6 — Finance Support Module Audit](#section-6--finance-support-module-audit)
7. [Section 7 — Executive Summary](#section-7--executive-summary)

---

## SECTION 1 — PROJECT DEVELOPMENT ROADMAP

### Current Maturity Score: **62 / 100**

The system has real, working implementations across all three domains. It is not a prototype — it is a functional internal service desk with 38 DB models, 44 workflow action types, 80+ request statuses, JWT auth, SLA tracking, S3 file storage, SSE notifications, and full CRUD across IT/HR/Finance. That is genuinely impressive for an internal build. However, it is pre-production, not production-grade.

---

### Recommended Roadmap

#### NOW — Sprint 1–4 (Must fix before first 50-user pilot)

| Item | Why |
|---|---|
| MFA / SSO (Azure AD / Google Workspace) | No company should run internal tooling in 2026 with username+password only. Single biggest risk. |
| Email notification templates — structured, not inline HTML | Current inline HTML strings in controllers will break, are unmaintainable, and are not testable. |
| Password reset end-to-end verification | Flow exists in code but untested in prod. One broken link and helpdesk floods. |
| Finance workflow stepper fix | `RequestHeader` stepper still uses legacy FINANCE statuses, not new FIN statuses — known bug. |
| `LOA_ACCEPTED` → `COMPLETED` transition | Current dead-end in HR workflow means hiring tickets never close. |
| Frontend error boundaries everywhere | `ErrorBoundary.tsx` exists but coverage unknown. An unhandled promise rejection crashes the page. |
| Basic frontend test suite (Vitest + RTL) | Zero frontend tests. Any deployment is a gamble. |
| Sentry or equivalent error tracking | Winston to file is not enough. You need alerts when production errors happen. |

#### NEXT — Sprint 5–8 (Required for company-wide rollout of 200+ users)

| Item | Why |
|---|---|
| SSO integration (SAML/OIDC) | IT will not manage 200+ accounts manually. AD sync or OIDC is non-negotiable at scale. |
| SLA breach alerting (email/notification) | SLA checker job runs every 60s but there is no alert when a breach occurs — the data is collected and discarded. |
| Full-text search (Postgres `tsvector`) | Current LIKE-based search will be unacceptably slow at 10k+ tickets. The preview feature is enabled but unused. |
| Reporting dashboard — real data, exportable | Reports page exists but needs verification of completeness and CSV/Excel export. |
| Admin workflow builder (non-dev config) | Admins cannot modify workflows without a code deployment. Hard blocker for Finance team customizing approvals. |
| Mobile responsive QA pass | No evidence of responsive design testing across form-heavy pages (CreateRequest, RequestDetail). |
| Knowledge base — agent-facing internal notes | Current KB is user-facing. Agents need internal runbooks that are not public. |
| Ticket merge / link (duplicate detection) | Two users submit the same "VPN is down" ticket — no way to link or merge. |

#### LATER — Phase 2 (Enterprise grade)

| Item | Why |
|---|---|
| Integration with Active Directory / HR system | True new joiner automation (no manual HR ticket needed) |
| Accounting system integration (Finance) | Finance approval flow today is approval-only — no ERP write-back |
| Asset management linkage (ServiceNow/Snipe-IT) | IT tickets reference hardware but no asset register integration |
| Automation rules (if X then Y) | No event-driven automation — auto-assign, auto-escalate after N hours |
| Customer satisfaction (CSAT) surveys | No feedback loop after ticket resolution |
| Multi-language support | Single language only |
| Webhook / API for external integrations | No outbound webhook system for Slack, Teams, or ERP notifications |

---

### Critical Blockers

1. **No SSO/MFA** — a corporate IT policy blocker in most companies
2. **Finance stepper bug** — visible to all Finance users on every ticket
3. **Zero frontend test coverage** — every deployment is unverified
4. **No external error monitoring** — silent production failures
5. **HR hiring workflow dead-end** (`LOA_ACCEPTED` never closes)

### Fastest Path to Production

1. Fix the 3 known workflow bugs (Finance stepper, LOA dead-end, GET_IT_HELP wiring)
2. Add Sentry
3. Add at least smoke-test coverage for the 3 critical user journeys (create ticket, approve, resolve)
4. Soft launch to 20 internal pilot users (one desk each)
5. Fix what breaks. Then expand.

---

## SECTION 2 — PRODUCTION READINESS AUDIT

### Production Readiness Score: **54 / 100**

### Infrastructure

| Area | Status | Score |
|---|---|---|
| Hosting | No deployment config found (no Dockerfile, no docker-compose, no CI/CD pipeline, no Terraform/CDK) | ❌ |
| Backup | No automated DB backup policy visible in codebase | ❌ |
| Disaster recovery | No DR plan, no replica config | ❌ |
| Logging | Winston to file + Morgan. Structured JSON in production. File-based only. | ⚠️ |
| Monitoring | Health check endpoint exists (`GET /health`). No uptime monitoring, no APM. | ⚠️ |
| Alerts | SLA job runs but does not alert. No PagerDuty, OpsGenie, or equivalent. | ❌ |

### Security

| Area | Status | Score |
|---|---|---|
| Authentication | JWT + httpOnly cookies + refresh token rotation + JTI revocation. Solid. | ✅ |
| SSO | Not implemented | ❌ |
| RBAC | Role-based middleware with 8 roles. Present and enforced. | ✅ |
| Permissions model | `Permission` model exists but unclear if granular permissions are enforced beyond roles | ⚠️ |
| Audit trail | `AuditLog` model with old/new values, IP, user agent. `auditLog()` helper used in controllers. | ✅ |
| Session management | Sessions stored in DB, revocable, tracked with IP+UA | ✅ |
| Password policy | Complexity validation + optional HaveIBeenPwned check + bcrypt cost 12 | ✅ |
| MFA | Not implemented | ❌ |
| Input validation | Zod validators + sanitize utility | ✅ |
| Rate limiting | 4 tiers (API / auth / upload / password reset) with prod-appropriate limits | ✅ |
| CORS / Helmet | Both configured | ✅ |
| Cookie security | httpOnly, secure, sameSite from config | ✅ |
| SSE auth | Token passed in query string (`?token=`) — logged in server logs, potentially in proxies | ⚠️ |

### Performance

| Area | Status |
|---|---|
| Search | LIKE-based, not indexed. Will degrade at scale. |
| SLA checker | Polls DB every 60 seconds. No queue or event-driven architecture. Will degrade at 1,000+ open tickets. |
| Pagination | Exists on request listing. Needs verification on all list endpoints. |
| Concurrent users | No load test data. Single Node.js process (no clustering config found). |
| DB indexes | Prisma generates basic indexes on PKs and FKs. Custom indexes for search not added. |

### Operations

| Area | Status |
|---|---|
| Incident support model | None documented |
| SLA tracking | Data collection works. Alerting missing. |
| Support escalation | Not formalized beyond workflow transitions |
| Release deployment | No CI/CD pipeline found |

### Red Flags — Must-Fix Before Launch

1. No CI/CD — manual deployments are not acceptable for production
2. No external error monitoring — you will not know when production breaks
3. No infrastructure as code — you cannot reproduce the environment
4. SSE token in query string — should be moved to initial HTTP handshake
5. No DB backup automation visible in the repo

### Launch Recommendation

> **SOFT LAUNCH** — 20–50 pilot users, one desk at a time.
>
> Not ready for company-wide rollout. Ready for a controlled pilot with monitoring.

---

## SECTION 3 — CORE FEATURE READINESS

### Universal Features

| Feature | Status | Notes |
|---|---|---|
| Login | ✅ Complete | JWT + httpOnly cookie, password complexity |
| Logout | ✅ Complete | Token revocation on logout |
| Forgot password | ✅ Complete | Time-limited token, email via Resend, enumeration-safe |
| Dashboard | ✅ Complete | `Dashboard.tsx`, `AgentDashboard.tsx` |
| Ticket creation | ✅ Complete | `CreateRequest.tsx` with form builder |
| Ticket tracking | ✅ Complete | `MyRequests.tsx`, `RequestDetail.tsx` |
| Notifications | ✅ Complete | SSE push + `NotificationDropdown.tsx` |
| Search | ✅ Complete | Global search across requests/KB/users |
| Approval flow | ✅ Complete | Multi-level, role-based approvals |
| Reporting | ⚠️ Partial | `Reports.tsx` exists — completeness unverified |
| Attachments | ✅ Complete | S3 storage, upload middleware |
| Comments | ✅ Complete | `RequestActivity` model, internal/external flag |
| Mobile responsive | ⚠️ Unknown | No evidence of responsive testing on complex pages |

### Admin Features

| Feature | Status | Notes |
|---|---|---|
| Manage users | ✅ Complete | `UserAccountsTab`, `CreateUserModal`, `UserEditModal` |
| Manage departments | ⚠️ Partial | Department is a string field on User — no separate entity |
| Manage request types | ✅ Complete | `ServiceDesksTab`, `ServiceModal`, `CategoryModal` |
| Manage SLA | ⚠️ Partial | `slaDueAt` and SLA checker exist — no UI for SLA configuration |
| Role permissions | ✅ Complete | `PermissionsTab`, `RoleAssignmentModal` |
| Workflow builder | ⚠️ Partial | `WorkflowTransitionTab` exists but dev-only — not self-service for admins |
| Email templates | ⚠️ Partial | `NotificationTemplate` model + Resend integration. Inline HTML in controllers, no admin UI. |

### Missing High-Risk Features

- **SLA configuration UI** — admins cannot set SLA timers per request type without a developer
- **Email template editor** — no admin UI for customizing email content
- **Ticket bulk actions** — no bulk close, bulk assign, bulk export
- **Service catalog preview** — end users cannot browse available services before creating a ticket
- **Escalation rules** — no automatic escalation after N hours (SLA breach tracking exists, escalation action does not)

---

## SECTION 4 — IT SUPPORT MODULE AUDIT

### IT Readiness Score: **68 / 100**

**Implemented request types:** Hardware request, software provisioning, general IT support (GET_IT_HELP workflow)

### Workflow Coverage

| Workflow | Status |
|---|---|
| Multi-level approval chain (Manager → VP → CEO → CTO → CFO → Payment) | ✅ Implemented |
| Procurement workflow (In Progress → Ordered → Received → Provisioned → Fulfilled) | ✅ Implemented |
| GET_IT_HELP three-step lifecycle (Start Review → In Progress → Resolve) | ✅ Implemented |

### Missing Flows

| Flow | Gap |
|---|---|
| Password reset request | No IT ticket type. Auth system has reset but no agent-visible ticket. |
| VPN access request | Not modeled as a distinct request type with its own structured fields |
| Asset assignment tracking | `ITHardwareRequest` exists but no asset register, serial number, or barcode tracking |
| New joiner setup | Partially covered by onboarding but no IT-specific task automation (AD account, license, etc.) |

### Improvement Ideas

- Add `serialNumber` and `assetTag` fields to `ITHardwareRequest`
- Auto-close `HARDWARE_RECEIVED` tickets after N days with no action
- Link IT tickets to onboarding workflow (new joiner triggers IT setup tasks automatically)
- Add SLA configuration per IT category (password reset = 4h SLA, hardware = 5-day SLA)

---

## SECTION 5 — HR SUPPORT MODULE AUDIT

### HR Readiness Score: **61 / 100**

### Implemented Workflows

| Workflow | Status |
|---|---|
| New hire request (CEO → Job Post → Manager → Interview → Screening → LOA → Onboarding) | ✅ Implemented |
| Onboarding (9-phase with task templates) | ✅ Implemented |
| Offboarding (6-phase with task templates) | ✅ Implemented |

### Known Bugs

| Bug | Impact |
|---|---|
| `LOA_ACCEPTED` is a dead-end — no transition to `COMPLETED` | Hiring tickets never formally close |
| HR stepper does not show LOA statuses in hiring workflow steps | Wrong step indicator shown to agents |
| `selectedCandidateId/Name` display labels may have edge cases | Incorrect candidate info shown in panel |

### Missing Flows

| Flow | Gap |
|---|---|
| Leave inquiry | No leave balance or leave request type — requires HR system integration |
| Payroll inquiry | No structured data — would be a free-text ticket only |
| Staff confirmation letter | No letter generation or templating — agents download blank Word docs manually |
| Resignation clearance | Partially covered by offboarding — no clearance checklist linking IT/Finance for asset return and final pay |

### Privacy Risks

| Risk | Severity |
|---|---|
| All agents see all HR tickets regardless of sensitivity — no per-ticket confidentiality flag | HIGH |
| Any agent with HR desk access can download candidate resumes from S3 — no field-level access control | HIGH |
| No data retention policy or auto-purge for sensitive HR documents | MEDIUM |

### UX Improvements

- Candidate name should be prominent in ticket list view (currently in custom fields)
- Interview schedule should be visible in ticket header, not buried in a panel
- Onboarding task completion should show % progress bar, not just a flat list

---

## SECTION 6 — FINANCE SUPPORT MODULE AUDIT

### Finance Readiness Score: **63 / 100**

### Implemented Request Types

| Request Type | Status |
|---|---|
| Purchase Requisition (Finance ACK → Finalized Amount → CFO → Group CEO if above threshold → Payment → Close) | ✅ Implemented |
| Expense Reimbursement (Manager → Finance Head → Payment) | ✅ Implemented |

### Approval Workflow

The purchase requisition workflow is architecturally sound. The Group CEO threshold escalation is configurable via `GROUP_CEO_APPROVAL_THRESHOLD` env var. CFO can approve below threshold; Group CEO is required above it.

### Known Bugs

| Bug | Impact |
|---|---|
| Finance stepper in `RequestHeader` uses legacy FINANCE statuses, not new FIN statuses | Wrong step indicator shown on every Finance ticket |
| `CustomFieldsPanel` `FINANCE_FIELD_LABELS` missing `finalizedAmount` key | Finalized amount field not displayed in Finance tickets |

### Missing Controls

| Control | Gap |
|---|---|
| Vendor onboarding | Not modeled as a request type with structured vendor fields (company name, bank details, tax ID) |
| Invoice matching | No three-way match (PO → invoice → delivery receipt) |
| Budget check | No budget availability check before routing to CFO |
| Currency validation | Currency handling was retrofitted (migration script exists) — may be fragile |
| Duplicate invoice detection | No check for same vendor + same amount + similar date |
| Accounting system integration | Approval captured but no GL posting, no ERP write-back |

### Compliance Risks

| Risk | Severity |
|---|---|
| No dedicated immutable Finance audit trail (SOX-equivalent) — global AuditLog exists but is shared | HIGH |
| 4-eyes principle enforced at workflow level only — a bug could bypass it at the data layer | HIGH |
| No document expiry tracking (vendor contracts, purchase orders) | MEDIUM |

---

## SECTION 7 — EXECUTIVE SUMMARY

### Overall System Score: **61 / 100**

---

### Top 10 Critical Risks

| # | Risk | Severity |
|---|---|---|
| 1 | **No MFA or SSO** — one compromised credential = full internal system breach | CRITICAL |
| 2 | **No CI/CD pipeline** — manual deployments, no automated testing gate | CRITICAL |
| 3 | **Zero frontend test coverage** — production deployments are untested gambles | HIGH |
| 4 | **No external error monitoring** — you learn about production failures from user complaints | HIGH |
| 5 | **HR ticket confidentiality** — any HR agent sees all sensitive hiring/salary data | HIGH |
| 6 | **Finance stepper broken** — wrong status shown on every Finance ticket, erodes user trust immediately | HIGH |
| 7 | **LOA_ACCEPTED dead-end** — HR hiring workflow tickets never formally close | HIGH |
| 8 | **LIKE-based search** — will degrade sharply at 5,000+ tickets | MEDIUM |
| 9 | **No escalation automation** — SLA breaches tracked, not actioned | MEDIUM |
| 10 | **No DB backup automation** — a single server failure could mean data loss | MEDIUM |

---

### Top 10 Quick Wins

> Each fixable in under 1 day.

| # | Quick Win | Impact |
|---|---|---|
| 1 | Fix Finance stepper to use FIN statuses | Immediate visible quality improvement for Finance users |
| 2 | Add `LOA_ACCEPTED` → `COMPLETED` transition | Closes the HR hiring dead-end |
| 3 | Add Sentry (5-minute setup) | Immediately know when production breaks |
| 4 | Add `finalizedAmount` to `FINANCE_FIELD_LABELS` | Fixes display bug in Finance tickets |
| 5 | Wire SLA breach → send notification (trigger already exists in checker job) | Turns data collection into actionable alerting |
| 6 | Switch search controller to Postgres full-text (preview feature already enabled) | Faster search with minimal code change |
| 7 | Add per-ticket confidentiality flag on HR tickets | Basic privacy control |
| 8 | Add `serialNumber` and `assetTag` fields to `ITHardwareRequest` | Enables basic asset tracking |
| 9 | Add a GitHub Actions CI workflow with `npm test` gate | Prevents broken code from deploying |
| 10 | Move SSE token from query string to initial POST handshake | Minor security hygiene |

---

### What Competitors Do Better

| Competitor | What they have that you don't |
|---|---|
| Jira Service Management | Asset management, SLA configuration UI, automation rules, portal branding, customer portal (separate from agent view) |
| ServiceNow | Full CMDB, change management, problem management, ITIL-aligned, integration hub |
| Freshservice | One-click SSO, built-in approval delegation, service catalog with pricing, automatic ticket categorization (AI) |
| Zendesk | Customer satisfaction surveys, ticket deflection via AI, macro (canned response) library, SLA per priority level |
| HappyFox | Canned responses, ticket collision detection (prevents two agents replying simultaneously), team inbox |

The gap is not catastrophic. You are a focused internal tool. You do not need everything ServiceNow does. But SSO, SLA config UI, and canned responses are table stakes.

---

### What World-Class Internal Systems Have

1. **Zero-touch provisioning** — new joiner triggers automatic IT setup, no ticket needed
2. **Delegation** — approver can delegate authority during leave
3. **Ticket deflection** — AI suggests KB articles before ticket submission; 20–30% ticket reduction
4. **Approval SLA** — approvers who do not act within N hours get auto-escalated or auto-approved
5. **Service catalog** — end users browse available services with descriptions, SLAs, and FAQs before submitting
6. **Real-time analytics** — live dashboard showing ticket volume, SLA health, and agent workload
7. **Change management** — separate workflow for infrastructure changes with risk scoring
8. **Scheduled maintenance** — IT posts maintenance windows that auto-generate notifications

---

### 30-Day Action Plan

| Week | Priority Actions |
|---|---|
| Week 1 | Fix 3 known workflow bugs (Finance stepper, LOA dead-end, GET_IT_HELP). Add Sentry. Set up GitHub Actions CI. |
| Week 2 | Wire SLA breach notifications. Fix `finalizedAmount` display. Add HR ticket confidentiality flag. Write smoke tests for 3 critical user journeys. |
| Week 3 | Soft launch pilot: 5 IT users, 5 HR users, 5 Finance users. Monitor Sentry. Daily standup on issues. |
| Week 4 | Fix everything found in pilot. Document deployment process. Add DB backup automation. |

---

### 90-Day Roadmap

| Month | Focus |
|---|---|
| Month 1 | Pilot stability + security baseline (MFA or SSO via Azure AD / Google Workspace) |
| Month 2 | Company-wide rollout (IT desk first, then HR, then Finance). Full-text search. SLA config UI. Reporting completeness. |
| Month 3 | Automation rules (auto-assign, auto-escalate). Vendor onboarding request type. Service catalog UX. Mobile QA pass. |

---

### Final Verdict

## ⚠️ ALMOST READY — Conditional Soft Launch Approved

**Brutal honest assessment:**

You have built a legitimately functional, architecturally sound service desk system. The data model is well-thought-out. The auth security is above average for an internal tool. The workflow depth — especially the Finance multi-tier approval and HR hiring pipeline — is genuinely impressive. Most internal teams at this stage have a SharePoint form and an email chain.

**But you are not production-ready yet.** The gaps are not cosmetic — they are operational. No SSO means your IT team becomes the password desk for their own helpdesk. No CI/CD means one bad deploy breaks everything silently. No error monitoring means you learn about outages from Slack complaints. The Finance stepper bug will make Finance users distrust the system from day one.

**The path is clear and short.** Three weeks of focused work on the items above, a controlled pilot, and you have something genuinely worth rolling out. Do not rush the full company launch. A failed rollout with 200 frustrated users will set this project back six months politically. A successful pilot with 20 happy users will fund the next phase.

**Recommended next step:** Fix the Finance stepper bug and LOA dead-end today. Add Sentry tomorrow. Start the pilot next week.

---

*Generated by Claude Code on 2026-04-24. Based on full codebase analysis of branch `dev2.0`.*
