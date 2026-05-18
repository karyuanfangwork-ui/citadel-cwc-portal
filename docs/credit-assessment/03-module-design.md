# 03 — Credit Assessment Module — Future-State Design

This document specifies the **feature catalogue** of the Credit Assessment Module (CAM). For each feature: objective, business value, workflow, roles, backend logic, validations, approval logic, risk controls, DB notes, API surface, UX, audit, compliance, security.

For data-model details see §11. For UI details see §09. For workflow diagrams see §08.

---

## Roles introduced by CAM

| Role | Code | Mandate |
|---|---|---|
| Relationship Manager (RM) | `credit:rm` | Originate, complete application, package submission |
| Credit Analyst (CA) | `credit:analyst` | Spread financials, run scorecard, recommend |
| Credit Manager (CM) | `credit:manager` | First-line approve / decline within delegated authority |
| Senior Credit Officer | `credit:senior` | Approve above CM threshold; escalate to committee |
| Credit Committee Member | `credit:committee` | Vote in formal committee meetings |
| Credit Administration | `credit:admin` | Conditions precedent, drawdown release, document custody |
| Risk / Portfolio Officer | `credit:risk` | Monitoring, EWS, covenants, watchlist management |
| Compliance Officer | `credit:compliance` | KYC/AML clearance, regulatory reporting |
| Internal Audit | `credit:audit:read` | Read-only across CAM with audit-trail export |

Segregation rule: **no user may hold both `credit:rm` and `credit:manager` on the same application** (enforced at service layer).

---

## Feature catalogue

### F1. Individual Borrower Profile (Sole-Prop / Guarantor)
- **Objective**: Capture natural-person profile for sole proprietors and guarantors.
- **Business value**: Single source of truth for natural-person counterparties.
- **Workflow**: RM creates → KYC capture → AML screening (async) → Compliance clearance → Available for use in applications.
- **Roles**: `credit:rm` (create), `credit:compliance` (clear), `credit:audit:read`.
- **Backend**: Extends `CrmContact`; new `BorrowerIndividual` with employment, income, exposures, related parties.
- **Validations**: NRIC checksum (MyKad), DOB ≥ 18, address evidence required, source of funds required.
- **Approval**: Compliance clearance gate before usage in any application.
- **Risk controls**: Mandatory AML/PEP/sanctions screening; periodic re-screen (annual or trigger-based).
- **DB**: `BorrowerIndividual`, `BorrowerIdentification`, `BorrowerIncome`, `RelatedPartyLink`.
- **API**: `POST /api/v1/credit/borrowers/individual`, `GET /…/:id`, `PATCH …`, `POST …/:id/screening`.
- **UX**: Stepper form, autofill from NRIC capture, real-time validation.
- **Audit**: All field changes via AuditLog (auto-via Prisma middleware).
- **Compliance**: PDPA consent capture, purpose limitation, retention 7 years post-closure.
- **Security**: NRIC field-level encryption; redacted in lower envs; masked in UI for non-privileged roles.

### F2. Corporate Borrower Profile
- **Objective**: Capture entity profile (Sdn Bhd, Bhd, LLP, foreign incorporated).
- **Value**: Anchor of corporate credit relationship.
- **Workflow**: RM creates → SSM/CCM verification (auto-fetch where possible) → UBO mapping → KYC + AML on entity & UBOs → Compliance clearance.
- **Roles**: `credit:rm`, `credit:compliance`.
- **Backend**: Extends `CrmAccount` → `BorrowerCorporate` with paid-up capital, sector (MSIC), directors, shareholders, UBOs, group structure.
- **Validations**: SSM number format; ≥1 director; UBO ≥25% threshold; sector code mandatory.
- **Approval**: Compliance clearance; high-risk sectors (per policy) require senior compliance.
- **Risk controls**: UBO threshold per BNM; related-party detection across group; sanctions screen on entity AND all directors/UBOs.
- **DB**: `BorrowerCorporate`, `Director`, `Shareholder`, `UltimateBeneficialOwner`, `GroupStructure`.
- **API**: standard CRUD + `…/:id/group-structure`, `…/:id/screening`.
- **UX**: Org-chart visualisation of group, drill-down to UBOs.
- **Audit**: Full diff.
- **Compliance**: BNM AML/CFT Sectoral Guidelines on UBO identification.
- **Security**: Sensitive financials masked outside credit team.

