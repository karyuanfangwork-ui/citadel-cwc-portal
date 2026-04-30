# CWC 2.0 — IT Hardware Request Workflow Reference

> **Quick-reference card for IT Agents**
> **Last Updated:** April 2026

---

## Status Flow Diagram

### Executive Approval Path (all procurement requests)

All IT hardware and software procurement requests go through the executive chain:

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
  │  ┌── Hardware: PROCUREMENT_IN_PROGRESS
  │  └── Software: PENDING_DELIVERY_IT
  ▼ (hardware path continues below)
PROCUREMENT_IN_PROGRESS
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

### No-Approval Path

```
SUBMITTED ──► IN_REVIEW ──► [Agent handles directly] ──► RESOLVED
```
(For non-procurement IT request types where `requiresApproval = false` — e.g., Get IT Help, Email Management, Report System Problem)

---

## API Endpoints

| Method | Endpoint | Role | Action |
|--------|----------|------|--------|
| POST | `/it-workflow/requests/:id/acknowledge` | ADMIN/AGENT | Route to CEO |
| POST | `/it-workflow/requests/:id/ceo-decision` | CEO | CEO approve/reject |
| POST | `/it-workflow/requests/:id/cto-decision` | CTO | CTO approve/reject |
| POST | `/it-workflow/requests/:id/route-to-cfo` | ADMIN/AGENT | Upload invoice, route to CFO |
| POST | `/it-workflow/requests/:id/cfo-decision` | CFO | CFO approve/reject |
| POST | `/it-workflow/requests/:id/payment-done` | ADMIN/AGENT | Payment completed |
| POST | `/it-workflow/requests/:id/complete-delivery` | ADMIN/AGENT | Delivery confirmed (software) |
| POST | `/it-workflow/requests/:id/mark-procurement` | ADMIN/AGENT | Start procurement |
| POST | `/it-workflow/requests/:id/mark-hardware-ordered` | ADMIN/AGENT | Mark ordered (order#, vendor, tracking#) |
| POST | `/it-workflow/requests/:id/mark-hardware-received` | ADMIN/AGENT | Mark received (assetTag, serial#, registerAsAsset) |
| POST | `/it-workflow/requests/:id/mark-software-provisioned` | ADMIN/AGENT | Software setup done |
| POST | `/it-workflow/requests/:id/mark-fulfilled` | ADMIN/AGENT | Close/resolve request |

---

## Status Transition Rules

| From Status | To Status | Trigger | Who |
|-------------|-----------|---------|-----|
| SUBMITTED | PENDING_CEO_APPROVAL_IT | Acknowledge & route | ADMIN/AGENT |
| SUBMITTED | IN_REVIEW | Auto (no approval needed) | System |
| PENDING_CEO_APPROVAL_IT | PENDING_CTO_APPROVAL_IT | CEO approves | CEO |
| PENDING_CEO_APPROVAL_IT | CEO_REJECTED_IT | CEO rejects | CEO |
| PENDING_CTO_APPROVAL_IT | PENDING_INVOICE_IT | CTO approves | CTO |
| PENDING_CTO_APPROVAL_IT | CTO_REJECTED_IT | CTO rejects | CTO |
| PENDING_INVOICE_IT | PENDING_CFO_APPROVAL_IT | Route to CFO | ADMIN/AGENT |
| PENDING_CFO_APPROVAL_IT | PAYMENT_PROCESSING_IT | CFO approves | CFO |
| PENDING_CFO_APPROVAL_IT | CFO_REJECTED_IT | CFO rejects | CFO |
| PAYMENT_PROCESSING_IT | PAYMENT_DONE_IT | Payment done | ADMIN/AGENT |
| PAYMENT_DONE_IT | PENDING_DELIVERY_IT | Complete delivery (software) | ADMIN/AGENT |
| PAYMENT_DONE_IT | PROCUREMENT_IN_PROGRESS | Payment done (hardware) | ADMIN/AGENT |
| PROCUREMENT_IN_PROGRESS | HARDWARE_ORDERED | Mark ordered | ADMIN/AGENT |
| HARDWARE_ORDERED | HARDWARE_RECEIVED | Mark received | ADMIN/AGENT |
| HARDWARE_RECEIVED | SOFTWARE_PROVISIONED | Mark provisioned | ADMIN/AGENT |
| SOFTWARE_PROVISIONED | RESOLVED | Mark fulfilled | ADMIN/AGENT |

---

## Key Status Validations

| Status | Required Previous Status | Required Fields in Request Body |
|--------|--------------------------|--------------------------------|
| PENDING_CEO_APPROVAL_IT | SUBMITTED | `ceoId` (UUID) |
| PENDING_CTO_APPROVAL_IT | PENDING_CEO_APPROVAL_IT | `decision`: "APPROVED" |
| PENDING_INVOICE_IT (via route-to-cfo) | PENDING_CTO_APPROVAL_IT | invoice file upload, optional `cfoId`, `notes` |
| PROCUREMENT_IN_PROGRESS | (no status check in controller) | `orderNumber?`, `vendor?`, `estimatedDelivery?` |
| HARDWARE_ORDERED | PROCUREMENT_IN_PROGRESS | `orderNumber?`, `vendor?`, `trackingNumber?` |
| HARDWARE_RECEIVED | HARDWARE_ORDERED | `receivedDate?`, `notes?`, `assetTag?`, `serialNumber?`, `registerAsAsset?` |
| SOFTWARE_PROVISIONED | HARDWARE_RECEIVED | `provisioningNotes?`, `softwareInstalled?` |
| RESOLVED (fulfilled) | SOFTWARE_PROVISIONED | `notes?` |

---

## SLA Pause / Resume

**Paused (timer stops):**
- PENDING_CEO_APPROVAL_IT
- PENDING_CTO_APPROVAL_IT
- PENDING_CFO_APPROVAL_IT

**Resumed (timer resumes):**
- All active processing statuses (PROCUREMENT_IN_PROGRESS, HARDWARE_ORDERED, etc.)