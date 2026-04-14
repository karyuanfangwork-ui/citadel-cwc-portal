# IT Hardware Approval Chain Redesign

**Date:** 2026-04-14
**Scope:** IT Support service desk — "Request new hardware" and "Request Software Installation" request types
**Approach:** Extend existing `it-workflow.controller.ts` with new endpoints and statuses

---

## Background

The existing IT hardware workflow used a Manager → optional VP (price threshold) → Procurement → Hardware Ordered → Received → Software Provisioned → Resolved chain. This is being replaced with a formal executive approval chain: CEO → CTO → CFO, followed by Finance payment processing and IT delivery.

Other IT request types ("Get IT help", "Email management", etc.) are unaffected — they continue using the generic SUBMITTED → IN_REVIEW → IN_PROGRESS → RESOLVED flow.

---

## Affected Request Types

- `Request new hardware`
- `Request Software Installation`

Both are identified via the existing `PROCUREMENT_REQUEST_TYPES` constant in `frontend/src/utils/workflowActions.ts`.

---

## State Machine

```
SUBMITTED
  └─► ACKNOWLEDGED_IT          (IT agent acknowledges, selects CEO user)
        └─► PENDING_CEO_APPROVAL_IT
              ├─► CEO_REJECTED_IT ──► auto → REJECTED, notify requester
              └─► CEO_APPROVED_IT ──► auto → PENDING_CTO_APPROVAL_IT
                    └─► PENDING_CTO_APPROVAL_IT
                          ├─► CTO_REJECTED_IT ──► auto → REJECTED, notify requester
                          └─► CTO_APPROVED_IT ──► auto → PENDING_INVOICE_IT
                                └─► PENDING_INVOICE_IT   (IT agent selects CFO user)
                                      └─► PENDING_CFO_APPROVAL_IT
                                            ├─► CFO_REJECTED_IT ──► auto → REJECTED, notify requester
                                            └─► CFO_APPROVED_IT ──► auto → PAYMENT_PROCESSING_IT
                                                  └─► PAYMENT_PROCESSING_IT
                                                        (Finance agent fills payment ref, amount, date)
                                                        └─► PAYMENT_DONE_IT ──► auto → PENDING_DELIVERY_IT
                                                              └─► PENDING_DELIVERY_IT
                                                                    └─► RESOLVED
```

**Rejection behaviour:** Any rejection (CEO, CTO, or CFO) immediately auto-transitions to `REJECTED` and sends a notification to the requester. No resubmission path.

---

## Retired Statuses (for these 2 request types)

The following statuses are no longer used for new requests. They remain in the schema to preserve historical records:

- `PENDING_MANAGER_APPROVAL_IT`
- `MANAGER_APPROVED_IT`
- `MANAGER_REJECTED_IT`
- `PENDING_VP_APPROVAL_IT`
- `VP_APPROVED_IT`
- `VP_REJECTED_IT`
- `PROCUREMENT_IN_PROGRESS`
- `HARDWARE_ORDERED`
- `HARDWARE_RECEIVED`
- `SOFTWARE_PROVISIONED`

---

## Section 1: Prisma Schema Changes

### New `RequestStatus` enum values (14 total)

```
ACKNOWLEDGED_IT
PENDING_CEO_APPROVAL_IT
CEO_APPROVED_IT
CEO_REJECTED_IT
PENDING_CTO_APPROVAL_IT
CTO_APPROVED_IT
CTO_REJECTED_IT
PENDING_INVOICE_IT
PENDING_CFO_APPROVAL_IT
CFO_APPROVED_IT
CFO_REJECTED_IT
PAYMENT_PROCESSING_IT
PAYMENT_DONE_IT
PENDING_DELIVERY_IT
```

### Seed updates (`backend/prisma/seed.ts`)

Add CTO and CFO roles and seed users following the same pattern as the existing CEO seed:

| Role | Email | Password |
|------|-------|----------|
| `CTO` | `cto@company.com` | `cto123` |
| `CFO` | `cfo@company.com` | `cfo123` |

CEO role and user already exist in the seed.

---

## Section 2: Backend — New Endpoints

