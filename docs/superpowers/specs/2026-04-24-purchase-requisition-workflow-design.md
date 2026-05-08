# Purchase Requisition Workflow Design

**Date:** 2026-04-24  
**Scope:** Finance service desk — Purchase Requisition request type  
**Status:** Approved

---

## Overview

Replace the existing stub Finance workflow with a fully implemented Purchase Requisition approval chain. Staff submit a ticket; Finance Agents review and enter a finalized amount before routing through a CEO → CFO → (conditional) Group CEO approval chain, followed by payment processing and ticket closure.

---

## Workflow State Machine

```
SUBMITTED
  └─[Finance Agent: Acknowledge]──► ACKNOWLEDGED_FIN
       └─[Finance Agent: Enter finalized amount + Route to CEO]──► PENDING_CEO_APPROVAL_FIN
            ├─[CEO: Reject]──► CEO_REJECTED_FIN (closed)
            └─[CEO: Approve]──► PENDING_CFO_APPROVAL_FIN  (auto, no manual step)
                 ├─[CFO: Reject]──► CFO_REJECTED_FIN (closed)
                 └─[CFO: Approve]──► [amount check]
                      ├─ > MYR 15,000 ──► PENDING_GROUP_CEO_APPROVAL_FIN
                      │    ├─[Group CEO: Reject]──► GROUP_CEO_REJECTED_FIN (closed)
                      │    └─[Group CEO: Approve]──► PAYMENT_PROCESSING_FIN
                      └─ ≤ MYR 15,000 ──► PAYMENT_PROCESSING_FIN
                           └─[Finance Agent: Mark payment complete]──► PAYMENT_COMPLETED_FIN
                                └─[Finance Agent: Close ticket]──► COMPLETED
```

**Rejection behaviour:** Any rejection closes the ticket outright (no re-routing back to Finance Agent).

**CEO auto-routing:** When CEO approves, the backend transitions the status to `PENDING_CFO_APPROVAL_FIN` in the same transaction — no manual Finance Agent step between CEO and CFO.

**Threshold check:** The MYR 15,000 check is enforced server-side when the CFO approves, using `request.customFields.finalizedAmount`.

---

## New RequestStatus Enum Values

Add to `schema.prisma` `RequestStatus` enum under the `// Finance Workflow` section:

```
ACKNOWLEDGED_FIN
PENDING_CEO_APPROVAL_FIN
CEO_APPROVED_FIN
CEO_REJECTED_FIN
PENDING_CFO_APPROVAL_FIN
CFO_APPROVED_FIN
CFO_REJECTED_FIN
PENDING_GROUP_CEO_APPROVAL_FIN
GROUP_CEO_APPROVED_FIN
GROUP_CEO_REJECTED_FIN
PAYMENT_PROCESSING_FIN
PAYMENT_COMPLETED_FIN
```

`COMPLETED` already exists. No new model fields — `finalizedAmount` stored in `request.customFields` (JSON).

---

## Backend API Endpoints

All under `/api/v1/finance-workflow/requests/:id/`

| Method | Path | Actor | Description |
|--------|------|-------|-------------|
| POST | `acknowledge` | Finance Agent | `SUBMITTED → ACKNOWLEDGED_FIN` |
| POST | `set-finalized-amount-and-route-ceo` | Finance Agent | Saves `finalizedAmount` to customFields, transitions `ACKNOWLEDGED_FIN → PENDING_CEO_APPROVAL_FIN` |
| POST | `ceo-decision` | CEO | `APPROVE → PENDING_CFO_APPROVAL_FIN` (auto), `REJECT → CEO_REJECTED_FIN` |
| POST | `cfo-decision` | CFO | `APPROVE` → threshold check → `PENDING_GROUP_CEO_APPROVAL_FIN` or `PAYMENT_PROCESSING_FIN`; `REJECT → CFO_REJECTED_FIN` |
| POST | `group-ceo-decision` | Group CEO | `APPROVE → PAYMENT_PROCESSING_FIN`, `REJECT → GROUP_CEO_REJECTED_FIN` |
| POST | `mark-payment-complete` | Finance Agent | `PAYMENT_PROCESSING_FIN → PAYMENT_COMPLETED_FIN` |
| POST | `close` | Finance Agent | `PAYMENT_COMPLETED_FIN → COMPLETED` |

Request body for `set-finalized-amount-and-route-ceo`: `{ finalizedAmount: number, notes?: string }`  
Request body for decision endpoints: `{ decision: 'APPROVED' | 'REJECTED', comments?: string }`

Each endpoint creates a `RequestActivity` record and calls `notify()` for the relevant stakeholder.

---

## Frontend Changes

### `finance-workflow.service.ts`
Replace existing 5 methods with 7 new methods matching the endpoints above.

### `FinanceWorkflowPanel.tsx`
Remove — this component uses `prompt()` dialogs and is not integrated with the main ActionSidebar pattern. Finance workflow actions will be handled in `ActionSidebar.tsx` via modals, consistent with IT and HR workflows.

### `workflowActions.ts`
Add `WorkflowActionType` values:
- `ACKNOWLEDGE_FIN`
- `ROUTE_TO_CEO_FIN`
- `CEO_APPROVE_FIN` / `CEO_REJECT_FIN`
- `CFO_APPROVE_FIN` / `CFO_REJECT_FIN`
- `GROUP_CEO_APPROVE_FIN` / `GROUP_CEO_REJECT_FIN`
- `MARK_PAYMENT_COMPLETE_FIN`
- `CLOSE_TICKET_FIN`

Wire into `getWorkflowActions()` with status-gated visibility, similar to the GET_IT_HELP pattern.

### `ActionSidebar.tsx`
Add inline async handlers for each Finance action type. `ROUTE_TO_CEO_FIN` requires a finalized amount input — use a modal (or inline form field) rather than `prompt()`. All other actions use confirmation modals with optional comments field.

### `RequestHeader.tsx` stepper
Add Finance Purchase Requisition step progression:
1. Submitted
2. Under Review (`ACKNOWLEDGED_FIN`)
3. Pending CEO Approval (`PENDING_CEO_APPROVAL_FIN`)
4. Pending CFO Approval (`PENDING_CFO_APPROVAL_FIN`)
5. Pending Group CEO Approval (`PENDING_GROUP_CEO_APPROVAL_FIN`) — shown only when amount > MYR 15,000
6. Payment Processing (`PAYMENT_PROCESSING_FIN`)
7. Completed (`PAYMENT_COMPLETED_FIN`, `COMPLETED`)

### `CustomFieldsPanel`
Add label entry for `finalizedAmount` → display as `MYR {value}` formatted.

---

## Role Mapping

| Role in system | Approves at |
|----------------|-------------|
| `AGENT` (Finance desk) | Acknowledge, Route to CEO, Payment, Close |
| `CEO` | CEO approval step |
| `CFO` | CFO approval step |
| `GROUP_CEO` (new role or existing admin) | Group CEO approval step |

Group CEO uses a dedicated `GROUP_CEO` role, seeded into the database alongside the existing CEO/CFO roles.

---

## Out of Scope

- Rejection re-routing (rejected tickets close outright)
- Email notifications beyond the existing `notify()` service
- Changes to other Finance request types (Expense Reimbursement, etc.)