### F3. Application Intake
- **Objective**: Structured credit application capture.
- **Value**: Standardise submission, eliminate paper forms.
- **Workflow**: RM creates application → links borrower(s) + guarantors + collateral → uploads documents → submits.
- **Roles**: `credit:rm`.
- **Backend**: `CreditApplication` with state machine (DRAFT → SUBMITTED → ANALYSING → COMMITTEE → DECISIONED → CONDITIONS → DISBURSED / DECLINED / WITHDRAWN / LAPSED).
- **Validations**: Document checklist must be 100% complete to submit; facility purpose mandatory; tenor & amount within policy bounds.
- **Approval**: Submission is not an approval; routes to triage.
- **Risk**: Duplicate-application detection (same SSM + 30 days).
- **DB**: `CreditApplication`, `ApplicationFacility`, `ApplicationParty`, `ApplicationDocument`.
- **API**: `POST /api/v1/credit/applications`, `PATCH …/:id`, `POST …/:id/submit`, `POST …/:id/withdraw`.
- **UX**: Multi-tab wizard with autosave; progress meter; pre-submission checklist.
- **Audit**: State transitions + all field edits.
- **Compliance**: Application form must satisfy BNM minimum information requirements.

### F4. KYC Verification
- **Objective**: Establish, verify, and document customer identity.
- **Value**: Mandatory regulatory prerequisite.
- **Workflow**: Identity capture → document verification (OCR + manual) → liveness/biometric (where applicable) → AML/PEP/sanctions screening → compliance clearance.
- **Roles**: `credit:rm` (capture), `credit:compliance` (clear).
- **Backend**: `KycCase` extending current `CrmKycRecord`; integrates with external KYC/eKYC provider; stores screening hits.
- **Validations**: Mandatory documents per customer type; expiry dates tracked.
- **Approval**: Compliance must clear before application can move past `ANALYSING`.
- **Risk**: Re-KYC trigger on material change; periodic refresh per risk tier (annual high, biennial medium, triennial low).
- **DB**: `KycCase`, `KycDocument`, `ScreeningRun`, `ScreeningHit`, `ScreeningAdjudication`.
- **API**: `POST /api/v1/credit/kyc/:borrowerId/cases`, screening trigger, adjudication.
- **UX**: Hit-clearance dashboard; side-by-side adjudication UI.
- **Audit**: Hits, adjudications, clearance decisions all logged.
- **Compliance**: BNM AML/CFT, PDPA.
- **Security**: Hits stored encrypted; access logged with role check.

### F5. Document Management for Credit
- **Objective**: Manage all credit documents through full lifecycle.
- **Value**: Eliminates physical files; supports audit and recall.
- **Workflow**: Upload → AV scan → OCR → classify → version → review → sign-off → archive.
- **Roles**: `credit:rm`, `credit:analyst`, `credit:admin`.
- **Backend**: Extends current S3 upload with `CreditDocument` model: doc type, version, hash, retention, retention basis.
- **Validations**: AV pass mandatory; max 200MB; doc-type taxonomy enforced.
- **Approval**: Certain doc types require Credit Admin sign-off (e.g., signed facility letter).
- **Risk**: Tamper detection via SHA-256 content hash; signed URLs only.
- **DB**: `CreditDocument`, `CreditDocumentVersion`, `DocumentChecklistItem`.
- **API**: `POST /api/v1/credit/applications/:id/documents`, versioning endpoints.
- **UX**: Doc table per application with status icons; preview, download, version history.
- **Audit**: All accesses logged (`READ` events on sensitive docs).
- **Compliance**: 7-year retention post-closure; legal-hold flag.
- **Security**: AV via ClamAV / cloud AV; FLE on hash; access via signed URL with TTL.

