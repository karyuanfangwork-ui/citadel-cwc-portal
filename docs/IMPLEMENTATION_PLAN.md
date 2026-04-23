# CWC 2.0 — Implementation Plan
> Tracking all bug fixes, gaps, and technical debt from the pre-launch audit.
> Doc reference: `CWC_2.0_Service_Management_Platform.md` (v1.0, 2026-04-22)

---

## How to Use This File

- [ ] **Unchecked** = Not started
- [x] **Checked** = Completed
- ⚠️ **Flagged** = In progress / blocked
- Each item has an owner, priority, and target phase field
- Update `Last Updated` whenever changes are made

**Last Updated:** April 22, 2026 (v1.4 — G-001, G-002, G-003, G-004 implemented)
**Overall Status:** Pre-Launch — Internal Review

---

## PART A — Critical Gaps (Must Fix Before Go-Live)

---

### [x] G-001: Hiring Workflow Skips LOA_ACCEPTED Status Entirely

**Location:**
- Backend: `backend/src/controllers/loa.controller.ts` (`uploadSignedLOA` + `markLOAAccepted`)
- Frontend: `frontend/pages/RequestDetail.tsx` (`handleMarkLOAAccepted`)

**Impact:** The `LOA_ACCEPTED` state (defined in the spec as the step where the candidate signs and uploads the signed LOA) is never actually set. The workflow jumps directly from `LOA_ISSUED → COMPLETED` when the HR agent clicks "Mark LOA Accepted". The `LOA_ACCEPTED` state is bypassed and the audit trail is missing that step.

**Root Cause (confirmed):** Two separate bugs:
1. `uploadSignedLOA` sets `signedLoaFileUrl` on the LOA record but does NOT advance the request status to `LOA_ACCEPTED`.
2. `markLOAAccepted` checks `request.status !== 'LOA_ISSUED'` and sets `status: 'COMPLETED'` directly — bypassing `LOA_ACCEPTED` entirely.

**Fix (2 parts — COMPLETED):**
- Part A: `uploadSignedLOA` — After saving `signedLoaFileUrl`, also call `prisma.request.update({ status: 'LOA_ACCEPTED' })` on the parent request. Also adds a separate `STATUS_CHANGE` activity log entry. ✅
- Part B: `markLOAAccepted` — Changed the guard check from `!== 'LOA_ISSUED'` to `!== 'LOA_ACCEPTED'`. The `status: 'COMPLETED'` update was already correct. ✅
- The `LOA_ACCEPTED → COMPLETED` transition row already existed in the DB (confirmed: 85 transitions, active). ✅

**Files Changed:** `backend/src/controllers/loa.controller.ts`

**Verified:** TypeScript errors in `loa.controller.ts` are all pre-existing (missing `include` on Prisma queries, query param type issues). No new errors introduced by this fix.

**Priority:** Critical
**Phase:** P0 — Go-Live Blockers
**Owner:** __
**Ticket:** __
**Status:** ⚠️ COMPLETED — April 22, 2026

---

### [x] G-002: Local File Storage — No Redundancy / CDN / Backup

**Location:** File Upload System (Part 2 §2.4)
**Impact:** Files are stored on the local filesystem. Data loss risk in production. File URLs break on server restart or redeployment.
**Fix:** Migrated to DigitalOcean Spaces (S3-compatible). `backend/src/services/s3.service.ts` handles all uploads/presigned URLs. Local filesystem code removed.
**Priority:** Critical
**Phase:** P0 — Go-Live Blockers
**Owner:** __
**Ticket:** __
**Status:** ✅ COMPLETED — April 22, 2026

---

### [x] G-003: Real-time Notifications (No WebSocket/SSE)

**Location:** Notification Architecture (Part 2 §2.3)
**Impact:** Agents miss time-sensitive approvals and SLA alerts because notifications require page refresh.
**Fix:** Implemented SSE (Server-Sent Events). `backend/src/utils/sseClients.ts` manages per-user connections. `notificationSse.routes.ts` exposes the SSE endpoint. `notification.service.ts` pushes events on status changes. Frontend `NotificationDropdown` subscribes via `EventSource`.
**Priority:** Critical
**Phase:** P0 — Go-Live Blockers
**Owner:** __
**Ticket:** __
**Status:** ✅ COMPLETED — April 22, 2026

