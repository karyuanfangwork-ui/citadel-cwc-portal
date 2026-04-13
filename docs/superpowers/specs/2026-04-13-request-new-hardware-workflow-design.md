# Request New Hardware Workflow — Full Audit & Fix Design

**Date:** 2026-04-13
**Status:** Approved for implementation
**Approach:** Incremental Layered Fix (Option A)

---

## Overview

The "Request New Hardware" workflow in CWC 2.0 is approximately 75% complete. It has a functional approval and procurement pipeline but suffers from data integrity gaps, a security vulnerability, unreachable workflow states, and several UX issues. This document describes a 4-layer fix plan to bring it to production readiness.

---

## Audit Findings

### Critical

1. **ITHardwareRequest table never populated** — The `ITHardwareRequest` database table exists in schema and migration but is never written to in backend code. Hardware-specific fields (name, model, price, vendor, URL, justification) are stored in the generic `Request.customFields` JSON blob instead of the structured table.

2. **managerDecision endpoint has no authorization** — `POST /it-workflow/requests/:id/manager-decision` has no `authenticate` or `authorize` middleware. Any authenticated user can approve or reject any hardware request.

### High

3. **Three different field naming schemas** — Seed `formConfig` uses `hw_name/hw_model/hw_reason`, `CustomFieldsPanel` expects `hardwareType/model/reason`, and `HardwareForm.tsx` uses `hardware-name` etc. Data stored under wrong keys; fields display broken in RequestDetail.

4. **Four intermediate workflow states unreachable** — `HARDWARE_ORDERED`, `HARDWARE_RECEIVED`, `SOFTWARE_PROVISIONED` are defined in the schema and `workflowTransitions.ts` but have no controller endpoints or frontend actions. The workflow jumps directly from `PROCUREMENT_IN_PROGRESS` → `RESOLVED`.

5. **Two duplicate form entry points** — `/it/hardware` (hardcoded `HardwareForm.tsx`) and `/it/{deskId}/create/{categoryId}` (dynamic `CreateRequest`) both exist with different fields, different field names, and different reference number formats.

### Medium

6. **No SLA hours set** — Hardware `RequestType` has no `slaHours` value in seed. `slaDueAt` is never calculated; the SLA indicator never displays.

7. **Manual manager selection** — No auto-suggestion from requester's org hierarchy. Agents must search all admins/managers manually.

8. **No resubmit path after rejection** — `MANAGER_REJECTED_IT` is terminal. Requesters have no way to address the rejection reason and resubmit.

### Low

9. **Missing notifications** — `markHardwareOrdered`, `markHardwareReceived`, `markSoftwareProvisioned` states generate no notifications.

10. **Wrong reference number in HardwareForm** — Shows "HW-542" but the system generates "IT-542".

11. **VP budget threshold unenforced** — HardwareForm sidebar mentions VP approval for requests >$2,500 but no logic enforces it.

---

## Target Workflow (Post-Fix)

```
SUBMITTED
  ↓ Agent: Submit for Manager Approval
PENDING_MANAGER_APPROVAL_IT
  ├─ Manager Rejects → MANAGER_REJECTED_IT
  │     ↓ Requester: Edit details + Resubmit
  │     PENDING_MANAGER_APPROVAL_IT (loop)
  │
  └─ Manager Approves
        ↓ estimatedPrice < $2,500
        MANAGER_APPROVED_IT
        ↓ estimatedPrice ≥ $2,500
        PENDING_VP_APPROVAL_IT
          ├─ VP Rejects → VP_REJECTED_IT (terminal)
          └─ VP Approves → MANAGER_APPROVED_IT

MANAGER_APPROVED_IT
  ↓ Agent: Start Procurement
PROCUREMENT_IN_PROGRESS
  ↓ Agent: Mark Hardware Ordered
HARDWARE_ORDERED
  ↓ Agent: Mark Hardware Received
HARDWARE_RECEIVED
  ↓ Agent: Mark Software Provisioned
SOFTWARE_PROVISIONED
  ↓ Agent: Close & Resolve
RESOLVED
```

---

## Layer 1 — Data Integrity

### 1A — Canonical Field Names

