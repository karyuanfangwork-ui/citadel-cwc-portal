# CA Memo — Phase 4 Implementation Plan
## Security, Profitability, Counterparties & Directors/Shareholders

**Date:** 2026-05-20
**Depends on:** Phase 3 complete
**Scope:** Form **Sections 8, 9, 10, 11, 13**
**Complexity:** L · **Estimated touch:** ~20 files

---

## What this phase delivers

- **Section 8 — Security:** Dual-valuation (PMMD vs Panel Valuer) on `Collateral`; security category + subtype; extend `Guarantee` with financial profile fields
- **Section 9 — Account Profitability & Wallet Share:** New `AccountProfitability`, `ProfitabilityLine`, `WalletShare` models; account strategy + cross-selling (schema hook already in Phase 1)
- **Section 10 — Company/Group Background:** New `KeyCounterparty` model (suppliers/buyers/competitors)
- **Section 11 — Directors & Key Management:** Extend `Director` + `Shareholder` with DoB, nationality, experience
- **Section 13 — Conduct of Accounts:** New `AccountUtilisationSnapshot` model (6-month rolling OD/cashline)

---

## 1. Schema changes

### 1a. New enums

```prisma
enum SecurityCategory {
  TANGIBLE       // Properties, FSRA, SFA
  SUPPORTING     // Debenture, Assignment of Contract Proceeds
}

enum CounterpartyRole {
  SUPPLIER
  BUYER
  COMPETITOR
}
```

### 1b. Extend `Collateral`

```prisma
// CA Memo Phase 4 — Section 8 dual valuation + classification
securityCategory       SecurityCategory? @map("security_category")
securitySubType        String?           @map("security_sub_type") @db.VarChar(100)
isExisting             Boolean           @default(true) @map("is_existing")
isNewToBeObtained      Boolean           @default(false) @map("is_new_to_be_obtained")

// PMMD (Property Management & Monitoring Department) valuation
pmmdMarketValue        Decimal?          @map("pmmd_market_value") @db.Decimal(15, 2)
pmmdForcedSaleValue    Decimal?          @map("pmmd_forced_sale_value") @db.Decimal(15, 2)

// Panel Valuer valuation (existing marketValue/forcedSaleValue become Panel Valuer values)
// Existing: marketValue → panelValuerMarketValue (aliased, no rename needed)
// Add explicit Panel Valuer pair for clarity:
panelValuerName        String?           @map("panel_valuer_name") @db.VarChar(255)
securityCoverageRatio  Decimal?          @map("security_coverage_ratio") @db.Decimal(8, 4)
```

> **Note:** Existing `marketValue`/`forcedSaleValue` on `Collateral` map to **Panel Valuer** values (the primary valuer). PMMD columns are new additive fields. No rename = no migration risk.

### 1c. Extend `Guarantee`

```prisma
// CA Memo Phase 4 — Section 8 guarantor financial profile
contingentLiabilities      Decimal?  @map("contingent_liabilities") @db.Decimal(15, 2)
estimatedNetWorth          Decimal?  @map("estimated_net_worth") @db.Decimal(15, 2)
guarantorRiskRatingSnapshot String?  @map("guarantor_risk_rating_snapshot") @db.VarChar(20)
remarks                    String?   @db.Text
```

### 1d. New `AccountProfitability` model

```prisma
model AccountProfitability {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @unique @map("application_id") @db.Uuid
  reportingPeriod String?  @map("reporting_period") @db.VarChar(50)  // e.g. "YTD 2026"
  notes           String?  @db.Text

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication  @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  lines           ProfitabilityLine[]

  @@map("account_profitabilities")
}
```

### 1e. New `ProfitabilityLine` model

```prisma
model ProfitabilityLine {
  id                String   @id @default(uuid()) @db.Uuid
  profitabilityId   String   @map("profitability_id") @db.Uuid
  productCategory   String   @map("product_category") @db.VarChar(100)
  // e.g. FINANCINGS, TRADES_FUNDED, TRADES_NON_FUNDED, FOREX, DEPOSITS, REMITTANCE, FEES_OTHERS
  netProfitYtd      Decimal? @map("net_profit_ytd") @db.Decimal(15, 2)
  netProfitProjected Decimal? @map("net_profit_projected") @db.Decimal(15, 2)
  feeIncomeYtd      Decimal? @map("fee_income_ytd") @db.Decimal(15, 2)
  feeIncomeProjected Decimal? @map("fee_income_projected") @db.Decimal(15, 2)
  displayOrder      Int      @default(0) @map("display_order")

  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  profitability     AccountProfitability @relation(fields: [profitabilityId], references: [id], onDelete: Cascade)

  @@unique([profitabilityId, productCategory])
  @@index([profitabilityId])
  @@map("profitability_lines")
}
```

