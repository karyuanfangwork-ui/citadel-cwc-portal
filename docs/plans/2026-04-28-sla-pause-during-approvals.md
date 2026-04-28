# SLA Pause During Approvals — Implementation Plan

**Date:** April 28, 2026
**Audit Reference:** FULL_PROJECT_AUDIT_2026-04-27.md — Risk #10
**Status:** Pending Review

---

## Problem Statement

The SLA deadline (`slaDueAt`) is set once at request creation time and never adjusted. When a ticket enters any `PENDING_*_APPROVAL` status, the SLA clock keeps ticking even though the assignee/agent has zero control over how fast an approver responds. This means:

- A 48h SLA ticket could burn 40h waiting for CEO approval and only have 8h left for actual work
- SLA breach notifications fire during approval waits — noise, not signal
- Escalation rules fire on breach time that includes idle approval wait time

---

## Current Architecture

| Component | File | Current Behavior |
|-----------|------|------------------|
| SLA due date | `Request.slaDueAt` (created at ticket creation, `now + slaHours`) | Never modified |
| Breach detector | `sla.service.ts` → `checkSlaBreaches()` | Checks `slaDueAt <= now` on non-terminal statuses |
| Escalation engine | `sla.service.ts` → `checkEscalations()` | Fires rules after breach, no pause awareness |
| SLA checker cron | `sla-checker.ts` | Runs on interval or cron, calls both checks |
| Frontend timer | `SLAIndicator.tsx` | Shows `slaDueAt - now`, no pause concept |
| Approval transitions | `approval.controller.ts`, `it-workflow.controller.ts`, `finance-workflow.controller.ts`, `chargeback-workflow.controller.ts` | No SLA pause/resume logic |
| WorkflowStep model | Prisma schema | Has `status`, `isInitial`, `isFinal` — no SLA pause config |

---

## Design Decision: Which Statuses Pause the SLA?

**Approach: Configurable via `WorkflowStep.slaPause` flag** — each workflow step gets a `slaPause: Boolean @default(false)` field. Admins can mark which statuses pause the SLA. Defaults are seeded for all `PENDING_*_APPROVAL` statuses.

This is better than a hardcoded allowlist because:

