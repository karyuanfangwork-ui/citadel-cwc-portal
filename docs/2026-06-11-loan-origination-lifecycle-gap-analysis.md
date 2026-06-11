# Loan Origination Lifecycle — Gap Analysis

**Date:** 2026-06-11
**Branch:** dev2.0
**Scope:** Credit Assessment Module (backend `backend/src/credit/`, schema `backend/prisma/schema.prisma`, frontend `frontend/pages/credit/`)
**Reference lifecycle:** 12-stage loan origination process — Application → KYC → Document Collection → Automated Validation → Credit Assessment → Risk Scoring → Credit Recommendation → Approval → Offer Letter → Acceptance → Disbursement → Portfolio Monitoring

---

## Executive Summary

The internal workflow skeleton covers the full lifecycle end-to-end. The 17-state `ApplicationState` machine (`schema.prisma:2505`) already maps to all 12 reference stages:

```
DRAFT → SUBMITTED → KYC_REVIEW → KYC_APPROVED/KYC_REJECTED
      → UNDERWRITING → CREDIT_ASSESSMENT → COMMITTEE_REVIEW
      → APPROVED/REJECTED → OFFER → ACCEPTED → DISBURSED → ACTIVE → CLOSED
      (plus WITHDRAWN, REFERRED_BACK)
```

**Strengths:** document collection, risk scoring, approval governance, offer letter generation, disbursement workflow, and portfolio monitoring are fully implemented with versioning, SOD/maker-checker, and audit-chain logging.

**Weaknesses:** everything that touches the outside world. All six external integration points are placeholder/noop adapters (AML screening, OCR, credit bureau, eKYC/SSM registry, core banking, payment sync). There is no customer-facing channel at any stage, and several stages rely on manual triggers rather than automation.

### Status at a Glance

| # | Stage | Status | Headline Gap |
|---|-------|--------|--------------|
| 1 | Customer Application | 🟡 Partial | Staff-initiated only; no customer self-service intake |
| 2 | KYC Verification | 🟡 Partial | No real IC/SSM/AML verification — adapters are stubs |
| 3 | Document Collection | 🟢 Implemented | OCR stub; no dedicated EPF model |
| 4 | Automated Validation | 🟡 Partial | No rule engine; no active AV scanning job |
| 5 | Credit Assessment | 🟡 Partial | All manual entry; no financial spreading |
| 6 | Risk Scoring | 🟢 Implemented | Manual trigger; no PD/LGD models |
| 7 | Credit Recommendation | 🟡 Partial | No analyst recommendation field |
| 8 | Approval | 🟢 Implemented | Committee vote aggregation detail thin |
| 9 | Offer Letter | 🟢 Implemented | Single static template |
| 10 | Acceptance | 🟡 Partial | Implicit only — no explicit accept endpoint |
| 11 | Disbursement | 🟢 Implemented* | *Core banking adapter is noop |
| 12 | Portfolio Monitoring | 🟢 Implemented* | *Manual payment entry; annual review not automated |

---

## Stage-by-Stage Findings

### Stage 1 — Customer Application: 🟡 Partial

**Implemented:**
- `CreditApplication` model (`schema.prisma:3172`) with state machine, optimistic-concurrency `version`, assigned RM/analyst.
- `POST /api/v1/credit/applications` behind `credit:create` (`creditApplication.routes.ts:90`); creation flow in `creditApplication.service.ts:546`.
- Requires a pre-existing `BorrowerProfile` linked to a CRM Account/Contact.

**Gaps:**
- No customer self-service web form or intake portal — applications are staff-entered (RM/Admin) only.
- No quick-start borrower onboarding; BorrowerProfile must be pre-created in CRM first.

### Stage 2 — KYC Verification: 🟡 Partial

**Implemented:**
- `Director` (`schema.prisma:3016`), `Shareholder` (`:3048`), `UBO` (`:3078`) models with AES-256-encrypted NRIC/Passport (HMAC-indexed) via `CreditEncryptionService`.
- `FatcaCrsDeclaration` model + service/routes; PEP flag and source-of-wealth on UBO.
- KYC application states (`KYC_REVIEW` / `KYC_APPROVED` / `KYC_REJECTED`) with transitions.
- AML rescreen job scaffold (`jobs/amlRescreenChecker.ts`, `amlRescreen.service.ts`).

**Gaps per reference sub-item:**
- **IC / Passport:** stored encrypted but never verified — no eKYC or biometric/registry check.
- **SSM (Company):** SSM number lives on linked `CrmAccount`, used only for duplicate detection (`borrowerProfile.service.ts:112`); no SSM registry adapter.
- **Director Verification:** manual data entry only; no cross-reference to SSM registry.
- **AML screening is a placeholder** — `aml.placeholder.ts` always returns CLEAR.
- Two parallel KYC tracks (CRM-side `CrmKycRecord` vs credit-side application states) are not unified.

### Stage 3 — Document Collection: 🟢 Implemented

