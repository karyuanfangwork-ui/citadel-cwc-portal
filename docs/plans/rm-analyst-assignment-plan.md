# Implementation Plan: RM & Analyst Assignment on Credit Application Detail

**Date:** 2026-06-01  
**Status:** DRAFT — Pending Approval  
**Author:** Hermes Agent  

---

## Problem Statement

The Credit Application detail page (`CreditApplicationDetail.tsx`) displays RM and Analyst as **read-only info chips** showing "—" when unassigned. There is no UI to:

1. Assign an RM or Analyst to a DRAFT application
2. Change an existing assignment
3. See SOD implications (can't approve your own app)

When an application is created via the UI, the backend auto-assigns the creator as RM (`effectiveRmId = data.assignedRmId ?? actorId`), but seeded apps or API-created apps may have null RM. The approval SOD check blocks the RM from approving their own application (`if (application.assignedRmId === actorId)` → 403), so correct RM assignment is critical for the approval workflow.

---

## Discovery Summary

### Backend (ready)

- `PATCH /api/v1/credit/applications/:id` supports `assignedRmId` and `assignedAnalystId` fields (DRAFT-only)
- `GET /api/v1/users?role=CREDIT_RM` returns users filtered by role — **currently single-role only** (see Phase 2A backend fix)
- `GET /api/v1/users/search?q=` provides typeahead user search
- SOD check in `approvalAction.service.ts` blocks RM from approving own app

### Frontend (gaps)

- `CreditApplicationDetail.tsx` line 485-486: RM/Analyst chips are read-only, no edit/assign button
- `creditUtils.ts` line 479: `assignedRmId` smart-default computed but never used
- `CreditApplication` interface already has `rm?: CreditUserRef`, `analyst?: CreditUserRef`, `rmId`, `analystId`
- `updateApplication()` service method exists and calls `PATCH /credit/applications/:id`
- No `UserSelect` or `AssignUser` component exists for credit — but `ParticipantsSection.tsx` has a reusable user search pattern (debounced `/users/search?q=`)

### Seeded users with credit roles

| Email | Name | Role | Notes |
|---|---|---|---|
| `john.doe@test.local` | John Doe | CREDIT_RM | Only credit user in seed |
| `admin@test.local` | Fang Kar Yuan | ADMIN | Has all credit perms incl. `credit:approve` |
| _(none)_ | — | CREDIT_MANAGER | **Missing** |
| _(none)_ | — | CREDIT_SENIOR | **Missing** |
| _(none)_ | — | CREDIT_ANALYST | **Missing** |

### Current application state

- Application `a28251c6-63dc-4737-b7af-4e42b1aa7bc2` has `rmId: null`, `analystId: null`
- S7 (Decision) is incomplete — requires `decisionedAt` via approval workflow
- Approval can only happen after DRAFT → SUBMITTED → UNDERWRITING/CREDIT_ASSESSMENT/COMMITTEE_REVIEW

---

## Implementation Plan

### Phase 1: Assign RM via API (Immediate Fix)

**Goal:** Unblock the current application for approval testing.

**Steps:**
1. `PATCH /api/v1/credit/applications/{id}` with `{ assignedRmId: "<john.doe-user-id>", assignedAnalystId: "<admin-user-id>" }`
2. Verify the chip updates on the detail page after reload

**Effort:** 2 minutes  
**Files:** None (API call only)

---

### Phase 2: RM/Analyst Assignment UI

#### 2A. Backend: Support multi-role filtering on `GET /users`

**File:** `backend/src/controllers/user.controller.ts` (line ~231)

The current `role` query param uses `equals` — a single string. Change to accept a comma-separated `roles` param and use `in`:

```ts
// Before
if (role) {
  where.roles = { some: { role: { name: { equals: role as string, mode: 'insensitive' } } } };
}

// After
const roleParam = (req.query.roles || req.query.role) as string | undefined;
if (roleParam) {
  const roleList = roleParam.split(',').map(r => r.trim());
  where.roles = { some: { role: { name: { in: roleList } } } };
}
```

This stays backward-compatible: `?role=CREDIT_RM` still works; `?roles=CREDIT_RM,CREDIT_MANAGER,ADMIN` now also works.

**Effort:** 5 minutes

#### 2B. Create `UserAssignChip` component

**File:** `frontend/src/components/credit/UserAssignChip.tsx` (NEW)

A reusable inline-editable chip that:

- Displays current assignee name + role label (e.g., "John Doe · RM")
- Shows "—" + pencil icon when unassigned
- On click → opens a search dropdown with debounced user search (`GET /users/search?q=`) filtered by configurable role (`GET /users?role=CREDIT_RM`)
- On selection → calls `PATCH /credit/applications/:id` with new `assignedRmId`/`assignedAnalystId`
- Shows the saved value with a checkmark
- **Disabled when application state is not DRAFT** (assignment only editable in DRAFT)
- Tooltip on RM chip: "RM cannot approve their own application (SOD)"
- Reuses the user search pattern from `ParticipantsSection.tsx`

**Props:**

```ts
interface UserAssignChipProps {
  label: 'RM' | 'Analyst';
  value: CreditUserRef | null;
  applicationId: string;
  field: 'assignedRmId' | 'assignedAnalystId';
  roleFilters?: string[];        // e.g., ['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']
  disabled?: boolean;            // true when state !== 'DRAFT'
  onUpdated: (app: CreditApplication) => void;
}
```

**Effort:** 60 minutes

#### 2C. Replace static info chips in CreditApplicationDetail.tsx

**File:** `frontend/pages/CreditApplicationDetail.tsx`

Change lines 485-486 from:

```tsx
{ label: 'RM', value: app.rm ? `${app.rm.firstName} ${app.rm.lastName}` : '—', icon: 'person' },
{ label: 'Analyst', value: app.analyst ? `${app.analyst.firstName} ${app.analyst.lastName}` : '—', icon: 'analytics' },
```

To:

```tsx
<UserAssignChip label="RM" value={app.rm} applicationId={app.id} field="assignedRmId" roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']} disabled={app.state !== 'DRAFT'} onUpdated={setApp} />
<UserAssignChip label="Analyst" value={app.analyst} applicationId={app.id} field="assignedAnalystId" roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']} disabled={app.state !== 'DRAFT'} onUpdated={setApp} />
```

Keep other chips (Amount, Approved, Tenor, Currency, Risk) as static read-only.

**Effort:** 15 minutes

#### 2D. Auto-assign RM on application creation

**File:** `frontend/pages/CreditApplicationList.tsx` (line ~146)

Inject `assignedRmId` from `getSmartDefaults()` if the current user has CREDIT_RM role:

```ts
const { assignedRmId } = getSmartDefaults({ currentUser, productType: form.productType, borrower: selectedBorrower });
if (assignedRmId) payload.assignedRmId = assignedRmId;
```

This ensures new applications created through the UI always have an RM assigned.

**Effort:** 10 minutes

---

### Phase 3: Seed Data — Add Credit Role Users

**File:** `backend/prisma/seed.ts`

Add seed entries for:

| Email | Name | Role | Purpose |
|---|---|---|---|
| `credit.manager@test.local` | Sarah Tan | CREDIT_MANAGER | Can approve BBB-rated apps up to RM500k |
| `credit.analyst@test.local` | Rajesh Kumar | CREDIT_ANALYST | Can score/spread/analyze apps |
| `credit.senior@test.local` | Lim Wei | CREDIT_SENIOR | Can approve higher-value / lower-rated apps |

Password: `abc@123` (same as all seed accounts)

This gives the assignment dropdown real users to pick from and ensures the approval matrix has eligible approvers.

**Effort:** 10 minutes

---

### Phase 4: UX Enhancements (Nice-to-have)

#### 4A. SOD Warning Banner

**File:** `frontend/src/components/credit/ApprovalChainPanel.tsx`

When the logged-in user IS the assigned RM, show a warning banner:

> "You are the assigned Relationship Manager for this application. Due to Segregation of Duties, you cannot approve this application. Another authorized approver must submit the decision."

**Effort:** 15 minutes

#### 4B. Assignment History in Audit Trail

**File:** `backend/src/credit/services/creditApplication.service.ts`

When `assignedRmId` or `assignedAnalystId` changes, include old and new values in the audit event metadata:

```ts
if ('assignedRmId' in data) {
  auditMeta.previousRmId = existing.assignedRmId;
  auditMeta.newRmId = data.assignedRmId;
}
```

**Effort:** 10 minutes

#### 4C. Notification to Assigned RM

When `assignedRmId` is set or changed, trigger a notification to the new RM (reusing the existing notification infra/SSE channel).

**Effort:** 30 minutes (depends on notification infra)

---

## Execution Order

| Step | Phase | Task | Effort |
|---|---|---|---|
| 1 | Phase 1 | Assign RM/Analyst on current app via API | 2 min |
| 2 | Phase 3 | Add seed users with credit roles | 10 min |
| 3 | Phase 2A | Backend: multi-role filter on `GET /users` | 5 min |
| 4 | Phase 2B | Build `UserAssignChip` component | 60 min |
| 5 | Phase 2C | Wire into `CreditApplicationDetail.tsx` | 15 min |
| 6 | Phase 2D | Auto-assign RM on creation | 10 min |
| 7 | Phase 4A | SOD warning banner | 15 min |
| 8 | Phase 4B | Audit trail enhancement | 10 min |
| 9 | Phase 4C | RM notification | 30 min |

**Total estimated effort:** ~2.5 hours

---

## Files to Create/Modify

| File | Action | Phase |
|---|---|---|
| `backend/prisma/seed.ts` | Add 3 credit role users | Phase 3 |
| `backend/src/controllers/user.controller.ts` | Support `?roles=A,B,C` multi-role filter | Phase 2A |
| `frontend/src/components/credit/UserAssignChip.tsx` | **CREATE** — Inline editable user assignment chip | Phase 2B |
| `frontend/pages/CreditApplicationDetail.tsx` | Replace static RM/Analyst chips with UserAssignChip | Phase 2C |
| `frontend/pages/CreditApplicationList.tsx` | Inject assignedRmId from smart defaults on creation | Phase 2D |
| `frontend/src/components/credit/ApprovalChainPanel.tsx` | SOD warning banner | Phase 4A |
| `backend/src/credit/services/creditApplication.service.ts` | Audit event metadata for RM/Analyst changes | Phase 4B |

---

## Related Bugs Already Fixed (This Session)

1. **Backend `getApplication` missing related records** — Added `retailIncome`, `bureauChecklist`, `scoreRuns`, `bureauChecks` to Prisma include + flattened `riskRating` from latest score run. Fixed S3/S4/S5 showing incomplete.
2. **Frontend `fetchFacilities` only loaded on Facilities tab** — Changed to load on mount. Fixed S1 showing incomplete.
3. **Facility purpose seeded as "a1"** — Updated via API to meaningful text.

## Related Bugs (Not Yet Fixed)

1. **"Unnamed Borrower" flash** — Race condition on tab navigation; borrower name briefly shows "Unnamed Borrower" before data loads.
2. **Scorecard factors default to 50** — No financial statement upload mechanism for retail borrowers. DSR stress test shows "No DSCR data available".