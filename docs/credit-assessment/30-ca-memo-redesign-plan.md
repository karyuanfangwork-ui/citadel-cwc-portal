# CA Memo Redesign — Action Plan
**Doc:** 30 | **Date:** 2026-05-29 | **Status:** Approved for execution

## Context

Citadel CWC is a **non-bank SME lender**. Its core credit workflow is:

```
Borrower applies → Financials entered → Risk scored → Bureau checked → Loan decision
```

The current CA Memo (P1–P6) was modelled after a full Malaysian commercial bank credit paper
(Maybank/CIMB corporate banking style). It contains ~40 sub-sections, many of which are
bank-regulatory obligations (MFRS 9 ECL, BNM ESG VBI, wallet share, account profitability)
that do not apply to a non-bank lender and add friction without improving decision quality.

This plan redesigns the CA Memo from 6 phases to **7 focused sections** — each directly
feeding the scoring/decision output.

---

## Target Structure

```
Section 1  Loan Request          amount · tenor · product type · purpose
Section 2  Borrower Profile      KYC fields · directors · UBOs · shareholders
Section 3  Financials            3-year P&L + balance sheet → ratios (DSCR, current ratio, gearing)
Section 4  Risk Score            Scorecard output · internal rating · DSR stress test
Section 5  Bureau                CCRIS/CTOS summary · hit flags · watchlist
Section 6  Collateral            Type · market value · FSV · coverage ratio · guarantees
Section 7  Decision              Approve/Reject · approved amount/tenor/rate · conditions
```

---

## Fields to Remove from UI (hide, not delete from schema)

These fields remain in the Prisma schema (no migration needed) but are removed from all
form panels, completion checks, and required-field validation.

### Bank-only / Not applicable to non-bank lender

| Field / Model | Reason |
|---|---|
| `EclSnapshot`, `EclForecast` (entire models) | MFRS 9 impairment provisioning — licensed bank accounting obligation only |
| `SicrAssessment` | Significant Increase in Credit Risk — pure MFRS 9 concept |
| `EsgAssessment` (assignedGp, assignedCategory) | BNM Value-based Intermediation / Islamic banking ESG framework |
| `WalletShare` | Bank relationship "share of wallet" tracking — irrelevant without multi-product banking licence |
| `AccountProfitability` + `ProfitabilityLine` | Bank P&L per customer — requires transfer pricing; not applicable |
| `AccountUtilisationSnapshot` | Banks monitor their own held accounts; non-bank lenders don't hold customer accounts |
| `ExternalRating` (MARC / RAM) | SME borrowers won't have capital market ratings |
| `ExposureSummary` (relatedCounterpartySecured/Unsecured, groupTotal) | Bank-level group exposure portfolio management |
| `RmdIssue` | Risk Management Division internal check — bank-specific governance layer |
| `CommitteeMeeting` + `CommitteeMember` + `CommitteeVote` + `CommitteeAgendaItem` | Formal board-style minutes with quorum. Replace with simple approval chain (see Section 7 redesign) |
| `CashflowProjection` + `ProjectionLineItem` | 3-year 12-line projection — keep for project finance >RM5M only; remove from standard flow |
| `SensitivityScenario` (3-scenario model) | Replace with single DSR stress field (rate +2%, income -20%) on scorecard |

### CA Memo narrative fields — remove from completion check, make optional

| Field | Reason |
|---|---|
| `preambleText` | RM relationship narrative — auto-generate from structured data instead |
| `mattersToHighlight` | Free-text; replace with structured risk flags from `RiskAssessment` |
| `transactionDetailsText` | Redundant with loan request structured fields |
| `crossSellingInitiatives` | Bank cross-sell tracking — not applicable |
| `customerGroupName`, `cifNo` | Bank internal routing/CIF system fields |
| `originatingDepartment`, `teamLeadName`, `referredBy` | Bank channel/RM attribution fields |
| `accountStrategy` (GROW/MAINTAIN/EXIT) | Bank portfolio strategy per customer |
| `connectedPartyFlag`, `connectedPartyStaffName` | Keep as a yes/no disclosure flag only; remove staff-name free text |
| `accountClassification` (PERFORMING/EARLY_CARE/NPL) | Bank asset quality — relevant only post-disbursement for monitoring, not at origination |

### Sign-off simplification

Current: `ApplicationSignoff` with roles `PREPARED_BY / REVIEWED_BY / CONCURRED_BY`
Target: Two roles only — **`SUBMITTED_BY`** (RM/analyst) and **`DECIDED_BY`** (approver)

The three-tier bank signoff chain mirrors RM → Credit Analyst → Senior Manager.
For a scoring-driven lender the scorecard is the credit analyst; the decision tier is
determined by the approval matrix (amount-based authority level).

---

## Fields to Keep (core scoring/decision data)