Unified field IDs matching `ITHardwareRequest` column names:

| Canonical ID | Label | Type | Required | Old seed ID | Old panel key |
|---|---|---|---|---|---|
| `hardwareName` | Hardware Name | text | Yes | `hw_name` | `hardwareType` |
| `hardwareModel` | Preferred Model | text | No | `hw_model` | `model` |
| `estimatedPrice` | Estimated Price | currency | No | — | — |
| `preferredVendor` | Preferred Vendor | text | No | — | — |
| `productUrl` | Product URL | text | No | — | — |
| `businessJustification` | Business Justification | textarea | Yes | `hw_reason` | `reason` |

**Files to update:**
- `backend/prisma/seed.ts` — update formConfig field IDs, add 3 missing fields
- `frontend/src/components/request-detail/CustomFieldsPanel.tsx` — update `IT_FIELD_LABELS` map
- `frontend/pages/HardwareForm.tsx` — delete (see 1D)

### 1B — Populate ITHardwareRequest on Creation

In `backend/src/controllers/request.controller.ts` `createRequest()`, after the `Request` record is created: detect hardware requests by `requestType.name` containing "hardware" (case-insensitive), then create a linked `ITHardwareRequest` record from `customFields`.

Also update `getRequestById()` to include the `itHardwareRequest` relation in its Prisma query so the frontend can display structured data.

### 1C — Backfill Migration Script

One-time script at `backend/prisma/scripts/backfill-hardware-requests.ts` to populate `ITHardwareRequest` rows for existing requests that have no linked record. Maps all three legacy field naming schemas with fallback chains (e.g., `cf.hardwareName ?? cf.hw_name ?? cf.hardwareType ?? 'Unknown'`).

Run once after deploy: `npx ts-node backend/prisma/scripts/backfill-hardware-requests.ts`

### 1D — Consolidate Form Entry Points

- Delete `frontend/pages/HardwareForm.tsx`
- Change the `/it/hardware` route in `frontend/App.tsx` to redirect to `/it` (the ITSupport category listing)
- The dynamic `CreateRequest` page becomes the sole entry point once formConfig has all 6 canonical fields

---

## Layer 2 — Security Fix

### 2A — Route-level authentication

Add `authenticate` middleware to the `managerDecision` route in `backend/src/routes/it-workflow.routes.ts`.

### 2B — Controller-level ownership check

At the start of `managerDecision()` in `backend/src/controllers/it-workflow.controller.ts`:
1. Look up the `RequestApproval` record where `requestId = id`, `approverId = req.user.id`, `status = 'PENDING'`
2. If no matching record found AND user role is not ADMIN → return 403 Forbidden
3. If found or user is ADMIN → proceed

**Files changed:** 2 files, ~15 lines. No schema changes, no migrations.

---

## Layer 3 — Workflow Completeness

### 3A — New Backend Endpoints

Three new controller actions added to `backend/src/controllers/it-workflow.controller.ts`:

**`markHardwareOrdered(requestId, { orderNumber, vendor, trackingNumber, estimatedDelivery })`**
- Transition: `PROCUREMENT_IN_PROGRESS` → `HARDWARE_ORDERED`
- Writes `orderNumber`, `trackingNumber`, `preferredVendor` to `ITHardwareRequest`
- Notifies requester: "Your hardware {ref} has been ordered. Order number: {orderNumber}"
- Logs activity entry

**`markHardwareReceived(requestId, { receivedDate, notes, assetTag? })`**
- Transition: `HARDWARE_ORDERED` → `HARDWARE_RECEIVED`
- Writes `procurementStatus = 'RECEIVED'` to `ITHardwareRequest`
- Notifies requester + assigned agent: "Your hardware has arrived and is being set up"
- Logs activity entry

**`markSoftwareProvisioned(requestId, { provisioningNotes, softwareInstalled? })`**
- Transition: `HARDWARE_RECEIVED` → `SOFTWARE_PROVISIONED`
- Writes `procurementStatus = 'PROVISIONED'` to `ITHardwareRequest`
- Notifies requester: "Your hardware {ref} is ready for pickup/delivery"
- Logs activity entry