**Implemented:**
- `CreditDocument` (`schema.prisma:3575`): 21 document classes (incl. PAYSLIP, BANK_STATEMENT, SSM_CERT, AUDITED_FINANCIALS), SHA-256 integrity, AV status field, verify/reject workflow, soft delete.
- `CreditDocumentVersion` for replacement history; `DocumentRequirement` checklist per application with mandatory-by-borrower-type rules (`DocumentsTab.tsx:33`).
- `FinancialStatement` (`schema.prisma:4177`) + `FinancialLineItem` + `FinancialRatio` with entry/review/approval workflow and CA-Memo commentary fields.

**Gaps:**
- **OCR adapter is a stub** (`ocr.placeholder.ts`) — no auto-classification or financial data extraction; financials are keyed in manually.
- **EPF:** no dedicated model or KWSP integration — falls under OTHER document class.
- No payslip/bank-statement API retrieval; ClamAV falls back to stub when unavailable.

### Stage 4 — Automated Validation: 🟡 Partial

**Implemented:**
- `submissionReadiness.service.ts` — 12 hard-gate checks: facility presence, borrower link, mandatory docs, pending score overrides, stale collateral valuations, guarantor completeness, financials, bureau freshness (90-day), bureau checklist completion + second-officer verification, retail DSR thresholds (>70% error / 60–70% warning), exposure limit, FATCA/CRS expiry. Exposed at `GET /applications/:id/readiness`.
- `creditAutoException.service.ts` — AI-driven policy exception detection (exposure breaches, risk flags).

**Gaps:**
- No active AV scanning job — `isAvClean` is set externally.
- No configurable rule engine — validation logic is hard-coded.
- No async data-validation workers; exception detection is AI-only with no deterministic rule fallback.

### Stage 5 — Credit Assessment: 🟡 Partial

**Implemented:**
- `QualitativeAssessment` (management/relationship/industry/collateral scores), `IndustryAssessment` (sector outlooks), `RiskAssessment` (8 risk categories with mitigation), `RetailIncome` with DSR computation (`retailIncome.service.ts`).
- 14-ratio computation engine in `financial.service.ts`.
- AI risk narrative generation (`creditNarrative.service.ts`, GPT-4o, template `A4_RISK_NARRATIVE`).

**Gaps:**
- All assessments are manual entry / on-demand — no auto-execution or assessment workflow state.
- No financial spreading (EBITDA add-backs, working-capital adjustments, statement quality review).
- No assessment completeness gate blocking state transitions.
- AI narrative requires manual trigger.

### Stage 6 — Risk Scoring: 🟢 Implemented

**Implemented:**
- `CreditScorecard` / `CreditScorecardVersion` (versioned factor weights, corporate + retail, weights validated to sum 100) / `CreditScoreRun` (`schema.prisma:4269–4314`).
- Full pipeline in `scoring.service.ts`: latest approved financials → 9 factor scores (financial, leverage, liquidity, cashflow/DSR, management, industry, collateral, relationship, market) → weighted total → AAA–D rating → bureau rating caps (CCRIS/CTOS/AML) → persisted run.
- Override governance (`scoreOverride.service.ts`): ≥2-notch overrides require second approver (SOD-enforced).

**Gaps:**
- Manual trigger only; score goes stale if financials change post-scoring.
- No PD/LGD models (rating only); retail scoring is DSR-only; stress scenarios computed in frontend but not persisted; bureau caps hard-coded.

### Stage 7 — Credit Recommendation: 🟡 Partial

**Implemented:**
- 3-role sign-off chain via `ApplicationSignoff` (`schema.prisma:4927`): PREPARED_BY → REVIEWED_BY → CONCURRED_BY with IP/timestamp audit; hard gates (all signoffs + verified bureau checklist) before transition to COMMITTEE_REVIEW.
- CA Memo assembly with narrative sections (Preamble, Matter to Highlight, Way Out) and PDF generation.

**Gaps:**
- **No analyst recommendation field** — the memo recommendation is mechanically derived from risk rating (D/CC/CCC/C → REJECT, B-tier → REVIEW, A-tier → APPROVE) in `committee.service.ts`.
- No conditional recommendations ("approve with mitigants", "reject unless waived"), no recommendation matrix, no audit trail of the recommendation itself (sign-offs record the act, not the position taken).

### Stage 8 — Approval: 🟢 Implemented

**Implemented:**
- `CreditDecision`, `CreditApprovalMatrix` (exposure × risk rating → authority level, branch overrides) with `CreditApprovalMatrixVersion` snapshots.
- Authority hierarchy RM → MANAGER → COMMITTEE → BOARD (`approvalAction.service.ts`); real-time lookup endpoint.
- Committee meetings with quorum, attendance, majority voting, risk-member checks; delegation service with on-behalf-of audit trail.
- SOD middleware (`sod.middleware.ts`) on approval and disbursement actions; approval pack PDF/HTML generation.

**Gaps:**
- Multi-member vote aggregation detail is thin; delegation UI not fully surfaced in frontend.

### Stage 9 — Offer Letter: 🟢 Implemented

**Implemented:**
- `loo.service.ts`: generates PDF LOO from HTML template, uploads to S3, records as `CreditDocument` (class LETTER_OF_OFFER), moves application to OFFER.
- 14-day expiry with scheduled job (`jobs/looExpiry.job.ts`); regeneration with version increment; status endpoint (expiry, days remaining).

