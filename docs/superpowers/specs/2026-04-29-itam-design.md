# IT Asset Management (ITAM) Module — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  
**Scope:** Full company-wide IT asset lifecycle tracking within CWC

---

## 1. Overview

CWC currently tracks hardware assets only as side-effects of procurement requests (`ITHardwareRequest`). There is no central asset registry, no assignment history, and no way to answer "what does this employee currently hold?" or "who has had this laptop over its lifetime?"

This module adds a first-class IT Asset Management domain to CWC:

- Central `Asset` registry covering hardware, peripherals, phones, network equipment, and software licenses
- Immutable `AssetAssignment` history table — full audit trail of every assignment and return
- Auto-registration from the existing procurement workflow (`HARDWARE_RECEIVED`)
- Workflow integration with onboarding (assign asset) and offboarding (return asset)
- Bulk CSV import for existing inventory
- Dedicated `/assets` page for IT agents

---

## 2. Data Model

### 2.1 New: `Asset`

Central record for a single physical or logical asset.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `assetTag` | String UNIQUE | e.g. `CIT-LT-0042` |
| `serialNumber` | String? UNIQUE | |
| `name` | String | e.g. `Dell XPS 15 9530` |
| `category` | `AssetCategory` enum | `LAPTOP \| DESKTOP \| MONITOR \| PERIPHERAL \| PHONE \| NETWORK \| SOFTWARE_LICENSE \| OTHER` |
| `brand` | String? | |
| `model` | String? | |
| `purchaseDate` | Date? | |
| `purchasePrice` | Decimal? | |
| `vendor` | String? | |
| `warrantyExpiry` | Date? | |
| `status` | `AssetStatus` enum | See §2.3 |
| `notes` | String? | |
| `sourceRequestId` | UUID? FK → Request | Procurement request that created this asset |
| `createdById` | UUID FK → User | IT agent who registered it |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### 2.2 New: `AssetAssignment`

Immutable event log — one row per assignment period.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `assetId` | UUID FK → Asset | |
| `userId` | UUID FK → User | Employee the asset is assigned to |
| `assignedById` | UUID FK → User | IT agent who performed the action |
| `assignedAt` | DateTime | When assignment started |
| `returnedAt` | DateTime? | Null = currently assigned |
| `reason` | String? | e.g. `Onboarding`, `Replacement`, `Loan` |
| `linkedRequestId` | UUID? FK → Request | Onboarding/offboarding/hardware request that triggered this |
| `notes` | String? | |

### 2.3 `AssetStatus` Enum

| Value | Meaning |
|-------|---------|
| `IN_STOCK` | In IT storage, available for assignment |
| `ASSIGNED` | Currently assigned to an employee |
| `RESERVED` | Reserved for an upcoming assignment |
| `PENDING_RETURN` | Employee has been asked to return; not yet received |
| `IN_REPAIR` | Sent out for repair/maintenance |
| `RETIRED` | Decommissioned, no longer in service |
| `LOST` | Reported lost |
| `STOLEN` | Reported stolen |
| `DISPOSED` | Written off / physically disposed |

### 2.4 `AssetCategory` Enum

`LAPTOP | DESKTOP | MONITOR | PERIPHERAL | PHONE | NETWORK | SOFTWARE_LICENSE | OTHER`

### 2.5 Changes to Existing Models

**`ITHardwareRequest`**
- Add `assetId UUID? FK → Asset` — populated when `markHardwareReceived` is called

**`OnboardingRequest`**
- `hardwareAssigned` boolean flag now also writes an `AssetAssignment` row; agent selects asset from `IN_STOCK` registry

**`OffboardingRequest`**
- `hardwareReturned` flag now closes open `AssetAssignment` rows for the departing employee; sets asset status to `IN_STOCK`

---

## 3. API

Base prefix: `/api/v1/assets`  
Auth: All endpoints require `asset:read` or `asset:write` permission (ADMIN/AGENT roles).

### 3.1 Asset CRUD

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| `GET` | `/assets` | `asset:read` | List assets — filter by `status`, `category`, `assignedTo`; search by `name`/`assetTag`/`serialNumber` |
| `POST` | `/assets` | `asset:write` | Register single asset manually |
| `POST` | `/assets/import` | `asset:import` | Bulk CSV import |
| `GET` | `/assets/:id` | `asset:read` | Asset detail + full assignment history |
| `PATCH` | `/assets/:id` | `asset:write` | Update asset fields |
| `DELETE` | `/assets/:id` | `asset:delete` | Soft-delete / mark DISPOSED |

