# Credit Assessment Module — Phase 3 Implementation Plan
## Enhancement (Weeks 14–24)

**Date:** 2026-06-06  
**Source:** Enterprise Audit Rev 4  
**Prerequisite:** Phase 1 and Phase 2 complete and stable in production.  
**Objective:** Expand commercial coverage — multi-branch, Islamic banking, portfolio risk management, UX polish, and API documentation. No external API dependencies in this phase.  
**Total Estimated Effort:** ~12 weeks (items highly parallelisable)

---

## Summary of Items

| # | Item | Effort | Track |
|---|------|--------|-------|
| 3.1 | Multi-branch support | 2 weeks | Full stack |
| 3.2 | Islamic banking facility types | 3 weeks | Full stack |
| 3.3 | Portfolio concentration limit management | 2 weeks | Full stack |
| 3.4 | FATCA/CRS declaration model | 1 week | Backend |
| 3.5 | UX consolidation | 3 weeks | Frontend |
| 3.6 | OpenAPI spec generation | 1 week | Backend |

**Deferred (external API dependency):**
- ~~AI Credit Memo~~ — deferred, requires LLM API
- ~~AI Financial Statement Extraction~~ — deferred, requires OCR + LLM API
- ~~Core banking feed~~ — deferred, requires core banking API
- ~~Live bureau API~~ — deferred, requires external connectivity
- ~~E-sign provider~~ — deferred, requires e-sign provider API

**Recommended parallel tracks:**
- Track A (Full stack): 3.1 → 3.3
- Track B (Full stack): 3.2
- Track C (Backend): 3.4 → 3.6
- Track D (Frontend): 3.5 (can start week 14 independently)

---

## Item 3.1 — Multi-Branch Support

**Effort:** 2 weeks  
**Track:** Full stack  
**Audit Reference:** ER-2

### Context
No `branchId` on `CreditApplication` or `BorrowerProfile`. A multi-branch lender cannot scope views, approval matrices, or SLA policies to a specific branch. Each branch operates with its own credit portfolio, team, and reporting.

### Schema Changes

```prisma
model Branch {
  id        String  @id @default(uuid()) @db.Uuid
  code      String  @unique @db.VarChar(20)   // e.g. KL, PG, JB
  name      String  @db.VarChar(255)
  region    String? @db.VarChar(100)
  isActive  Boolean @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  applications     CreditApplication[]
  borrowerProfiles BorrowerProfile[]
  slaOverrides     CreditSlaPolicyBranchOverride[]

  @@map("branches")
}

model CreditSlaPolicyBranchOverride {
  id         String   @id @default(uuid()) @db.Uuid
  policyId   String   @map("policy_id") @db.Uuid
  branchId   String   @map("branch_id") @db.Uuid
  slaHours   Int      @map("sla_hours")
  isActive   Boolean  @default(true) @map("is_active")

  policy  CreditSlaPolicy @relation(fields: [policyId], references: [id])
  branch  Branch          @relation(fields: [branchId], references: [id])

  @@unique([policyId, branchId])
  @@map("credit_sla_policy_branch_overrides")
}
```

Add `branchId` to `CreditApplication` and `BorrowerProfile`:
```prisma
// CreditApplication
branchId  String?  @map("branch_id") @db.Uuid
branch    Branch?  @relation(fields: [branchId], references: [id])

// BorrowerProfile
branchId  String?  @map("branch_id") @db.Uuid
branch    Branch?  @relation(fields: [branchId], references: [id])
```

Add `branchId` to `CreditApprovalMatrix` to allow branch-specific authority levels:
```prisma
branchId  String?  @map("branch_id") @db.Uuid   // null = applies to all branches
branch    Branch?  @relation(fields: [branchId], references: [id])
```

Run migration: `npx prisma migrate dev --name add_branch_support`

### Backend Changes

**File:** `backend/src/credit/services/branch.service.ts` *(new)*
```typescript
// CRUD for Branch model
list(), getOne(id), create(dto), update(id, dto), deactivate(id)
```

