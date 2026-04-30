# CWC 2.0 — IT Agent Step-by-Step Playbook

> **Daily operations guide for IT Agents**
> **Last Updated:** April 2026

---

## Scenario 1: New Hardware Request (IT Procurement — Executive Chain)

A user submitted a "Request New Hardware" request. This is the **IT_PROCUREMENT** workflow — it goes through the executive approval chain (CEO → CTO → CFO), not through manager approval.

### Steps

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | Go to Agent Dashboard, find the new ticket (status: SUBMITTED) | SUBMITTED |
| 2 | Click **"Acknowledge & Route to CEO"** — this acknowledges the ticket and routes it to the CEO for first-level approval | ACKNOWLEDGED_IT → PENDING_CEO_APPROVAL_IT |
| 3 | Wait for CEO approval (SLA paused, CEO notified in Approvals tab) | PENDING_CEO_APPROVAL_IT |
| 4 | CEO approves → ticket automatically routes to CTO | PENDING_CTO_APPROVAL_IT |
| 5 | CTO approves → ticket moves to you for invoice stage | PENDING_INVOICE_IT |
| 6 | Click **"Route to CFO for Approval"** — upload invoice, optionally add CFO user and notes | PENDING_CFO_APPROVAL_IT |
| 7 | CFO approves → ticket moves to payment stage | PAYMENT_PROCESSING_IT |
| 8 | Click **"Mark Payment Done"** — enter payment reference, amount paid, payment method | PAYMENT_DONE_IT → PENDING_DELIVERY_IT |
| 9 | Click **"Complete Delivery"** — confirm hardware delivered to requester, add delivery notes | RESOLVED |

### Important Notes

- **No manager approval step**: "Request New Hardware" uses the IT_PROCUREMENT workflow which routes directly through the executive chain. The "Submit for Manager Approval" button is **not available** for procurement request types.
- **No asset registration**: Unlike the procurement-with-assets flow, the IT_PROCUREMENT workflow does **not** auto-create asset entries. If you need to track the hardware as an asset, create it manually via `/assets`.
- **SLA pauses** during all PENDING_*_APPROVAL steps and resumes on approval decisions.

---

## Scenario 2: Non-Procurement IT Request with Manager Approval

For IT request types that require approval but are **not** procurement (e.g., access requests, software that needs sign-off):

### Steps

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | Find the new ticket (status: SUBMITTED) | SUBMITTED |
| 2 | Click **"Submit for Manager Approval"** — select the user's manager (auto-suggested) | PENDING_MANAGER_APPROVAL_IT |
| 3 | Wait for manager approval (SLA paused) | — |
| 4a | If approved: ticket moves to MANAGER_APPROVED_IT | MANAGER_APPROVED_IT |
| 4b | If rejected: ticket moves to MANAGER_REJECTED_IT — user can resubmit | MANAGER_REJECTED_IT |
| 5 | If procurement-type: click **"Start Procurement"** — enter vendor, order number, estimated delivery | PROCUREMENT_IN_PROGRESS |
| 6 | If procurement-type: follow steps 6–10 from Scenario 2a below | — |
| 5alt | If non-procurement: agent handles directly and resolves | IN_PROGRESS → RESOLVED |

### Scenario 2a: Procurement Path (after Manager Approval)

For procurement requests after manager approval (e.g., SOFTWARE_INSTALLATION):

| Step | What You Do | Status After |
|------|-------------|--------------|
| 5 | Click **"Start Procurement"** — enter vendor, order number, estimated delivery | PROCUREMENT_IN_PROGRESS |
| 6 | When order placed, click **"Mark Hardware Ordered"** — enter order#, vendor, tracking# | HARDWARE_ORDERED |
| 7 | When hardware arrives, click **"Mark Hardware Received"** — enter assetTag (e.g., CIT-LP-0042), serial#, toggle **"Register as Asset"** to ON | HARDWARE_RECEIVED |
| 8 | Set up software, click **"Mark Software Provisioned"** — enter software installed, provisioning notes | SOFTWARE_PROVISIONED |
| 9 | Click **"Close & Resolve"** — enter closing notes | RESOLVED |