### F6. Financial Statement Spreading
- **Objective**: Convert raw financials into standardised, normalised form.
- **Value**: Foundation for ratios, scoring, peer comparison.
- **Workflow**: Upload PDF/XLSX → OCR extract → analyst reviews/corrects → normalise to chart → period-on-period comparison → submit.
- **Roles**: `credit:analyst`.
- **Backend**: `FinancialStatement` + line-item table; OCR via Azure Doc Intelligence / Textract; mapper to canonical chart.
- **Validations**: Balance-sheet must balance ±0.5%; period continuity check.
- **Approval**: Analyst submission + supervisor sign-off (maker-checker).
- **Risk**: Variance flags vs. peer / prior period; AI red-flags (e.g., revenue spike inconsistent with industry).
- **DB**: `FinancialStatement`, `FinancialPeriod`, `FinancialLineItem`, `SpreadingMap`.
- **API**: spreading endpoints + OCR webhook.
- **UX**: Spreadsheet-like editor with side-by-side OCR preview.
- **Audit**: Field-level edits captured.
- **Compliance**: Source document retained; auditor trail to original PDF.

### F7. Financial Ratio & Trend Analysis
- **Objective**: Compute and present standardised ratios.
- **Value**: Objective input to scoring.
- **Ratios** (minimum): Current ratio, quick ratio, DE, DSCR, ICR, ROA, ROE, gross/operating/net margin, gearing, working capital cycle, operating cash flow / debt.
- **Backend**: `FinancialRatio` computed on spreading commit; versioned.
- **Risk**: Outlier detection; trend deterioration flags.
- **UX**: Ratio dashboard with sparklines and peer benchmarks.

### F8. Credit Scoring (Internal Scorecard) — see §04 for framework
- **Objective**: Produce a quantitative internal rating.
- **Value**: Standardised, defensible, BNM-defensible rating.
- **Backend**: `Scorecard` (versioned) → `ScoreRun` → produces `InternalRating` (e.g., AAA…F) + Probability of Default (PD).
- **Approval**: Override of scorecard requires senior credit officer + reason capture.
- **Risk**: Champion–challenger model; backtesting quarterly.
- **AI**: AI-suggested rating (advisory only) shown alongside scorecard; mandatory human acceptance.
- **DB**: see §11.
- **UX**: Score breakdown by factor; explainability panel; override flow with mandatory justification.

### F9. Risk Grading
- **Objective**: Map internal score to risk grade per policy.
- **Backend**: `RiskGradeMatrix` (versioned).
- **Approval**: Grade overrides require senior credit officer.

### F10. Exposure & Limit Management
- **Objective**: Track total facilities, drawn, and headroom; enforce limits.
- **Backend**: `Exposure`, `LimitDefinition` (single counterparty, group, sector, country), `LimitBreach`.
- **Validations**: Application cannot be sanctioned if it would breach hard limits without explicit waiver.
- **Risk**: Real-time exposure recompute on facility state change.
- **UX**: Exposure widget on application detail; portfolio heatmap on risk dashboard.

### F11. Limit Recommendation Engine
- **Objective**: Suggest facility limit based on financial capacity + risk grade.
- **Backend**: Rules engine + (optional) AI advisor.
- **Risk**: Output is recommendation; human must justify final limit.

### F12. Collateral Management
- **Objective**: Track pledged assets with valuation, haircut, perfection.
- **Backend**: `Collateral` (type, owner, value, currency), `CollateralValuation` (date, source, value), `CollateralLien` (rank, registry).
- **Validations**: Valuation freshness (e.g., property ≤ 12 months); insurance for property/inventory.
- **Approval**: Acceptance by Credit Manager.
- **UX**: Collateral table with LTV; revaluation due alerts.

### F13. Guarantor Management
- **Objective**: Track personal/corporate guarantees.
- **Backend**: `Guarantee` linking guarantor → facility with type, amount, joint-and-several flag, expiry.
- **Risk**: Guarantor net-worth refreshed annually; concentration tracked.

### F14. Supporting Document Validation
- **Objective**: Enforce required-document checklist per facility type and customer type.
- **Backend**: `DocumentRequirement` library + per-application checklist; auto-derived from facility type.
- **Validations**: Cannot submit without checklist green; certain docs require dual sign-off.