### 3.2 Assignment Actions

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| `POST` | `/assets/:id/assign` | `asset:write` | Assign asset to user — creates `AssetAssignment`, sets status to `ASSIGNED` |
| `POST` | `/assets/:id/return` | `asset:write` | Return asset — closes `AssetAssignment`, sets status to `IN_STOCK` |
| `GET` | `/assets/by-user/:userId` | `asset:read` | All assets currently assigned to an employee — must be registered before `/:id` route in Express |

### 3.3 Workflow Integration Hooks (changes to existing controllers)

**`it-workflow.controller` → `markHardwareReceived`**
- Auto-creates `Asset` from `ITHardwareRequest` (assetTag, serialNumber, hardwareName, estimatedPrice, vendor)
- Links `assetId` back to `ITHardwareRequest`
- Default status: `IN_STOCK`
- Agent can toggle off "Register as Asset" if asset already exists

**`onboarding.controller` → `markHardwareAssigned`**
- Requires `assetId` in request body (agent picks from `IN_STOCK` assets)
- Creates `AssetAssignment` with `linkedRequestId = onboardingRequestId`
- Sets asset status to `ASSIGNED`

**`offboarding.controller` → `markHardwareReturned`**
- Shows checklist of all open `AssetAssignment` rows for the departing employee
- Closing an assignment sets `returnedAt = now()`, asset status → `IN_STOCK`
- Agent can set status to `PENDING_RETURN` before physical return is confirmed

---

## 4. UI

### 4.1 `/assets` Route

New protected route, visible to ADMIN and AGENT roles. Two tabs:

#### Tab 1: Asset Registry

- Search bar (name / asset tag / serial number)
- Filter dropdowns: Category, Status
- Actions: `+ Register Asset` button, `↑ Import CSV` button
- Table columns: Asset Tag | Name | Category | Status | Assigned To | Last Updated | Actions
- **View** action opens an asset detail drawer:
  - All fields, editable inline by IT agent
  - Assignment history timeline (assignee, dates, linked request)
  - Action buttons: Assign / Return / Change Status

#### Tab 2: Employee Assets

- Employee search (name or email)
- On selection: shows all assets currently assigned to that employee
- Each row: Asset Tag | Name | Category | Assigned Date | `[ Return ]` button
- Return action prompts for condition notes, closes `AssetAssignment`

### 4.2 Workflow UI Upgrades

**HardwareReceivedModal** (`/frontend/src/components/request-detail/`)
- Add "Register as Asset" toggle (default: on)
- Pre-fills `assetTag` and `serialNumber` from existing fields
- Agent can edit before confirming

**Onboarding "Mark Hardware Assigned" action**
- Replace boolean checkbox with an asset picker
- Searches `IN_STOCK` assets; agent selects one or more
- Selected assets shown as chips before confirming

**Offboarding "Mark Hardware Returned" action**
- Fetch open `AssetAssignment` rows for the departing employee
- Show as checklist — agent ticks off each returned item
- Option to set individual asset status: `IN_STOCK` (received) or `PENDING_RETURN` (not yet received)

---

## 5. Bulk CSV Import

### 5.1 CSV Format

```
assetTag,serialNumber,name,category,brand,model,purchaseDate,purchasePrice,vendor,warrantyExpiry,status,assignedToEmail,notes
CIT-LT-0001,SN123456,Dell XPS 15,LAPTOP,Dell,XPS 15 9530,2024-01-15,5500.00,Dell Malaysia,2027-01-15,ASSIGNED,john.tan@citadel.com,
CIT-MN-0001,,LG 27" Monitor,MONITOR,LG,27UK850,2024-01-15,800.00,LG Malaysia,,IN_STOCK,,,
```

### 5.2 Import Behaviour

- `assignedToEmail` provided + user exists → creates `AssetAssignment` (`assignedAt = purchaseDate`, flagged as `imported`)
- `assignedToEmail` provided + user not found → asset imported as `IN_STOCK`, warning returned
- Duplicate `assetTag` or `serialNumber` → row skipped with error (no silent overwrites)
- Response: `{ imported: N, warnings: N, errors: N, details: [...] }`

---

## 6. Permissions

Four new permissions, seeded into the `Permission` table:

| Permission | ADMIN | AGENT | Description |
|-----------|-------|-------|-------------|
| `asset:read` | ✅ | ✅ | View asset registry and employee assets |
| `asset:write` | ✅ | ✅ | Register, edit, assign, return assets |
| `asset:import` | ✅ | ❌ | Bulk CSV import |
| `asset:delete` | ✅ | ❌ | Dispose/soft-delete assets |

---

## 7. Out of Scope (for this iteration)

- Asset-to-asset relationships / bundles (e.g. laptop + dock + monitor as a set)
- Financial depreciation tracking
- Scheduled maintenance / service reminders
- Contract / warranty renewal workflows
- Mobile app / barcode scanning for asset check-in/out
