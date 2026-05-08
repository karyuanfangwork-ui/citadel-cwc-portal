# CWC 2.0 — IT Agent Step-by-Step Playbook

> **Daily operations guide for IT Agents**
> **Last Updated:** April 2026

---

## Scenario 1: New Hardware Request (IT_HARDWARE_PROCUREMENT — Executive Chain)

A user submitted a "Request New Hardware" request. This uses the **IT_HARDWARE_PROCUREMENT** workflow — it goes through the executive approval chain (CEO → CTO → CFO), then procurement and asset registration steps.

### Steps

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | Go to Agent Dashboard, find the new ticket (status: SUBMITTED) | SUBMITTED |
| 2 | Click **"Acknowledge & Route to CEO"** — select the CEO user, this acknowledges the ticket and routes it to the CEO for first-level approval | ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT |
| 3 | Wait for CEO approval (SLA paused, CEO notified in Approvals tab) | PENDING_CEO_APPROVAL_IT |
| 4 | CEO approves → ticket automatically routes to CTO | PENDING_CTO_APPROVAL_IT |
| 5 | CTO approves → ticket moves to you for invoice stage | PENDING_INVOICE_IT |
| 6 | Click **"Route to CFO for Approval"** — upload invoice, optionally add CFO user and notes | PENDING_CFO_APPROVAL_IT |
| 7 | CFO approves → ticket moves to payment stage | PAYMENT_PROCESSING_IT |
| 8 | Click **"Mark Payment Done"** — enter payment reference, amount paid, payment method | PAYMENT_DONE_IT → PROCUREMENT_IN_PROGRESS |
| 9 | Click **"Start Procurement"** — enter vendor name, estimated cost, PO number | PROCUREMENT_IN_PROGRESS |
| 10 | When order placed, click **"Mark Hardware Ordered"** — enter order reference, estimated delivery date | HARDWARE_ORDERED |
| 11 | When hardware arrives, click **"Mark Hardware Received"** — enter assetTag (e.g., CIT-LP-0042), serial#, toggle **"Register as Asset"** to ON | HARDWARE_RECEIVED |
| 12 | Set up software, click **"Mark Software Provisioned"** — enter software installed, provisioning notes | SOFTWARE_PROVISIONED |
| 13 | Click **"Close & Resolve"** — enter closing notes | RESOLVED |

### Important Notes

- **No manager approval step**: "Request New Hardware" uses IT_HARDWARE_PROCUREMENT, which routes directly through the executive chain. The "Submit for Manager Approval" button is **not available** for procurement request types.
- **Asset auto-creation**: When "Register as Asset" is toggled ON at step 11, the system auto-creates an Asset record in the registry with the assetTag and serialNumber. You can then assign it to the user via Asset Registry.
- **SLA pauses** during all PENDING_*_APPROVAL steps and resumes on approval decisions.
- **Approval records are auto-created**: When a ticket enters any PENDING_*_APPROVAL status (via acknowledge or status change), the system automatically creates the matching RequestApproval record. This ensures executives can always approve from the Approvals tab. If you manually change a ticket's status to a PENDING_APPROVAL status, the approval record is still created automatically — no manual step needed.

---

## Scenario 2: Software Installation Request (IT_PROCUREMENT — Executive Chain, No Procurement Steps)

A user submitted a "Request Software Installation" request. This uses the **IT_PROCUREMENT** workflow — it goes through the same executive chain (CEO → CTO → CFO) but skips the procurement/asset registration steps after payment.

### Steps

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | Go to Agent Dashboard, find the new ticket (status: SUBMITTED) | SUBMITTED |
| 2 | Click **"Acknowledge & Route to CEO"** — select the CEO user | PENDING_CEO_APPROVAL_IT |
| 3 | Wait for CEO approval | PENDING_CEO_APPROVAL_IT |
| 4 | CEO approves → ticket routes to CTO | PENDING_CTO_APPROVAL_IT |
| 5 | CTO approves → ticket moves to invoice stage | PENDING_INVOICE_IT |
| 6 | Click **"Route to CFO for Approval"** — upload invoice | PENDING_CFO_APPROVAL_IT |
| 7 | CFO approves → ticket moves to payment stage | PAYMENT_PROCESSING_IT |
| 8 | Click **"Mark Payment Done"** — enter payment details | PAYMENT_DONE_IT → PENDING_DELIVERY_IT |
| 9 | Click **"Complete Delivery"** — confirm software has been delivered/installed for the requester | RESOLVED |

### Important Notes

- **No procurement steps**: Software installation goes directly from payment to delivery — no hardware ordering, receiving, or asset registration.
- **No asset auto-creation**: This workflow does not create asset entries since there's no physical hardware.
- Both IT_HARDWARE_PROCUREMENT and IT_PROCUREMENT share the same executive approval chain (CEO → CTO → CFO). The difference is only in what happens after payment.

---

## Scenario 3: No-Approval IT Request