**`markFulfilled()` — updated**
- Transition changes from `PROCUREMENT_IN_PROGRESS → RESOLVED` to `SOFTWARE_PROVISIONED → RESOLVED`
- Label in frontend changes from "Mark as Fulfilled" to "Close & Resolve"

Three new routes added to `backend/src/routes/it-workflow.routes.ts`, all with `authorize('ADMIN', 'AGENT')`.

### 3B — New Frontend Modals

Three new modal components in `frontend/src/components/request-detail/`:

**`HardwareOrderedModal.tsx`**
- Fields: Vendor Name (text), Order/PO Number (text), Tracking Number (text), Est. Delivery Date (date)
- Calls `itWorkflowService.markHardwareOrdered(requestId, data)`

**`HardwareReceivedModal.tsx`**
- Fields: Received Date (date, default today), Delivery Notes (textarea), Asset Tag (text, optional)
- Calls `itWorkflowService.markHardwareReceived(requestId, data)`

**`SoftwareProvisionedModal.tsx`**
- Fields: Provisioning Notes (textarea), Software Installed (text, optional)
- Calls `itWorkflowService.markSoftwareProvisioned(requestId, data)`

### 3C — Wire Actions

**`frontend/src/utils/workflowActions.ts`** — add 3 new action entries:
- `PROCUREMENT_IN_PROGRESS + isProcurement` → "Mark Hardware Ordered" (replaces current "Mark as Fulfilled")
- `HARDWARE_ORDERED + isProcurement` → "Mark Hardware Received"
- `HARDWARE_RECEIVED + isProcurement` → "Mark Software Provisioned"
- `SOFTWARE_PROVISIONED + isProcurement` → "Close & Resolve" (existing markFulfilled, reassigned)

**`frontend/src/components/request-detail/ActionSidebar.tsx`** — wire each new action to its modal.

**`frontend/src/services/it-workflow.service.ts`** — add 3 new API call methods.

**`frontend/types.ts`** — already has all statuses. No change needed.

**`frontend/constants.tsx`** — already has all status configs. No change needed.

---

## Layer 4 — Polish & Production Readiness

### 4A — SLA Configuration

Set `slaHours: 72` on hardware `RequestType` in `backend/prisma/seed.ts`. The existing `createRequest()` SLA calculation already handles this — no further changes needed.

### 4B — Manager Auto-Suggest

**Backend:** Add `GET /it-workflow/requests/:id/suggested-manager` endpoint. Returns the requester's direct manager if `User.managerId` is set in the schema; returns `null` otherwise.

**Frontend:** On `SubmitForApprovalModal` open, fetch suggested manager. If found, pre-select with a "Suggested" badge. Agent can override. Falls back gracefully to the existing search UI if no suggestion available.

### 4C — VP Budget Threshold

**Schema:** Add 3 new statuses to `RequestStatus` enum in `backend/prisma/schema.prisma`:
- `PENDING_VP_APPROVAL_IT`
- `VP_APPROVED_IT`
- `VP_REJECTED_IT`

New Prisma migration required.

**Config:** Add `HARDWARE_VP_APPROVAL_THRESHOLD` env var (default: `2500`) to `backend/src/config/index.ts`.

**Controller logic in `managerDecision()`:** After manager approves, check `ITHardwareRequest.estimatedPrice`:
- If `estimatedPrice >= threshold`: set status to `PENDING_VP_APPROVAL_IT`, create new `RequestApproval` record for a VP-role user, notify VP-role users
- If `estimatedPrice < threshold` or no price set: proceed to `MANAGER_APPROVED_IT` as normal

**New `vpDecision()` controller action** — mirrors `managerDecision()`. On approval: transitions `PENDING_VP_APPROVAL_IT` → `MANAGER_APPROVED_IT` directly (skips `VP_APPROVED_IT` as a visible state — it is only recorded on the `RequestApproval` record for audit trail). On rejection: transitions to `VP_REJECTED_IT` (terminal).

**Frontend:** Add `PENDING_VP_APPROVAL_IT` / `VP_APPROVED_IT` / `VP_REJECTED_IT` to `frontend/types.ts` and `constants.tsx`. Add VP approve/reject actions to `workflowActions.ts`. New `VpApprovalModal` and `VpRejectModal` components.

