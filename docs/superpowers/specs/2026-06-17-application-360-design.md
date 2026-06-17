# Application 360 Workspace — Design Spec
**Date:** 2026-06-17  
**Status:** Approved  
**Scope:** Full replace of `CreditApplicationDetail.tsx` and all 30+ tab files with a Universal Application 360 Workspace supporting Retail, SME, and Corporate lending.

---

## 1. Goals

- Replace the existing `CreditApplicationDetail` page with an enterprise-grade Application 360 Workspace
- Support Retail, SME, and Corporate lending within a single configurable view
- Preserve all existing business logic (state machine, transitions, PDF polling, dirty-form guard, signoff flow)
- Deliver a page quality comparable to nCino, Salesforce FSC, Moody's CreditLens

---

## 2. Customer Type Detection

Customer type is inferred from `app.borrowerProfile.borrowerType`:

| `borrowerType` | Mode | Tabs/sections rendered |
|---|---|---|
| `INDIVIDUAL` | Retail | DSR, Credit Score, CCRIS/CTOS, income/commitment sections |
| `SOLE_PROPRIETOR` | SME | DSCR, Current Ratio, revenue/profit trend, SSM sections |
| `CORPORATE` | Corporate | Group Exposure, PD, group structure, financial spreading |

No new field is added to the schema. The mapping lives in `creditUtils.ts` as `getBorrowerSegment(borrowerType)`.

---

## 3. Layout

