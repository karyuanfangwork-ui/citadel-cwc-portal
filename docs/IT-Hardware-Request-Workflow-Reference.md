# CWC 2.0 — IT Hardware Request Workflow Reference

> **Quick-reference card for IT Agents**
> **Last Updated:** April 2026

---

## Status Flow Diagram

### Standard Path (price < $2,500)

```
SUBMITTED
  │
  ▼ submitForApproval()
PENDING_MANAGER_APPROVAL_IT    ◄── SLA PAUSED
  │
  ├── reject ──► MANAGER_REJECTED_IT ──► resubmit (by requester) ──► loops back
  │
  └── approve
       │
       ├── price < threshold ──► MANAGER_APPROVED_IT    ◄── SLA RESUMED
       │
       └── price >= threshold ──► PENDING_VP_APPROVAL_IT ◄── SLA PAUSED
                                        │
                                        ├── vpDecision(REJECTED) ──► VP_REJECTED_IT
                                        └── vpDecision(APPROVED) ──► MANAGER_APPROVED_IT

MANAGER_APPROVED_IT
  │
  ▼ markProcurement()
PROCUREMENT_IN_PROGRESS
  │
  ▼ markHardwareOrdered()
HARDWARE_ORDERED
  │
  ▼ markHardwareReceived()  ◄── Auto-creates Asset if assetTag provided
HARDWARE_RECEIVED
  │
  ▼ markSoftwareProvisioned()
SOFTWARE_PROVISIONED
  │
  ▼ markFulfilled()
RESOLVED
```

### Executive Approval Path (high-value)

```
SUBMITTED
  │
  ▼ acknowledgeRequest()
PENDING_CEO_APPROVAL_IT         ◄── SLA PAUSED
  │
  ├── reject ──► CEO_REJECTED_IT
  │
  ▼ ceoDecision(APPROVED)
PENDING_CTO_APPROVAL_IT         ◄── SLA PAUSED
  │
  ├── reject ──► CTO_REJECTED_IT
  │
  ▼ ctoDecision(APPROVED)
PENDING_INVOICE_IT              ◄── Agent uploads invoice
  │
  ▼ routeToCfoApproval()
PENDING_CFO_APPROVAL_IT         ◄── SLA PAUSED
  │
  ├── reject ──► CFO_REJECTED_IT
  │
  ▼ cfoDecision(APPROVED)
PAYMENT_PROCESSING_IT
  │
  ▼ markPaymentDone()
PAYMENT_DONE_IT
  │
  ▼ completeDelivery()
PENDING_DELIVERY_IT ──► ... → HARDWARE_RECEIVED → SOFTWARE_PROVISIONED → RESOLVED
```

### No-Approval Path

```
SUBMITTED ──► IN_REVIEW ──► [Agent handles directly] ──► RESOLVED
```
(When request type has `requiresApproval = false`)

---

## API Endpoints