All routes added to `backend/src/routes/it-workflow.routes.ts` and handlers added to `backend/src/controllers/it-workflow.controller.ts`.

### Endpoint table

| Method | Path | Authorized Roles | From Status | To Status |
|--------|------|-----------------|-------------|-----------|
| POST | `/it-workflow/requests/:id/acknowledge` | ADMIN, AGENT | SUBMITTED | ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT |
| POST | `/it-workflow/requests/:id/ceo-decision` | CEO | PENDING_CEO_APPROVAL_IT | CEO_APPROVED_IT → PENDING_CTO_APPROVAL_IT, or CEO_REJECTED_IT → REJECTED |
| POST | `/it-workflow/requests/:id/cto-decision` | CTO | PENDING_CTO_APPROVAL_IT | CTO_APPROVED_IT → PENDING_INVOICE_IT, or CTO_REJECTED_IT → REJECTED |
| POST | `/it-workflow/requests/:id/pending-invoice` | ADMIN, AGENT | PENDING_INVOICE_IT | PENDING_CFO_APPROVAL_IT |
| POST | `/it-workflow/requests/:id/cfo-decision` | CFO | PENDING_CFO_APPROVAL_IT | CFO_APPROVED_IT → PAYMENT_PROCESSING_IT, or CFO_REJECTED_IT → REJECTED |
| POST | `/it-workflow/requests/:id/payment-done` | ADMIN, AGENT (Finance agents — no separate Finance role exists) | PAYMENT_PROCESSING_IT | PAYMENT_DONE_IT → PENDING_DELIVERY_IT |
| POST | `/it-workflow/requests/:id/complete-delivery` | ADMIN, AGENT | PENDING_DELIVERY_IT | RESOLVED |

### Request bodies

**`acknowledge`**
```json
{ "ceoId": "uuid", "notes": "optional string" }
```

**`ceo-decision` / `cto-decision` / `cfo-decision`**
```json
{ "decision": "APPROVED | REJECTED", "comments": "optional string" }
```

**`pending-invoice`**
```json
{ "cfoId": "uuid", "notes": "optional string" }
```

**`payment-done`**
```json
{ "paymentReference": "string", "amount": "number", "paymentDate": "ISO date string", "notes": "optional string" }
```

**`complete-delivery`**
```json
{ "notes": "optional string" }
```

### Approval records

Each approver selection (`acknowledge` selecting CEO, `pending-invoice` selecting CFO) creates a `RequestApproval` record with the appropriate `approverType` (`CEO`, `CTO`, `CFO`) and `status: PENDING`. Decisions update the record to `APPROVED` or `REJECTED`.

### Activity log entries

Every transition creates a `RequestActivity` record with `activityType: 'APPROVAL'` or `'REJECTION'`, recording the actor name and role.

### Notifications

- On rejection: notify requester via existing `notify()` service
- On approval routing to next approver: notify the next approver
- On `PAYMENT_DONE_IT`: notify IT agent team
- On `RESOLVED`: notify requester

### `backend/src/utils/workflowTransitions.ts`

Add all 14 new statuses and their valid transitions to the `VALID_TRANSITIONS` map.

---

## Section 3: Frontend Changes

### 3a. `frontend/types.ts`

Add all 14 new `RequestStatus` enum values.

### 3b. `frontend/constants.tsx`

Add display metadata for each new status:

| Status | Label | Color |
|--------|-------|-------|
| ACKNOWLEDGED_IT | Acknowledged | blue |
| PENDING_CEO_APPROVAL_IT | Pending CEO Approval | amber |
| CEO_APPROVED_IT | CEO Approved | green |
| CEO_REJECTED_IT | CEO Rejected | red |
| PENDING_CTO_APPROVAL_IT | Pending CTO Approval | amber |
| CTO_APPROVED_IT | CTO Approved | green |
| CTO_REJECTED_IT | CTO Rejected | red |
| PENDING_INVOICE_IT | Pending Invoice | purple |
| PENDING_CFO_APPROVAL_IT | Pending CFO Approval | amber |
| CFO_APPROVED_IT | CFO Approved | green |
| CFO_REJECTED_IT | CFO Rejected | red |
| PAYMENT_PROCESSING_IT | Payment Processing | blue |
| PAYMENT_DONE_IT | Payment Done | green |
| PENDING_DELIVERY_IT | Pending Delivery | purple |