### 4D — Missing Notifications

Added directly inside the 3 new Layer 3 controller actions (see 3A). VP threshold notification added inside updated `managerDecision()`.

### 4E — Resubmit After Rejection (Option 1)

**`workflowTransitions.ts`:** Add `MANAGER_REJECTED_IT: ['PENDING_MANAGER_APPROVAL_IT']` transition.

**New `resubmitRequest()` controller action:**
- Only callable by the original requester (ownership check)
- Accepts updated hardware fields: `hardwareName`, `hardwareModel`, `estimatedPrice`, `preferredVendor`, `productUrl`, `businessJustification`
- Updates `ITHardwareRequest` record with new values
- Updates `Request.customFields` to stay in sync
- Resets the existing `RequestApproval` record to `PENDING` (or creates a new one)
- Transitions status: `MANAGER_REJECTED_IT` → `PENDING_MANAGER_APPROVAL_IT`
- Notifies the same manager who rejected with a note that the request was revised

**New `ResubmitModal.tsx` frontend component:**
- Pre-fills form with current `ITHardwareRequest` values
- All 6 hardware fields editable
- Optional "Resubmit Notes" field for addressing rejection reason
- Calls `itWorkflowService.resubmitRequest(requestId, updatedFields)`

**`workflowActions.ts`:** Add `MANAGER_REJECTED_IT + isRequester` → "Revise & Resubmit" action (visible to requester only, not agents).

---

## Files Changed Summary

### Backend
| File | Layer | Change Type |
|---|---|---|
| `backend/prisma/seed.ts` | 1A | Update hardware formConfig (6 canonical fields + slaHours) |
| `backend/src/controllers/request.controller.ts` | 1B | Create ITHardwareRequest on hardware request creation; include in getById |
| `backend/prisma/scripts/backfill-hardware-requests.ts` | 1C | New one-time migration script |
| `backend/src/routes/it-workflow.routes.ts` | 2A, 3A, 4B, 4C, 4E | Add authenticate, 5 new routes |
| `backend/src/controllers/it-workflow.controller.ts` | 2B, 3A, 4B, 4C, 4E | Auth check + 5 new actions |
| `backend/src/services/it-workflow.service.ts` (if exists) | 3A | Add service methods if applicable |
| `backend/src/config/index.ts` | 4C | Add HARDWARE_VP_APPROVAL_THRESHOLD env var |
| `backend/prisma/schema.prisma` | 4C | Add 3 new VP statuses to enum |
| `backend/prisma/migrations/...` | 4C | New migration for VP statuses |

### Frontend
| File | Layer | Change Type |
|---|---|---|
| `frontend/pages/HardwareForm.tsx` | 1D | Delete |
| `frontend/App.tsx` | 1D | Redirect /it/hardware → /it |
| `frontend/src/components/request-detail/CustomFieldsPanel.tsx` | 1A | Update IT_FIELD_LABELS |
| `frontend/src/components/request-detail/HardwareOrderedModal.tsx` | 3B | New component |
| `frontend/src/components/request-detail/HardwareReceivedModal.tsx` | 3B | New component |
| `frontend/src/components/request-detail/SoftwareProvisionedModal.tsx` | 3B | New component |
| `frontend/src/components/request-detail/ResubmitModal.tsx` | 4E | New component |
| `frontend/src/components/request-detail/VpApprovalModal.tsx` | 4C | New component |
| `frontend/src/components/request-detail/VpRejectModal.tsx` | 4C | New component |
| `frontend/src/components/request-detail/ActionSidebar.tsx` | 3C | Wire 4 new actions to modals |
| `frontend/src/components/request-detail/SubmitForApprovalModal.tsx` | 4B | Add manager auto-suggest |
| `frontend/src/utils/workflowActions.ts` | 3C, 4C, 4E | Add 6 new action entries |
| `frontend/src/services/it-workflow.service.ts` | 3C, 4E | Add 5 new API call methods |
| `frontend/types.ts` | 4C | Add 3 VP statuses |
| `frontend/constants.tsx` | 4C | Add VP status color configs |