| Area | Fields |
|---|---|
| Loan request | `requestedAmount`, `requestedTenor`, `productType`, `purpose`, `currency` |
| Borrower identity | `borrowerType`, `registrationNumber`, `incorporationDate`, `directors`, `shareholders`, `ultimateBeneficialOwners` |
| KYC / AML | `amlRiskTier`, `isSanctionedEntity`, `sourceOfWealth`, `purposeOfAccount` |
| Financials | `FinancialStatement` (BS + PL, 2–3 years), `FinancialLineItem`, `FinancialRatio` |
| Risk score | `CreditScoreRun` (totalScore, riskRating, factorScores), `CreditScorecard` |
| Repayment capacity | `firstWayOut` (keep, simplify to dropdown + 1-sentence note) |
| Bureau | `CreditBureauCheck` (CCRIS, CTOS, SSM eInfo) — essential |
| Collateral | `Collateral` (type, marketValue, FSV), `CollateralValuation`, `Guarantee` |
| Conditions | `Condition` (precedent only — subsequent conditions are post-disbursement monitoring) |
| Decision | `CreditDecision` (decisionType, authorityLevel, conditions, comments) |
| Audit trail | `CreditAuditEvent` — keep all state transitions |
| Documents | `CreditDocument`, `DocumentRequirement` — keep, simplify required classes |

---

## New Phase / Section Map

### Current (6 phases, ~40 sub-sections)
```
P1  Header & Background      →  applicationType, preambleText, CIF, team, dates...
P2  Facilities & Requests    →  facilities, requestItems, exposureSummary, walletShare...
P3  Risk Rating & ECL        →  riskRating, firstWayOut, score, ECL, SICR, sensitivity...
P4  Security & Guarantees    →  parties, collateral, profitability, counterparties, utilisation...
P5  Credit Checks            →  bureau, industry, risk, ESG, SICR, sign-offs
P6  Summary & Conditions     →  conditions, purpose
```

### Target (7 sections, ~15 sub-sections)
```
S1  Loan Request             →  amount, tenor, product, purpose, currency
S2  Borrower Profile         →  identity, KYC, directors, UBOs, key counterparties
S3  Financials               →  3-year P&L + BS, ratios (DSCR, current ratio, gearing, LTV)
S4  Risk Score               →  scorecard run, internal rating, DSR stress test (single scenario)
S5  Bureau & Compliance      →  CCRIS, CTOS, SSM eInfo, AML/PEP watchlist
S6  Collateral & Guarantees  →  collateral, valuation, FSV, guarantees, coverage ratio
S7  Decision                 →  approve/reject, approved terms, conditions precedent, sign-off
```

---

## Implementation Waves

### Wave A — UI restructure (no schema changes) — ~3 days

**Goal:** Rebuild the left-nav sidebar and tab routing to match the 7-section structure.
Remove bank-only tabs from the visible navigation.

**Files to change:**
- `frontend/pages/credit/creditUtils.ts` — rewrite `TAB_GROUPS` and `getPhaseCompletion()`
- `frontend/pages/CreditApplicationDetail.tsx` — update sidebar rendering, remove P3 ECL/SICR/ESG tabs, remove P4 Profitability/WalletShare/Utilisation tabs
- Remove or gate these tab components behind `credit:advanced_memo` feature flag:
  - `RiskRatingEclTab` — ECL snapshot/forecast sections only (keep rating scale + external ratings)
  - `SecurityGuaranteesTab` — Profitability, WalletShare, AccountUtilisation sub-tabs
  - `CreditChecksTab` — ESG, SICR, RMD sub-sections
  - `CommitteeTab` — full committee meeting flow (replace with approval chain display)

**New `getPhaseCompletion()` logic:**
```ts
s1_loan:       requestedAmount + requestedTenor + productType + purpose
s2_borrower:   borrowerType + (registrationNumber OR individualId) + ≥1 director
s3_financials: ≥1 FinancialStatement with ≥1 FinancialLineItem
s4_score:      ≥1 CreditScoreRun linked to app
s5_bureau:     ≥1 CreditBureauCheck (CCRIS or CTOS)
s6_collateral: optional (unsecured lending path) — 'optional' status
s7_decision:   ≥1 CreditDecision record
```

**Completion dot logic:** Green = complete, Amber = incomplete required, Gray = optional.
Section S6 Collateral = always gray (optional) unless product type is secured.

---

### Wave B — Scorecard DSR stress test (replaces 3-scenario sensitivity) — ~2 days

**Goal:** Replace the 3-scenario `SensitivityScenario` model with a single built-in DSR
stress calculation shown on the score tab.

**Stress inputs (hardcoded defaults, configurable per scorecard version):**
- Rate stress: +200bps on proposed rate
- Income stress: -20% on reported net income / revenue