| Method | Endpoint | Role | Action |
|--------|----------|------|--------|
| POST | `/it-workflow/requests/:id/submit-for-approval` | ADMIN/AGENT | Submit request to manager |
| POST | `/it-workflow/requests/:id/manager-decision` | Manager | Approve/reject (auto-escalates if >= threshold) |
| POST | `/it-workflow/requests/:id/vp-decision` | ADMIN | VP approve/reject |
| POST | `/it-workflow/requests/:id/resubmit` | Requester | Resubmit after rejection |
| POST | `/it-workflow/requests/:id/mark-procurement` | ADMIN/AGENT | Start procurement |
| POST | `/it-workflow/requests/:id/mark-hardware-ordered` | ADMIN/AGENT | Mark ordered (order#, vendor, tracking#) |
| POST | `/it-workflow/requests/:id/mark-hardware-received` | ADMIN/AGENT | Mark received (assetTag, serial#, registerAsAsset) |
| POST | `/it-workflow/requests/:id/mark-software-provisioned` | ADMIN/AGENT | Software setup done |
| POST | `/it-workflow/requests/:id/mark-fulfilled` | ADMIN/AGENT | Close/resolve request |
| POST | `/it-workflow/requests/:id/acknowledge` | ADMIN/AGENT | Route to CEO |
| POST | `/it-workflow/requests/:id/ceo-decision` | CEO | CEO approve/reject |
| POST | `/it-workflow/requests/:id/cto-decision` | CTO | CTO approve/reject |
| POST | `/it-workflow/requests/:id/route-to-cfo` | ADMIN/AGENT | Upload invoice, route to CFO |
| POST | `/it-workflow/requests/:id/cfo-decision` | CFO | CFO approve/reject |
| POST | `/it-workflow/requests/:id/payment-done` | ADMIN/AGENT | Payment completed |
| POST | `/it-workflow/requests/:id/complete-delivery` | ADMIN/AGENT | Delivery confirmed |
| GET | `/it-workflow/requests/:id/suggested-manager` | Authenticated | Get requester's manager |

---

## Status Transition Rules

| From Status | To Status | Trigger | Who |
|-------------|-----------|---------|-----|
| SUBMITTED | PENDING_MANAGER_APPROVAL_IT | Submit for approval | ADMIN/AGENT |
| SUBMITTED | PENDING_CEO_APPROVAL_IT | Acknowledge & route | ADMIN/AGENT |
| SUBMITTED | IN_REVIEW | Auto (no approval needed) | System |
| PENDING_MANAGER_APPROVAL_IT | MANAGER_APPROVED_IT | Manager approves (price < threshold) | Manager |
| PENDING_MANAGER_APPROVAL_IT | PENDING_VP_APPROVAL_IT | Manager approves (price >= threshold) | System auto |
| PENDING_MANAGER_APPROVAL_IT | MANAGER_REJECTED_IT | Manager rejects | Manager |
| MANAGER_REJECTED_IT | PENDING_MANAGER_APPROVAL_IT | Requester resubmits | Requester |
| PENDING_VP_APPROVAL_IT | MANAGER_APPROVED_IT | VP approves | ADMIN |
| PENDING_VP_APPROVAL_IT | VP_REJECTED_IT | VP rejects | ADMIN |
| MANAGER_APPROVED_IT | PROCUREMENT_IN_PROGRESS | Start procurement | ADMIN/AGENT |
| PROCUREMENT_IN_PROGRESS | HARDWARE_ORDERED | Mark ordered | ADMIN/AGENT |
| HARDWARE_ORDERED | HARDWARE_RECEIVED | Mark received | ADMIN/AGENT |
| HARDWARE_RECEIVED | SOFTWARE_PROVISIONED | Mark provisioned | ADMIN/AGENT |
| SOFTWARE_PROVISIONED | RESOLVED | Mark fulfilled | ADMIN/AGENT |
| PENDING_CEO_APPROVAL_IT | PENDING_CTO_APPROVAL_IT | CEO approves | CEO |
| PENDING_CEO_APPROVAL_IT | CEO_REJECTED_IT | CEO rejects | CEO |
| PENDING_CTO_APPROVAL_IT | PENDING_INVOICE_IT | CTO approves | CTO |
| PENDING_CTO_APPROVAL_IT | CTO_REJECTED_IT | CTO rejects | CTO |
| PENDING_INVOICE_IT | PENDING_CFO_APPROVAL_IT | Route to CFO | ADMIN/AGENT |
| PENDING_CFO_APPROVAL_IT | PAYMENT_PROCESSING_IT | CFO approves | CFO |
| PENDING_CFO_APPROVAL_IT | CFO_REJECTED_IT | CFO rejects | CFO |
| PAYMENT_PROCESSING_IT | PAYMENT_DONE_IT | Payment done | ADMIN/AGENT |
| PAYMENT_DONE_IT | PENDING_DELIVERY_IT | Complete delivery | ADMIN/AGENT |

---

## Key Status Validations

| Status | Required Previous Status | Required Fields in Request Body |
|--------|--------------------------|--------------------------------|
| PENDING_MANAGER_APPROVAL_IT | Any (SUBMITTED or resubmit) | `managerId` (UUID) |
| MANAGER_APPROVED_IT | PENDING_MANAGER_APPROVAL_IT or PENDING_VP_APPROVAL_IT | `decision`: "APPROVED" |
| MANAGER_REJECTED_IT | PENDING_MANAGER_APPROVAL_IT | `decision`: "REJECTED" |
| PROCUREMENT_IN_PROGRESS | (no status check in controller) | `orderNumber?`, `vendor?`, `estimatedDelivery?` |
| HARDWARE_ORDERED | PROCUREMENT_IN_PROGRESS | `orderNumber?`, `vendor?`, `trackingNumber?` |
| HARDWARE_RECEIVED | HARDWARE_ORDERED | `receivedDate?`, `notes?`, `assetTag?`, `serialNumber?`, `registerAsAsset?` |
| SOFTWARE_PROVISIONED | HARDWARE_RECEIVED | `provisioningNotes?`, `softwareInstalled?` |
| RESOLVED (fulfilled) | SOFTWARE_PROVISIONED | `notes?` |

---

## Decision Thresholds

| Threshold | Default Value | Env Variable |
|-----------|--------------|--------------|
| VP Approval | $2,500 | `HARDWARE_VP_APPROVAL_THRESHOLD` |

When `ITHardwareRequest.estimatedPrice >= threshold`, manager approval automatically escalates to VP.

---

## SLA Pause / Resume

**Paused (timer stops):**
- PENDING_MANAGER_APPROVAL_IT
- PENDING_VP_APPROVAL_IT
- PENDING_CEO_APPROVAL_IT
- PENDING_CTO_APPROVAL_IT
- PENDING_CFO_APPROVAL_IT
- MANAGER_REJECTED_IT (awaiting resubmit)

**Resumed (timer resumes):**
- MANAGER_APPROVED_IT
- All active processing statuses (PROCUREMENT_IN_PROGRESS, HARDWARE_ORDERED, etc.)