**Asset auto-creation**: When "Register as Asset" is toggled ON at step 7, the system auto-creates an Asset record in the registry with the assetTag and serialNumber. You can then assign it to the user via Asset Registry.

### Scenario 2b: VP Escalation (high-value ≥ RM 2,500)

If the manager approves but the estimated value triggers auto-escalation:

| Step | What You Do | Status After |
|------|-------------|--------------|
| 3 | Manager approves, but value ≥ RM 2,500 auto-escalates to VP | PENDING_VP_APPROVAL_IT |
| 4 | VP approves → ticket moves to MANAGER_APPROVED_IT (then continue to procurement flow) | MANAGER_APPROVED_IT |

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

## Scenario 4: Request Rejected — Resubmission

Manager rejected the request.

| Step | What You Do | Status After |
|------|-------------|--------------|
| 1 | The requester (not you) opens the rejected ticket | MANAGER_REJECTED_IT |
| 2 | Requester clicks **"Revise & Resubmit"** — edits details, justification | PENDING_MANAGER_APPROVAL_IT |
| 3 | Flow continues from manager approval | — |

---

## Scenario 5: Managing Existing Assets

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
  ├── Is this a procurement request? (NEW_HARDWARE, SOFTWARE_INSTALLATION)
  │     └── YES → ACKNOWLEDGE & ROUTE TO CEO
  │           │
  │           CEO approves → CTO approves → PENDING_INVOICE_IT
  │           │                              │
  │           │                              Agent routes to CFO → CFO approves →
  │           │                              PAYMENT_PROCESSING_IT → PAYMENT_DONE_IT →
  │           │                              PENDING_DELIVERY_IT → RESOLVED
  │           │
  │           └── (No manager approval for procurement requests)
  │
  ├── Requires approval but NOT procurement? (e.g., access requests)
  │     └── SUBMIT FOR MANAGER APPROVAL
  │           │
  │           ├── Manager approves → MANAGER_APPROVED_IT
  │           │     ├── If procurement-type: START PROCUREMENT → HARDWARE_ORDERED →
  │           │     │   HARDWARE_RECEIVED (asset auto-created) → SOFTWARE_PROVISIONED → RESOLVED
  │           │     └── If non-procurement: handle directly → RESOLVED
  │           │
  │           └── Manager rejects → MANAGER_REJECTED_IT → requester can resubmit
  │
  └── No approval required? (e.g., Get IT Help, Email Issue)
        └── START REVIEW → IN_PROGRESS → RESOLVED
```

---

## Common Pitfalls

1. **Procurement ≠ Manager approval**: "Request New Hardware" goes through the executive chain (CEO → CTO → CFO), not through manager approval. The "Submit for Manager Approval" button does not appear for procurement request types.

2. **No asset auto-creation in executive chain**: The IT_PROCUREMENT workflow (CEO → CTO → CFO chain) does NOT auto-create assets. Asset registration only happens in the procurement path (MANAGER_APPROVED_IT → PROCUREMENT_IN_PROGRESS → HARDWARE_RECEIVED).

3. **SLA pauses during approvals**: The timer stops during PENDING_*_APPROVAL statuses. Don't panic if SLA appears frozen — it resumes on approval.

4. **Resubmission is for requesters only**: Only the original requester can resubmit a rejected request. The agent cannot do this on their behalf.

5. **Check for duplicate tags**: The system enforces unique assetTag and serialNumber. If you see a 409 error, check if the asset already exists.

6. **Route to CFO requires invoice**: The "Route to CFO for Approval" action expects an invoice file upload. Have the invoice ready before clicking this button.

7. **Assign before resolving**: Best practice is to assign the asset to the user (via Asset Registry) before resolving the ticket, so the handoff is documented.