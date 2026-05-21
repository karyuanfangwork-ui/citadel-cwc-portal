# CA Memo — Phase 3 Implementation Plan
## Risk Rating, ECL, Financial Projections & Commentary

**Date:** 2026-05-20
**Depends on:** Phase 2 complete
**Scope:** Form **Sections 5, 7, 12**
**Complexity:** L (largest phase) · **Estimated touch:** ~18 files

---

## What this phase delivers

- **Section 5 — Risk Rating & ECL:** External ratings (RAM/MARC/S&P/Moody's), ECL snapshots (MIA, MFRS9 stage, PD/LGD), 3-year ECL forecasts, historical rating timeline
- **Section 7 — Payment Capability:** 5-year cashflow projections, sensitivity/scenario analysis (Base + 3 scenarios), Way Out narratives (first/second/other)
- **Section 12 — Financial Analysis:** Auditor/qualification fields on `FinancialStatement`, structured narrative commentary (Sales/Profitability, Asset Mgmt, Debt Mgmt, Cashflow, Conclusion)

---

## 1. Schema changes

### 1a. New enums

```prisma
enum MfrsStage {
  STAGE_1
  STAGE_2
  STAGE_3
}

enum RatingAgency {
  RAM
  MARC
  SP
  MOODYS
  FITCH
}

enum ProjectionScenario {
  BASE
  SCENARIO_1
  SCENARIO_2
  SCENARIO_3
}
```

### 1b. Extend `FinancialStatement`

```prisma
// CA Memo Phase 3 — Section 12 audit + commentary fields
auditorName              String?   @map("auditor_name") @db.VarChar(255)
isQualified              Boolean?  @map("is_qualified")
qualificationNotes       String?   @map("qualification_notes") @db.Text
isDraftAccounts          Boolean   @default(false) @map("is_draft_accounts")

// Section 12 narrative commentary (one set per FY / statement)
commentarySalesProfitability String? @map("commentary_sales_profitability") @db.Text
commentaryAssetMgmt          String? @map("commentary_asset_mgmt") @db.Text
commentaryDebtMgmt           String? @map("commentary_debt_mgmt") @db.Text
commentaryCashflow           String? @map("commentary_cashflow") @db.Text
commentaryConclusion         String? @map("commentary_conclusion") @db.Text
```

### 1c. Extend `CreditApplication`

```prisma
// Section 7 — Way Out narratives
firstWayOut      String?  @map("first_way_out") @db.Text
secondWayOut     String?  @map("second_way_out") @db.Text
otherWayOut      String?  @map("other_way_out") @db.Text
```

> Wire `firstWayOut`, `secondWayOut`, `otherWayOut` into Phase 1 validator/service pattern (extend `caMemoHeaderFields` or add a new `caMemoSection7Fields` block — same `applyCaMemoFields` helper).

### 1d. New `ExternalRating` model

```prisma
model ExternalRating {
  id                String       @id @default(uuid()) @db.Uuid
  applicationId     String       @map("application_id") @db.Uuid
  subjectType       String       @map("subject_type") @db.VarChar(50) // CUSTOMER | CORPORATE_GUARANTOR
  subjectName       String?      @map("subject_name") @db.VarChar(255)
  agency            RatingAgency
  rating            String       @db.VarChar(20)
  ratingDate        DateTime?    @map("rating_date") @db.Date
  outlook           String?      @db.VarChar(50) // Stable, Negative, Positive
  fiscalYear        Int?         @map("fiscal_year")

  createdAt         DateTime     @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime     @updatedAt @map("updated_at") @db.Timestamp(6)

  application       CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@map("external_ratings")
}
```

### 1e. New `EclSnapshot` model

```prisma
model EclSnapshot {
  id                String     @id @default(uuid()) @db.Uuid
  applicationId     String     @map("application_id") @db.Uuid
  subjectType       String     @map("subject_type") @db.VarChar(50) // CUSTOMER | CORPORATE_GUARANTOR
  subjectName       String?    @map("subject_name") @db.VarChar(255)
  snapshotDate      DateTime   @map("snapshot_date") @db.Date

  miaCount          Int?       @map("mia_count")             // Months in Arrears
  mfrsStage         MfrsStage? @map("mfrs_stage")
  totalOutstanding  Decimal?   @map("total_outstanding") @db.Decimal(15, 2)
  pdPct             Decimal?   @map("pd_pct") @db.Decimal(8, 6)   // Probability of Default
  lgdPct            Decimal?   @map("lgd_pct") @db.Decimal(8, 6)  // Loss Given Default
  lossRatePct       Decimal?   @map("loss_rate_pct") @db.Decimal(8, 6)
  eclAmount         Decimal?   @map("ecl_amount") @db.Decimal(15, 2)
  potentialEclWriteback Decimal? @map("potential_ecl_writeback") @db.Decimal(15, 2)
  notes             String?    @db.Text

  createdAt         DateTime   @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime   @updatedAt @map("updated_at") @db.Timestamp(6)

  application       CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
  @@map("ecl_snapshots")
}
```

### 1f. New `EclForecast` model

```prisma
model EclForecast {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @map("application_id") @db.Uuid
  forecastYear    Int      @map("forecast_year")  // 1, 2, 3
  mfrsStage       MfrsStage? @map("mfrs_stage")
  eclAmount       Decimal?  @map("ecl_amount") @db.Decimal(15, 2)
  pdPct           Decimal?  @map("pd_pct") @db.Decimal(8, 6)
  lgdPct          Decimal?  @map("lgd_pct") @db.Decimal(8, 6)
  assumptions     String?   @db.Text

  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, forecastYear])
  @@index([applicationId])
  @@map("ecl_forecasts")
}
```

### 1g. New `CashflowProjection` model

```prisma
model CashflowProjection {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @unique @map("application_id") @db.Uuid
  assumptions     String?  @db.Text

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  lineItems       ProjectionLineItem[]

  @@map("cashflow_projections")
}
```

### 1h. New `ProjectionLineItem` model

```prisma
model ProjectionLineItem {
  id              String   @id @default(uuid()) @db.Uuid
  projectionId    String   @map("projection_id") @db.Uuid
  lineKey         String   @map("line_key") @db.VarChar(100)
  lineLabel       String   @map("line_label") @db.VarChar(200)
  projectionYear  Int      @map("projection_year")  // 1-5 (relative to application date)
  amount          Decimal  @db.Decimal(15, 2)
  displayOrder    Int      @default(0) @map("display_order")

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  projection      CashflowProjection @relation(fields: [projectionId], references: [id], onDelete: Cascade)

  @@unique([projectionId, lineKey, projectionYear])
  @@index([projectionId])
  @@map("projection_line_items")
}
```

### 1i. New `SensitivityScenario` model

```prisma
model SensitivityScenario {
  id              String             @id @default(uuid()) @db.Uuid
  applicationId   String             @map("application_id") @db.Uuid
  scenario        ProjectionScenario
  label           String?            @db.VarChar(100)  // "Base", "Scenario 1: -20% Revenue"
  assumptions     String?            @db.Text

  // Key outputs per scenario
  revenueAmount        Decimal? @map("revenue_amount") @db.Decimal(15, 2)
  opCashflow           Decimal? @map("op_cashflow") @db.Decimal(15, 2)
  ebitda               Decimal? @map("ebitda") @db.Decimal(15, 2)
  financingCosts       Decimal? @map("financing_costs") @db.Decimal(15, 2)
  gearingRatio         Decimal? @map("gearing_ratio") @db.Decimal(8, 4)
  dscr                 Decimal? @map("dscr") @db.Decimal(8, 4)

  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, scenario])
  @@index([applicationId])
  @@map("sensitivity_scenarios")
}
```

> Add all new relations to `CreditApplication`.

### 1j. Migration
`backend/prisma/migrations/20260520000002_phase3_risk_ecl_projections/migration.sql`

---

## 2. Backend changes

### 2a. New route files (each with controller + validator)
- `backend/src/credit/routes/externalRating.routes.ts`
  - `GET /applications/:id/external-ratings`, `POST`, `PATCH /:ratingId`, `DELETE /:ratingId`
- `backend/src/credit/routes/ecl.routes.ts`
  - `GET /applications/:id/ecl-snapshots`, `POST`, `PATCH /:snapshotId`, `DELETE /:snapshotId`
  - `GET /applications/:id/ecl-forecasts` (3 rows, upsert by forecastYear)
- `backend/src/credit/routes/projection.routes.ts`
  - `GET /applications/:id/cashflow-projection` (includes lineItems)
  - `PUT /applications/:id/cashflow-projection` (upsert)
  - `PUT /applications/:id/cashflow-projection/lines` (bulk upsert line items)
- `backend/src/credit/routes/sensitivityScenario.routes.ts`
  - `GET /applications/:id/sensitivity-scenarios`
  - `PUT /applications/:id/sensitivity-scenarios/:scenario` (upsert by scenario enum)

### 2b. Extend financial routes
- Extend `financial.validator.ts` with new `FinancialStatement` fields (auditor, qualification, commentary)
- Extend financial controller PATCH to accept and persist new fields

### 2c. Extend `creditApplication` service
- Add `firstWayOut`, `secondWayOut`, `otherWayOut` to `CaMemoHeaderFields` (or new `caMemoSection7Fields` struct)
- Wire into existing `applyCaMemoFields` pattern

---

## 3. Frontend changes

### 3a. Types (`frontend/src/services/credit.service.ts`)
- Add `ExternalRating`, `EclSnapshot`, `EclForecast`, `CashflowProjection`, `ProjectionLineItem`, `SensitivityScenario` interfaces
- Add `MfrsStage`, `RatingAgency`, `ProjectionScenario` type unions
- Add new API service objects: `externalRatingApi`, `eclApi`, `projectionApi`, `sensitivityApi`
- Extend `FinancialStatement` with auditor + commentary fields
- Extend `CreditApplication` with `firstWayOut`, `secondWayOut`, `otherWayOut`

### 3b. New tab: `RiskRatingEclTab.tsx`
`frontend/pages/credit/tabs/RiskRatingEclTab.tsx`

Layout (Section 5):
```
┌─ Internal Risk Rating ──────────────────────────────────────────────────┐
│  (creditRiskRating already shown in Summary tab — repeat read-only here)│
└─────────────────────────────────────────────────────────────────────────┘
┌─ External Ratings (RAM/MARC/S&P/Moody's) ───────────────────────────────┐
│  Subject | Agency | Rating | Date | Outlook | FY   [+ Add row]          │
└─────────────────────────────────────────────────────────────────────────┘
┌─ ECL Snapshot ──────────────────────────────────────────────────────────┐
│  Subject | MIA | Stage | O/S | PD% | LGD% | Loss Rate% | ECL | Writebk │
└─────────────────────────────────────────────────────────────────────────┘
┌─ ECL Forecasts (Y1 / Y2 / Y3) ─────────────────────────────────────────┐
│  Year | Stage | ECL Amount | PD% | LGD% | Assumptions                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3c. New tab: `PaymentCapabilityTab.tsx`
`frontend/pages/credit/tabs/PaymentCapabilityTab.tsx`

Layout (Section 7):
```
┌─ Way Out Narratives ────────────────────────────────────────────────────┐
│  First Way Out  [textarea]                                               │
│  Second Way Out [textarea]                                               │
│  Other Way Out  [textarea]                                               │
└─────────────────────────────────────────────────────────────────────────┘
┌─ 5-Year Cashflow Projection ────────────────────────────────────────────┐
│  Line Item | Y1 | Y2 | Y3 | Y4 | Y5                                    │
│  (Sales, Total Inflow, Costs, Net CF, DSCR, Gearing)                    │
│  Projection Assumptions [textarea]                                       │
└─────────────────────────────────────────────────────────────────────────┘
┌─ Sensitivity Analysis ──────────────────────────────────────────────────┐
│  Scenario | Revenue | Op CF | EBITDA | Fin Costs | Gearing | DSCR       │
│  Base / S1 / S2 / S3 — each editable row with assumptions               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3d. Extend existing Financial Spreading page
`frontend/pages/FinancialSpreading.tsx` (exists, 576 lines):
- Add auditor name, isQualified checkbox, qualificationNotes field per statement
- Add 5 commentary text areas (Sales/Profitability, Asset Mgmt, Debt Mgmt, Cashflow, Conclusion)
- Integrate into existing edit-statement form

### 3e. Wire tabs into `CreditApplicationDetail.tsx`
Add `'risk-rating'`, `'payment-capability'` to `DetailTab` union and tab nav.

---

## 4. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | 3 enums + 6 new models + fields on `FinancialStatement` + `CreditApplication` |
| `backend/prisma/migrations/20260520000002_.../migration.sql` | New |
| `backend/src/credit/routes/externalRating.routes.ts` | New |
| `backend/src/credit/controllers/externalRating.controller.ts` | New |
| `backend/src/credit/routes/ecl.routes.ts` | New |
| `backend/src/credit/controllers/ecl.controller.ts` | New |
| `backend/src/credit/routes/projection.routes.ts` | New |
| `backend/src/credit/controllers/projection.controller.ts` | New |
| `backend/src/credit/routes/sensitivityScenario.routes.ts` | New |
| `backend/src/credit/controllers/sensitivityScenario.controller.ts` | New |
| `backend/src/credit/validators/financial.validator.ts` | Extend |
| `backend/src/credit/controllers/financial.controller.ts` | Extend |
| `backend/src/credit/routes/credit.routes.ts` | Register 4 new route groups |
| `backend/src/credit/services/creditApplication.service.ts` | Add Way Out fields |
| `frontend/src/services/credit.service.ts` | Add 6 interfaces + 4 API objects |
| `frontend/pages/credit/tabs/RiskRatingEclTab.tsx` | New |
| `frontend/pages/credit/tabs/PaymentCapabilityTab.tsx` | New |
| `frontend/pages/FinancialSpreading.tsx` | Extend edit form |
| `frontend/pages/CreditApplicationDetail.tsx` | Add 2 tabs |

---

## 5. Acceptance criteria

- [ ] RM can add external ratings (up to 4 agencies × customer + CG) per application
- [ ] RM can enter ECL snapshot: MIA, MFRS9 stage, O/S, PD%, LGD%, ECL amount
- [ ] ECL forecasts for Y1/Y2/Y3 are entered and persisted per application
- [ ] 5-year cashflow projection grid saves cell-by-cell on blur
- [ ] Sensitivity scenarios (Base + up to 3) each save independently
- [ ] Way Out narratives autosave on blur (same pattern as Phase 1)
- [ ] Financial statement edit form shows auditor, isQualified flag, qualification notes
- [ ] Commentary textareas (5 per FY) persist against each `FinancialStatement`
- [ ] All new tabs render read-only for non-DRAFT applications
- [ ] No regression on existing scorecard / financial spreading functionality

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Projection grid (5 cols × N rows) is the most complex UI in Phase 3 | Use simple HTML table with inline inputs; `onBlur` bulk-upserts all dirty cells in one PATCH to avoid N+1 API calls |
| ECL data is supposed to come from Finance system | Phase 3 implements manual import pattern; wire to Finance API in a future phase; add `importedFromSystem` + `importedAt` fields to `EclSnapshot` for future tracing |
| `FinancialStatement` commentary tied to historical FYs — not to the application | Correct — commentary lives on `FinancialStatement`, not `CreditApplication`. RM selects the relevant FY statements; commentaries populate the CA memo Section 12. No model conflict. |
| Way Out narratives — 3 separate text blobs on `CreditApplication` | Straightforward. Extend existing `CaMemoHeaderFields` helper or add dedicated `caMemoSection7Fields` constant. |