Three-column desktop layout. No mobile layout.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GLOBAL HEADER (sticky, 56px)                                            │
│ APP-2026-000123 · ABC Manufacturing · [SME] · Working Capital · RM1.5M  │
│                   [Status] [Risk Grade] [SLA]      [Save] [Submit] [▾]  │
└─────────────────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────────┬───────────────────┐
│ LEFT PANEL   │ CENTER WORKSPACE                     │ RIGHT PANEL       │
│ (240px)      │ (flex-1)                             │ (280px)           │
│              │                                      │                   │
│ Section      │  KPI CARD ROW (8 cards)              │ Current Status    │
│ Index        │  JOURNEY STEPPER (11 stages)         │ SLA Monitor       │
│              │  ─────────────────────────────       │ Assigned Team     │
│ Nav items    │  HORIZONTAL TABS                     │ Pending Tasks     │
│ with status  │  TAB CONTENT AREA (scrolls)          │ Customer Insights │
│ badges       │                                      │ Notes             │
└──────────────┴──────────────────────────────────────┴───────────────────┘
```

### Global Header
- `position: sticky; top: 0; z-index: 50`
- Left: back link → breadcrumb (App ID · Customer Name · [Segment pill] · Product · Amount)
- Center: status badge + risk grade + SLA countdown pill
- Right: role-gated action buttons derived from `transitions` array; overflow beyond 3 into `▾` dropdown
- Actions: Save Draft, Submit, Assign, Request Info, Approve, Reject, Generate Offer Letter, Disburse

### Left Panel — Section Index (240px)
- Sticky alongside tab content
- 14 items: Overview, Customer Profile, Application Details, Financial Profile, Risk Assessment, Collateral & Guarantees, Documents, Approvals, Conditions & Offer, Timeline & Audit
- Each item shows a status badge: Complete (green check) / In Progress (blue dot) / Pending (grey) / Exception (red)
- Clicking navigates to the corresponding tab
- Status is derived from application state + data completeness checks

### Center Workspace
- **KPI Card Row** — 8 horizontally scrollable cards, 64px height. Customer-type gates the last 2 cards (see Section 4)
- **Journey Stepper** — 11 stages, horizontal progress track (see Section 5)
- **Horizontal Tab Bar** — 10 tabs (see Section 6)
- **Tab Content** — scrolls independently below the sticky header + KPI row + stepper

### Right Context Panel (280px)
Six collapsible widgets:
1. **Current Status** — state badge + next required action
2. **SLA Monitor** — countdown ring; red warning at <24h
3. **Assigned Team** — RM, Analyst, Approver chips
4. **Pending Tasks** — auto-derived checklist with badge count (missing docs, pending valuations, unsigned approvals, unmet CPs)
5. **Customer Insights** — Retail: credit score + CCRIS status; SME: existing facilities + key ratios; Corporate: group exposure + PD
6. **Notes** — inline comment thread (reuses `ApplicationComments`)

---

## 4. KPI Card Row

Component: `ApplicationKpiRow.tsx`

| Position | Retail | SME | Corporate |
|---|---|---|---|
| 1 | Customer Type | Customer Type | Customer Type |
| 2 | Product | Product | Product |
| 3 | Requested Amount | Requested Amount | Requested Amount |
| 4 | Recommended Amount | Recommended Amount | Recommended Amount |
| 5 | Tenure | Tenure | Tenure |
| 6 | Interest Rate | Interest Rate | Interest Rate |
| 7 | **DSR** | **DSCR** | **Group Exposure** |
| 8 | **Credit Score** | **Current Ratio** | **Probability of Default** |

Card anatomy: 64px tile — label (top, 11px muted), value (large, 18px semibold), benchmark/delta (bottom, 11px). Cards 7–8 use traffic-light colouring against policy thresholds (green/amber/red).

---

## 5. Application Journey Stepper

Component: `ApplicationJourneyStepper.tsx`

11 stages in order:
1. Lead
2. Customer Onboarding
3. Application
4. Document Collection
5. Financial Assessment
6. Credit Assessment
7. Approval
8. Offer Letter
9. Legal Documentation
10. Disbursement
11. Post Disbursement

- Current stage: filled circle + bold label
- Completed stages: checkmark icon
- Future stages: muted
- Clicking a completed stage navigates to the relevant tab
- Stage mapping from `currentState` added to `creditUtils.ts` as `getJourneyStage(state)`

---

## 6. The 10 Tabs

### Tab 1 — Overview
Dynamic by segment:
- **Retail:** Credit score gauge, CCRIS summary, CTOS flag, affordability meter, DSR bar
- **SME:** Business health snapshot (revenue, profit, key ratios), risk flags, facility utilisation
- **Corporate:** Group structure mini-chart, total group exposure, management assessment summary, banking relationships

### Tab 2 — Customer Profile
- **Retail:** IC number, DOB, employment, employer, monthly income, existing commitments
- **SME:** Company name, SSM number, industry, business nature, revenue, shareholders list, directors list, existing facilities
- **Corporate:** Corporate group tree, parent company, subsidiaries table, board members, existing banking relationships

### Tab 3 — Application Details
- **Retail/SME:** Product, requested amount, recommended amount, tenure, purpose of financing, repayment structure
- **Corporate:** Multi-tranche facility structure, drawdown schedule, financial covenants

### Tab 4 — Financial Profile
- **Retail:** Monthly income breakdown, monthly commitments, DSR calculation, affordability assessment
- **SME:** Revenue/profit trend charts (3Y), balance sheet snapshot, cash flow summary, DSCR, Debt-to-Equity, Current/Quick ratios
- **Corporate:** Financial spreading (3Y), group consolidation, industry benchmarking, cash flow projection, stress testing results, exposure analysis

### Tab 5 — Risk Assessment
- **Retail:** Scorecard result, credit risk, fraud risk, AML risk, compliance flag
- **SME:** Risk rating, industry risk, operational risk, DSCR stress, LTV, collateral coverage
- **Corporate:** Full risk rating model, Probability of Default, Expected Loss, risk heatmap (6-axis), ESG risk, forward-looking risk

### Tab 6 — Collateral & Guarantees
All segments: collateral type, market value, forced sale value, margin of finance, coverage ratio, valuation date, insurance status, supporting documents.
- **Retail:** Property, vehicle, fixed deposit, personal guarantee
- **SME:** Property, debenture, trade assets, corporate guarantee
- **Corporate:** Debenture, charges, cross-collateral, group guarantee, charge registration status

### Tab 7 — Documents
Categorised by segment:
- **Retail:** IC, payslip, EPF, bank statement
- **SME:** SSM, audited financial statements, management accounts, bank statements
- **Corporate:** Group financials, board resolution, legal agreements, valuation reports

Document status per item: Uploaded / Pending / Expired / Rejected / Missing

### Tab 8 — Approvals
Visual approval matrix with status per approver:
- **Retail/SME:** RM → Credit Analyst → Credit Manager
- **Corporate:** + Head of Credit → Credit Committee → Board Approval

Status per node: Approved / Pending / Rejected / Returned / Escalated. Each node shows approver name, timestamp, and comments.

### Tab 9 — Conditions & Offer
Two sub-sections:
1. **Conditions Precedent Tracker** — checklist with progress bar: Offer Accepted, Valuation Completed, Insurance Assigned, Legal Docs Executed, Charge Registered, Board Resolution Received, All CPs Fulfilled
2. **Offer Letter** — preview panel + e-sign status (reuses existing signoff/esign logic)

### Tab 10 — Timeline & Audit
Two sub-sections:
1. **Activity Feed** — timestamped entries with user, department, activity, comments
2. **Audit Trail** — full immutable log of field changes, state transitions, document events

---

## 7. New Components

### `frontend/src/components/credit/detail/`
| File | Purpose |
|---|---|
| `ApplicationKpiRow.tsx` | 8-card KPI row |
| `ApplicationJourneyStepper.tsx` | 11-stage journey stepper |
| `ApplicationSectionIndex.tsx` | Left panel section index |
| `ApplicationPendingTasks.tsx` | Right panel pending tasks widget |
| `ApplicationCustomerInsights.tsx` | Right panel customer insights widget |

### `frontend/pages/credit/tabs/` (new)
| File | Replaces |
|---|---|
| `OverviewTab.tsx` | `ApplicationOverviewTab` |
| `CustomerProfileTab.tsx` | `BorrowerProfileTab` + new SME/Corporate sections |
| `ApplicationDetailsTab.tsx` | `LoanRequestTab` + `FacilitiesTab` + `RequestsFacilitiesTab` |
| `FinancialProfileTab.tsx` | `FinancialsTab` + `SmeFinancialsTab` + `RetailIncomeTab` + `PaymentCapabilityTab` |
| `RiskAssessmentTab.tsx` | `RiskScoreTab` + `CreditChecksTab` + `CreditChecksRiskTab` + `IndustryOutlookTab` + `RiskMitigatorsTab` + `RiskRatingEclTab` + `ForwardLookingRiskTab` + `EsgTab` + `SicrTab` |
| `CollateralGuaranteesTab.tsx` | `CollateralTab` + `SecurityGuaranteesTab` + `GuarantorFinancialAssessmentTab` |
| `DocumentsTab.tsx` | `DocumentsTab` (in-place upgrade) |
| `ApprovalsTab.tsx` | `ApprovalsTab` + `CommitteeWidget` (in-place upgrade) |
| `ConditionsOfferTab.tsx` | `ConditionsTab` + `SignoffTab` + `LooSection` |
| `TimelineAuditTab.tsx` | `AuditTab` + `ApplicationTimeline` |

---

## 8. Files to Delete

```
frontend/pages/credit/tabs/SmeFinancialsTab.tsx
frontend/pages/credit/tabs/RetailIncomeTab.tsx
frontend/pages/credit/tabs/RetailFacilitiesTab.tsx
frontend/pages/credit/tabs/CreditChecksTab.tsx
frontend/pages/credit/tabs/CreditChecksRiskTab.tsx
frontend/pages/credit/tabs/IndustryOutlookTab.tsx
frontend/pages/credit/tabs/RiskMitigatorsTab.tsx
frontend/pages/credit/tabs/RiskScoreTab.tsx
frontend/pages/credit/tabs/CollateralTab.tsx
frontend/pages/credit/tabs/SecurityGuaranteesTab.tsx
frontend/pages/credit/tabs/GuarantorFinancialAssessmentTab.tsx
frontend/pages/credit/tabs/PaymentCapabilityTab.tsx
frontend/pages/credit/tabs/FacilitiesTab.tsx
frontend/pages/credit/tabs/RequestsFacilitiesTab.tsx
frontend/pages/credit/tabs/PartiesTab.tsx
frontend/pages/credit/tabs/RiskRatingEclTab.tsx
frontend/pages/credit/tabs/ProfitabilityWalletTab.tsx
frontend/pages/credit/tabs/CounterpartiesTab.tsx
frontend/pages/credit/tabs/AccountConductTab.tsx
frontend/pages/credit/tabs/ForwardLookingRiskTab.tsx
frontend/pages/credit/tabs/HeaderBackgroundTab.tsx
frontend/pages/credit/tabs/SummaryTab.tsx
frontend/pages/credit/tabs/LooSection.tsx
frontend/pages/credit/tabs/EsgTab.tsx
frontend/pages/credit/tabs/SicrTab.tsx
frontend/pages/credit/tabs/QualitativeAssessmentTab.tsx
frontend/pages/credit/tabs/PricingWorksheetPanel.tsx
frontend/pages/credit/tabs/SignoffTab.tsx
frontend/pages/credit/tabs/BorrowerProfileTab.tsx
frontend/pages/credit/tabs/LoanRequestTab.tsx
frontend/pages/credit/CommitteeMeetingDetail.tsx  ← merge logic into ApprovalsTab
```

---

## 9. What Is Preserved (Not Touched)

- `credit.service.ts` — all API calls, interfaces, types
- All hooks: `useCreditFeatureFlags`, `useApplicationLane`, `useDirtyFormGuard`
- All backend routes, controllers, services
- `creditUtils.ts` — extended with `getBorrowerSegment()` and `getJourneyStage()`, nothing removed
- Existing reused components: `SlaBreachWidget`, `UserAssignChip`, `ApplicationComments`, `StateBadge`, `RiskBadge`, `ApprovalChainPanel`, `FinancialCharts`
- Route: `/credit/applications/:id` unchanged

---

## 10. Implementation Strategy

**Pass 1 — Shell (deploy-ready after this pass)**
1. Rebuild `CreditApplicationDetail.tsx` render tree with the new 3-column layout
2. Build `ApplicationKpiRow`, `ApplicationJourneyStepper`, `ApplicationSectionIndex`
3. Build right panel widgets: `ApplicationPendingTasks`, `ApplicationCustomerInsights`
4. Rebuild global header with role-gated actions
5. Existing tab components render inside the new shell unchanged during this pass

**Pass 2 — Tab Replacement (one tab at a time)**
6. Build and swap each of the 10 new tabs, deleting the replaced files after each
7. Add `getBorrowerSegment()` and `getJourneyStage()` to `creditUtils.ts`
8. Remove `useCreditFeatureFlags` after all legacy tabs are deleted

---

## 11. Design Tokens

All new components use the existing `--cr-*` CSS custom properties. No new design token namespace is introduced. Light sidebar palette is preserved.
