# Non-Bank Lending Platform Improvements — Design Spec
**Date:** 2026-05-31  
**Author:** KY  
**Scope:** Credit Assessment module (S1–S7), both retail and corporate borrower segments

---

## Background & Context

The current S1–S7 credit application flow was designed with bank-grade assumptions:
- Full audited financial statements required for all borrowers
- 40% of the risk score (qualitative factors) permanently defaults to a neutral 50 — scores are partially fictional
- S5 bureau checks are a placeholder shell with no actual data capture
- Document gates treat all borrower types identically (NRIC + AUDITED_FINANCIALS for everyone)
- No concept of individual DSR (Debt Service Ratio) or salary-based repayment capacity

As a **non-bank lender serving both retail individuals and corporate/SME customers**, these gaps mean:
1. Risk scores do not reflect actual borrower quality
2. Retail RMs are forced to use the wrong financial spreading tool
3. Bureau data (CCRIS/CTOS) — the most critical external signal — is not captured at all
4. Compliance gates are inconsistent across borrower types

---

## Improvement Waves

### Wave 1 — Fix the Scoring Blind Spot (Qualitative Factors)

**Problem:** Factors management quality, relationship/behavioural, industry outlook, and collateral quality always score 50/100, contributing meaningless weight to the final risk score.

**Solution:** Add a Qualitative Assessment sub-tab in S4 (Risk Score) with RM-scored sliders.

#### New UI: Qualitative Assessment Sub-tab

Located within S4, after the existing scorecard run section.

Four sliders, each rated 1–5 with anchor descriptions:

| Factor | 1 (Weak) | 3 (Neutral) | 5 (Strong) |
|--------|----------|-------------|------------|
| Management Quality | No track record, high turnover | Adequate experience | Experienced team, clear succession plan |
| Relationship & History | New customer, no history | 1–2 years, minor issues | 5+ years, zero delinquency |
| Industry Outlook | Declining sector, unfavourable regulation | Stable, moderate growth | High-growth, favourable regulatory trend |
| Collateral Quality | No collateral / unsecured | Tangible asset, moderate liquidity | Liquid, fully insured, professionally valued |

**Slider-to-score mapping:**
```
1 → 10  (poor)
2 → 32
3 → 50  (neutral — preserves existing behaviour if not rated)
4 → 68
5 → 90  (strong)
```

If RM does not fill a factor, it defaults to 50 (current behaviour preserved).

#### New Data Model: `QualitativeAssessment`

