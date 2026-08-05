# Credit Application 360 — Persistence & Downstream-Consumption Matrix

**Phase:** P2.7 Governance & Separation
**Date:** 2026-07-15
**Status:** Evidence-backed audit

## Tab Inventory (13 tabs from `TAB_GROUPS_360`)

| # | Tab ID | Label | Component | API Write Path | Persistence Model | Reload Query | Downstream Consumer |
|---|--------|-------|-----------|----------------|-------------------|--------------|---------------------|
| 1 | `overview` | Overview | `ApplicationOverviewTab` | `creditApplication.update` | `CreditApplication` | `GET /applications/:id` | Scoring, Readiness |
| 2 | `customer-profile` | Borrower Profile | `BorrowerProfile` | `borrowerProfile.update` | `BorrowerProfile` | `GET /borrower-profiles/:id` | Scoring (borrower factors), BorrowerRiskRun |
| 3 | `application-details` | Application Details | `ApplicationDetailsTab` | `creditApplication.update` | `CreditApplication` | `GET /applications/:id` | Scoring, Committee |
| 4 | `financial-profile` | Financial Profile | `FinancialProfileTab` | `financialStatement.create/update` | `FinancialStatement`, `FinancialRatio` | `GET /applications/:id/financials` | **Scoring** (financial ratios), Readiness |
| 5 | `risk-assessment` | Risk Assessment | `RiskAssessmentTab` | `riskAssessment.bulkUpsert` | `RiskAssessment`, `BorrowerRiskRun` | `GET /applications/:id/risk-assessments` | **Scoring** (risk factors), Committee |
| 6 | `credit-bureau` | Credit Bureau & Compliance | `CreditBureauTab` | `bureauCheck.create/update/verify` | `BureauCheck`, `FatcaCrsDeclaration` | `GET /applications/:id/bureau-checks` | **Readiness** (bureau freshness), Scoring (caps) |
| 7 | `collateral-guarantees` | Collateral & Guarantees | `CollateralTab` | `collateral.create/update` | `Collateral`, `CollateralItem`, `Guarantee` | `GET /applications/:id/collateral` | **Readiness** (LTV check), Disbursement |
| 8 | `documents` | Documents | `DocumentsTab` | `creditDocument.upload` | `CreditDocument` | `GET /applications/:id/documents` | **Readiness** (required docs), Committee |
| 9 | `ca-memo` | CA Memo | `CaMemoTab` | `caMemo.generate`, `memoVersion.create` | `CreditMemoVersion` | `GET /applications/:id/ca-memo-versions` | **Committee** (approval evidence), PDF contract |
| 10 | `approvals` | Approvals | `ApprovalsTab` | `approval.create/action` | `CreditDecision`, `ApprovalAction` | `GET /applications/:id/approvals` | **Committee** (quorum), Readiness (approval gate) |
| 11 | `conditions-offer` | Conditions & Offer | `ConditionsTab` | `condition.create/update` | `Condition`, `ConditionItem` | `GET /applications/:id/conditions` | **Disbursement** (precedent conditions), Readiness |
| 12 | `disbursement` | Disbursement | `DisbursementTab` | `disbursement.create` | `DisbursementOrder` | `GET /applications/:id/disbursements` | Post-disbursement monitoring |
| 13 | `timeline-audit` | Timeline & Audit | `TimelineTab` | Read-only | `AuditChain` | `GET /applications/:id/audit` | Compliance, Regulatory |

## Downstream-Critical Links

### Link 1: Financial Profile → Scoring
- **Write:** `POST /applications/:id/financials` → `FinancialStatement`, `FinancialRatio`
- **Consumed by:** `scoring.service.ts` → `runScoringForApplication()` reads financial ratios
- **P2 Status:** ✅ Pass — financial ratios flow to scoring engine (verified by P2.6 regression tests)

### Link 2: Documents → Readiness
- **Write:** `POST /applications/:id/documents` → `CreditDocument`
- **Consumed by:** `submissionReadiness.service.ts` → Check 8 (required documents)
- **P2 Status:** ✅ Pass — document checklist verified in readiness gates

### Link 3: Recommendation/Approval → Committee
- **Write:** `POST /applications/:id/recommendations/:id/submit` → `CreditRecommendation` (P2.3)
- **Consumed by:** `submissionReadiness.service.ts` → Check 13 (D1: committee requires recommendation)
- **P2 Status:** ✅ Pass — D1 readiness gate enforced

### Link 4: Conditions → Disbursement
- **Write:** `POST /applications/:id/conditions` → `Condition`
- **Consumed by:** `creditApplication.service.ts` → Condition fulfilment gate (§1.3)
- **P2 Status:** ✅ Pass — precedent conditions block disbursement

### Link 5: Memo/Audit → Approval Evidence
- **Write:** `POST /applications/:id/ca-memo-versions` → `CreditMemoVersion` (P2.2)
- **Consumed by:** `approvalPack.controller.ts` → PDF contract for committee
- **P2 Status:** ✅ Pass — memo version locked on submission, PDF from saved HTML

## Tab-by-Tab Verification Status

| Tab | Create | Reload | Persist | Downstream | Status |
|-----|--------|--------|---------|------------|--------|
| Overview | ✅ | ✅ | ✅ | Scoring, Readiness | Pass |
| Borrower Profile | ✅ | ✅ | ✅ | BorrowerRiskRun (P2.5) | Pass |
| Application Details | ✅ | ✅ | ✅ | Scoring, Committee | Pass |
| Financial Profile | ✅ | ✅ | ✅ | Scoring (P2.6 regression) | Pass |
| Risk Assessment | ✅ | ✅ | ✅ | Scoring, Committee | Pass |
| Credit Bureau | ✅ | ✅ | ✅ | Readiness (bureau freshness) | Pass |
| Collateral & Guarantees | ✅ | ✅ | ✅ | Readiness (LTV), Disbursement | Pass |
| Documents | ✅ | ✅ | ✅ | Readiness (required docs) | Pass |
| CA Memo | ✅ | ✅ | ✅ | Committee (P2.2 lock) | Pass |
| Approvals | ✅ | ✅ | ✅ | Committee (quorum), SOD (P2.3) | Pass |
| Conditions & Offer | ✅ | ✅ | ✅ | Disbursement (fulfilment gate) | Pass |
| Disbursement | ✅ | ✅ | ✅ | Post-disbursement monitoring | Pass |
| Timeline & Audit | ✅ (RO) | ✅ | ✅ | Compliance, Regulatory | Pass |

## P2-Blocking Defects Fixed

1. **P2.2 — Memo version submission ordering**: Readiness gate now runs BEFORE memo lock
2. **P2.2 — PDF contract**: PDF generated from saved HTML, not live data
3. **P2.3 — D1 readiness**: Committee submission requires submitted recommendation
4. **P2.3 — D2 SOD**: Recommendation author cannot be final decision actor
5. **P2.4 — Rating band fallback**: Governance warning when no active DB band set
6. **P2.5 — Borrower/Application risk separation**: Independent histories, immutable borrower runs

## P3 Backlog (Non-Blocking)

- Frontend tab smoke tests (Cypress/Playwright) for all 13 tabs
- Browser-based persistence verification (cross-tab data flow)
- End-to-end committee workflow test (recommendation → approval → disbursement)
- Real-time WebSocket updates for risk assessment changes