**File:** `backend/src/credit/routes/branch.routes.ts` *(new)*
```
GET    /api/v1/credit/branches
POST   /api/v1/credit/branches          (credit:admin)
PATCH  /api/v1/credit/branches/:id      (credit:admin)
```

**Scoping changes across existing services:**

- `creditApplication.service.ts` — `list()` filters by `branchId` if provided in query; RM-scope filter already in place, add branch-scope filter.
- `approvalMatrix.service.ts` — `lookupAuthority()` checks branch-specific matrix first, falls back to global matrix.
- `creditSla.service.ts` — `checkEscalations()` applies branch override if present.
- `dashboard.service.ts` — all KPIs accept optional `branchId` filter.
- `reports.service.ts` — all reports accept optional `branchId` filter.

**User model** — add `branchId` to `User` (nullable) to auto-scope RM views:
```prisma
// Extend existing User model
branchId  String?  @map("branch_id") @db.Uuid
branch    Branch?  @relation(fields: [branchId], references: [id])
```

### Frontend Changes

**File:** `frontend/pages/credit/CreditDashboard.tsx`

Add branch filter dropdown in dashboard header (visible to Admin; pre-filtered to own branch for RM).

**File:** `frontend/pages/credit/CreditApplicationWizard.tsx`

Add branch selector step (pre-filled from current user's branch; overridable by admin).

**File:** `frontend/pages/credit/CreditReports.tsx`

Add branch filter to all reports.

### Seed Changes

Seed 3 sample branches: HQ, Branch-North, Branch-South. Assign existing seed users to branches.

### Acceptance Criteria
- [ ] Branch model seeded with at least 3 branches.
- [ ] New applications capture `branchId`; existing records accept null (backward compatible).
- [ ] RM users see only their branch's applications by default.
- [ ] Admin can view and filter across all branches.
- [ ] Approval matrix supports branch-specific authority overrides.
- [ ] SLA policies support branch-specific hour overrides.
- [ ] Dashboard and reports filterable by branch.

---

## Item 3.2 — Islamic Banking Facility Types

**Effort:** 3 weeks  
**Track:** Full stack  
**Audit Reference:** MF-6

### Context
`FacilityType` enum already includes `MURABAHAH`, `MUSHARAKA`, `IJARAH`, `WAKALA`. No Islamic-specific fields or UI exist. This item adds type-specific data models and screens for the four primary Islamic products.

### Schema Changes

```prisma
// Islamic product-specific details (one per ApplicationFacility for Islamic types)
model IslamicFacilityDetail {
  id                  String   @id @default(uuid()) @db.Uuid
  facilityId          String   @unique @map("facility_id") @db.Uuid
  islamicStructure    String   @map("islamic_structure") @db.VarChar(50) // MURABAHAH | MUSHARAKA | IJARAH | WAKALA

  // Murabahah fields
  costPrice           Decimal? @map("cost_price") @db.Decimal(15, 2)
  salePrice           Decimal? @map("sale_price") @db.Decimal(15, 2)         // cost + profit
  profitAmount        Decimal? @map("profit_amount") @db.Decimal(15, 2)       // = salePrice - costPrice
  profitRatePct       Decimal? @map("profit_rate_pct") @db.Decimal(6, 4)
  assetDescription    String?  @map("asset_description") @db.Text
  assetSupplierId     String?  @map("asset_supplier_id") @db.VarChar(255)

  // Musharaka fields
  bankSharePct        Decimal? @map("bank_share_pct") @db.Decimal(6, 4)      // bank's equity stake %
  customerSharePct    Decimal? @map("customer_share_pct") @db.Decimal(6, 4)  // customer's equity stake %
  profitSharingRatio  String?  @map("profit_sharing_ratio") @db.VarChar(20)  // e.g. 70:30
  lossSharingRatio    String?  @map("loss_sharing_ratio") @db.VarChar(20)    // typically pro-rata to share

  // Ijarah fields
  leasedAssetDesc     String?  @map("leased_asset_desc") @db.Text
  rentalAmountMonthly Decimal? @map("rental_amount_monthly") @db.Decimal(15, 2)
  residualValue       Decimal? @map("residual_value") @db.Decimal(15, 2)     // at end of lease
  transferOfOwnership Boolean  @default(false) @map("transfer_of_ownership") // Ijarah Muntahia Bittamleek

  // Wakala fields
  wakalaFeeAmountPct  Decimal? @map("wakala_fee_amount_pct") @db.Decimal(6, 4)
  expectedProfitRatePct Decimal? @map("expected_profit_rate_pct") @db.Decimal(6, 4)
  investmentPurpose   String?  @map("investment_purpose") @db.Text

  // Shariah compliance
  shariahAdvisorName  String?  @map("shariah_advisor_name") @db.VarChar(255)
  shariahApprovedAt   DateTime? @map("shariah_approved_at") @db.Date
  shariahRefNo        String?  @map("shariah_ref_no") @db.VarChar(100)
  shariahNotes        String?  @map("shariah_notes") @db.Text

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  facility ApplicationFacility @relation(fields: [facilityId], references: [id], onDelete: Cascade)

  @@map("islamic_facility_details")
}
```

Run migration: `npx prisma migrate dev --name add_islamic_facility_detail`

### Backend Changes

**File:** `backend/src/credit/services/islamicFacility.service.ts` *(new)*
```typescript
upsert(facilityId, dto)       // create or update Islamic detail
getByFacility(facilityId)
validateStructure(facilityId) // check required fields per structure type are filled
```

**File:** `backend/src/credit/routes/islamicFacility.routes.ts` *(new)*
```
GET  /api/v1/credit/applications/:id/facilities/:facilityId/islamic
PUT  /api/v1/credit/applications/:id/facilities/:facilityId/islamic
```

**Pricing engine integration (from 2.1):**
For Islamic facilities, `PricingWorksheet.baseRateType` should accept `PROFIT_RATE`; `ratePct` displays as "Profit Rate" rather than "Interest Rate" in the LOO and CA Memo.

**CA Memo PDF** — `caMemoPdf.service.ts`:
- Detect Islamic facility types; render Shariah-specific terminology (Profit Rate, Murabahah Sale Price, etc.) instead of conventional terms.
- Include Shariah advisor name + ref number in the facility section.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/FacilitiesTab.tsx`

When a facility's `facilityType` is `MURABAHAH`, `MUSHARAKA`, `IJARAH`, or `WAKALA`, render an **Islamic Detail sub-panel** with type-specific fields:

- **Murabahah:** Cost Price, Sale Price (auto-computed: cost + profit), Profit Amount, Profit Rate %, Asset Description, Supplier.
- **Musharaka:** Bank Share %, Customer Share %, Profit Sharing Ratio, Loss Sharing Ratio.
- **Ijarah:** Asset Description, Monthly Rental, Residual Value, Transfer of Ownership toggle (Ijarah Muntahia Bittamleek).
- **Wakala:** Wakala Fee %, Expected Profit Rate %, Investment Purpose.

All types: Shariah Advisor Name, Shariah Approval Date, Shariah Ref No, Shariah Notes.

Display terminology adapts: "Rate" → "Profit Rate", "Interest" → "Profit", "Loan" → "Facility".

### Acceptance Criteria
- [ ] Islamic detail sub-panel shown only for Islamic facility types.
- [ ] All type-specific fields saved and retrieved correctly.
- [ ] CA Memo PDF uses Shariah-compliant terminology for Islamic facilities.
- [ ] LOO PDF uses correct Islamic product terminology.
- [ ] Conventional and Islamic facilities can coexist on the same application.
- [ ] Shariah approval details included in approval pack.

---

## Item 3.3 — Portfolio Concentration Limit Management

**Effort:** 2 weeks  
**Track:** Full stack  
**Audit Reference:** MF-9

### Context
No portfolio-level concentration limit management. Cannot monitor single-borrower, single-industry, or single-product concentration vs. regulatory limits.

### Schema Changes

```prisma
enum ConcentrationDimension {
  SINGLE_BORROWER
  BORROWER_GROUP
  INDUSTRY
  PRODUCT_TYPE
  GEOGRAPHY
  COLLATERAL_TYPE
}

model ConcentrationLimit {
  id            String                 @id @default(uuid()) @db.Uuid
  name          String                 @db.VarChar(255)
  dimension     ConcentrationDimension
  dimensionKey  String?                @map("dimension_key") @db.VarChar(100) // e.g. industry code, product type value
  limitAmount   Decimal?               @map("limit_amount") @db.Decimal(15, 2) // absolute MYR limit
  limitPct      Decimal?               @map("limit_pct") @db.Decimal(6, 4)    // % of total portfolio
  warningPct    Decimal                @default(0.9) @map("warning_pct") @db.Decimal(4, 3) // alert at 90%
  isActive      Boolean                @default(true) @map("is_active")
  effectiveFrom DateTime               @map("effective_from") @db.Date
  effectiveTo   DateTime?              @map("effective_to") @db.Date
  createdAt     DateTime               @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt     DateTime               @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("concentration_limits")
}
```

Run migration: `npx prisma migrate dev --name add_concentration_limits`

### Backend Changes

**File:** `backend/src/credit/services/concentrationLimit.service.ts` *(new)*

```typescript
// CRUD for limits
list(), getOne(id), create(dto), update(id, dto), deactivate(id)

// Core check — called on approval decision and disbursement readiness
async checkConcentration(applicationId: string): Promise<ConcentrationCheckResult> {
  const limits = await prisma.concentrationLimit.findMany({ where: { isActive: true } });
  const results = [];

  for (const limit of limits) {
    const currentExposure = await this.computeCurrentExposure(limit.dimension, limit.dimensionKey);
    const projectedExposure = currentExposure + applicationFacilityTotal;
    const portfolioTotal = await this.getTotalPortfolioExposure();

    const limitValue = limit.limitAmount ?? (portfolioTotal * limit.limitPct);
    const utilisation = projectedExposure / limitValue;

    results.push({
      limitId: limit.id,
      name: limit.name,
      currentExposure,
      projectedExposure,
      limitValue,
      utilisationPct: utilisation,
      isBreached: utilisation > 1.0,
      isWarning: utilisation > limit.warningPct,
    });
  }

  return {
    allPass: results.every(r => !r.isBreached),
    results,
  };
}
```

Wire concentration check into `approvalMatrix.service.ts` — on approval decision, run concentration check:
- If breached: block approval (hard stop, requires `credit:admin` override).
- If warning: proceed but log a `CreditAuditEvent` with warning details.

**File:** `backend/src/credit/routes/concentrationLimit.routes.ts` *(new)*
```
GET  /api/v1/credit/concentration-limits           — list all limits
POST /api/v1/credit/concentration-limits           — create (credit:admin)
PATCH /api/v1/credit/concentration-limits/:id      — update (credit:admin)
GET  /api/v1/credit/concentration-limits/check/:applicationId — check application
```

### Frontend Changes

**File:** `frontend/pages/credit/CreditDashboard.tsx`

Add **Concentration Risk card**:
- Bar chart: each active limit shown as a progress bar (current % of limit used).
- Green < 80%, Amber 80–100%, Red > 100%.
- Click limit → drill-down list of applications contributing to that dimension.

**File:** `frontend/pages/credit/tabs/ApprovalsTab.tsx`

Show concentration check results before approver can submit decision:
- Green badge if all pass.
- Warning badge if approaching limit — approver can proceed with acknowledgement.
- Red banner + block if limit breached — only `credit:admin` can override.

**File:** Admin settings area — `ConcentrationLimitSettings.tsx` *(new)*
- CRUD screen for managing limit definitions (dimension, key, limit amount/%, warning threshold, effectiveFrom/To).

### Acceptance Criteria
- [ ] Concentration limits configurable by admin per dimension.
- [ ] Check runs automatically on approval decision.
- [ ] Warning (80–100%): approver notified, can proceed with acknowledgement logged.
- [ ] Breach (>100%): approval blocked; `credit:admin` override required with reason.
- [ ] Dashboard shows real-time concentration utilisation.

---

## Item 3.4 — FATCA/CRS Declaration Model

**Effort:** 1 week  
**Track:** Backend  
**Audit Reference:** RC-4

### Context
No FATCA/CRS self-certification model. Required for cross-border lending and regulatory reporting for foreign individual borrowers or UBOs with overseas tax residency.

### Schema Changes

```prisma
enum FatcaEntityClassification {
  INDIVIDUAL
  ACTIVE_NFE          // Active Non-Financial Entity
  PASSIVE_NFE         // Passive Non-Financial Entity
  FINANCIAL_INSTITUTION
}

model FatcaCrsDeclaration {
  id                    String                    @id @default(uuid()) @db.Uuid
  borrowerProfileId     String                    @map("borrower_profile_id") @db.Uuid
  declarationDate       DateTime                  @map("declaration_date") @db.Date
  isUsPerson            Boolean                   @map("is_us_person")
  usTin                 String?                   @map("us_tin") @db.VarChar(50)         // encrypted
  entityClassification  FatcaEntityClassification @map("entity_classification")
  crsResidencies        Json                      @map("crs_residencies")
  // JSON: [{ country: "US", tin: "xxx-xx-xxxx" }, { country: "AU", tin: "..." }]
  selfCertifiedById     String                    @map("self_certified_by_id") @db.Uuid
  verifiedById          String?                   @map("verified_by_id") @db.Uuid
  verifiedAt            DateTime?                 @map("verified_at") @db.Timestamp(6)
  expiryDate            DateTime?                 @map("expiry_date") @db.Date           // typically 3 years
  createdAt             DateTime                  @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt             DateTime                  @updatedAt @map("updated_at") @db.Timestamp(6)

  borrowerProfile   BorrowerProfile @relation(fields: [borrowerProfileId], references: [id])
  selfCertifiedBy   User            @relation("FatcaSelfCertifiedBy", fields: [selfCertifiedById], references: [id])
  verifiedBy        User?           @relation("FatcaVerifiedBy", fields: [verifiedById], references: [id])

  @@map("fatca_crs_declarations")
}
```

Run migration: `npx prisma migrate dev --name add_fatca_crs_declaration`

### Backend Changes

**File:** `backend/src/credit/services/fatcaCrs.service.ts` *(new)*
```typescript
upsert(borrowerProfileId, selfCertifiedById, dto)
getByBorrower(borrowerProfileId)
verify(declarationId, verifiedById)
checkExpiry(borrowerProfileId): Promise<{ expired: boolean, expiryDate }>
```

Encrypt `usTin` using existing `encryption.service.ts`.

**File:** `backend/src/credit/routes/fatcaCrs.routes.ts` *(new)*
```
GET   /api/v1/credit/borrowers/:borrowerId/fatca-crs
PUT   /api/v1/credit/borrowers/:borrowerId/fatca-crs
PATCH /api/v1/credit/borrowers/:borrowerId/fatca-crs/verify
```

Add FATCA/CRS completeness check to `submissionReadiness.service.ts` for foreign borrowers (where `amlRiskTier` is MEDIUM or HIGH): warn if no valid, unexpired FATCA/CRS declaration on file.

### Frontend Changes

**File:** `frontend/pages/credit/tabs/BorrowerProfileTab.tsx`

Add **FATCA/CRS Declaration section** (collapsible):
- Is US Person toggle.
- US TIN field (if US Person = Yes).
- Entity classification dropdown.
- CRS Tax Residency table: country selector + TIN per row (add/remove rows).
- Declaration date, expiry date.
- Verified by + verified at (visible to credit:approve role).

### Acceptance Criteria
- [ ] FATCA/CRS declaration saved per borrower with `usTin` encrypted.
- [ ] Expiry tracked; submission readiness warns if declaration expired.
- [ ] Verification (second person) required before declaration considered complete.
- [ ] CRS residencies stored as structured JSON (array of country + TIN objects).

---

## Item 3.5 — UX Consolidation

**Effort:** 3 weeks  
**Track:** Frontend  
**Audit Reference:** UX-1 through UX-10

### Sub-items

#### 3.5a — Tab Grouping (1 week)

**File:** `frontend/pages/credit/tabRegistry.ts`

Consolidate 35+ tabs into 10 named section groups with expandable sub-navigation:

| Group | Tabs Included |
|---|---|
| 1. Overview | SummaryTab, HeaderBackgroundTab |
| 2. Borrower & Parties | BorrowerProfileTab, PartiesTab, DirectorsTab, ShareholdersTab, UBOsTab, CounterpartiesTab |
| 3. Facilities & Exposure | LoanRequestTab, FacilitiesTab, RetailFacilitiesTab, ExposureSummaryTab |
| 4. Financial Analysis | FinancialsTab, PaymentCapabilityTab, IndustryOutlookTab |
| 5. Risk & Scoring | RiskScoreTab, QualitativeAssessmentTab, RiskMitigatorsTab, EsgTab, SicrTab, ForwardLookingRiskTab |
| 6. Collateral & Security | CollateralTab, SecurityGuaranteesTab |
| 7. Approval & Governance | ApprovalsTab, SignoffTab, ConditionsTab, RiskRatingEclTab |
| 8. Documents | DocumentsTab, CreditChecksTab |
| 9. Post-Disbursement | DisbursementTab, AccountConductTab, ProfitabilityWalletTab |
| 10. Audit | AuditTab |

Replace tab bar with a left-side vertical section menu (collapsible groups). Active section highlighted. Keyboard-navigable.

#### 3.5b — Application Progress Bar (3 days)

**File:** `frontend/pages/CreditApplicationDetail.tsx`

Add a progress ring in the application header: `{filledRequiredFields} / {totalRequiredFields} complete`.

Logic: each tab component exposes a `completionStatus(): { required: number, filled: number }` method. Aggregate across all tabs for the ring value.

Colour: Red < 50%, Amber 50–80%, Green > 80%.

#### 3.5c — Autosave Status Indicator (2 days)

**File:** `frontend/src/components/credit/AutosaveTextField.tsx`

Add a subtle "Saved" indicator after successful save:
- Show a fading "✓ Saved" chip for 2 seconds after each successful save.
- Show "Saving..." spinner during the debounce window.
- Show "⚠ Save failed — retry" on error with a retry button.

Apply the same indicator pattern to all numeric inputs and dropdowns with autosave.

#### 3.5d — Application Timeline View (3 days)

**File:** `frontend/src/components/credit/ApplicationTimeline.tsx` *(new)*

A horizontal stepper showing the application's state journey:
- Each state node: label, date entered, days spent in state.
- Active state highlighted.
- Completed states show green checkmark.
- Rejected/Declined states show red X.

Derive from `CreditAuditEvent` records (eventType: state transitions, filtered by applicationId).

Embed in application detail header, collapsible.

#### 3.5e — Smart Filter Quick Views (2 days)

**File:** `frontend/pages/CreditApplicationList.tsx`

Add filter chip bar above the list with pre-built quick views:

| Chip | Filter |
|---|---|
| My Applications | `assignedRmId = currentUser.id` |
| Pending My Approval | `approvalStatus = PENDING AND approver includes currentUser` |
| Overdue SLA | `slaBreaches.unresolved > 0` |
| In Committee | `state = COMMITTEE_REVIEW` |
| Expiring Offers | `state = OFFER AND looExpiryDate < now() + 5 days` |
| All | clear filters |

Active chip highlighted. Multiple chips cannot be combined (mutually exclusive).

#### 3.5f — Empty State Design (2 days)

**Files:** CollateralTab, CreditChecksTab, DocumentsTab, MonitoringTab, AuditTab

For each tab with no data yet:
- Illustrated empty state (simple SVG icon + label).
- Descriptive sub-text explaining what goes here.
- Primary CTA button ("Add Collateral", "Upload Document", etc.).

Example:
```
[shield icon]
No collateral recorded
Add collateral items to support the facility request.
[+ Add Collateral]
```

### Acceptance Criteria
- [ ] 35+ tabs consolidated into 10 grouped sections; left-nav visible and keyboard-navigable.
- [ ] Progress ring in application header updates as fields are filled.
- [ ] Autosave indicator visible after every save; error state shown on failure.
- [ ] Application timeline shows all state transitions with dates and days-in-state.
- [ ] Quick filter chips functional; URL query params reflect active filter.
- [ ] Empty states implemented for all data-entry tabs.

---

## Item 3.6 — OpenAPI Spec Generation

**Effort:** 1 week  
**Track:** Backend  
**Audit Reference:** ER-4

### Context
85+ credit routes exist with no external documentation. A published OpenAPI spec enables: future third-party integration, internal developer onboarding, and API contract testing.

### Backend Changes

Install: `npm install swagger-ui-express swagger-jsdoc` (or use `@fastify/swagger` equivalent).

**File:** `backend/src/credit/docs/openapi.ts` *(new)*

Define the OpenAPI 3.0 spec document structure:
```typescript
export const creditApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Credit Assessment Module API',
    version: '1.0.0',
    description: 'Internal API for credit origination, underwriting, and governance.',
  },
  servers: [{ url: '/api/v1/credit' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
};
```

Add JSDoc annotations to each route file using `@openapi` or swagger-jsdoc `@swagger` tags. Prioritise:
1. Application lifecycle routes (CRUD + transitions)
2. Approval routes
3. Disbursement routes (new from Phase 1)
4. Bureau checklist routes
5. Financial routes

**Mount docs endpoint:**
```typescript
// backend/src/routes/index.ts
app.use('/api/v1/credit/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

Access at: `http://localhost:3000/api/v1/credit/docs`

**Export spec file:** Add build script to generate `credit-api-spec.json` for version control and CI contract testing:
```json
// package.json
"generate:credit-api-spec": "ts-node scripts/generateCreditApiSpec.ts"
```

### Acceptance Criteria
- [ ] Swagger UI accessible at `/api/v1/credit/docs` (dev environment only, behind `credit:admin` auth in production).
- [ ] All Phase 1 and Phase 2 new routes documented.
- [ ] All existing application, approval, and financial routes documented.
- [ ] `credit-api-spec.json` generated and committed to `/docs/` for version control.
- [ ] Schema models (request/response bodies) defined in OpenAPI components.

---

## Phase 3 Delivery Checklist

| Item | Schema Migration | Backend Service | API Route | Frontend UI | Done |
|---|---|---|---|---|---|
| 3.1 Multi-branch | `Branch`, `branchId` on App/Borrower/User/Matrix | `branch.service.ts` + scoping updates | GET/POST branches | Dashboard/wizard/reports branch filter | ☐ |
| 3.2 Islamic banking | `IslamicFacilityDetail` | `islamicFacility.service.ts` | GET/PUT islamic | FacilitiesTab Islamic sub-panel | ☐ |
| 3.3 Concentration limits | `ConcentrationLimit` | `concentrationLimit.service.ts` | GET/POST limits + check | Dashboard card + approval gate | ☐ |
| 3.4 FATCA/CRS | `FatcaCrsDeclaration` | `fatcaCrs.service.ts` | GET/PUT/PATCH | BorrowerProfileTab declaration section | ☐ |
| 3.5 UX consolidation | — | — | — | Tab grouping, progress bar, autosave, timeline, filters, empty states | ☐ |
| 3.6 OpenAPI spec | — | swagger-jsdoc setup | `/credit/docs` | — | ☐ |

**Definition of Done for Phase 3:**
- All migrations applied cleanly.
- Seed re-run passes without errors.
- Branch seeded with 3 sample branches; existing data assigned to HQ branch.
- Smoke test passes.
- No TypeScript errors.
- OpenAPI spec file committed to `docs/credit-api-spec.json`.
- Full user acceptance testing sign-off before release.

---

## Deferred Items Register

The following items require external API connectivity and are explicitly deferred. They will be re-evaluated when connectivity is available.

| Item | Dependency | Re-evaluation Trigger |
|---|---|---|
| Live bureau API (CTOS/CCRIS adapter) | CTOS API subscription + CCRIS access | When API agreement signed |
| Core banking feed | Core banking REST API | When core banking vendor provides API credentials |
| E-sign provider integration | DocuSign / SigningCloud API | When e-sign provider procured |
| AI Credit Memo generation | LLM API (Claude) | When AI integration approved |
| AI Financial Statement Extraction | OCR + LLM API | When AI integration approved |

Until these are implemented, the compliant manual workarounds documented in the audit report (Rev 4) remain in effect.