### 1f. New `WalletShare` model

```prisma
model WalletShare {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @map("application_id") @db.Uuid
  facilityType    String   @map("facility_type") @db.VarChar(100)
  ourLimitAmount  Decimal? @map("our_limit_amount") @db.Decimal(15, 2)
  totalMarketAmount Decimal? @map("total_market_amount") @db.Decimal(15, 2)
  ourSharePct     Decimal? @map("our_share_pct") @db.Decimal(5, 2)
  yoyChangePct    Decimal? @map("yoy_change_pct") @db.Decimal(5, 2)
  notes           String?  @db.Text

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, facilityType])
  @@index([applicationId])
  @@map("wallet_shares")
}
```

### 1g. New `KeyCounterparty` model (Section 10)

```prisma
model KeyCounterparty {
  id                String           @id @default(uuid()) @db.Uuid
  borrowerProfileId String           @map("borrower_profile_id") @db.Uuid
  role              CounterpartyRole
  name              String           @db.VarChar(255)
  address           String?          @db.Text
  telephone         String?          @db.VarChar(50)
  yearsOfRelationship Int?           @map("years_of_relationship")
  creditTermsDays   Int?             @map("credit_terms_days")
  salesOrPurchasePct Decimal?        @map("sales_or_purchase_pct") @db.Decimal(5, 2)
  modeOfPayment     String?          @map("mode_of_payment") @db.VarChar(100)
  sortOrder         Int              @default(0) @map("sort_order")

  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime         @updatedAt @map("updated_at") @db.Timestamp(6)

  borrowerProfile   BorrowerProfile @relation(fields: [borrowerProfileId], references: [id], onDelete: Cascade)

  @@index([borrowerProfileId, role])
  @@map("key_counterparties")
}
```

> Add `keyCounterparties KeyCounterparty[]` to `BorrowerProfile` relations.

### 1h. Extend `Director` (Section 11)

```prisma
// CA Memo Phase 4 — Section 11
dateOfBirth            DateTime?  @map("date_of_birth") @db.Date
nationality            String?    @db.VarChar(100)
experienceQualification String?   @map("experience_qualification") @db.Text
isKeyManagement        Boolean    @default(false) @map("is_key_management")
```

### 1i. Extend `Shareholder` (Section 10)

```prisma
// CA Memo Phase 4 — Section 10
dateOfBirthOrIncorporation DateTime? @map("dob_or_incorp_date") @db.Date
nationality                String?   @db.VarChar(100)
businessRegNo              String?   @map("business_reg_no") @db.VarChar(100)
```

### 1j. New `AccountUtilisationSnapshot` model (Section 13)

```prisma
model AccountUtilisationSnapshot {
  id              String   @id @default(uuid()) @db.Uuid
  applicationId   String   @map("application_id") @db.Uuid
  accountNo       String   @map("account_no") @db.VarChar(50)
  facilityType    String   @map("facility_type") @db.VarChar(100)  // TERM, CASHLINE, TRADE
  snapshotMonth   DateTime @map("snapshot_month") @db.Date  // first day of month

  // Cashline rolling data
  withdrawalAmount    Decimal?  @map("withdrawal_amount") @db.Decimal(15, 2)
  depositAmount       Decimal?  @map("deposit_amount") @db.Decimal(15, 2)
  monthEndBalance     Decimal?  @map("month_end_balance") @db.Decimal(15, 2)
  returnedChequesCount Int?     @map("returned_cheques_count")

  // Term / Trade data
  approvedLimit       Decimal?  @map("approved_limit") @db.Decimal(15, 2)
  outstandingAmount   Decimal?  @map("outstanding_amount") @db.Decimal(15, 2)
  overdueAmount       Decimal?  @map("overdue_amount") @db.Decimal(15, 2)
  instalmentsInArrears Int?     @map("instalments_in_arrears")

  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  application     CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([applicationId, accountNo, snapshotMonth])
  @@index([applicationId])
  @@map("account_utilisation_snapshots")
}
```

### 1k. Migration
`backend/prisma/migrations/20260520000003_phase4_security_profitability_counterparties/migration.sql`

---

## 2. Backend changes