---

### [x] G-004: Email Delivery Not Verified in Production

**Location:** Notification Architecture (Part 2 §2.3), Email Delivery
**Impact:** Nodemailer was configured with `SMTP_HOST=localhost` + `PORT=1025` (Mailhog dev port) with no Mailhog running — all email silently failed. 8 `notify()` call-sites in `it-workflow.controller.ts` passed plain strings instead of `NotifyOptions`, so they never fired templates or emails. `notify()` had no type signature so TypeScript accepted these invalid calls.

**Fix (COMPLETED):**
- Replaced Nodemailer with Resend SDK in `backend/src/services/email.service.ts` ✅
- Updated `backend/src/config/index.ts` to use `RESEND_API_KEY` (removed SMTP config) ✅
- Updated `backend/.env` and `.env.example` with `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` placeholders ✅
- Fixed 6 broken `notify()` calls in `it-workflow.controller.ts` (plain string → proper `NotifyOptions` with event types) ✅
- Added 13 missing `NotificationTemplate` entries to `backend/prisma/seed.ts` (all new event types) ✅

**New Notification Templates Added:**
- `MANAGER_APPROVAL_REQUIRED`, `MANAGER_APPROVED`, `MANAGER_REJECTED`
- `PROCUREMENT_INITIATED`, `HARDWARE_ORDERED`, `HARDWARE_RECEIVED`, `HARDWARE_DELIVERED`
- `VP_APPROVAL_REQUIRED`, `VP_APPROVED`, `VP_REJECTED`
- `REQUEST_REJECTED`, `ACTION_REQUIRED`

**Files Changed:**
- `backend/src/services/email.service.ts`
- `backend/src/config/index.ts`
- `backend/src/controllers/it-workflow.controller.ts`
- `backend/prisma/seed.ts`
- `backend/.env`
- `backend/.env.example`

**To Enable Email:** Set `RESEND_API_KEY` in `backend/.env`. Get a free key at https://resend.com. By default, with no API key, emails are silently skipped (logs a warning) so the app continues working without it.

**Priority:** Critical
**Phase:** P0 — Go-Live Blockers
**Owner:** __
**Ticket:** __
**Status:** ✅ COMPLETED — April 22, 2026

---

## PART B — High Priority Gaps (Fix in Sprint 1 Post-Launch)

---

### [ ] G-005: SLA Clock Does Not Pause During Approval Wait Time

**Location:** SLA Engine / SLA Rules (Part 2 §R-003, §2.6)
**Impact:** Finance and HR requests appear to breach SLA even when waiting on external approvers — unfair to agents.
**Fix:** Track `approvalStartAt` timestamp when a request enters any `PENDING_*_APPROVAL` status, and `approvalEndAt` when it exits. Modify SLA elapsed calculation to exclude `approvalStartAt → approvalEndAt` intervals. Update SLA checker background job accordingly.
**Priority:** High
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] G-006: Reporting — No Charts or Data Export

**Location:** Reports page (Part 1 §1.4, Part 7 G-006)
**Impact:** Management cannot generate compliance reports or present KPI dashboards. Reports page shows counts only.
**Fix:** Add chart visualizations (Recharts or Chart.js) for: resolution time trends, SLA performance by department, request volume by type/status. Implement CSV export endpoint (`GET /reports/export?format=csv`) and PDF generation endpoint.
**Priority:** High
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] G-007: No Optimistic Locking on Request Updates

**Location:** All PATCH `/requests/:id/status` and comment/file update endpoints
**Impact:** Two agents editing simultaneously can overwrite each other's changes. Risk of lost updates.
**Fix:** Add a `version` integer field (or `updatedAt` check) to the `Request` model. On every PATCH, include a `WHERE version = :expectedVersion` clause. If 0 rows affected, return `409 Conflict` with the current server state. Frontend shows "This request was updated by another user" dialog on 409.
**Priority:** High
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] G-008: Admin Workflow Builder Has No Dead-End Detection

