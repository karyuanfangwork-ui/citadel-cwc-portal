# CA Memo — Phase 2 Implementation Plan
## Facilities, Requests & Exposure

**Date:** 2026-05-20
**Depends on:** Phase 1 complete ✅
**Scope:** Form **Section 3 — Requests, Rationale & Justification**
**Complexity:** M · **Estimated touch:** ~10 files

---

## What this phase delivers

- Extend `ApplicationFacility` with limit-tracking fields (existing/proposed/new/outstanding/undisbursed)
- New `RequestItem` model to capture Request 1–4 sub-types and per-request approving level
- Exposure summary view (customer-this / customer-other / group / related counterparties)
- Extend `FacilityType` enum with Islamic facility variants
- Frontend: enhanced Facilities tab on `CreditApplicationDetail.tsx`

---

## 1. Schema changes

### 1a. Extend `FacilityType` enum

```prisma
// Add to existing FacilityType enum
enum FacilityType {
  // ... existing values ...
  CASHLINE
  RWC_I         // Revolving Working Capital — Islamic
  LC_I          // Letter of Credit — Islamic
  BG_I          // Bank Guarantee — Islamic
  ICMTD_I       // Islamic Commodity Murabahah Term Deposit
}
```

### 1b. New `RequestType` enum

```prisma
enum RequestType {
  FACILITY_RENEWAL
  VARIATION
  POLICY_BREACH_RATIFICATION
  SICR_IMPAIRMENT
}
```

### 1c. Extend `ApplicationFacility`

New fields (all nullable — backwards compat):

```prisma
// CA Memo Phase 2 — Section 3 limit tracking
pricingLabel         String?   @map("pricing_label") @db.VarChar(100)
existingLimit        Decimal?  @map("existing_limit") @db.Decimal(15, 2)
proposedChange       Decimal?  @map("proposed_change") @db.Decimal(15, 2)
newLimit             Decimal?  @map("new_limit") @db.Decimal(15, 2)
outstandingBalance   Decimal?  @map("outstanding_balance") @db.Decimal(15, 2)
undisbursedLimit     Decimal?  @map("undisbursed_limit") @db.Decimal(15, 2)
approvingLevel       String?   @map("approving_level") @db.VarChar(100)
requestItemId        String?   @map("request_item_id") @db.Uuid
```

### 1d. New `RequestItem` model

```prisma
model RequestItem {
  id              String      @id @default(uuid()) @db.Uuid
  applicationId   String      @map("application_id") @db.Uuid
  requestType     RequestType @map("request_type")
  sortOrder       Int         @default(1) @map("sort_order")
  approvingLevel  String?     @map("approving_level") @db.VarChar(100)
  rationale       String?     @db.Text

  createdAt       DateTime    @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime    @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication   @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  facilities      ApplicationFacility[]

  @@index([applicationId])
  @@map("request_items")
}
```

> Add `requestItems RequestItem[]` to `CreditApplication` relations.
> Add `requestItem RequestItem? @relation(fields: [requestItemId], references: [id])` to `ApplicationFacility`.

### 1e. New `ExposureSummary` model

```prisma
model ExposureSummary {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @unique @map("application_id") @db.Uuid

  // Secured / Unsecured split for each exposure bucket
  thisAppSecured      Decimal? @map("this_app_secured") @db.Decimal(15, 2)
  thisAppUnsecured    Decimal? @map("this_app_unsecured") @db.Decimal(15, 2)
  otherAppSecured     Decimal? @map("other_app_secured") @db.Decimal(15, 2)
  otherAppUnsecured   Decimal? @map("other_app_unsecured") @db.Decimal(15, 2)
  customerTotalSecured   Decimal? @map("customer_total_secured") @db.Decimal(15, 2)
  customerTotalUnsecured Decimal? @map("customer_total_unsecured") @db.Decimal(15, 2)
  relatedCounterpartySecured   Decimal? @map("related_counterparty_secured") @db.Decimal(15, 2)
  relatedCounterpartyUnsecured Decimal? @map("related_counterparty_unsecured") @db.Decimal(15, 2)
  groupTotalSecured   Decimal? @map("group_total_secured") @db.Decimal(15, 2)
  groupTotalUnsecured Decimal? @map("group_total_unsecured") @db.Decimal(15, 2)

  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@map("exposure_summaries")
}
```

> Add `exposureSummary ExposureSummary?` to `CreditApplication` relations.

### 1f. Migration

`backend/prisma/migrations/20260520000001_phase2_facilities_requests/migration.sql`

---

## 2. Backend changes