### F15. Credit Committee Workflow
- **Objective**: Run formal committee meetings with agenda, papers, votes, minutes.
- **Workflow**: Application routed to committee → agenda built → papers distributed (with watermark + access log) → meeting held → votes captured → minutes generated → decision recorded.
- **Backend**: `CommitteeMeeting`, `CommitteeAgendaItem`, `CommitteeVote`, `CommitteeDecision`.
- **Roles**: Secretary, members, chair; quorum enforced.
- **Risk**: Members with conflict must recuse; system enforces recusal.
- **UX**: Pre-meeting paper pack PDF; live meeting view; e-vote.

### F16. Approval Workflow & Multi-Level Hierarchy
- **Objective**: Route credit decisions per delegated authority matrix.
- **Backend**: `ApprovalMatrix` (data-driven, versioned) — rules like `amount ≤ 500K AND grade ≤ BBB → Credit Manager; amount ≤ 5M → Senior Credit Officer; > 5M → Committee`.
- **Validations**: Maker-checker; recusal enforced; quorum for committee.
- **Audit**: Every routing decision logged.

### F17. Exception Handling
- **Objective**: Manage policy exceptions transparently.
- **Backend**: `PolicyException` with policy clause, justification, compensating control, approver, expiry.
- **Risk**: Exception register reported monthly to risk committee.

### F18. Conditions Precedent / Subsequent
- **Objective**: Track CPs and CSs through to clearance.
- **Backend**: `Condition` with type, owner, due date, evidence.
- **Validations**: All CPs must be cleared before disbursement signal.

### F19. Disbursement Handoff
- **Objective**: Hand off sanctioned facility to CBS for booking; CAM is system of record for origination, not loan ledger.
- **Backend**: Outbound webhook / message to CBS; receives back booking confirmation.

### F20. Audit Logging (system-wide)
- **Objective**: Immutable, tamper-evident audit trail of every credit-system action.
- **Backend**: Prisma middleware writes to existing `AuditLog`; immutable mode (append-only, optional WORM-bucket sink).
- **Compliance**: BNM expectation; supports both internal and external audit.

### F21. Compliance Monitoring
- **Objective**: Continuous AML/sanctions screening; covenant tests; periodic review.
- **Backend**: Scheduled jobs via durable queue; `OngoingScreeningSchedule`; `CovenantTest`.

### F22. Post-Disbursement Monitoring
- **Objective**: Continuously monitor facility health.
- **Backend**: `FacilityHealth`, `CovenantTest`, `PaymentEvent` (mirrored from CBS), `EarlyWarningSignal`.
- **UX**: Watchlist board; deterioration alerts.

### F23. Periodic Review
- **Objective**: Scheduled credit reviews (annual or risk-tiered).
- **Backend**: `PeriodicReview` task auto-generated per facility; due-date driven.

### F24. Early Warning Alerts
- **Objective**: Detect deterioration early.
- **Inputs**: Late payments, ratio deterioration, sector signals, adverse media, regulatory hits.
- **Backend**: `EarlyWarningSignal` model; rules + AI augmentation; routes to watchlist.

### F25. Portfolio Monitoring & Concentration
- **Objective**: Manage portfolio quality at aggregate.
- **Backend**: Daily/weekly aggregation jobs; dashboards (§10).

---

## State machine — credit application

```
DRAFT
  └─ submit → SUBMITTED
                ├─ triage
                ▼
            ANALYSING
                ├─ analyst recommends
                ▼
            UNDER_DECISION
                ├─ ≤ delegated authority → DECISIONED
                ├─ > delegated authority → COMMITTEE → DECISIONED
                ▼
            CONDITIONS_PRECEDENT
                ├─ all cleared
                ▼
            READY_FOR_DRAWDOWN
                ├─ CBS booked
                ▼
            ACTIVE
                ├─ matured / closed → CLOSED
                ├─ defaulted → DEFAULT
                └─ written-off → WRITTEN_OFF

Cross-state exits:
  → DECLINED (any pre-decision state)
  → WITHDRAWN (RM action; pre-decision)
  → LAPSED (TTL exceeded; pre-decision)
```

All transitions are gated by permission, validation rules, and produce an immutable audit event.