1. Different workflows may want different pause behavior (e.g., `LOA_PENDING_APPROVAL` pauses but `LOA_ISSUED` doesn't)
2. Admins can toggle pause per step from the workflow admin UI
3. No code change needed to add/remove pause statuses

### Default Pause Statuses (Seeded)

- `PENDING_CEO_APPROVAL`, `PENDING_CEO_APPROVAL_IT`
- `PENDING_MANAGER_APPROVAL_IT`, `PENDING_MANAGER_APPROVAL_FIN`, `PENDING_MANAGER_REVIEW`
- `PENDING_VP_APPROVAL_IT`
- `PENDING_CTO_APPROVAL_IT`, `PENDING_CFO_APPROVAL_IT`, `PENDING_CFO_APPROVAL_FIN`
- `PENDING_FINANCE_HEAD_APPROVAL`
- `PENDING_FROM_ENTITY_APPROVAL`, `PENDING_TO_ENTITY_APPROVAL`
- `LOA_PENDING_APPROVAL`
- `PENDING_INVOICE_IT` (waiting on vendor invoice — pause)

### Non-Pause Statuses (by Design)

- `ACKNOWLEDGED_IT` — agent acknowledges, they're working
- `PROCUREMENT_IN_PROGRESS`, `IN_PROGRESS` — active work
- `WAITING` — ambiguous, defaults to not paused (can be toggled per workflow)

---

## Step-by-Step Implementation

### STEP 1 — Prisma Schema: Add SLA Pause Fields

**File:** `backend/prisma/schema.prisma`

Add to `Request` model:

```prisma
  // SLA Pause Tracking
  slaPausedAt          DateTime?  @map("sla_paused_at") @db.Timestamp(6)
  slaPauseDurationMs   BigInt     @default(0) @map("sla_pause_duration_ms")
```

- `slaPausedAt` — set to `now()` when entering a pause-status, `null` when not paused
- `slaPauseDurationMs` — cumulative milliseconds the SLA has been paused (accumulated across multiple pause/resume cycles)

Add to `WorkflowStep` model:

```prisma
  slaPause   Boolean  @default(false) @map("sla_pause")
```

**Migration command:** `npx prisma migrate dev --name add_sla_pause_fields`

**Estimated effort:** 30 min

---

### STEP 2 — SLA Pause Service

**New file:** `backend/src/services/sla-pause.service.ts`

```typescript
/**
 * Pause the SLA timer for a request.
 * Sets slaPausedAt = now(). Idempotent — no-op if already paused.
 */
export async function pauseSla(requestId: string): Promise<void>

/**
 * Resume the SLA timer for a request.
 * Calculates pause duration, accumulates into slaPauseDurationMs,
 * extends slaDueAt by the pause duration, clears slaPausedAt.
 * Idempotent — no-op if not paused.
 */
export async function resumeSla(requestId: string): Promise<void>

/**
 * Check if a given status should pause the SLA.
 * Queries DB (WorkflowStep.slaPause), caches in Redis for 5min.
 */
export async function isPauseStatus(status: string): Promise<boolean>
```

**pauseSla() detail:**
1. Fetch request — if `slaPausedAt` is not null, return (already paused)
2. Update: `slaPausedAt = now()`
3. Create `RequestActivity`: `activityType: 'SYSTEM'`, message: `'SLA timer paused — request entered approval status'`

**resumeSla() detail:**
1. Fetch request — if `slaPausedAt` is null, return (not paused)
2. Calculate: `pauseDurationMs = now() - slaPausedAt`
3. Update: `slaPauseDurationMs += pauseDurationMs`, `slaDueAt += pauseDurationMs`, `slaPausedAt = null`
4. Create `RequestActivity`: `activityType: 'SYSTEM'`, message: `'SLA timer resumed — approval decision made (paused Xh Xm)'`

**isPauseStatus() detail:**
1. Check Redis cache: `sla:pause_status:{status}`
2. If miss, query: `SELECT 1 FROM workflow_steps WHERE status = :status AND sla_pause = true LIMIT 1`
3. Cache result for 5 minutes
4. Return boolean

**Estimated effort:** 1.5 h

---

### STEP 3 — Wire Pause/Resume into ALL Status Transition Points

Every place that calls `prisma.request.update({ data: { status: ... } })` must check for SLA pause/resume.

**Pattern:**

```typescript
import { pauseSla, resumeSla, isPauseStatus } from '../services/sla-pause.service';

// Before status change:
const wasPaused = await isPauseStatus(currentRequest.status);

// After status change:
const nowPaused = await isPauseStatus(newStatus);

if (!wasPaused && nowPaused) {
  await pauseSla(id);
} else if (wasPaused && !nowPaused) {
  await resumeSla(id);
}
```

**Files to modify (7 controllers):**

| File | Entering Pause (→ call pauseSla) | Leaving Pause (→ call resumeSla) |
|------|---------------------------------|----------------------------------|
| `approval.controller.ts` | `routeToCEO()` → PENDING_CEO_APPROVAL | `ceoDecision()` → CEO_APPROVED / CEO_REJECTED |
| `it-workflow.controller.ts` | SUBMITTED → PENDING_MANAGER_APPROVAL_IT, ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT, MANAGER_APPROVED_IT → PENDING_VP_APPROVAL_IT, VP_APPROVED_IT → PENDING_CTO_APPROVAL_IT, CTO_APPROVED_IT → PENDING_INVOICE_IT, PENDING_INVOICE_IT → PENDING_CFO_APPROVAL_IT | MANAGER_APPROVED_IT, CEO_APPROVED_IT, VP_APPROVED_IT, CTO_APPROVED_IT, CFO_APPROVED_IT |
| `finance-workflow.controller.ts` | SUBMITTED → PENDING_MANAGER_APPROVAL_FIN, MANAGER_APPROVED_FIN → PENDING_FINANCE_HEAD_APPROVAL, FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN | MANAGER_APPROVED_FIN, FINANCE_HEAD_APPROVED, CFO_APPROVED_FIN |
| `chargeback-workflow.controller.ts` | SUBMITTED → PENDING_FROM_ENTITY_APPROVAL, FROM_ENTITY_APPROVED → PENDING_TO_ENTITY_APPROVAL | FROM_ENTITY_APPROVED, TO_ENTITY_APPROVED |
| `screening.controller.ts` | HR_SCREENING → LOA_PENDING_APPROVAL | LOA_APPROVED / LOA_REJECTED |
| `request.controller.ts` | `updateStatus()` — generic handler, dynamic check | `updateStatus()` — dynamic check |
| LOA-related routes | LOA_PENDING_APPROVAL transitions | Transitions out of LOA_PENDING_APPROVAL |

**Estimated effort:** 3 h

---

### STEP 4 — Update SLA Breach Detection to Respect Pauses

**File:** `backend/src/services/sla.service.ts`

**In `checkSlaBreaches()`:**

Add to the `where` clause:

```typescript
where: {
  slaDueAt: { lte: now },
  slaPausedAt: null,  // Don't fire breach on paused tickets
  status: { notIn: [...TERMINAL_STATUSES] },
}
```

**In `checkEscalations()`:**

Same exclusion:

```typescript
where: {
  slaDueAt: { lte: now },
  slaPausedAt: null,  // Don't escalate paused tickets
  requestTypeId: { not: null },
  status: { notIn: [...TERMINAL_STATUSES] },
}
```

**Effective SLA calculation helper:**

```typescript
/**
 * Compute the effective SLA deadline, accounting for pause time.
 * If currently paused, the "remaining time" is frozen.
 */
export function getEffectiveSlaDueAt(request: {
  slaDueAt: Date;
  slaPausedAt: Date | null;
  slaPauseDurationMs: BigInt;
}): Date {
  const base = new Date(request.slaDueAt.getTime() + Number(request.slaPauseDurationMs));
  if (request.slaPausedAt) {
    const currentPauseMs = Date.now() - request.slaPausedAt.getTime();
    return new Date(base.getTime() + currentPauseMs);
  }
  return base;
}
```

**Estimated effort:** 1 h

---

### STEP 5 — Auto-Resume Stale Pauses

Edge case: an approver goes AWOL and the ticket stays paused forever.

**File:** `backend/src/services/sla.service.ts` — new function `checkStalePauses()`

**Logic:**

1. Find requests where `slaPausedAt` is not null
2. Calculate current pause duration: `now() - slaPausedAt`
3. If `totalPauseDuration > maxPauseRatio × slaHours`, auto-resume and escalate
4. Configurable via env: `SLA_MAX_PAUSE_RATIO` (default `0.5` = 50% of total SLA)
5. Log activity: `"SLA auto-resumed — approval exceeded maximum pause threshold (Xh)"`
6. Fire escalation notification to admin

**Wire into cron:**

**File:** `backend/src/jobs/sla-checker.ts`

Add `checkStalePauses()` to `runChecks()`:

```typescript
async function runChecks(): Promise<void> {
    await checkSlaBreaches().catch(...);
    await checkEscalations().catch(...);
    await checkStalePauses().catch(...);  // NEW
}
```

**Estimated effort:** 1 h

---

### STEP 6 — API: Include SLA Pause Info in Request Responses

**File:** `backend/src/controllers/request.controller.ts`

Wherever requests are returned, include `slaPausedAt` and `slaPauseDurationMs` (provided by Prisma automatically).

Add computed fields in the API response:

```typescript
slaPaused: request.slaPausedAt !== null,
effectiveSlaDueAt: getEffectiveSlaDueAt(request).toISOString(),
```

This applies to:
- `getRequest` (single request detail)
- `getAllRequests` (list view)
- Any other endpoint returning request objects

**Estimated effort:** 30 min

---

### STEP 7 — Frontend: Update SLA Indicator to Show Pause State

**File:** `frontend/src/components/request-detail/SLAIndicator.tsx`

Update props to accept `slaPausedAt` and `slaPauseDurationMs`.

**New UI states:**

| State | Condition | Visual |
|-------|-----------|--------|
| Paused | `slaPausedAt !== null` | Blue indicator: "SLA: Paused (approval pending)" with pause icon |
| Remaining | Not paused, `effectiveDueAt > now` | Green/amber: "Xd Xh remaining" (using effective due date) |
| Warning | Not paused, `< 24h` remaining | Amber: "Xh remaining" |
| Breached | Not paused, `effectiveDueAt <= now` | Red: "Xh overdue" |

Add a subtitle showing cumulative pause info: "Paused for 12h 30m during approval"

**Estimated effort:** 1.5 h

---

### STEP 8 — Frontend: My Requests List Pause Indicator

Add a visual indicator in the SLA column of the request list showing a pause icon (⏸) or blue badge when `slaPausedAt !== null`.

**Estimated effort:** 30 min

---

### STEP 9 — Admin UI: WorkflowStep slaPause Toggle

**Frontend file:** Workflow transitions / status management admin tab

Add a toggle to each WorkflowStep row: "Pause SLA during this status" with a tooltip explaining what it does.

**Backend:** Update WorkflowStep CRUD API to include `slaPause` boolean field in create/update responses.

**Estimated effort:** 1 h

---

### STEP 10 — Seed: Set Default slaPause on Existing Workflow Steps

**File:** `backend/prisma/seed.ts` (or a dedicated migration seed)

For all existing WorkflowStep records whose `status` matches `PENDING_*_APPROVAL` patterns, set `slaPause = true`.

Seed logic:

```typescript
const PAUSE_STATUS_PATTERNS = [
  'PENDING_CEO_APPROVAL',
  'PENDING_MANAGER_APPROVAL_IT',
  'PENDING_MANAGER_APPROVAL_FIN',
  'PENDING_MANAGER_REVIEW',
  'PENDING_VP_APPROVAL_IT',
  'PENDING_CTO_APPROVAL_IT',
  'PENDING_CFO_APPROVAL_IT',
  'PENDING_CFO_APPROVAL_FIN',
  'PENDING_FINANCE_HEAD_APPROVAL',
  'PENDING_FROM_ENTITY_APPROVAL',
  'PENDING_TO_ENTITY_APPROVAL',
  'LOA_PENDING_APPROVAL',
  'PENDING_INVOICE_IT',
  'PENDING_CEO_APPROVAL_IT',
];

await prisma.workflowStep.updateMany({
  where: { status: { in: PAUSE_STATUS_PATTERNS } },
  data: { slaPause: true },
});
```

**Estimated effort:** 30 min

---

### STEP 11 — Tests

**New file:** `backend/src/__tests__/sla-pause.service.test.ts`

Test cases:

| Test | Description |
|------|-------------|
| `pauseSla()` sets `slaPausedAt` | Verify field is set to current time |
| `pauseSla()` creates activity log | Activity with type SYSTEM and pause message |
| `pauseSla()` is idempotent | Calling twice does not reset `slaPausedAt` |
| `resumeSla()` accumulates `slaPauseDurationMs` | Duration is added, not replaced |
| `resumeSla()` extends `slaDueAt` | Due date pushed forward by pause duration |
| `resumeSla()` clears `slaPausedAt` | Field reset to null |
| `resumeSla()` creates activity log | Activity with resume message including duration |
| `resumeSla()` is idempotent | Calling when not paused is a no-op |
| `isPauseStatus()` reads from DB | Returns true for seeded pause statuses |
| `isPauseStatus()` returns false for non-pause | Returns false for IN_PROGRESS etc. |
| Breach detection skips paused | Paused request not counted in breach results |
| Escalation skips paused | Paused request not escalated |
| Stale pause auto-resume | Paused too long → auto-resume + notification |
| Multiple pause/resume cycles | Cumulative duration is correct after 2+ cycles |

**Estimated effort:** 2 h

---

## Execution Phases

| Phase | Steps | Deliverable | Risk |
|-------|-------|------------|------|
| Phase 1 | Steps 1-3 | Schema migration + SLA pause service + controller wiring | Low — additive changes, no data loss |
| Phase 2 | Steps 4-5 | Breach detection respects pauses + stale pause auto-resume | Medium — changes SLA behavior |
| Phase 3 | Steps 6-9 | API fields + frontend SLA indicator + admin toggle | Low — display layer only |
| Phase 4 | Steps 10-11 | Seed defaults + tests | Low |

---

## Rollback Safety

All changes are additive. New columns default to `null`/`0`. If code is reverted, the system operates exactly as before:

- `slaDueAt` stays unchanged
- No pause logic runs
- Extra columns are ignored by the old code

**Data migration:** Existing requests with `slaDueAt` already set are unaffected. `slaPauseDurationMs = 0` and `slaPausedAt = null` means "never been paused" — the math works out to `effectiveDueAt = slaDueAt + 0 = slaDueAt`.

---

## Total Estimated Effort

| Step | Effort |
|------|--------|
| Step 1 — Prisma schema + migration | 30 min |
| Step 2 — SLA pause service | 1.5 h |
| Step 3 — Wire into 7 controllers | 3 h |
| Step 4 — Update breach + escalation detection | 1 h |
| Step 5 — Stale pause auto-resume | 1 h |
| Step 6 — API response fields | 30 min |
| Step 7 — Frontend SLA indicator update | 1.5 h |
| Step 8 — My Requests pause indicator | 30 min |
| Step 9 — Admin UI toggle | 1 h |
| Step 10 — Seed defaults | 30 min |
| Step 11 — Tests | 2 h |
| **Total** | **~13 h** |

---

## Suggested Kickstart Sequence

1. Steps 1-3 (schema, service, controller wiring) — the backbone everything depends on
2. Steps 4-5 (breach detection + stale pause) — corrects SLA behavior
3. Steps 6-9 (API + frontend + admin) — user-facing
4. Steps 10-11 (seed + tests) — polish

---

*Generated on 2026-04-28. Addresses Risk #10 from FULL_PROJECT_AUDIT_2026-04-27.md.*