For request types where `requiresApproval = false` (e.g., "Get IT Help"):

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | Click **"Start Review"** | IN_REVIEW |
| 2 | Handle the request directly | — |
| 3 | Click **"Mark In Progress"** | IN_PROGRESS |
| 4 | Click **"Resolve Ticket"** | RESOLVED |

---

## Scenario 4: Managing Existing Assets

### Assigning an Asset to a User

1. Go to `/assets` → Asset Registry tab
2. Find the asset (search by name, tag, or serial number)
3. Click "View" to open the detail drawer
4. Click "Edit" → change status if needed → Save
5. Or via API: `POST /api/v1/assets/:id/assign` with `userId` and optional `reason`

### Returning an Asset from an Employee

**Option A (from Asset Registry):**
1. Go to `/assets` → find the asset → View drawer → see assignment history
2. Via API: `POST /api/v1/assets/:id/return` with `notes` and `newStatus`

**Option B (from Employee Assets tab):**
1. Go to `/assets` → Employee Assets tab
2. Search employee by name/email
3. See their active assets
4. Click "Return" on the relevant asset

### Bulk Importing Assets

1. Go to `/assets` → click "↑ Import CSV"
2. Prepare CSV with columns: assetTag, name, category, serialNumber, brand, model, purchaseDate, purchasePrice, vendor, warrantyExpiry, notes, assignedToEmail
3. Paste or upload the CSV
4. Review import results (imported count, warnings, errors)

### Disposing an Asset

1. Via API: `DELETE /api/v1/assets/:id` — this soft-deletes (sets status to DISPOSED)
2. Or via Edit in the drawer: change status to RETIRED, LOST, STOLEN, or DISPOSED

---

## Quick Decision Tree

```
New IT Request Arrives (SUBMITTED)
  │
  ├── Is this NEW_HARDWARE? (Request New Hardware)
  │     └── YES → ACKNOWLEDGE & ROUTE TO CEO (IT_HARDWARE_PROCUREMENT)
  │           │
  │           CEO approves → CTO approves → PENDING_INVOICE_IT
  │           │
  │           Agent routes to CFO → CFO approves →
  │           PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT →
  │           PROCUREMENT_IN_PROGRESS → HARDWARE_ORDERED →
  │           HARDWARE_RECEIVED (asset auto-created) →
  │           SOFTWARE_PROVISIONED → RESOLVED
  │
  ├── Is this SOFTWARE_INSTALLATION? (Request Software Installation)
  │     └── YES → ACKNOWLEDGE & ROUTE TO CEO (IT_PROCUREMENT)
  │           │
  │           CEO approves → CTO approves → PENDING_INVOICE_IT
  │           │
  │           Agent routes to CFO → CFO approves →
  │           PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT →
  │           PENDING_DELIVERY_IT → RESOLVED
  │
  └── No approval required? (e.g., Get IT Help, Email Issue)
       └── START REVIEW → IN_PROGRESS → RESOLVED
```

---

## Common Pitfalls

1. **NEW_HARDWARE ≠ SOFTWARE_INSTALLATION**: They use different workflows. NEW_HARDWARE (IT_HARDWARE_PROCUREMENT) has procurement + asset registration steps after payment. SOFTWARE_INSTALLATION (IT_PROCUREMENT) goes directly to delivery after payment. Both share the same executive approval chain (CEO → CTO → CFO).

2. **All IT approval goes through the executive chain**: "Request New Hardware" and "Request Software Installation" use the executive chain (CEO → CTO → CFO). There is no manager approval step for IT requests — non-procurement types (Get IT Help, Email Management, etc.) go directly to IN_REVIEW.

3. **Approval records are auto-created**: When a ticket enters any PENDING_*_APPROVAL status, the system automatically creates the matching RequestApproval record. This happens regardless of whether the status change was triggered by the acknowledge flow, bulk-action cascade, or a manual status update. You do NOT need to manually create approval records.

4. **SLA pauses during approvals**: The timer stops during PENDING_*_APPROVAL statuses. Don't panic if SLA appears frozen — it resumes on approval.

5. **Resubmission is for requesters only**: Only the original requester can resubmit a rejected request. The agent cannot do this on their behalf.

6. **Check for duplicate tags**: The system enforces unique assetTag and serialNumber. If you see a 409 error, check if the asset already exists.

7. **Route to CFO requires invoice**: The "Route to CFO for Approval" action expects an invoice file upload. Have the invoice ready before clicking this button.

8. **Assign before resolving**: Best practice is to assign the asset to the user (via Asset Registry) before resolving the ticket, so the handoff is documented.

9. **Mark Payment Done branches by workflow**: After CFO approves and you click "Mark Payment Done", the system checks the workflow type. For NEW_HARDWARE, it routes to PROCUREMENT_IN_PROGRESS (next step: order hardware). For SOFTWARE_INSTALLATION, it routes to PENDING_DELIVERY_IT (next step: complete delivery).

10. **Only ONE modal per action**: Each workflow action button opens exactly one dialog. If you see two overlapping dialogs that can't be clicked, this is a bug — report it to the dev team. (Previously fixed: HARDWARE_ORDERED was rendering both a config-driven and legacy modal simultaneously.)