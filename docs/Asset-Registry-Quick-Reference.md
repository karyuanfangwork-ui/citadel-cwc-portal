# CWC 2.0 — Asset Registry Quick Reference

> **Quick-reference card for IT Agents managing the Asset Registry**
> **Last Updated:** April 2026

---

## Access

Navigate to **`/assets`** (visible to Admin and Agent roles only; requires `asset:read` permission).

Two tabs: **Asset Registry** and **Employee Assets**.

---

## Asset Registry Tab

### Search & Filter

| Filter | Options |
|--------|---------|
| Search | Name, asset tag, or serial number |
| Category | LAPTOP, DESKTOP, MONITOR, PERIPHERAL, PHONE, NETWORK, SOFTWARE_LICENSE, OTHER |
| Status | IN_STOCK, ASSIGNED, RESERVED, PENDING_RETURN, IN_REPAIR, RETIRED, LOST, STOLEN, DISPOSED |

### Actions

| Action | Button | What It Does |
|--------|--------|-------------|
| **Register Asset** | "+ Register Asset" | Opens modal with form fields (assetTag*, name*, category* required) |
| **Import CSV** | "↑ Import CSV" | Opens bulk import modal with CSV template |
| **View** | "View" link per row | Opens slide-out drawer with full details + assignment history |
| **Edit** | "Edit" in drawer | Inline editing of all asset fields |
| **Assign** | Via drawer / API | Assign to a user — changes status to ASSIGNED |
| **Return** | Via drawer / API | Return asset — choose next status (IN_STOCK, IN_REPAIR, PENDING_RETURN) |
| **Dispose** | DELETE /api/v1/assets/:id | Soft-delete — sets status to DISPOSED |

### Register Asset Form Fields

| Field | Required | Notes |
|-------|----------|-------|
| Asset Tag | ✅ | Must be unique across all assets |
| Name | ✅ | Descriptive name |
| Category | ✅ | Dropdown enum |
| Serial Number | ❌ | Must be unique if provided |
| Brand | ❌ | |
| Model | ❌ | |
| Purchase Date | ❌ | |
| Purchase Price | ❌ | Decimal |
| Vendor | ❌ | |
| Warranty Expiry | ❌ | |
| Status | ❌ | Default: IN_STOCK |
| Notes | ❌ | Free text |
| Source Request | ❌ | Links to IT hardware request (auto-filled when created via workflow) |

---

## Employee Assets Tab

### How to Use

1. Type employee name or email in the search box (minimum 2 characters)
2. Click on a result to load their active assignments
3. View assigned assets with: asset tag, name, category, assigned date
4. Click **"Return"** to process a return (defaults status to IN_STOCK)

### API Endpoint

```
GET /api/v1/assets/by-user/:userId
```

Returns `{ user, assignments }` — active assignments only (where `returnedAt` is null).

---

## CSV Import Format

The import modal provides a template. Columns expected:

| Column | Required | Notes |
|--------|----------|-------|
| assetTag | ✅ | Must be unique |
| name | ✅ | |
| category | ✅ | Must match enum values |
| serialNumber | ❌ | Must be unique if provided |
| brand | ❌ | |
| model | ❌ | |
| purchaseDate | ❌ | YYYY-MM-DD format |
| purchasePrice | ❌ | Decimal number |
| vendor | ❌ | |
| warrantyExpiry | ❌ | YYYY-MM-DD format |
| notes | ❌ | |
| assignedToEmail | ❌ | Email of existing user — auto-assigns on import |

### Example CSV Row

```csv
assetTag,name,category,serialNumber,brand,model,purchaseDate,purchasePrice,vendor,warrantyExpiry,notes,assignedToEmail
CIT-LP-0001,Dell Latitude 5540,LAPTOP,ABC123XYZ,Dell,Latitude 5540,2025-01-15,3500.00,Dell Malaysia,2028-01-15,Primary laptop for finance team,john@company.com
```

---

## API Endpoints

| Method | Endpoint | Permission | Action |
|--------|----------|------------|--------|
| GET | `/api/v1/assets` | `asset:read` | List with filters (status, category, assignedTo, search, pagination) |
| GET | `/api/v1/assets/:id` | `asset:read` | Full detail with assignments + source request |
| POST | `/api/v1/assets` | `asset:write` | Create (validates duplicate tag/serial) |
| PATCH | `/api/v1/assets/:id` | `asset:write` | Partial update (validates duplicates on change) |
| DELETE | `/api/v1/assets/:id` | `asset:delete` | Soft-delete → status = DISPOSED |
| POST | `/api/v1/assets/:id/assign` | `asset:write` | Assign to user (creates AssetAssignment + sets ASSIGNED) |
| POST | `/api/v1/assets/:id/return` | `asset:write` | Return asset (sets returnedAt + updates status) |
| GET | `/api/v1/assets/by-user/:userId` | `asset:read` | Active assignments for a user |
| POST | `/api/v1/assets/import` | `asset:import` | Bulk CSV import |

### Query Parameters for GET /assets

| Param | Type | Example |
|-------|------|---------|
| `page` | number | `1` |
| `limit` | number | `10` |
| `status` | enum | `IN_STOCK`, `ASSIGNED` |
| `category` | enum | `LAPTOP`, `MONITOR` |
| `assignedTo` | UUID | Filter by assigned user |
| `search` | string | Search name, tag, serial |

### Assign Request Body

```json
{
  "userId": "uuid-of-user",
  "reason": "New laptop allocation",
  "linkedRequestId": "uuid-of-request (optional)",
  "notes": "HP EliteBook for onboarding"
}
```

### Return Request Body

```json
{
  "notes": "Returned in good condition",
  "newStatus": "IN_STOCK"
}
```

`newStatus` must be one of: `IN_STOCK`, `IN_REPAIR`, `PENDING_RETURN`

---

## Business Rules

1. **Unique Asset Tag**: Every asset must have a unique `assetTag`. Attempting to create or update with a duplicate returns 409 Conflict.

2. **Unique Serial Number**: If provided, must be unique. Attempting to create or update with a duplicate returns 409 Conflict.

3. **Single Active Assignment**: An asset can only have one active (returnedAt=null) assignment at a time. Attempting to assign an already-assigned asset returns 400 error.

4. **No Assignment on Disposed**: Cannot assign a disposed asset. Returns 400 error.

5. **Soft Delete**: Deleting an asset sets status to `DISPOSED` — the record is preserved for audit history.

6. **Auto-Create from Workflow**: When marking hardware received in the IT workflow, if `registerAsAsset=true` and `assetTag` is provided, the system automatically creates an Asset record with:
   - `name` = hardware request's `hardwareName`
   - `category` = `LAPTOP` (default)
   - `vendor` = hardware request's `preferredVendor`
   - `purchasePrice` = hardware request's `estimatedPrice`
   - `status` = `IN_STOCK`
   - `sourceRequestId` = the originating request ID

7. **Assignment History**: The asset detail drawer shows all past and current assignments (not just active ones). This provides a full audit trail.