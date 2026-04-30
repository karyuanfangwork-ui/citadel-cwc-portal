# CWC 2.0 — IT Asset Management Guide

> **Audience:** IT Agents, System Administrators
> **Last Updated:** April 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Model](#2-data-model)
3. [IT Hardware Request Workflow](#3-it-hardware-request-workflow)
4. [Asset Registry](#4-asset-registry)
5. [How the Two Subsystems Connect](#5-how-the-two-subsystems-connect)
6. [Permissions & RBAC](#6-permissions--rbac)
7. [Asset Status Rules](#7-asset-status-rules)
8. [SLA Behavior](#8-sla-behavior)
9. [Notification Events](#9-notification-events)
10. [Configuration](#10-configuration)
11. [Frontend Components](#11-frontend-components)
12. [FAQ](#12-faq)

---

## 1. System Overview

The IT Asset Management system consists of **two integrated subsystems**:

| Subsystem | Purpose | Access |
|-----------|---------|--------|
| **IT Hardware Request Workflow** | Procurement lifecycle — from request to delivery | IT Agent actions on request tickets |
| **Asset Registry** | Standalone CRUD for managing IT assets | `/assets` page (Admin/Agent only) |

They are connected: when hardware is received in the workflow, an **Asset record is auto-created** in the registry, linking the request to the asset.

---

## 2. Data Model

### 2.1 Asset Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assetTag` | String (unique) | ✅ | Company asset tag (e.g. `CIT-LP-0001`) |
| `serialNumber` | String? (unique) | ❌ | Manufacturer serial number |
| `name` | String | ✅ | Display name (e.g. "Dell Latitude 5540") |
| `category` | Enum | ✅ | See categories below |
| `brand` | String? | ❌ | Manufacturer brand |
| `model` | String? | ❌ | Model identifier |
| `purchaseDate` | Date? | ❌ | Acquisition date |
| `purchasePrice` | Decimal? | ❌ | Cost in local currency |
| `vendor` | String? | ❌ | Supplier name |
| `warrantyExpiry` | Date? | ❌ | Warranty deadline |
| `status` | Enum | ✅ | Default: `IN_STOCK` |
| `notes` | Text? | ❌ | Free-form notes |
| `sourceRequestId` | UUID? | ❌ | Links back to IT hardware request |
| `createdById` | UUID | ✅ | Who registered the asset |

**Asset Categories:** `LAPTOP`, `DESKTOP`, `MONITOR`, `PERIPHERAL`, `PHONE`, `NETWORK`, `SOFTWARE_LICENSE`, `OTHER`

### 2.2 Asset Statuses

| Status | Meaning | How It's Set |
|--------|---------|-------------|
| `IN_STOCK` | Available in inventory | Default on create; on return with no issues |
| `ASSIGNED` | Currently checked out to someone | Auto-set on assign action |
| `RESERVED` | Held for future assignment | Manual status change |
| `PENDING_RETURN` | Return in progress | Set on return when asset needs processing |
| `IN_REPAIR` | Being serviced | Set on return or manual change |
| `RETIRED` | No longer in active use | Manual status change |
| `LOST` | Cannot be located | Manual status change |
| `STOLEN` | Reported stolen | Manual status change |
| `DISPOSED` | Permanently removed | Set by soft-delete (DELETE endpoint) |

### 2.3 AssetAssignment Fields

| Field | Type | Description |
|-------|------|-------------|
| `assetId` / `userId` / `assignedById` | UUID | What, who, who assigned |
| `assignedAt` | DateTime | When assigned |
| `returnedAt` | DateTime? | When returned (null = active) |
| `reason` | String? | Why assigned |
| `linkedRequestId` | UUID? | Links to a service request |
| `notes` | Text? | Return/assignment notes |

### 2.4 ITHardwareRequest Fields

| Field | Type | Description |
|-------|------|-------------|
| `hardwareName` / `hardwareModel` | String | What's being requested |
| `estimatedPrice` | Decimal? | Cost estimate |
| `preferredVendor` / `productUrl` | String? | Vendor preference |
| `businessJustification` | Text | Why needed |
| `managerApprovalRequired` | Boolean | Default true |
| `managerApprovedAt` / `managerApprovedById` | DateTime? / UUID? | Manager approval |
| `procurementStatus` | String? | `ORDERED`, `RECEIVED`, `PROVISIONED` |
| `orderNumber` / `trackingNumber` | String? | Procurement tracking |
| `serialNumber` / `assetTag` | String? | Captured at receipt |
| `assetId` | UUID? | Links to created Asset record |

---

## 3. IT Hardware Request Workflow

### 3.1 Standard Approval Flow (price < VP threshold)

```
SUBMITTED
  │  [Agent submits for approval]
  ▼
PENDING_MANAGER_APPROVAL_IT      ◄── SLA paused
  │
  ├── [Manager rejects] ──► MANAGER_REJECTED_IT ──► (Requester can resubmit)
  │
  └── [Manager approves]
        │
        ├── Price < $2,500 ──► MANAGER_APPROVED_IT
        │
        └── Price >= $2,500 ──► PENDING_VP_APPROVAL_IT
                                      │
                                      ├── [VP approves] ──► MANAGER_APPROVED_IT
                                      └── [VP rejects]  ──► VP_REJECTED_IT

MANAGER_APPROVED_IT
  │  [Agent starts procurement]
  ▼
PROCUREMENT_IN_PROGRESS
  │  [Agent marks ordered]
  ▼
HARDWARE_ORDERED
  │  [Agent marks received — Asset auto-created]
  ▼
HARDWARE_RECEIVED
  │  [Agent provisions software]
  ▼
SOFTWARE_PROVISIONED
  │  [Agent marks fulfilled]
  ▼
RESOLVED (ticket closed)
```

### 3.2 High-Value Executive Approval Chain

For very high-value requests, the agent can route through the executive chain:

```
SUBMITTED
  │  [Agent acknowledges & routes to CEO]
  ▼
PENDING_CEO_APPROVAL_IT          ◄── SLA paused
  │
  ├── [CEO rejects] ──► CEO_REJECTED_IT
  │
  └── [CEO approves]
        ▼
PENDING_CTO_APPROVAL_IT          ◄── SLA paused
  │
  ├── [CTO rejects] ──► CTO_REJECTED_IT
  │
  └── [CTO approves]
        ▼
PENDING_INVOICE_IT               ◄── Agent uploads invoice
  │  [Agent routes to CFO]
  ▼
PENDING_CFO_APPROVAL_IT          ◄── SLA paused
  │
  ├── [CFO rejects] ──► CFO_REJECTED_IT
  │
  └── [CFO approves]
        ▼
PAYMENT_PROCESSING_IT
  │  [Agent marks payment done]
  ▼
PAYMENT_DONE_IT
  │  [Agent completes delivery]
  ▼
PENDING_DELIVERY_IT ──► ... → HARDWARE_RECEIVED → SOFTWARE_PROVISIONED → RESOLVED
```

### 3.3 Rejection & Resubmission

When a request is rejected at any approval stage:
- The requester receives a notification
- The request sits in a rejected status (e.g. `MANAGER_REJECTED_IT`, `VP_REJECTED_IT`, etc.)
- The **original requester** can edit hardware details (name, model, price, vendor, justification) and resubmit
- Resubmission resets the approval chain

### 3.4 No-Approval Path

If the request type has `requiresApproval = false`, submitting for approval bypasses the manager step entirely:

```
SUBMITTED ──► IN_REVIEW ──► [Agent handles directly] ──► RESOLVED
```

---

## 4. Asset Registry

The standalone asset management page at `/assets` (requires `asset:read` permission; Admin/Agent only).

### 4.1 Asset Registry Tab

| Action | Description |
|--------|-------------|
| **Register Asset** | Manual creation via modal form (assetTag, name, category required) |
| **Import CSV** | Bulk import with columns: assetTag, name, category, serialNumber, brand, model, purchaseDate, purchasePrice, vendor, warrantyExpiry, notes, assignedToEmail |
| **View Asset** | Slide-out drawer with full detail + assignment history |
| **Edit Asset** | Inline editing in drawer (all fields including status) |
| **Search & Filter** | By name/tag/serial, by category, by status |
| **Assign Asset** | Assign to a user with reason and optional linked request |
| **Return Asset** | Mark returned, set new status (IN_STOCK, IN_REPAIR, PENDING_RETURN) |
| **Dispose Asset** | Soft-delete (status = DISPOSED) |

### 4.2 Employee Assets Tab

- Search employees by name or email (auto-complete)
- View all currently assigned assets for the selected employee
- Quick-return assets directly from the table with one click

### 4.3 Asset Assignment Rules

- Cannot assign an asset already in `ASSIGNED` status
- Cannot assign an asset with an existing open (returnedAt=null) assignment
- Cannot assign a `DISPOSED` asset
- On assign: status changes to `ASSIGNED` automatically
- On return: you choose the next status from `IN_STOCK`, `IN_REPAIR`, `PENDING_RETURN`

---

## 5. How the Two Subsystems Connect

The critical link point is the **"Mark Hardware Received"** step:

```
markHardwareReceived(requestId, { assetTag, serialNumber, registerAsAsset })
  │
  ├── If registerAsAsset=true AND assetTag provided:
  │     ├── Checks for duplicate assetTag/serialNumber
  │     ├── Creates Asset record (status=IN_STOCK, sourceRequestId=requestId)
  │     ├── Stores assetId on ITHardwareRequest
  │     └── Returns assetId in response
  │
  └── If registerAsAsset=false or no assetTag:
        └── Only updates procurement status, no asset created
```

After this, the agent goes to `/assets`, finds the newly-created asset, and assigns it to the end user.

The assignment record can optionally link back to the original request via `linkedRequestId`.

---

## 6. Permissions & RBAC

| Permission | Who Has It | What It Controls |
|-----------|-----------|-----------------|
| `asset:read` | ADMIN, AGENT | View asset registry + employee assets |
| `asset:write` | ADMIN, AGENT | Create, update, assign, return assets |
| `asset:import` | ADMIN, AGENT | Bulk CSV import |
| `asset:delete` | ADMIN, AGENT | Soft-delete (dispose) assets |

**IT workflow endpoints:**

| Endpoint | Role Required |
|----------|--------------|
| Submit for approval | ADMIN, AGENT |
| Mark procurement / ordered / received / provisioned / fulfilled | ADMIN, AGENT |
| VP decision | ADMIN |
| CEO decision | CEO role |
| CTO decision | CTO role |
| CFO decision | CFO role |
| Route to CFO / acknowledge | ADMIN, AGENT |
| Get suggested manager | Authenticated |
| Resubmit | Original requester only |

---

## 7. Asset Status Rules

### Valid Status Transitions on Assign

| Current Status | Can Assign? |
|---------------|------------|
| IN_STOCK | ✅ |
| RESERVED | ✅ |
| PENDING_RETURN | ✅ |
| IN_REPAIR | ✅ |
| ASSIGNED | ❌ Already assigned |
| RETIRED | ❌ Not active |
| LOST | ❌ Not available |
| STOLEN | ❌ Not available |
| DISPOSED | ❌ Permanently removed |

### Valid Status Transitions on Return

On returning an asset, the agent selects the new status. Only these are allowed:

- `IN_STOCK` — back to shelving, ready for reassignment
- `IN_REPAIR` — needs servicing before going back to stock
- `PENDING_RETURN` — return is in progress (needs processing)

---

## 8. SLA Behavior

The SLA timer **pauses** during these statuses (approval/pending states):

- `PENDING_MANAGER_APPROVAL_IT`
- `PENDING_VP_APPROVAL_IT`
- `PENDING_CEO_APPROVAL_IT`
- `PENDING_CTO_APPROVAL_IT`
- `PENDING_CFO_APPROVAL_IT`
- `MANAGER_REJECTED_IT` (while awaiting resubmit)

When the status transitions out of these (approval granted, rejection, resubmission), `resumeSla()` is called. This means the SLA clock only ticks during active work phases like `PROCUREMENT_IN_PROGRESS`, `HARDWARE_ORDERED`, etc.

---

## 9. Notification Events

| Event | Recipient | Trigger |
|-------|-----------|---------|
| `MANAGER_APPROVAL_REQUIRED` | Manager | Request submitted for approval |
| `MANAGER_APPROVED` | Requester | Manager approves |
| `MANAGER_REJECTED` | Requester | Manager rejects |
| `VP_APPROVAL_REQUIRED` | VP/Admin | High-value escalation (>= threshold) |
| `VP_APPROVED` / `VP_REJECTED` | Requester | VP decision |
| `PROCUREMENT_INITIATED` | Requester | Agent starts procurement |
| `HARDWARE_ORDERED` | Requester | Agent marks ordered |
| `HARDWARE_RECEIVED` | Requester | Agent marks received |
| `HARDWARE_DELIVERED` | Requester | Software provisioned (implies delivery) |
| `REQUEST_RESOLVED` | Requester | Request fulfilled |
| `APPROVAL_REQUIRED` (CEO) | CEO user | Executive chain routed |
| `ACTION_REQUIRED` | Assigned agent | Hardware ready for provisioning |

---

## 10. Configuration

| Setting | Default | Environment Variable | Location |
|---------|---------|---------------------|----------|
| VP Approval Threshold | $2,500 | `HARDWARE_VP_APPROVAL_THRESHOLD` | `backend/src/config/index.ts` |

When the `estimatedPrice` on an ITHardwareRequest >= this threshold, manager approval auto-escalates to VP.

---

## 11. Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AssetManagement.tsx` | `frontend/pages/` | Main page with Registry + Employee Assets tabs |
| `HardwareOrderedModal.tsx` | `frontend/src/components/request-detail/` | Modal: order#, vendor, tracking# |
| `HardwareReceivedModal.tsx` | `frontend/src/components/request-detail/` | Modal: receivedDate, assetTag, serial#, registerAsAsset toggle |
| `HardwareOrderedModal.tsx` | `frontend/src/components/request-detail/` | Modal: hardware ordered confirmation |
| `CompleteDeliveryModal.tsx` | `frontend/src/components/request-detail/` | Modal: delivery completion notes |
| `ResubmitModal.tsx` | `frontend/src/components/request-detail/` | Modal: resubmit with edited hardware details |
| `CustomFieldsPanel.tsx` | `frontend/src/components/request-detail/` | Displays hardwareName, hardwareModel as custom fields |
| `it-workflow.service.ts` | `frontend/src/services/` | All IT workflow API calls |
| `asset.service.ts` | `frontend/src/services/` | All Asset CRUD + assign/return/import API calls |

Workflow action buttons appear on the RequestDetail page based on `getWorkflowActions()` in `workflowActions.ts`, which returns available actions depending on current status, user role, and assignment.

---

## 12. FAQ

**Q: What happens if I forget to check "Register as Asset" when marking hardware received?**
A: No Asset record is created. You can manually register the asset later via `/assets` → "Register Asset" and optionally link it to the source request.

**Q: Can I assign an asset to a user outside of a request?**
A: Yes. Go to Asset Registry → View asset → Assign. The `linkedRequestId` is optional.

**Q: What if a manager rejects and the requester wants to change the hardware?**
A: The requester clicks "Resubmit" on the rejected ticket, which opens a modal to edit hardwareName, model, price, vendor, and justification. This resets the approval chain.

**Q: How do I bulk-import existing assets?**
A: Go to `/assets` → "Import CSV". Prepare a CSV with columns: assetTag, name, category, serialNumber, brand, model, purchaseDate, purchasePrice, vendor, warrantyExpiry, notes, assignedToEmail (optional — will auto-assign to that user).

**Q: What's the difference between "Dispose" and "Retire"?**
A: `RETIRED` means the asset is no longer in active use but is kept for records. `DISPOSED` is a soft-delete (triggered by the DELETE endpoint) meaning it's permanently removed from circulation.

**Q: Can an asset have multiple assignments?**
A: An asset can have a history of assignments, but only one active (returnedAt=null) assignment at a time.

**Q: Who gets notified when a high-value request is escalated?**
A: All users with the ADMIN role are notified of pending VP approval. For CEO/CTO/CFO routes, only the specifically designated executive user is notified.