### 2a. New route files
- `backend/src/credit/routes/profitability.routes.ts` — `GET/PUT /applications/:id/profitability` (upsert header + lines)
- `backend/src/credit/routes/walletShare.routes.ts` — `GET/PUT /applications/:id/wallet-shares` (array upsert)
- `backend/src/credit/routes/keyCounterparty.routes.ts` — `GET/POST/PATCH/:id/DELETE` on `/borrower-profiles/:id/counterparties`
- `backend/src/credit/routes/accountUtilisation.routes.ts` — `GET/POST/PATCH/:id/DELETE` on `/applications/:id/account-utilisation`

### 2b. Extend existing routes
- `collateral.routes.ts` / controller — accept new dual-valuation + category fields
- `guarantee.routes.ts` / controller — accept new financial profile fields
- `director.routes.ts` / controller + validator — accept DoB, nationality, experience, isKeyManagement
- `shareholder.routes.ts` / controller + validator — accept DoB/Incorp date, nationality, businessRegNo

### 2c. Phase 1 hook fields now active
`accountStrategy` + `crossSellingInitiatives` on `CreditApplication` were schema-stubbed in Phase 1. Validate they render correctly in Section 9 UI (they're already being persisted).

---

## 3. Frontend changes

### 3a. Types (`frontend/src/services/credit.service.ts`)
- Add `AccountProfitability`, `ProfitabilityLine`, `WalletShare`, `KeyCounterparty`, `AccountUtilisationSnapshot` interfaces
- Add `SecurityCategory`, `CounterpartyRole` type unions
- Extend `Collateral` interface with PMMD fields + security classification
- Extend `Guarantee` interface with financial profile fields
- Extend `Director` interface with DoB, nationality, experience, isKeyManagement
- Extend `Shareholder` interface with DoB/incorp, nationality, businessRegNo
- Add `profitabilityApi`, `walletShareApi`, `keyCounterpartyApi`, `utilisationApi`

### 3b. New tab: `SecurityGuaranteesTab.tsx`
`frontend/pages/credit/tabs/SecurityGuaranteesTab.tsx`

Layout (Section 8):
```
┌─ Tangible Security ──────────────────────────────────────────────────────┐
│  Description | Category | SubType | Existing? | New?                     │
│  PMMD OMV | PMMD FSV | Panel Valuer OMV | Panel Valuer FSV | Coverage%   │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Corporate / Personal Guarantees ────────────────────────────────────────┐
│  Guarantor | CRR snapshot | Contingent Liabilities | Est Net Worth       │
│  Remarks                                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```
> Replaces existing collateral/guarantee inline rendering in `CreditApplicationDetail.tsx`.

### 3c. New tab: `ProfitabilityWalletTab.tsx`
`frontend/pages/credit/tabs/ProfitabilityWalletTab.tsx`

Layout (Section 9):
```
┌─ Account Profitability Table ────────────────────────────────────────────┐
│  Product | Net Profit YTD | Net Profit Projected | Fee YTD | Fee Proj   │
│  (Financings, Trades-Funded, Trades-NonFunded, Forex, Deposits, Fees…)  │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Wallet Share by Facility ───────────────────────────────────────────────┐
│  Facility | Our Limit | Market Total | Our Share% | YoY Δ%               │
└──────────────────────────────────────────────────────────────────────────┘
┌─ Account Strategy & Cross-Selling ───────────────────────────────────────┐
│  Strategy [select: GROW/MAINTAIN/EXIT]  (persisted in Phase 1 schema)   │
│  Cross-Selling Initiatives [textarea]                                    │
└──────────────────────────────────────────────────────────────────────────┘
```
> Skip entire tab for `borrowerType === 'INDIVIDUAL'`.

### 3d. New tab: `CounterpartiesTab.tsx`
`frontend/pages/credit/tabs/CounterpartiesTab.tsx`

Layout (Section 10):
```
┌─ Key Suppliers (max 3) ─────────────────────────────────────────────────┐
│  Name/Address | Years | Credit Terms | Sales% | Mode of Payment          │
└─────────────────────────────────────────────────────────────────────────┘
┌─ Key Buyers (max 3) ────────────────────────────────────────────────────┐
│  [same columns]                                                           │
└─────────────────────────────────────────────────────────────────────────┘
┌─ Main Competitors ──────────────────────────────────────────────────────┐
│  Free list of competitor names                                           │
└─────────────────────────────────────────────────────────────────────────┘
```
> Skip for `borrowerType === 'INDIVIDUAL'`.

### 3e. Extend `BorrowerProfileDetail.tsx` — Directors & Shareholders tabs
- Add DoB, nationality, experience/qualification, isKeyManagement to Director edit form
- Add DoB/incorp date, nationality, businessRegNo to Shareholder edit form
- isKeyManagement checkbox — separate "Key Management" section below directors list

### 3f. New tab: `AccountConductTab.tsx`
`frontend/pages/credit/tabs/AccountConductTab.tsx`

Layout (Section 13):
```
┌─ Term Financings ───────────────────────────────────────────────────────┐
│  Account No | Approved Limit | Outstanding | Overdue | Instalments Arrears│
└─────────────────────────────────────────────────────────────────────────┘
┌─ Cashline — 6-Month Rolling ────────────────────────────────────────────┐
│  Month | Withdrawal | Deposit | Month-End Balance | Returned Cheques     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3g. Wire tabs into `CreditApplicationDetail.tsx`
Add to `DetailTab` union: `'security'`, `'profitability'`, `'counterparties'`, `'conduct'`.
Replace existing collateral tab with `'security'` (extended).

---

## 4. File touch list

| Path | Action |
|---|---|
| `backend/prisma/schema.prisma` | 2 enums + 5 new models + fields on 4 models |
| `backend/prisma/migrations/20260520000003_.../migration.sql` | New |
| `backend/src/credit/routes/profitability.routes.ts` | New |
| `backend/src/credit/controllers/profitability.controller.ts` | New |
| `backend/src/credit/routes/walletShare.routes.ts` | New |
| `backend/src/credit/controllers/walletShare.controller.ts` | New |
| `backend/src/credit/routes/keyCounterparty.routes.ts` | New |
| `backend/src/credit/controllers/keyCounterparty.controller.ts` | New |
| `backend/src/credit/routes/accountUtilisation.routes.ts` | New |
| `backend/src/credit/controllers/accountUtilisation.controller.ts` | New |
| `backend/src/credit/validators/collateral.validator.ts` | Extend |
| `backend/src/credit/controllers/collateral.controller.ts` | Extend |
| `backend/src/credit/validators/guarantee.validator.ts` | Extend |
| `backend/src/credit/validators/director.validator.ts` | Extend |
| `backend/src/credit/validators/shareholder.validator.ts` | Extend |
| `backend/src/credit/routes/credit.routes.ts` | Register 4 new routes |
| `frontend/src/services/credit.service.ts` | Extend 4 interfaces + add 4 API objects |
| `frontend/pages/credit/tabs/SecurityGuaranteesTab.tsx` | New |
| `frontend/pages/credit/tabs/ProfitabilityWalletTab.tsx` | New |
| `frontend/pages/credit/tabs/CounterpartiesTab.tsx` | New |
| `frontend/pages/credit/tabs/AccountConductTab.tsx` | New |
| `frontend/pages/BorrowerProfileDetail.tsx` | Extend Director + Shareholder forms |
| `frontend/pages/CreditApplicationDetail.tsx` | Add 4 tabs; replace collateral with SecurityGuaranteesTab |

---

## 5. Acceptance criteria

- [ ] Collateral form shows PMMD OMV/FSV + Panel Valuer OMV/FSV as separate paired columns
- [ ] Security category (TANGIBLE/SUPPORTING) and sub-type are selectable
- [ ] isExisting / isNewToBeObtained checkboxes work independently
- [ ] Guarantee form shows contingentLiabilities, estimatedNetWorth, CRR snapshot, remarks
- [ ] Profitability table saves per-product YTD and projected values
- [ ] Wallet share table saves per-facility-type with our share % and YoY
- [ ] Suppliers/Buyers (max 3 each) editable rows in Counterparties tab
- [ ] Director edit form includes DoB, nationality, experience, isKeyManagement flag
- [ ] Shareholder edit form includes DoB/incorp date, nationality, businessRegNo
- [ ] Account Conduct tab shows term + cashline grids with 6-month rolling data
- [ ] Profitability + Counterparties tabs hidden for `INDIVIDUAL` borrowers
- [ ] No regression on existing collateral / guarantee flows

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Profitability data may not be available for all applications | All fields nullable; tab shows empty state with "Enter from CBS/Treasury system" prompt |
| `KeyCounterparty` scoped to `borrowerProfile` not `application` — counterparties are borrower-level facts | Correct design: reuses across applications. If application-specific override needed, add `applicationId` FK later. |
| Extending Director/Shareholder adds PII-adjacent fields (DoB, nationality) | Phase 6 (PII hardening) will review. For Phase 4, store as plaintext with same-column-name clarity as existing `nricPassportEncrypted`. |
| Collateral dual-valuation adds new columns without renaming existing ones | Safest migration path: existing `marketValue` = Panel Valuer primary value; PMMD = new additive columns. Document this convention in schema comments. |