```prisma
model QualitativeAssessment {
  id                  String   @id @default(uuid())
  applicationId       String   @unique
  application         CreditApplication @relation(fields: [applicationId], references: [id])
  managementScore     Int      @default(3)  // 1–5
  relationshipScore   Int      @default(3)
  industryScore       Int      @default(3)
  collateralScore     Int      @default(3)
  assessedById        String
  assessedBy          User     @relation(fields: [assessedById], references: [id])
  assessedAt          DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

#### Scoring Engine Changes (`scoring.service.ts`)

`executeScore()` accepts an optional `QualitativeAssessment` parameter. When present, the 4 qualitative factor scores are sourced from it instead of defaulting to 50.

The slider value (1–5) maps to the score via the lookup table above before being passed as the factor score.

#### S4 Phase Completion

S4 remains complete when `riskRating` is not null. The qualitative assessment is recommended but not a hard gate — an RM can skip it (factors default to 50). A soft warning is shown if any qualitative factor is unrated.

---

### Wave 2 — Retail vs Corporate Bifurcation

**Problem:** The platform has one journey for all borrower types. Retail individuals need DSR-based income assessment, not P&L/balance sheet spreading. Document requirements also differ significantly.

**Solution:** Auto-detect borrower type at application creation and route to the correct flow.

#### A) Retail Mode Detection

When `borrowerProfile.borrowerType === 'INDIVIDUAL'`, the application enters **Retail Mode**. This is set at S2 and does not change. Corporate/SME flows use the existing pathway unchanged.

Retail Mode changes:
- S3 shows the Retail Income Form instead of the Financial Statement spreader
- S5 document checklist uses the retail document set
- Scoring engine applies retail-specific factor weights

#### B) S3 Retail Income Form

Replaces the financial statement module for INDIVIDUAL borrowers only.

**Form fields:**
- Employment type: `SALARIED | SELF_EMPLOYED | COMMISSION_BASED | PENSIONER`
- Employer name
- Monthly gross income (MYR)
- EPF monthly contribution (validates employment legitimacy)
- Existing monthly commitments:
  - Hire purchase / car loans
  - Credit card minimum payments
  - Existing personal loans
  - Other loan obligations
- **Auto-computed DSR:** `(sum of existing commitments + proposed monthly instalment) / gross income × 100`

**DSR gate:**
- DSR ≤ 60%: Pass (green)
- DSR 61–70%: Warning (amber) — RM must note exception reason
- DSR > 70%: Fail (red) — blocked from submission unless override with approval

**New Prisma model: `RetailIncome`**

```prisma
model RetailIncome {
  id                    String   @id @default(uuid())
  applicationId         String   @unique
  application           CreditApplication @relation(fields: [applicationId], references: [id])
  employmentType        EmploymentType
  employerName          String?
  monthlyGrossIncome    Decimal
  epfMonthlyAmount      Decimal?
  hirePurchaseCommitment Decimal @default(0)
  creditCardCommitment  Decimal @default(0)
  existingLoanCommitment Decimal @default(0)
  otherCommitments      Decimal @default(0)
  proposedInstalment    Decimal?  // auto-calculated or RM input
  dsrPercent            Decimal?  // computed: (total obligations / gross income) × 100
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum EmploymentType {
  SALARIED
  SELF_EMPLOYED
  COMMISSION_BASED
  PENSIONER
}
```

**S3 completion for retail:** `RetailIncome` record exists with `monthlyGrossIncome > 0`.

#### C) Document Checklist Per Borrower Type

`submissionReadiness.service.ts` replaces the hard-coded `['NRIC_PASSPORT', 'AUDITED_FINANCIALS']` with a `getRequiredDocuments(borrowerType)` lookup:

| Borrower Type | Required Documents |
|--------------|-------------------|
| INDIVIDUAL | `NRIC_PASSPORT`, `PAYSLIP` (latest 3 months), `BANK_STATEMENT` (3 months) |
| CORPORATE | `SSM_CERT`, `AUDITED_FINANCIALS`, `MOA_AOA` |
| SOLE_PROPRIETOR | `NRIC_PASSPORT`, `SSM_CERT`, `BANK_STATEMENT` (6 months) |
| JOINT_VENTURE | `JV_AGREEMENT`, `AUDITED_FINANCIALS`, `NRIC` (all JV partners) |

The `DocumentsTab` filters the document upload category list by borrower type so retail RMs do not see "Upload Audited Financials".

**New document classification enum values to add:**
`PAYSLIP`, `SSM_CERT`, `MOA_AOA`, `JV_AGREEMENT`

#### D) Retail Scoring Weight Adjustment

When `application.borrowerType === 'INDIVIDUAL'`, the scoring engine uses a different weight profile:

| Factor | Corporate Weight | Retail Weight | Reason |
|--------|-----------------|---------------|--------|
| Cashflow / DSR | 18% | 25% | Salary stability is primary signal |
| Financial Performance | 15% | 12% | Less relevant for salaried individuals |
| Leverage | 15% | 10% | Personal leverage differs from business |
| Liquidity | 12% | 10% | Less applicable |
| Relationship & History | 10% | 15% | Payment history more predictive for retail |
| Management Quality | 10% | 0% | Not applicable for individuals |
| Industry Outlook | 7% | 0% | Not applicable for salaried employment |
| Collateral Quality | 5% | 8% | Hire purchase / property still relevant |
| Market Conditions | 8% | 20% | Employment market conditions matter more |

The active `CreditScorecardVersion` gains a `borrowerTypeOverrides` JSON field to store per-type weight sets. If no override is defined, the default weight set applies.

---

### Wave 3 — Bureau & Compliance Uplift

**Problem:** S5 is a non-functional shell. An RM can mark bureau checks "done" with zero evidence. No structured bureau data is captured. Adverse bureau findings have no impact on the risk score.

**Solution:** Structured bureau data entry + PDF upload evidence + automatic rating caps on adverse findings.

#### A) Structured Bureau Data Entry

The `CreditBureauCheck` model gains structured fields:

```prisma
model CreditBureauCheck {
  // existing fields ...
  
  // CCRIS structured fields
  ccrisOutstandingFacilities  Int?
  ccrisTotalOutstandingBalance Decimal?
  ccrisSaaFlag                Boolean @default(false)
  ccrisSaaCount               Int?
  ccrisMissedPayments12Months Int?     // 0–12
  ccrisBankruptcyFlag         Boolean @default(false)
  ccrisLegalActionFlag        Boolean @default(false)
  ccrisReportDate             DateTime?
  
  // CTOS structured fields
  ctosScore                   Int?     // 0–1000
  ctosAdverseFlag             Boolean @default(false)
  ctosAdverseDetails          String?
  ctosBankruptcyFlag          Boolean @default(false)
  ctosDirectorshipsCount      Int?
  ctosReportDate              DateTime?
  
  // Common
  reportDocumentId            String?  // FK to uploaded document
}
```

The S5 UI (CreditChecksTab) shows a form for each check type. RM uploads PDF first, then fills the structured fields from the report. The PDF upload uses the existing S3 document pipeline.

**Report freshness:** CCRIS and CTOS reports must be dated within 90 days of submission. Reports older than 90 days show a warning and block submission.

#### B) Bureau Risk Flag → Rating Downgrade Cap

After computing the base risk score, `scoring.service.ts` applies automatic rating caps:

| Adverse Finding | Maximum Allowed Rating |
|----------------|----------------------|
| No adverse findings | No cap (full score applies) |
| CCRIS missed payments ≥ 3 | BB |
| CCRIS SAA account present | BBB |
| CCRIS legal action flag | B |
| CTOS adverse record | BB |
| CTOS score < 500 | BB |
| CTOS score < 300 | B |
| Bankruptcy flag (either bureau) | C |

Caps are applied as: `effectiveRating = min(baseRating, lowestCap)` where the rating scale is ordered AAA > AA > A > BBB > BB > B > CCC > CC > C > D.

The `CreditScoreRun` stores the base rating before caps and the effective rating after caps, with a `bureauCapsApplied` JSON field listing which caps were triggered.

#### C) S5 RM Checklist

S5 tab adds a structured checklist — section only counts as "complete" when all items are checked:

- [ ] CCRIS report uploaded (dated within 90 days)
- [ ] CTOS report uploaded (dated within 90 days)
- [ ] All structured CCRIS/CTOS fields filled in
- [ ] No unresolved SAA or adverse record — OR — exception documented with reason and approver
- [ ] AML / sanctions name-screening completed

**S5 phase completion logic** (replaces `creditBureauChecks.length > 0`):
```typescript
s5: hasCcrisCheck && hasCtosCehck && allChecklistItemsTicked
```

A `BureauChecklist` record stores each checklist item state with `tickedById` + `tickedAt`.

---

## Implementation Sequence

```
Wave 1 (scoring fix)
  ├── Add QualitativeAssessment Prisma model + migration
  ├── Add qualitative slider sub-tab in S4
  ├── Update scoring.service.ts to accept qualitative inputs
  └── Update S4 phase completion to show soft warning

Wave 2 (retail bifurcation)
  ├── Add RetailIncome Prisma model + migration
  ├── Add EmploymentType enum
  ├── Add new document classification enums
  ├── Build S3 Retail Income Form (shown for INDIVIDUAL)
  ├── Add DSR calculation + threshold gate
  ├── Update submissionReadiness.service.ts → getRequiredDocuments(borrowerType)
  ├── Update DocumentsTab to filter by borrower type
  ├── Add retail weight set to CreditScorecardVersion
  └── Update scoring.service.ts to select weight set by borrowerType

Wave 3 (bureau uplift)
  ├── Extend CreditBureauCheck Prisma model + migration
  ├── Update S5 CreditChecksTab with structured form + PDF upload
  ├── Add bureau checklist model + UI
  ├── Add report freshness validation (90-day gate)
  ├── Update scoring.service.ts to apply rating downgrade caps
  ├── Update CreditScoreRun to store base vs effective rating
  └── Update S5 phase completion logic
```

---

## Files Impacted

**Backend:**
- `backend/prisma/schema.prisma` — 3 new models, extended existing models
- `backend/src/credit/services/scoring.service.ts` — qualitative input, weight sets, bureau caps
- `backend/src/credit/services/submissionReadiness.service.ts` — per-type doc gates, bureau freshness
- `backend/src/credit/controllers/scoring.controller.ts` — qualitative assessment endpoints
- New: `backend/src/credit/services/retailIncome.service.ts`
- New: `backend/src/credit/services/bureauCheck.service.ts`

**Frontend:**
- `frontend/pages/credit/tabs/RiskScoreTab.tsx` — qualitative sliders sub-tab
- `frontend/pages/credit/tabs/FinancialsTab.tsx` — retail income form vs corporate spreader
- `frontend/pages/credit/tabs/CreditChecksTab.tsx` — structured bureau form + checklist
- `frontend/pages/credit/tabs/DocumentsTab.tsx` — filter by borrower type
- `frontend/pages/credit/creditUtils.ts` — updated phase completion logic for S3, S5
- `frontend/src/services/credit.service.ts` — new API calls

---

## Out of Scope

- Live CCRIS/CTOS API integration (Wave 3 uses manual upload only)
- PDF parsing / OCR for bureau reports
- Admin-configurable document requirement rules
- Qualitative factor scoring by anyone other than the assigned RM/analyst