**Gaps:**
- Single static template (`templates/loo.html.ts`) — no per-product customization; no historical-version UI.

### Stage 10 — Acceptance: 🟡 Partial

**Implemented:**
- OFFER → ACCEPTED state transition; signed LOO tracked as a verified `CreditDocument`; acceptance enforced downstream as a disbursement-readiness precondition.

**Gaps:**
- **No explicit `acceptOffer` endpoint** — acceptance is inferred from document verification + state transition.
- No customer portal for signed-LOO upload; no acceptance acknowledgment / legal-compliance workflow. Acceptance is a prerequisite check, not a first-class tracked stage.

### Stage 11 — Disbursement: 🟢 Implemented (workflow) / 🔴 Missing (core banking)

**Implemented:**
- `DisbursementOrder` (`schema.prisma:4083`): PENDING → APPROVED → DISBURSED/CANCELLED with maker-checker (requester ≠ approver, `disbursement.service.ts:216`) and `credit:disburse` permission on execution.
- Readiness gate (`checkDisbursementReadiness`, `disbursement.service.ts:45`): state = ACCEPTED, all PRECEDENT conditions FULFILLED/WAIVED, approved decision exists, signed LOO verified.
- Audit-chain events for create/approve/disburse; `DisbursementTab.tsx` readiness checklist UI.

**Gaps:**
- **Core banking adapter is a noop** (`cbs.placeholder.ts`) — no fund transfer, beneficiary validation, or reconciliation.
- Full-amount disbursement only — no partial drawdown or disbursement schedule.

### Stage 12 — Portfolio Monitoring: 🟢 Implemented (framework) / 🟡 Partial (automation)

**Implemented:**
- `FacilityHealth` (HEALTHY/WATCH/AT_RISK/DEFAULT with review dates), `CovenantDefinition` + `CovenantTest` (8 covenant types, quarterly/semi-annual/annual), `PaymentEvent` (ON_TIME → LATE_30/60/90 → MISSED), `EarlyWarningSignal` (7 signal types, 4 severities) — `schema.prisma:4504–4583`.
- `monitoring.service.ts` CRUD + breach/overdue checks; scheduled jobs `monitor.job.ts` and `collateralInsuranceMonitor.job.ts`; signals trigger notifications and audit logging.
- Migration `20260611120000_add_ews_fk_and_condition_overdue`: covenant/condition FKs on EWS for deduplication + new CONDITION_OVERDUE signal type.

**Gaps:**
- `PaymentEvent` is manual entry — no CBS payment sync.
- Annual review tracked via `nextReviewDate` only — no automated review trigger or workflow.
- Condition-overdue detection is new (Jun 11) and not fully exercised; breach remediation workflow minimal; no monitoring dashboard widget.

---

## Cross-Cutting Finding: External Integrations Are All Placeholders

The single largest structural gap spans every stage that touches an external system. The adapter layer (`backend/src/credit/adapters/`) defines clean interfaces, but every registered provider is a stub:

| Integration | Adapter | Behavior | Stages Affected |
|-------------|---------|----------|-----------------|
| AML / sanctions screening | `aml.placeholder.ts` | Always returns CLEAR | 2, 4 |
| OCR / document AI | `ocr.placeholder.ts` | Returns success with empty data | 3, 5 |
| Credit bureau (CCRIS/CTOS) | `bureau.noop.ts` | Noop — reports uploaded manually | 4, 6 |
| eKYC / SSM registry | (none) | No adapter exists | 2 |
| Core banking (disbursement) | `cbs.placeholder.ts` | Noop — logical workflow only | 11 |
| Payment status sync | (none) | Manual `PaymentEvent` entry | 12 |

Internally the module is a complete, well-governed workflow engine; externally it is connected to nothing.

---

## Prioritized Recommendations

**P1 — High impact, existing scaffolding to plug into:**
1. **Real AML + bureau adapters** — the readiness gates and bureau rating caps already consume their outputs; implementing the providers activates existing governance (stages 2, 4, 6).
2. **Explicit acceptance step** — add an `acceptOffer` endpoint and acceptance record so stage 10 is a tracked, auditable event rather than an inference (stage 10).
3. **Analyst recommendation field** — add a structured recommendation (APPROVE / APPROVE_WITH_CONDITIONS / REJECT + rationale) to the CA memo and sign-off flow (stage 7).

**P2 — Automation of existing manual steps:**
4. Auto-trigger scoring/assessment refresh when approved financials change (stages 5, 6).
5. Active AV scanning job for uploaded documents (stages 3, 4).
6. Annual review workflow driven off `FacilityHealth.nextReviewDate` (stage 12).

**P3 — Larger build-outs:**
7. Customer self-service channel: application intake, document upload, signed-LOO upload (stages 1, 3, 10).
8. Core banking integration for disbursement execution and payment sync (stages 11, 12).
9. OCR / financial-spreading pipeline (stages 3, 5).
10. eKYC + SSM registry verification (stage 2).