**Location:** Admin Settings → Workflow Transitions tab (Part 6 §6.2, Part 7 G-008)
**Impact:** Admins can configure transitions that create dead-end states (no outgoing paths). Entire request type workflows can silently break.
**Fix:** Before saving any new transition, run a graph validation pass: build a directed graph of all transitions for the affected request type, detect nodes with zero outgoing edges that are not valid terminal states (`RESOLVED`, `CLOSED`, `REJECTED`, `COMPLETED`). Show a warning dialog with the affected statuses before confirming the save.
**Priority:** High
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] G-009: Approval Tracked as Status Changes — No ApprovalQueue Model

**Location:** HR Approval Chain (Part 4 §4.3.4), Finance Approval Chain (Part 5 §5.3.2)
**Impact:** Single point of failure if designated approver is unavailable. Parallel approval (multiple approvers at same level) not supported.
**Fix:** Create a new `ApprovalQueue` model in Prisma: `{ id, requestId, approverUserId, level, status (PENDING/APPROVED/REJECTED), comment, decidedAt }`. Replace inline status-change-based approval logic with `ApprovalQueue` lookups. Support approval delegation via an `ApprovalDelegation` table.
**Priority:** High
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

## PART C — Technical Debt (Refactoring)

---

### [ ] T-001: Decompose RequestDetail.tsx (2,395 LOC)

**Location:** `frontend/pages/RequestDetail.tsx`
**Impact:** Too large to maintain safely. Single file touching many concerns (display, actions, comments, file uploads, approvals, activity timeline).
**Fix:** Break into focused sub-components:
- `RequestHeader.tsx` — title, status badge, priority, requester info
- `StatusTimeline.tsx` — activity log / audit trail
- `ApprovalActions.tsx` — approve/reject buttons and logic
- `RequestComments.tsx` — comment thread
- `RequestAttachments.tsx` — file list and upload
- `RequestFormFields.tsx` — dynamic form fields by request type
- `SlaBadge.tsx` — SLA countdown and breach warning

**Priority:** Technical Debt
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] T-002: Decompose AdminSettings.tsx (1,805 LOC)

**Location:** `frontend/pages/AdminSettings.tsx`
**Impact:** Same problem as T-001. All admin features in one massive file.
**Fix:** The file already has tabs. Extract each tab into its own component (some already exist as separate files under `src/components/admin/`):
- `ServiceDesksTab.tsx` — service desk and category management
- `UsersTab.tsx` — user management (already partially separated via `CreateUserModal`)
- `OnboardingTasksTab.tsx` — onboarding template management
- `OffboardingTasksTab.tsx` — offboarding template management
- `WorkflowConfigTab.tsx` — workflow configuration (already `WorkflowTransitionTab.tsx`)
- `BannerConfigTab.tsx` — banner management (already separate)
- `StatusDefinitionsTab.tsx` — status definitions (already separate)
- `PermissionsTab.tsx` — permissions matrix (already separate)

**Priority:** Technical Debt
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] T-003: CEO/CFO/CTO String Checks — Not Part of RBAC

**Location:** Inline string checks scattered across backend and frontend (Part 7 T-003)
**Impact:** Not manageable via Admin UI. Adding/removing executives requires code changes.
**Fix:** Add a `ExecutiveRole` column to the `User` model (enum: `NONE`, `CEO`, `CFO`, `CTO`). Replace all `user.roles.includes('CEO')` with `user.executiveRole === 'CEO'`. Add an "Executive Roles" section in the Admin Settings Users tab to assign/toggle these.
**Priority:** Technical Debt
**Phase:** P1 — Sprint 1
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] T-004: SLA Checker Uses setInterval — Not Resilient