### 3c. `frontend/src/utils/workflowTransitions.ts`

Add all 14 new statuses to the frontend `VALID_TRANSITIONS` map, mirroring the backend.

### 3d. `frontend/src/utils/workflowActions.ts`

Update `PROCUREMENT_REQUEST_TYPES` to ensure both affected request types are included.

Add new `WorkflowActionType` values:
```
ACKNOWLEDGE_IT
CEO_DECISION
CTO_DECISION
PENDING_INVOICE
CFO_DECISION
PAYMENT_DONE
COMPLETE_DELIVERY
```

Add action rules in `getWorkflowActions()`:

| Status | Role | Action shown |
|--------|------|-------------|
| SUBMITTED (procurement type) | ADMIN, AGENT | ACKNOWLEDGE_IT |
| PENDING_CEO_APPROVAL_IT | CEO | CEO_DECISION |
| PENDING_CTO_APPROVAL_IT | CTO | CTO_DECISION |
| PENDING_INVOICE_IT | ADMIN, AGENT | PENDING_INVOICE |
| PENDING_CFO_APPROVAL_IT | CFO | CFO_DECISION |
| PAYMENT_PROCESSING_IT | ADMIN, AGENT | PAYMENT_DONE |
| PENDING_DELIVERY_IT | ADMIN, AGENT | COMPLETE_DELIVERY |

### 3e. `frontend/src/utils/roleDetection.ts`

Add `isCEO`, `isCTO`, `isCFO` helper functions alongside existing `isAdmin`, `isAgent`.

### 3f. New modal components (`frontend/src/components/request-detail/`)

| File | Purpose |
|------|---------|
| `AcknowledgeModal.tsx` | Agent selects CEO from dropdown (users filtered by CEO role), optional notes |
| `CeoDecisionModal.tsx` | CEO inputs APPROVED/REJECTED + optional comments |
| `CtoDecisionModal.tsx` | CTO inputs APPROVED/REJECTED + optional comments |
| `PendingInvoiceModal.tsx` | Agent selects CFO from dropdown (users filtered by CFO role), optional notes |
| `CfoDecisionModal.tsx` | CFO inputs APPROVED/REJECTED + optional comments |
| `PaymentDoneModal.tsx` | Finance agent fills payment reference (string), amount (number), payment date, optional notes |

All modals follow the same pattern as existing `SubmitForApprovalModal.tsx` and `VpApprovalModal.tsx`.

### 3g. `frontend/src/services/it-workflow.service.ts`

Add 7 new service methods:
- `acknowledgeRequest(requestId, ceoId, notes?)`
- `ceoDecision(requestId, decision, comments?)`
- `ctoDecision(requestId, decision, comments?)`
- `pendingInvoice(requestId, cfoId, notes?)`
- `cfoDecision(requestId, decision, comments?)`
- `paymentDone(requestId, data: { paymentReference, amount, paymentDate, notes? })`
- `completeDelivery(requestId, notes?)`

### 3h. `frontend/pages/RequestDetail.tsx`

Wire up all 6 new modals into the existing "Next Action Required" sidebar panel. Follow the existing modal state + handler pattern (e.g. `showAcknowledgeModal`, `handleAcknowledge`). Update the progress stepper for procurement request types to show the new 9-stage chain:

`Submitted → Acknowledged → CEO Approval → CTO Approval → Pending Invoice → CFO Approval → Payment → Pending Delivery → Resolved`

### 3i. User lookup by role

The `AcknowledgeModal` (pick CEO) and `PendingInvoiceModal` (pick CFO) need to fetch users filtered by role. Add `GET /api/v1/users?role=CEO` and `GET /api/v1/users?role=CFO` support to the backend users endpoint if not already present, and add a corresponding frontend service method.

---

## Out of Scope

- Resubmission path after rejection (no resubmit for this workflow)
- Editing request details after submission
- Changes to other IT request types ("Get IT help", "Email management", etc.)
- Changes to HR or Finance workflows