**Output:** Stressed DSCR displayed alongside base DSCR on the score run card.
No new model needed — compute on the fly from `FinancialRatio` + `ApplicationFacility`.

**Files to change:**
- `frontend/src/components/credit/ScoreRunCard.tsx` (or equivalent) — add stress DSCR row
- `frontend/pages/credit/CreditScoreTab.tsx` — remove `SensitivityScenario` section

---

### Wave C — Approval chain replaces committee flow — ~2 days

**Goal:** Replace `CommitteeMeeting` formal vote flow with a simple tiered approval chain
driven by the existing `CreditApprovalMatrix`.

**New approval UX:**
```
Amount <500K    →  1 approver  (CREDIT_RM)        single approve/reject button
Amount 500K–5M  →  2 approvers (CREDIT_MANAGER)   sequential — each sees pending action
Amount >5M      →  3 approvers (CREDIT_COMMITTEE) sequential chain
```

Each approver gets a notification, opens the application in read-only mode, and clicks
Approve or Reject with a mandatory comment at the >5M tier.

**`CreditDecision` usage:** One row per approver stage. Final `CreditDecision` with
`decisionType: APPROVE` stamps `decisionedAt` and transitions state to `APPROVED`.

**Files to change:**
- New component: `ApprovalChainPanel.tsx` — renders pending/completed approvers in sequence
- `frontend/pages/credit/CommitteeTab.tsx` — repurpose to render `ApprovalChainPanel` for
  standard approvals; hide meeting/agenda/vote UI behind `credit:committee_formal` flag
- Backend: no new routes needed — reuse `POST /credit/applications/:id/decide`

---

### Wave D — Seed + demo data update — ~1 day

**Goal:** Update `creditDemoSeed.ts` to reflect the leaner structure.

- Remove ECL, SICR, ESG, WalletShare, Profitability, AccountUtilisation, ExternalRating,
  SensitivityScenario, CashflowProjection seeding from the standard demo flow
- Keep them gated behind a `--bank-grade` CLI flag for future reference / advanced demo
- Add 2–3 demo applications that show the clean S1–S7 linear flow end-to-end:
  - App A: Retail borrower, RM80K personal loan, straight-through scoring, APPROVED
  - App B: SME, RM1.2M term loan, 2 approvers, APPROVED with conditions
  - App C: SME, RM6M project finance, 3-approver chain, COMMITTEE_REVIEW pending

---

### Wave E — Feature flag gates (safe rollout) — ~0.5 day

Add two new feature flags to `FeatureFlag` table:

| Key | Default | Purpose |
|---|---|---|
| `credit:advanced_memo` | `false` | Enables ECL, ESG, SICR, Committee Meeting, Sensitivity, Cashflow Projection, Wallet Share, Profitability, Account Utilisation tabs |
| `credit:committee_formal` | `false` | Enables full CommitteeMeeting + vote flow inside the approval tab |

This allows the lean 7-section flow to be the default while preserving the bank-grade
sections for clients that need them, behind a flag flip.

---

## What Does NOT Change

| Area | Status |
|---|---|
| Prisma schema | No migrations — all removed fields stay in DB, just hidden in UI |
| All existing API routes | No deletions — existing data is preserved |
| Borrower profile model | Unchanged |
| `CreditAuditEvent` | Unchanged — full audit trail retained |
| `CreditDocument` + `DocumentRequirement` | Unchanged |
| `CreditBureauCheck` | Unchanged |
| `CreditScoreRun` + `CreditScorecard` | Unchanged — this is the core |
| `Collateral` + `Guarantee` | Unchanged |
| `CreditDecision` | Unchanged — repurposed for approval chain |
| RBAC / permissions | Unchanged |

---

## Effort Summary

| Wave | Scope | Estimated Effort |
|---|---|---|
| A — UI restructure | Sidebar, tabs, `getPhaseCompletion` | 3 days |
| B — DSR stress test | Replace 3-scenario sensitivity | 2 days |
| C — Approval chain | Replace formal committee flow | 2 days |
| D — Seed update | Lean demo data + `--bank-grade` flag | 1 day |
| E — Feature flags | 2 new flags + guard wiring | 0.5 day |
| **Total** | | **~8.5 days** |

---

## Success Criteria

1. A new SME loan application can be assessed and decided via S1–S7 in under 15 minutes
2. The completion indicator shows all 7 sections green before a decision can be recorded
3. Bureau check (CCRIS/CTOS) is the only mandatory external data point
4. Financial spreading (S3) produces DSCR and feeds directly into the scorecard (S4)
5. No ECL, ESG, SICR, or committee meeting fields appear in the default flow
6. The `credit:advanced_memo` flag restores full bank-grade sections when enabled
7. All existing seeded data remains accessible and un-broken
