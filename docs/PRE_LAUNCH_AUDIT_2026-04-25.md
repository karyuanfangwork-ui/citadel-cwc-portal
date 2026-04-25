# CWC 2.0 — Pre-Launch Audit Report

**Audit Date:** 2026-04-25
**Audited By:** Claude Code (automated static analysis)
**Branch:** dev2.0
**System:** Citadel Enterprise Help Center / ITSM (IT + HR + Finance service desks)

---

## Table of Contents

1. [Project Structure Overview](#1-project-structure-overview)
2. [Configuration Data Extracted](#2-configuration-data-extracted)
   - [Workflows & Statuses](#workflows--statuses)
   - [SLA Configuration](#sla-configuration)
   - [Roles & Visibility](#roles--visibility)
   - [Approval Chains](#approval-chains)
   - [Authentication Mechanism](#authentication-mechanism)
   - [Email & Notifications](#email--notifications)
   - [File Storage](#file-storage)
   - [Integrations Summary](#integrations-summary)
   - [Frontend Routes](#frontend-routes)
   - [Seed Accounts](#seed-accounts)
3. [Audit Findings](#3-audit-findings)
   - [P1 Blockers](#p1-blockers)
   - [P2 High](#p2-high)
   - [P3 Medium](#p3-medium)
   - [P4 Low](#p4-low)
4. [Consolidated Audit Summary](#4-consolidated-audit-summary)
   - [Executive Summary](#executive-summary)
   - [Area Scorecards](#area-scorecards)
   - [What Is Working Well](#what-is-working-well)
   - [Recommended Pre-Launch Test Scenarios](#recommended-pre-launch-test-scenarios)
   - [Suggested Fix Order](#suggested-fix-order)

---

## 1. Project Structure Overview

**Monorepo layout:**

| Directory | Contents |
|---|---|
| `backend/` | Node.js + Express + TypeScript, Prisma ORM, PostgreSQL |
| `frontend/` | React 19 + TypeScript + Vite, React Router v7 |
| `docs/` | Markdown audit and design documents |
| `backend/prisma/` | Schema (38 models, 1,124 lines), seed.ts, migrations |
| `backend/src/` | 24 controllers, 24 route files, 7 services, 6 middleware, 1 email template, 1 background job |

**File types present:** TypeScript (primary), Prisma schema, JSON configs, Markdown docs

---

## 2. Configuration Data Extracted

### Workflows & Statuses

#### IT Support

| Request Type | Code | Workflow | SLA Hours | Requires Approval |
|---|---|---|---|---|
| Get IT Help | `GET_IT_HELP` | IT_SIMPLE | **null** | No |
| Email Management | `EMAIL_MANAGEMENT` | IT_SIMPLE | **null** | No |
| Report System Problem | `REPORT_SYSTEM_PROBLEM` | IT_SIMPLE | **null** | No |
| Software Installation | `SOFTWARE_INSTALLATION` | IT_PROCUREMENT | **null** | No |
| New Hardware | `NEW_HARDWARE` | IT_PROCUREMENT | 72h | Yes |

**IT Simple flow:**
`SUBMITTED` → `IN_REVIEW` → `IN_PROGRESS` → `RESOLVED`

**IT Procurement / Hardware approval chain (up to 13 statuses):**
`SUBMITTED` → `PENDING_MANAGER_APPROVAL_IT` → `MANAGER_APPROVED_IT` → *(if price > $2,500)* `PENDING_VP_APPROVAL_IT` → `VP_APPROVED_IT` → *(if CEO required)* `PENDING_CEO_APPROVAL_IT` → `CEO_APPROVED_IT` → `PENDING_CTO_APPROVAL_IT` → `CTO_APPROVED_IT` → `PENDING_INVOICE_IT` → `PENDING_CFO_APPROVAL_IT` → `CFO_APPROVED_IT` → `PAYMENT_PROCESSING_IT` → `PAYMENT_DONE_IT` → `PENDING_DELIVERY_IT` → `RESOLVED`

VP approval threshold: `HARDWARE_VP_APPROVAL_THRESHOLD` env var (default $2,500)

---

#### HR Services

| Request Type | Code | Workflow | SLA Hours | Required Role |
|---|---|---|---|---|
| Question for HR | `HR_QUESTION` | HR_GENERAL | 24h | None |
| New Hiring Request | `NEW_HIRING` | HR_RECRUITMENT | 48h | HIRING_MANAGER |
| Employee Onboarding | `EMPLOYEE_ONBOARDING` | ONBOARDING | 48h | None |
| Employee Offboarding | `EMPLOYEE_OFFBOARDING` | OFFBOARDING | 48h | None |

**HR Recruitment (13 statuses):**
`SUBMITTED` → `PENDING_CEO_APPROVAL` → `CEO_APPROVED` → `JOB_POSTED` → `PENDING_MANAGER_REVIEW` → `MANAGER_APPROVED` → `INTERVIEW_SCHEDULED` → `INTERVIEW_FEEDBACK_PENDING` → `HR_SCREENING` → `LOA_PENDING_APPROVAL` → `LOA_APPROVED` → `LOA_ISSUED` → `LOA_ACCEPTED` → ⚠️ **DEAD-END (P1 bug — no transition to COMPLETED)**

**Onboarding (9 phases):**
`ONBOARDING_SUBMITTED` → `ONBOARDING_PENDING_HR_APPROVAL` → `ONBOARDING_PRE_ARRIVAL_SETUP` → `ONBOARDING_READY_FOR_DAY_1` → `ONBOARDING_DAY_1_ORIENTATION` → `ONBOARDING_WEEK_1_INTEGRATION` → `ONBOARDING_MONTH_1_MILESTONE` → `ONBOARDING_MONTH_2_MILESTONE` → `ONBOARDING_MONTH_3_MILESTONE` → `ONBOARDING_COMPLETED`

**Offboarding (6 phases):**
`OFFBOARDING_SUBMITTED` → `OFFBOARDING_NOTICE_PERIOD` → `OFFBOARDING_KNOWLEDGE_TRANSFER` → `OFFBOARDING_FINAL_WEEK` → `OFFBOARDING_EXIT_PROCEDURES` → `OFFBOARDING_COMPLETED`

---

#### Group Finance

| Request Type | Code | SLA Hours |
|---|---|---|
| Purchase Requisition | `PURCHASE_REQUISITION` | 72h |
| Inter-Company Chargeback | `INTERCOMPANY_CHARGEBACK` | 72h |
| Budget Proposal | `BUDGET_PROPOSAL` | 72h |

**Finance Purchase Requisition (10 statuses):**
`FINANCE_PENDING_ACK` → `FINANCE_ACKNOWLEDGED` → `FINANCE_IN_PROGRESS` → `PENDING_CFO_APPROVAL_FIN` → *(if > RM15,000)* `PENDING_GROUP_CEO_APPROVAL` → `GROUP_CEO_APPROVED` → `PAYMENT_PROCESSING_FIN` → `AWAITING_PAYMENT_CONFIRMATION` → `PAYMENT_CONFIRMED_FIN` → `TICKET_CLOSED_FIN`

Group CEO threshold: `GROUP_CEO_APPROVAL_THRESHOLD` env var (default 15,000 MYR)

---

### SLA Configuration

| Request Type | SLA Hours | Business Hours? | Pauses During Approval? |
|---|---|---|---|
| HR Question | 24h | ❌ No — wall clock | ❌ No |
| HR Hiring / Onboarding / Offboarding | 48h | ❌ No | ❌ No |
| IT Hardware | 72h | ❌ No | ❌ No |
| Finance all types | 72h | ❌ No | ❌ No |
| IT Simple (3 types) | ⚠️ **null** | — | — |

**SLA checker job:** Polls every 60 seconds. On breach: creates a `SYSTEM` activity comment and notifies assignee + all admins via email and in-app notification.

---

### Roles & Visibility

| Role | Description | Ticket Visibility |
|---|---|---|
| `ADMIN` | Full system access | All tickets |
| `AGENT` | Handles requests, all service desks | All tickets |
| `USER` | Legacy end-user role | Own tickets only |
| `NORMAL_STAFF` | Current primary end-user role | Own tickets only |
| `CEO` | Approves HR hiring + high-value IT | Own + `PENDING_CEO_APPROVAL*` statuses |
| `CTO` | Approves IT at CTO level | Own + `PENDING_CTO_APPROVAL_IT` |
| `CFO` | Approves IT and Finance | Own + `PENDING_CFO_APPROVAL_IT` + `PENDING_CFO_APPROVAL_FIN` |
| `GROUP_CEO` | Highest finance authority | Own + `PENDING_GROUP_CEO_APPROVAL` |
| `HIRING_MANAGER` | Creates and manages hiring requests | Own tickets only |

---

### Approval Chains

| Domain | Approval Levels |
|---|---|
| IT Hardware (standard) | Manager → VP (if >$2,500) → CEO (if required) → CTO → CFO → Payment |
| IT Simple | Direct agent handling — no approval chain |
| HR Hiring | CEO → Job Post → Hiring Manager → Interview → Screening → LOA approval |
| HR Onboarding / Offboarding | HR agent manages tasks directly — no approval chain |
| Finance Purchase Req. | Finance agent ACK → In-progress → CFO → Group CEO (if >RM15,000) → Payment |

---

### Authentication Mechanism

| Mechanism | Detail |
|---|---|
| Method | JWT (HS256) via `jsonwebtoken` + `passport-jwt` |
| Access token | 15-minute expiry, httpOnly cookie + returned in login body (for SSE) |
| Refresh token | 30-day expiry, httpOnly cookie, SHA-256 hashed before storing in `sessions` table |
| Refresh rotation | Old session deleted, new session created on every refresh |
| Token revocation | JTI-based Redis blocklist (`jwt:blocked:{jti}`) + user-level revocation timestamp |
| Password hashing | bcrypt, cost factor 12 |
| Password reset | SHA-256 hashed token, 15-minute expiry, `password_reset_tokens` table |
| Session tracking | Sessions table with IP address + User-Agent |
| SSO / MFA | ❌ Not implemented |

---

### Email & Notifications

**Email provider:** Resend SDK (`resend` npm package), API key from `RESEND_API_KEY` env var

**27 seeded notification event types:**

| Event Type | Trigger |
|---|---|
| `REQUEST_CREATED` | New ticket submitted |
| `STATUS_CHANGED` | Any status update |
| `REQUEST_ASSIGNED` | Ticket assigned to agent |
| `COMMENT_ADDED` | New comment |
| `SLA_BREACHED` | SLA deadline passed |
| `MANAGER_APPROVAL_REQUIRED` | IT manager approval needed |
| `MANAGER_APPROVED` / `MANAGER_REJECTED` | IT manager decision |
| `PROCUREMENT_INITIATED` | Hardware procurement started |
| `HARDWARE_ORDERED` / `HARDWARE_RECEIVED` / `HARDWARE_DELIVERED` | Hardware lifecycle |
| `VP_APPROVAL_REQUIRED` / `VP_APPROVED` / `VP_REJECTED` | VP approval events |
| `REQUEST_REJECTED` | Any rejection |
| `ACTION_REQUIRED` | Generic action needed |
| `FINANCE_ACKNOWLEDGED` / `FINANCE_ROUTED_CFO` / `FINANCE_CFO_DECISION` | Finance workflow |
| `FINANCE_GROUP_CEO_DECISION` / `FINANCE_PAYMENT_COMPLETE` / `FINANCE_TICKET_CLOSED` | Finance closing |
| `FINANCE_MANAGER_APPROVAL_REQUESTED` / `FINANCE_MANAGER_DECISION` | Finance manager |
| `FINANCE_HEAD_APPROVAL_REQUESTED` / `FINANCE_HEAD_DECISION` | Finance head |
| `FINANCE_PAYMENT_UPDATE` | Finance payment update |
| `REQUEST_RESOLVED` | Ticket resolved |
| `APPROVAL_REQUIRED` | Generic approval |
| `PASSWORD_RESET` | ⚠️ Template body missing `{{resetUrl}}` — P1 bug |

**Real-time:** SSE via `/api/v1/notifications`. Auth token passed as `?token=` query string (security concern — P2).

---

### File Storage

| Setting | Value |
|---|---|
| Provider | AWS S3 SDK (`@aws-sdk/client-s3`) configured for DigitalOcean Spaces |
| Config vars | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| Upload middleware | multer-s3, max 10MB |
| Allowed types | JPEG, PNG, GIF, PDF, Word, Excel, CSV, text, ZIP |
| Download | ⚠️ **BROKEN** — `downloadAttachment` uses `fs.createReadStream` (local disk) instead of S3 presigned URL |
| Virus scanning | ⚠️ Stubbed — `isScanned: false` hardcoded on every upload |

---

### Integrations Summary

| Integration | Status | Notes |
|---|---|---|
| Email (Resend) | ✅ Implemented | Requires `RESEND_API_KEY` |
| S3 / DigitalOcean Spaces | ⚠️ Partial | Upload works; download broken |
| Redis | ✅ Implemented | JWT blocklist + user revocation (`ioredis`) |
| PostgreSQL (Prisma) | ✅ Implemented | Primary data store |
| SSE (real-time) | ✅ Implemented | In-process `sseClients` map |
| Active Directory / SSO | ❌ Not implemented | Critical gap |
| Slack / Microsoft Teams | ❌ Not implemented | Design vision gap |
| MFA / TOTP | ❌ Not implemented | Critical gap |
| Sentry / error tracking | ❌ Not implemented | Production risk |
| CI/CD | ❌ Not found | No `.github/workflows/` files |
| Gemini AI | ⚠️ Config only | API key in frontend bundle (security risk) |
| Elasticsearch | ⚠️ Config exists, unused | `LIKE`-based search used instead |
| Virus scanning (ClamAV) | ❌ Not implemented | Stubbed only |

---

### Frontend Routes

| Route | Component | Access |
|---|---|---|
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/` | `Dashboard` | Protected |
| `/hr` | `HRServices` | Protected |
| `/it` | `ITSupport` | Protected |
| `/finance` | `GroupFinance` | Protected |
| `/my-requests` | `MyRequests` | Protected |
| `/request/:id` | `RequestDetail` | Protected |
| `/agent` | `AgentDashboard` | ADMIN or AGENT only |
| `/reports` | `Reports` | ADMIN only |
| `/search` | `SearchResults` | Protected |
| `/kb` | `KnowledgeBase` | Protected |
| `/kb/:slug` | `ArticleDetail` | Protected |
| `/admin/settings` | `AdminSettings` | ADMIN only |
| `/:deskType/:deskId/create/:categoryId` | `CreateRequest` | Protected |

---

### Seed Accounts

All seed accounts use password `abc@123`:

| Email | Name | Roles |
|---|---|---|
| `admin@test.local` | Fang Kar Yuan | ADMIN, AGENT, HIRING_MANAGER |
| `ceo@test.local` | Emily Chow | CEO, HIRING_MANAGER |
| `cto@test.local` | Raymond Kueh | CTO |
| `cfo@test.local` | Saravanan Ramaiah | CFO |
| `groupceo@test.local` | Alain Boey | GROUP_CEO |
| `finance@test.local` | Zahidah | AGENT |
| `it@test.local` | Tham Ming Kai | AGENT |
| `it2@test.local` | Naila | AGENT |
| `hr@test.local` | Sasha Nair | AGENT |
| `john.doe@test.local` | John Doe | NORMAL_STAFF |
| `jane.smith@test.local` | Jane Smith | NORMAL_STAFF |
| `user@helpdesk.com` | Regular User | USER (legacy) |

> ⚠️ CLAUDE.md documents outdated credentials (`admin@helpdesk.com / admin123`) — these do not match current seed.

---

## 3. Audit Findings

---

### P1 Blockers

---

**FINDING: No SSO / Azure AD — manual account provisioning for every employee**
AREA: Portal UX / Integrations
TYPE: Gap
PRIORITY: P1 BLOCKER
FILE REFERENCE: `backend/src/controllers/auth.controller.ts`
DESCRIPTION: The design vision requires SSO (Azure AD / Okta). The system uses email/password only. Every employee account must be manually created by an admin. No SAML or OIDC endpoint exists. No auto-provisioning on first login.
RECOMMENDED FIX: Integrate `passport-saml` or `passport-azure-ad`. Map AD attributes to the User model. Auto-create or update User records on first SSO login. Add SSO login button to the Login page.

---

**FINDING: No MFA — executive and admin accounts unprotected**
AREA: Portal UX
TYPE: Gap
PRIORITY: P1 BLOCKER
FILE REFERENCE: `backend/src/controllers/auth.controller.ts`
DESCRIPTION: No TOTP, SMS OTP, or WebAuthn is implemented. Admin and executive accounts (CEO, CFO, GROUP_CEO) handling finance approvals and hiring decisions can be taken over with a single stolen password.
RECOMMENDED FIX: Add TOTP-based MFA using `speakeasy`. Require MFA enrollment for ADMIN, AGENT, and all executive roles on first login. Store `totpSecret` on the User model.

---

**FINDING: LOA_ACCEPTED is a dead-end — HR hiring tickets never close**
AREA: Workflows
TYPE: Bug
PRIORITY: P1 BLOCKER
FILE REFERENCE: `backend/src/controllers/approval.controller.ts`, `frontend/src/components/request-detail/ActionSidebar.tsx`
DESCRIPTION: The HR recruitment workflow ends at `LOA_ACCEPTED` with no action available to transition to `COMPLETED`. Every accepted hire creates a permanently open ticket. This inflates open ticket counts, skews SLA metrics, and leaves the hiring workflow with no formal close.
RECOMMENDED FIX: Add a "Close Hiring Request" action in ActionSidebar for `LOA_ACCEPTED` status that transitions the request to `COMPLETED`. Optionally auto-create the linked onboarding request at this point and send a notification.

---

**FINDING: Finance stepper shows wrong steps on every Finance ticket**
AREA: Workflows
TYPE: Bug
PRIORITY: P1 BLOCKER
FILE REFERENCE: `frontend/src/components/request-detail/RequestHeader.tsx`
DESCRIPTION: The Finance ticket stepper compares against legacy status names without the `_FIN` suffix. Every Finance ticket displays the wrong active step or shows all steps as inactive. This is a visible quality failure on every Finance request.
RECOMMENDED FIX: Update the Finance stepper status comparisons in RequestHeader to use the correct `_FIN`-suffixed status constants: `FINANCE_PENDING_ACK`, `FINANCE_ACKNOWLEDGED`, `PENDING_CFO_APPROVAL_FIN`, `PENDING_GROUP_CEO_APPROVAL`, `PAYMENT_PROCESSING_FIN`, `TICKET_CLOSED_FIN`.

---

**FINDING: S3 file downloads broken — `fs.createReadStream` used instead of S3 presigned URL**
AREA: Integrations
TYPE: Bug
PRIORITY: P1 BLOCKER
FILE REFERENCE: `backend/src/controllers/request.controller.ts` — `downloadAttachment` handler
DESCRIPTION: `downloadAttachment` constructs a local filesystem path and calls `fs.createReadStream(absolutePath)`. Files are uploaded to DigitalOcean Spaces via S3. The local path never exists on the server. Every file download returns a 500 error or empty response.
RECOMMENDED FIX: Replace the `fs.createReadStream` approach with `s3Service.getPresignedUrl(storageKey)` and redirect the client (`302`) to the presigned URL. Alternatively stream the S3 object directly via `GetObjectCommand` and pipe to the response.

---

### P2 High

---

**FINDING: Password reset email has no reset link — users cannot reset their password**
AREA: Integrations
TYPE: Bug
PRIORITY: P2 HIGH
FILE REFERENCE: `backend/prisma/seed.ts` — `PASSWORD_RESET` notification template; `backend/src/controllers/auth.controller.ts` line ~287
DESCRIPTION: Two bugs combined: (1) The `PASSWORD_RESET` notification template body does not include `{{resetUrl}}`, so the reset link is never rendered in the email. (2) `auth.controller.ts` references `user.name` when constructing template variables, but the User model only has `firstName` / `lastName` — `user.name` resolves to `undefined` and the email greeting shows "undefined".
RECOMMENDED FIX: (1) Update the `PASSWORD_RESET` template body in seed.ts to include `{{resetUrl}}` as a clickable anchor tag. (2) Change `user.name` to `` `${user.firstName} ${user.lastName}` `` in auth.controller.ts.

---

**FINDING: IT Simple request types have no SLA target**
AREA: SLA
TYPE: Gap
PRIORITY: P2 HIGH
FILE REFERENCE: `backend/prisma/seed.ts` — `slaHours: null` for GET_IT_HELP, EMAIL_MANAGEMENT, REPORT_SYSTEM_PROBLEM
DESCRIPTION: Three of the five IT request types have `slaHours: null`. The SLA checker skips them entirely, meaning agents have no accountability targets for what are likely the highest-volume ticket types.
RECOMMENDED FIX: Set appropriate SLA hours in seed.ts: `GET_IT_HELP: 8`, `EMAIL_MANAGEMENT: 24`, `REPORT_SYSTEM_PROBLEM: 4`.

---

**FINDING: IT Get IT Help stepper shows wrong step indicator**
AREA: Workflows
TYPE: Bug
PRIORITY: P2 HIGH
FILE REFERENCE: `frontend/src/components/request-detail/RequestHeader.tsx`
DESCRIPTION: `GET_IT_HELP` workflow steps were not included in the stepper mapping in RequestHeader. The ActionSidebar action wiring was fixed (Apr 24) but the visual stepper still does not progress correctly for this ticket type.
RECOMMENDED FIX: Verify and add the `GET_IT_HELP` branch in RequestHeader stepper to match the IT_SIMPLE workflow status sequence: SUBMITTED → IN_REVIEW → IN_PROGRESS → RESOLVED.

---

**FINDING: Onboarding new-hire account created with empty password hash**
AREA: Workflows
TYPE: Bug
PRIORITY: P2 HIGH
FILE REFERENCE: `backend/src/services/onboarding.service.ts`
DESCRIPTION: When the onboarding service creates the new hire's system account, it sets `passwordHash: ''`. The account is created but the new hire cannot log in — no temporary password is generated and no password-setup email is sent.
RECOMMENDED FIX: Generate a cryptographically random temporary password, hash it with bcrypt, set `mustResetPassword: true` on the User record, and email the temporary password (or a password-setup link) to the new hire's personal email address.

---

**FINDING: SSE authentication token exposed in URL query string**
AREA: Integrations
TYPE: Bug
PRIORITY: P2 HIGH
FILE REFERENCE: `backend/src/routes/notification.routes.ts`
DESCRIPTION: The SSE endpoint accepts `?token=<access_token>` because browsers cannot set custom headers for `EventSource`. This 15-minute JWT appears in nginx/proxy access logs, browser history, and Referrer headers — a credential leak vector in any proxied or load-balanced environment.
RECOMMENDED FIX: Issue a short-lived (30-second), single-use SSE token via `POST /api/v1/notifications/sse-token`. The client fetches this token first, then connects SSE using it. Store the SSE token in Redis with the user ID and invalidate on first use.

---

**FINDING: No external error monitoring — production failures invisible**
AREA: Integrations
TYPE: Gap
PRIORITY: P2 HIGH
FILE REFERENCE: `backend/src/app.ts`, `frontend/src/main.tsx`
DESCRIPTION: No Sentry, Datadog, or equivalent is configured. When the production server throws unhandled exceptions or the frontend crashes, the team has no alert and learns about it from user complaints.
RECOMMENDED FIX: Add `@sentry/node` to the backend (initialize in `app.ts`, add Sentry error handler middleware after routes). Add `@sentry/react` with `ErrorBoundary` to the frontend. Use a single Sentry project with environment tags for staging/production.

---

**FINDING: No CI/CD pipeline — every deployment is fully manual**
AREA: Integrations
TYPE: Gap
PRIORITY: P2 HIGH
FILE REFERENCE: `.github/workflows/` — directory does not exist
DESCRIPTION: No GitHub Actions or equivalent pipeline files exist in the repository. Build, test, migration, and deployment steps are all manual. A broken deploy has no automated gate. No tests run on pull requests.
RECOMMENDED FIX: Add a GitHub Actions workflow with two jobs: (1) PR check — run `tsc`, `eslint`, and `npm test` on every PR; (2) Deploy — on merge to `main`, build and deploy to staging, run `prisma migrate deploy`, then require manual promotion to production.

---

### P3 Medium

---

**FINDING: `CustomFieldsPanel` missing `finalizedAmount` label for Finance tickets**
AREA: Workflows
TYPE: Bug
PRIORITY: P3 MEDIUM
FILE REFERENCE: `frontend/src/components/request-detail/CustomFieldsPanel.tsx`
DESCRIPTION: `FINANCE_FIELD_LABELS` does not include the `finalizedAmount` key. When a CFO or agent sets a finalized amount, it renders as the raw key string (`finalizedAmount`) rather than a human-readable label in the ticket detail view.
RECOMMENDED FIX: Add `finalizedAmount: 'Finalized Amount'` to `FINANCE_FIELD_LABELS` in CustomFieldsPanel.tsx.

---

**FINDING: No approval delegation — absent approver blocks entire workflow globally**
AREA: Approvals
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/controllers/approval.controller.ts`
DESCRIPTION: If the CEO is on leave, all `PENDING_CEO_APPROVAL` hiring tickets are indefinitely blocked with no mechanism to delegate or escalate to a deputy. The same applies to CTO, CFO, and GROUP_CEO. One absent executive can halt all approvals for their role.
RECOMMENDED FIX: Add an "Approval Delegation" feature in Admin Settings where an approver designates a delegate user for a date range. The workflow automatically routes to the delegate when the primary approver has an active delegation.

---

**FINDING: `RequestApproval` records not created for IT and Finance workflow approvals**
AREA: Approvals
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/controllers/it-workflow.controller.ts`, `backend/src/controllers/finance-workflow.controller.ts`
DESCRIPTION: The `request_approvals` table exists with `approverType`, `approverId`, `status`, and `comments` fields designed for compliance audit tracking. IT and Finance workflow approval actions update `request.status` directly without creating `RequestApproval` records. No formal approval audit trail is stored.
RECOMMENDED FIX: Create a `RequestApproval` record on every approve and reject action across all workflows (IT, HR, Finance). This is required for any future compliance or audit reporting.

---

**FINDING: SLA does not pause during approval waiting periods**
AREA: SLA
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/services/sla.service.ts`, `backend/src/jobs/sla-checker.ts`
DESCRIPTION: IT hardware tickets can wait days in `PENDING_MANAGER_APPROVAL_IT` or `PENDING_CEO_APPROVAL_IT`. The SLA clock runs continuously through these waits. An agent who is blocked on an approver decision gets flagged for SLA breach even though the delay is in the approval chain, not the agent's queue.
RECOMMENDED FIX: Define a set of "clock pause" statuses (all `PENDING_*_APPROVAL_*` variants). Accumulate total paused duration in a new `slaPausedSeconds` field on `Request`. Subtract from SLA calculation when computing breach.

---

**FINDING: No business-hours SLA calendar — SLA runs 24/7 wall-clock time**
AREA: SLA
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/services/sla.service.ts`
DESCRIPTION: `slaDueAt = createdAt + slaHours` uses raw calendar time. A ticket submitted Friday at 4:55 PM with a 4-hour SLA breaches before agents arrive Monday morning. No business calendar or holiday configuration exists.
RECOMMENDED FIX: Add a `BusinessCalendar` model (working hours per day, public holidays). Implement a business-hours duration calculator and use it when computing `slaDueAt` at ticket creation.

---

**FINDING: No SLA breach escalation — breached tickets remain with original agent**
AREA: SLA / Workflows
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/jobs/sla-checker.ts`
DESCRIPTION: SLA breach creates a system comment and sends a notification, but takes no escalation action. Breached tickets remain assigned to the original agent with no forced response. Managers and team leads receive no alert unless they are admin users.
RECOMMENDED FIX: On breach: automatically elevate request `priority` to `CRITICAL`, notify the agent's team lead (via `agentTeam` field), post an in-app banner on the ticket, and flag it in the agent dashboard with a visual indicator.

---

**FINDING: Virus scanning stubbed — all uploaded files stored unscanned**
AREA: Integrations
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `backend/src/controllers/request.controller.ts` — `isScanned: false` hardcoded
DESCRIPTION: Every file upload sets `isScanned: false` and `scanResult: null` permanently. No ClamAV or cloud antivirus integration exists. Users can upload and retrieve files without any malware screening.
RECOMMENDED FIX: Integrate ClamAV via the `clamscan` npm package for synchronous scanning, or configure an S3 event notification that triggers a scanning Lambda. Block download of files where `isScanned: false` after a configurable grace period, and quarantine files where `scanResult = 'INFECTED'`.

---

**FINDING: No CSAT survey on ticket closure**
AREA: Portal UX / Reporting
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: N/A — feature absent from codebase and schema
DESCRIPTION: The design vision includes CSAT tracking. No survey prompt, rating model, or satisfaction metric exists anywhere in the system. The Reports page cannot show satisfaction data.
RECOMMENDED FIX: Add a `RequestRating` model (`requestId`, `rating` 1–5, `comment`, `submittedAt`). On `RESOLVED` status transition, send a rating email to the requester with a single-click rating link. Add a CSAT trend chart to the Reports page.

---

**FINDING: CLAUDE.md has wrong router type and outdated seed credentials**
AREA: Portal UX
TYPE: Gap
PRIORITY: P3 MEDIUM
FILE REFERENCE: `CLAUDE.md`
DESCRIPTION: (1) CLAUDE.md states "HashRouter" but `frontend/App.tsx` uses `BrowserRouter`. BrowserRouter requires a server-side catch-all for deep-link refreshes — if not configured, direct URL refreshes return 404 in production. (2) CLAUDE.md documents `admin@helpdesk.com / admin123` which no longer matches the current seed accounts (`@test.local` / `abc@123`).
RECOMMENDED FIX: (1) Update CLAUDE.md to reflect `BrowserRouter` and verify the production server has `try_files $uri /index.html` configured. (2) Update the default credentials section to match current seed.ts accounts.

---

### P4 Low

---

**FINDING: Gemini API key exposed in frontend bundle**
AREA: Integrations
TYPE: Gap
PRIORITY: P4 LOW
FILE REFERENCE: `frontend/vite.config.ts`
DESCRIPTION: `GEMINI_API_KEY` is compiled into the frontend bundle via Vite's `define` config. No Gemini feature exists in the codebase. Anyone who inspects the compiled JavaScript can extract and use the API key, incurring unexpected billing.
RECOMMENDED FIX: Remove `GEMINI_API_KEY` from vite.config.ts immediately. When an AI feature is built, proxy all Gemini API calls through the backend — never expose API keys in the frontend bundle.

---

**FINDING: No CSV or PDF report export**
AREA: Reporting
TYPE: Gap
PRIORITY: P4 LOW
FILE REFERENCE: `frontend/pages/Reports.tsx`, `backend/src/controllers/`
DESCRIPTION: The Reports page shows charts and tables but has no export function. Finance stakeholders and HR will request raw data exports for reconciliation, payroll, and compliance purposes.
RECOMMENDED FIX: Add backend endpoints returning CSV (`Content-Type: text/csv`) for requests filtered by date range, status, and type. Add "Export CSV" buttons to the Reports UI for each table view.

---

**FINDING: No cross-desk executive dashboard**
AREA: Reporting
TYPE: Gap
PRIORITY: P4 LOW
FILE REFERENCE: `frontend/pages/Reports.tsx`
DESCRIPTION: The design vision includes a cross-desk executive view. The current Reports page shows per-desk data. CEO, CFO, and GROUP_CEO cannot see a unified KPI view across IT + HR + Finance simultaneously.
RECOMMENDED FIX: Add an executive summary panel (visible to CEO/CFO/ADMIN) showing: total open tickets by desk, SLA breach rate by desk, average resolution time by desk, and pending approval count for the viewer's role.

---

**FINDING: No Slack or Teams integration for agent notifications**
AREA: Integrations
TYPE: Gap
PRIORITY: P4 LOW
FILE REFERENCE: N/A — feature absent
DESCRIPTION: The design vision includes Teams/Slack integration. Agents working primarily in Teams will not receive native notifications for new assignments, SLA breaches, or escalations — only email and in-app.
RECOMMENDED FIX: Add a webhook-based integration. Store a Teams/Slack incoming webhook URL per service desk in Admin Settings. On ticket creation, assignment, and SLA breach, post a card to the configured channel.

---

**FINDING: `Permission` model and `RolePermission` table exist but RBAC is not enforced**
AREA: Approvals
TYPE: Gap
PRIORITY: P4 LOW
FILE REFERENCE: `backend/prisma/schema.prisma`, `backend/src/middleware/auth.middleware.ts`
DESCRIPTION: The schema contains `Permission` and `RolePermission` models suggesting fine-grained RBAC. In practice, all authorization is coarse role-checking (`requireRole(['ADMIN'])`). The Permission records are seeded but never read at runtime.
RECOMMENDED FIX: Either (A) implement a `checkPermission(resource, action)` middleware that reads from the seeded permissions table, or (B) acknowledge RBAC is intentionally role-based only and remove the unused `Permission` / `RolePermission` models and their seed data to reduce schema confusion.

---

## 4. Consolidated Audit Summary

### Files Scanned

| File | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Full data model (38 models) |
| `backend/prisma/seed.ts` | All seed data — request types, users, workflows, notifications |
| `backend/src/app.ts` | Application entry point and middleware stack |
| `backend/src/config/index.ts` | Centralized environment variable config |
| `backend/src/routes/index.ts` | Route mounting |
| `backend/src/controllers/auth.controller.ts` | Authentication and password management |
| `backend/src/controllers/request.controller.ts` | Core ticket CRUD and file handling |
| `backend/src/controllers/approval.controller.ts` | HR approval chain transitions |
| `backend/src/controllers/it-workflow.controller.ts` | IT workflow transitions |
| `backend/src/controllers/finance-workflow.controller.ts` | Finance workflow transitions |
| `backend/src/services/email.service.ts` | Email sending via Resend |
| `backend/src/services/notification.service.ts` | In-app and email notification dispatch |
| `backend/src/services/sla.service.ts` | SLA due date calculation |
| `backend/src/services/onboarding.service.ts` | Onboarding task and account creation |
| `backend/src/jobs/sla-checker.ts` | Scheduled SLA breach detection |
| `backend/src/middleware/auth.middleware.ts` | JWT verification and role guards |
| `backend/src/templates/email-layout.ts` | Branded HTML email template |
| `frontend/App.tsx` | Router and route definitions |
| `frontend/src/components/request-detail/ActionSidebar.tsx` | Workflow action buttons |
| `frontend/src/components/request-detail/RequestHeader.tsx` | Ticket stepper and header |
| `frontend/src/components/request-detail/CustomFieldsPanel.tsx` | Custom field rendering |
| `frontend/src/components/request-detail/ApprovalActions.tsx` | Approval UI |
| All 35+ modal components | Per-action workflow modals |
| All admin tab components | Admin settings UI |
| All pages in `frontend/pages/` and `frontend/src/pages/` | Application pages |
| `docs/EMAIL_NOTIFICATION_ANALYSIS.md` | Prior email audit |
| `docs/EMAIL_NOTIFICATION_FIX_PLAN.md` | Email fix plan |
| `docs/EMAIL_TEMPLATE_SEED_DATA.md` | Template data reference |
| `CLAUDE.md` | Developer guidance |
| All `package.json` files | Dependencies and scripts |
| `backend/.env`, `backend/.env.example` | Environment configuration |

### Files Skipped / Unreadable

| File / Category | Reason |
|---|---|
| Binary image assets | Not applicable to audit |
| `node_modules/` | Excluded by design |
| Prisma migration SQL files | Schema captures current state adequately |
| `.github/workflows/` | Directory does not exist — no CI/CD configured |

---

### Executive Summary

| Metric | Value |
|---|---|
| Overall alignment with Company Portal + ITSM concept | **5.5 / 10** |
| Production readiness | **Needs Work** |
| Total findings | **22 total** |
| P1 Blockers | **5** |
| P2 High | **7** |
| P3 Medium | **8** |
| P4 Low | **5** (including sub-items) |
| Launch recommendation | **No-Go** (pilot with conditions — IT desk only, internal staff only, after P1 fixes) |

---

### Area Scorecards

| Area | Alignment /10 | Readiness /10 | Biggest Risk |
|---|---|---|---|
| Portal & Employee UX | 5/10 | 4/10 | No SSO — manual account creation for every employee |
| Workflows & Automation | 7/10 | 6/10 | LOA dead-end + Finance stepper broken = visible quality failure on every Finance ticket |
| SLA Configuration | 5/10 | 5/10 | No business hours, no clock pause during approvals, 3 request types have no SLA at all |
| Approval Chains | 7/10 | 7/10 | No delegation — one absent CEO blocks all hiring globally |
| Integrations | 4/10 | 4/10 | File downloads broken, password reset broken, no SSO, no error monitoring |
| Reporting & Dashboards | 4/10 | 4/10 | No CSAT, no export, no executive cross-desk view |

---

### P1 Blockers — Fix Before Launch

| # | Finding | File Reference | Estimated Effort |
|---|---------|---------------|-----------------|
| 1 | No SSO / Azure AD — manual account provisioning unscalable | `auth.controller.ts` | 5–8 days |
| 2 | No MFA — executive accounts unprotected | `auth.controller.ts` | 2–3 days |
| 3 | LOA_ACCEPTED dead-end — HR hiring tickets never close | `approval.controller.ts`, `ActionSidebar.tsx` | 0.5 days |
| 4 | Finance stepper shows wrong steps on every Finance ticket | `RequestHeader.tsx` | 0.5 days |
| 5 | S3 file downloads broken — `fs.createReadStream` instead of presigned URL | `request.controller.ts` | 0.5 days |

> **Note on P1 items 1 & 2:** If launch scope is a controlled internal pilot with fewer than 50 staff and strong network perimeter controls, SSO and MFA may be deferred to P2 with a documented risk acceptance. Items 3, 4, and 5 must be fixed regardless.

---

### P2 High — Fix Before or At Launch

| # | Finding | File Reference | Estimated Effort |
|---|---------|---------------|-----------------|
| 1 | Password reset email has no reset link + `user.name` undefined | `seed.ts`, `auth.controller.ts` | 1 hour |
| 2 | IT Simple request types have no SLA target (null) | `seed.ts` | 15 minutes |
| 3 | IT Get IT Help stepper shows wrong step | `RequestHeader.tsx` | 0.5 days |
| 4 | Onboarding new-hire account created with empty password | `onboarding.service.ts` | 0.5 days |
| 5 | SSE token exposed in URL query string (proxy log leak) | `notification.routes.ts` | 1 day |
| 6 | No external error monitoring (Sentry) | `app.ts`, `main.tsx` | 0.5 days |
| 7 | No CI/CD pipeline | `.github/workflows/` (missing) | 1–2 days |

---

### P3 Medium — First Sprint Post-Launch

| # | Finding | File Reference | Estimated Effort |
|---|---------|---------------|-----------------|
| 1 | `CustomFieldsPanel` missing `finalizedAmount` label | `CustomFieldsPanel.tsx` | 1 hour |
| 2 | Approval delegation — absent approver blocks workflow globally | `approval.controller.ts` | 3 days |
| 3 | `RequestApproval` records not created for IT/Finance (no audit trail) | `it-workflow.controller.ts`, `finance-workflow.controller.ts` | 1 day |
| 4 | SLA does not pause during approval waiting periods | `sla.service.ts` | 1.5 days |
| 5 | No business-hours SLA calendar | `sla.service.ts` | 2 days |
| 6 | No SLA breach escalation (auto-priority bump, team lead alert) | `sla-checker.ts` | 1 day |
| 7 | Virus scanning stubbed — no actual scanning | `request.controller.ts` | 2 days |
| 8 | No CSAT survey on ticket closure | Schema + frontend — new feature | 2 days |

---

### P4 Low — Backlog

| # | Finding | File Reference | Estimated Effort |
|---|---------|---------------|-----------------|
| 1 | Gemini API key exposed in frontend bundle | `vite.config.ts` | 15 minutes |
| 2 | No CSV / PDF report export | `Reports.tsx`, backend controllers | 2 days |
| 3 | No cross-desk executive dashboard | `Reports.tsx` | 2 days |
| 4 | No Slack / Teams integration | N/A — new feature | 3–5 days |
| 5 | `Permission` model exists but RBAC is not enforced | `schema.prisma`, `auth.middleware.ts` | 1 day |
| 6 | CLAUDE.md has wrong router type and outdated credentials | `CLAUDE.md` | 15 minutes |

---

### What Is Working Well

1. **Comprehensive workflow coverage** — IT hardware 13-step approval chain, HR recruitment 13-step lifecycle, Finance CFO/Group CEO approval routing, and onboarding/offboarding task management are all implemented with correct role-gating logic.

2. **Production-grade token security** — JTI-based Redis blocklist, per-user revocation timestamps, bcrypt cost-12 password hashing, and refresh token rotation are all correctly implemented.

3. **Real-time notification system** — SSE-based live updates + 27 seeded email notification templates covering the full ticket lifecycle, delivered via Resend with a branded HTML email layout.

4. **Role-visibility enforcement** — `getAllRequests` correctly gates each executive role (CEO/CTO/CFO/GROUP_CEO) to only the tickets relevant to their approval scope, preventing cross-role data leakage.

5. **SLA monitoring infrastructure** — 60-second polling SLA checker job with breach detection, automatic system activity comment, and dual notification (assignee + all admins). The scaffolding is solid and working; it only needs enhancements (business hours, pause logic).

---

### Recommended Pre-Launch Test Scenarios

These 5 end-to-end tests must pass before go-live:

| # | Scenario | Why Critical |
|---|---|---|
| 1 | **IT Hardware full cycle** — Submit hardware request (price >$2,500) → Manager approves → VP approves → CTO approves → CFO approves → Invoice uploaded → Payment done → Delivery confirmed → Ticket resolved. Verify stepper updates and email fires at each stage. | Covers the most complex approval chain and verifies email notifications at every gate |
| 2 | **HR Hiring full cycle** — CEO approves job → Job posted → Hiring Manager approves candidate → Interview scheduled → Interview feedback submitted → HR Screening completed → LOA uploaded → LOA approved → LOA issued → Candidate accepts (`LOA_ACCEPTED`) → Ticket marked complete (`COMPLETED`). | Exercises the P1 LOA dead-end bug fix; the final step is the critical fix |
| 3 | **File upload and download** — Submit a request with an attachment → View ticket detail → Click download → Verify file contents are correct and complete. | Exercises the P1 S3 download bug fix; the current code is entirely broken here |
| 4 | **Password forgot/reset full cycle** — Click "Forgot Password" → Receive email → Click the reset link in the email → Set new password → Log in with new password successfully. | Exercises both P2 bugs in auth: missing `{{resetUrl}}` in template and `user.name` undefined |
| 5 | **Finance Purchase Requisition full cycle** — Submit a PR above RM15,000 → Finance agent acknowledges → In-progress → CFO approves → Group CEO approves → Payment confirmed → Ticket closed. Verify Finance stepper shows correct active step throughout all phases. | Exercises the P1 Finance stepper bug fix and Group CEO approval routing |

---

### Suggested Fix Order — Day-by-Day Pre-Launch Plan

*Assumes a team of 1–2 developers. SSO and MFA deferred assuming controlled internal pilot.*

**Day 1 — Stop the bleeding (all sub-1-hour fixes)**
- [ ] Fix `{{resetUrl}}` in `PASSWORD_RESET` notification template in `seed.ts`
- [ ] Fix `user.name` → `` `${user.firstName} ${user.lastName}` `` in `auth.controller.ts`
- [ ] Fix `downloadAttachment` in `request.controller.ts` to use S3 presigned URL instead of `fs.createReadStream`
- [ ] Add `finalizedAmount: 'Finalized Amount'` to `FINANCE_FIELD_LABELS` in `CustomFieldsPanel.tsx`
- [ ] Set `slaHours` in `seed.ts`: `GET_IT_HELP: 8`, `EMAIL_MANAGEMENT: 24`, `REPORT_SYSTEM_PROBLEM: 4`

**Day 2 — Close the open workflows**
- [ ] Add "Close Hiring Request" action in `ActionSidebar.tsx`: `LOA_ACCEPTED` → `COMPLETED` transition + linked onboarding creation
- [ ] Fix Finance stepper in `RequestHeader.tsx` to use `_FIN`-suffixed status constants
- [ ] Fix `GET_IT_HELP` stepper mapping in `RequestHeader.tsx` to use IT_SIMPLE status sequence
- [ ] Run `npm run prisma:seed` after seed.ts changes, then smoke test all 5 test scenarios

**Day 3 — Security quick wins**
- [ ] Remove `GEMINI_API_KEY` from `vite.config.ts`
- [ ] Add Sentry to backend (`app.ts`) and frontend (`main.tsx`)
- [ ] Fix `onboarding.service.ts` to generate temp password and send password-setup email to new hire

**Day 4 — CI/CD foundation**
- [ ] Add `.github/workflows/ci.yml`: PR check job (tsc + eslint + npm test)
- [ ] Add `.github/workflows/deploy.yml`: merge-to-main staging deploy with `prisma migrate deploy`
- [ ] Configure environment secrets in GitHub repository settings

**Day 5 — Pilot readiness**
- [ ] Create real user accounts for pilot cohort (extend seed.ts or use Admin Settings UI)
- [ ] Run all 5 end-to-end test scenarios with a non-developer tester
- [ ] Fix any regressions found
- [ ] Brief agents on their workflows and the Admin on the admin panel
- [ ] Soft-launch IT desk only to pilot cohort

---

**Post-Pilot Sprint 1** (within 2 weeks of go-live):
- Approval delegation feature
- SLA clock-pause during approval waiting statuses
- Business-hours SLA calendar
- `RequestApproval` audit trail records for IT/Finance workflows
- CSAT survey on ticket closure
- SSE token security hardening (single-use SSE token endpoint)

**Post-Pilot Sprint 2** (weeks 3–6):
- SSO / Azure AD integration (if organisation uses AAD — `passport-azure-ad`)
- MFA / TOTP for admin and executive accounts (`speakeasy`)
- Slack / Teams webhook integration
- CSV report exports
- Virus scanning integration (ClamAV or cloud scanner)
- Cross-desk executive dashboard

---

*End of audit report. Generated 2026-04-25.*