**Location:** Background job / SLA checker (Part 7 T-004)
**Impact:** SLA checker runs on `setInterval`. Dies silently if the Node process crashes. Missed SLA events are not recovered.
**Fix:** Replace `setInterval` with BullMQ (Redis-backed job queue). Each SLA check becomes an idempotent job that can be retried. Use a cron schedule (`*/15 * * * *`). Add a "last notified at" flag per request to prevent duplicate notifications.
**Priority:** Technical Debt
**Phase:** P2 — Sprint 2+
**Owner:** __
**Ticket:** __
**Status:** Not started

---

### [ ] T-005: Full-Text Search Uses SQL ILIKE — Doesn't Scale

**Location:** Search functionality (Part 7 T-005)
**Impact:** `ILIKE` queries do not scale past ~100k records. Search performance degrades as the database grows.
**Fix (Short term):** Add PostgreSQL GIN indexes on the columns most commonly searched (`summary`, `description`). Use `tsvector` for structured full-text search. No new infrastructure required.
**Fix (Long term):** Implement Elasticsearch. This is a Phase 4 initiative per the roadmap.
**Priority:** Technical Debt
**Phase:** P2 — Sprint 2+ (short-term GIN indexes); P4 (Elasticsearch)
**Owner:** __
**Ticket:** __
**Status:** Not started

---

## PART D — Phase 2 Enhancements (Q2–Q3 2026)

> These are planned features from the roadmap that aren't bugs but are needed for operational maturity.

| ID | Initiative | Business Value | Priority |
|:---|:---|:---|:---:|
| P2-01 | Real-time WebSocket notifications | Agents receive instant alerts without refreshing | P0 |
| P2-02 | Cloud file storage (S3/MinIO) | Secure, scalable storage with CDN and backups | P0 |
| P2-03 | Email delivery verification | Ensure all approval requests reach users | P0 |
| P2-04 | Hiring workflow closure (G-001) | Complete LOA→COMPLETED transition | P0 |
| P2-05 | SLA business-hours engine | SLA clock respects business hours and approval wait | P1 |
| P2-06 | Approval delegation | Designate backup approvers so workflows never block | P1 |
| P2-07 | Report export (CSV/PDF) | Extract compliance-ready reports for audits | P1 |
| P2-08 | KPI dashboard with charts | Visual resolution time, SLA performance, volume | P1 |

---

## PART E — Completed Items

| ID | Item | Completed Date | Notes |
|:---|:---|:---|:---|
| ~~G-001~~ | ~~G-001: Hiring Workflow LOA_ACCEPTED fix~~ | ~~Apr 22 2026~~ | ~~2-part fix in `loa.controller.ts`: `uploadSignedLOA` now sets `status: 'LOA_ACCEPTED'`, `markLOAAccepted` guards on `LOA_ACCEPTED` instead of `LOA_ISSUED`. Both include activity log entries.~~ |
| ~~G-002~~ | ~~G-002: S3 file storage migration~~ | ~~Apr 22 2026~~ | ~~Migrated to DigitalOcean Spaces via `s3.service.ts`. Local filesystem storage removed.~~ |
| ~~G-003~~ | ~~G-003: Real-time SSE notifications~~ | ~~Apr 22 2026~~ | ~~SSE implemented via `sseClients.ts` + `notificationSse.routes.ts`. Frontend `NotificationDropdown` uses `EventSource`.~~ |
| ~~T3-6~~ | ~~Workflow-config tab in AdminSettings~~ | ~~Apr 22 2026~~ | ~~Fully implemented: `WorkflowTransitionTab.tsx` (326 LOC), wired in `AdminSettings.tsx` line 1694, all CRUD endpoints mounted at `/admin/workflow-transitions`. DB table `workflow_transitions` has 85 rows seeded.~~ |

---

## Change Log

| Version | Date | Author | Changes |
|:---|:---|:---|:---|
| 1.2 | 2026-04-22 | Claude | G-001 fully implemented (Part A + Part B in `loa.controller.ts`). Status updated to COMPLETED. |
| 1.1 | 2026-04-22 | Claude | G-001 root cause confirmed and documented (2-part bug in `uploadSignedLOA` + `markLOAAccepted`). G-001 DB state verified (transition row exists). T3-6 verified as complete. |
| 1.0 | 2026-04-22 | Platform Team | Initial plan from pre-launch audit document |