### 2a. New `RequestItem` routes + controller + service
- `backend/src/credit/routes/requestItem.routes.ts`
- `backend/src/credit/controllers/requestItem.controller.ts`
- CRUD: `GET /applications/:id/request-items`, `POST`, `PATCH /:itemId`, `DELETE /:itemId`

### 2b. New `ExposureSummary` routes + controller
- `backend/src/credit/routes/exposureSummary.routes.ts`
- `backend/src/credit/controllers/exposureSummary.controller.ts`
- `GET /applications/:id/exposure-summary`, `PUT` (upsert)

### 2c. Extend `ApplicationFacility` routes/service
- Extend `applicationFacility.validator.ts` with new optional fields
- Extend controller create/update to accept and persist new fields
- `CreditApprovalMatrix` logic: **no change** — approving level is stored as label string per request/facility, not re-evaluated. Matrix evaluation remains at application level.

### 2d. Register new routes
- Wire into `backend/src/credit/routes/credit.routes.ts`

---

## 3. Frontend changes

### 3a. Types (`frontend/src/services/credit.service.ts`)
- Extend `CreditFacility` interface: `pricingLabel`, `existingLimit`, `proposedChange`, `newLimit`, `outstandingBalance`, `undisbursedLimit`, `approvingLevel`, `requestItemId`
- Add `RequestItem` interface, `ExposureSummary` interface
- Add `RequestType` and extended `FacilityType` type unions
- Add `requestItemApi`, `exposureSummaryApi` service objects

### 3b. New `RequestsFacilitiesTab.tsx`
`frontend/pages/credit/tabs/RequestsFacilitiesTab.tsx`

Layout:
```
┌─ Facilities Table (Section 3a) ──────────────────────────────────────────┐
│  Facility Type | Pricing | Existing | Proposed Δ | New Limit | O/S Bal   │
│  Undisbursed   | Approving Level                                          │
│  [+ Add Facility]                                                         │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Exposure Summary (Section 3b) ──────────────────────────────────────────┐
│  Bucket         | Secured | Unsecured | Total                            │
│  This App / Other App / Customer Total / Related / Group Total           │
│  [Autosave on blur]                                                       │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Request Items (Section 3c) ─────────────────────────────────────────────┐
│  Request 1 | Request 2 | Request 3 | Request 4                           │
│  Type [select] | Approving Level [text] | Rationale [textarea]           │
│  [+ Add Request]                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3c. Replace existing Facilities tab content
Current `activeTab === 'facilities'` section in `CreditApplicationDetail.tsx` is inline (~50 lines). Extract to `RequestsFacilitiesTab.tsx` and replace inline render with `<RequestsFacilitiesTab />`.

---

## 4. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | Extend `ApplicationFacility`, `FacilityType`; add `RequestType`, `RequestItem`, `ExposureSummary` |
| `backend/prisma/migrations/20260520000001_phase2.../migration.sql` | New |
| `backend/src/credit/validators/applicationFacility.validator.ts` | Extend |
| `backend/src/credit/controllers/applicationFacility.controller.ts` | Extend |
| `backend/src/credit/routes/requestItem.routes.ts` | New |
| `backend/src/credit/controllers/requestItem.controller.ts` | New |
| `backend/src/credit/routes/exposureSummary.routes.ts` | New |
| `backend/src/credit/controllers/exposureSummary.controller.ts` | New |
| `backend/src/credit/routes/credit.routes.ts` | Register new routes |
| `frontend/src/services/credit.service.ts` | Extend types + add APIs |
| `frontend/pages/credit/tabs/RequestsFacilitiesTab.tsx` | New |
| `frontend/pages/CreditApplicationDetail.tsx` | Replace facilities tab content |

---

## 5. Acceptance criteria

- [ ] RM can edit existingLimit / proposedChange / newLimit / outstandingBalance / undisbursedLimit per facility line
- [ ] RM can add up to 4 Request Items with type, approving level, rationale
- [ ] Exposure summary auto-totals Secured + Unsecured per bucket when saved
- [ ] Islamic facility types (RWC-i, LC-i, BG-i, CASHLINE) appear in facility type dropdown
- [ ] Existing facility CRUD (add / edit / delete) unaffected
- [ ] `GET /applications/:id` includes `requestItems` and `exposureSummary` in response
- [ ] No regression on existing facilities tab

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `FacilityType` enum extension requires Prisma enum migration | `ALTER TYPE … ADD VALUE` — additive, safe, no downtime |
| `CreditApprovalMatrix` currently evaluates at application level | Store `approvingLevel` as free-text label only; full matrix re-evaluation per request item is Phase 5 scope |
| Exposure totals can drift from actual facility amounts | Treat as RM-entered override (bank typically uses CBS figures); no auto-compute in Phase 2 |
