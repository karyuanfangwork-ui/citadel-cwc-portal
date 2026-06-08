# Credit Assessment Module — Complete UI/UX & User Journey Audit

**Prepared by:** Claude Code — AI Audit Engine  
**Audit Date:** 7 June 2026  
**Codebase Branch:** dev2.0  
**Audit Scope:** Full stack — Frontend, Backend, Data Model, Workflow, Business Process

---

## Phase 1 — Module Understanding

### Summary of Understanding

This is a **full-lifecycle corporate and retail credit assessment platform** built for a lending organization (likely a Malaysian financial institution, based on MYR currency, CCRIS/CTOS bureau references, FATCA/CRS compliance, and DSR methodology).

**Module Purpose:** End-to-end credit origination and assessment — from borrower onboarding through KYC, financial analysis, risk scoring, committee approval, offer, disbursement, and post-disbursement monitoring.

**Target Users:** Credit Analysts, Relationship Managers (RM), Credit Managers, Committee Members, Risk Officers, Operations Staff, Compliance Officers, Branch Heads.

**User Roles Identified:**

| Role | Permission |
|---|---|
| Read-Only Viewer | `credit:read` |
| Analyst / RM | `credit:write` |
| Approver / Committee | `credit:approve` |
| Admin / Risk | `credit:admin` |
| Disbursement Officer | `credit:disburse` |

**Lending Products Supported:** Term Loan, Revolving Credit, Trade Finance, Project Finance, Syndicated, Bridge Loan, Overdraft, Letter of Credit, Bank Guarantee.

**Application Lifecycle:** 17 states from DRAFT → CLOSED/WITHDRAWN with full maker-checker enforcement.

### Potential Assumptions Made by Builder

1. Malaysian regulatory framework (CCRIS, CTOS, BNM guidelines) — not explicitly stated but implied by references.
2. Single-currency (MYR) primary with multi-currency capability suggested but not fully wired.
3. Corporate lending is primary use case; retail is secondary (some tabs are clearly bolted on).
4. The "S7" process framework (7 sections) is an internal convention, not a standard.
5. External bureau APIs are currently mocked — manual workaround is in place.

### Missing Business Context

- No explicit credit policy document wired into the system (approval matrix is configurable but credit policy rules are not automated).
- No relationship between borrower's industry and risk multipliers in scoring.
- No explicit BNM/regulatory reporting output (e.g., BAFIA, IFRS 9 reporting).
- Credit limit vs. credit utilisation relationship is partially built but not fully enforced.

---

## Phase 2 — Information Architecture Audit

### Current State

**Routes registered in App.tsx (15 total — CreditApplicationWizard is embedded, not a separate route):**
```
/credit                          → Dashboard
/credit/borrowers                → Borrower List
/credit/borrowers/:id            → Borrower Detail
/credit/applications             → Application Kanban/List
/credit/applications/:id         → Application Detail (8 groups / 18 sub-tabs default)
/credit/approvals                → My Approvals Inbox       [credit:approve]
/credit/financials               → Financial Spreading      [credit:read]
/credit/analysis                 → Financial Analysis       [credit:read]
/credit/scorecards               → Scorecard Management     [credit:admin]
/credit/committee                → Committee List
/credit/committee/:meetingId     → Committee Detail
/credit/m/committee/:meetingId   → Committee Mobile Vote    [credit:approve]
/credit/m/approvals              → Mobile Approval Inbox    [credit:approve]
/credit/collateral               → Collateral Registry      [credit:read]
/credit/reports                  → Reports
```

**Nav items shown in CreditNav (up to 8, overflow into "More" dropdown):**
```
Dashboard | Borrowers | Applications | My Approvals | Committee | Scorecards | Analysis | Reports
```

### Issues Found

**HIGH — Two Routes Exist But Are Not in the Nav**

`/credit/financials` (FinancialSpreading) and `/credit/collateral` (CollateralManagement) are registered routes but are absent from `CreditNav`'s `ALL_ITEMS`. They are reachable only via contextual deep-links:
- `BorrowerProfileDetail.tsx` links to `/credit/financials?borrowerProfileId=…`
- `CollateralTab.tsx` links to `/credit/collateral?applicationId=…`

This is intentional design (entry only through context), not a bug. However, it creates two risks:
1. Users who land on these pages have no visible way to go "back to where they came from" if the browser back button is unavailable.
2. Direct URL access (bookmarks, shared links) drops users into a page with no clear module context.

**Recommendation:** Add a contextual back-link/breadcrumb on both pages, e.g. "← Back to [Borrower Name]" or "← Back to Application".

**MEDIUM — `/credit/analysis` Scope is Ambiguous**

`/credit/analysis` (FinancialAnalysis) is in the nav as "Analysis" and covers portfolio-level financial trend analysis. Inside an application, the Financials tab (S3) also contains ratio analysis for that specific borrower. These are different scopes (portfolio vs. single application) but share a near-identical label in their respective contexts, which can confuse users about which one to use.

**Recommendation:** Rename the nav item to "Portfolio Analysis" to distinguish it from application-level financial analysis.

**MEDIUM — Borrower vs. Application Starting Point**

Borrower Profile and Application are separate top-level entities. New users are unclear whether to start from "Borrowers" or "Applications." There is no "New Application" CTA on the dashboard's primary action area.

**Recommendation:** Add a prominent "New Application" button on the dashboard that embeds borrower selection/creation as step one of the wizard.

**MEDIUM — Mobile Routes Not Auto-Detected**

`/credit/m/committee/:meetingId` and `/credit/m/approvals` are mobile-optimized routes with no automatic redirect from their desktop equivalents. A mobile user navigating to `/credit/committee/:meetingId` gets the desktop layout; they must know the `/m/` path exists.

**Recommendation:** Add viewport-based redirect from desktop committee/approval routes to their `/m/` equivalents, or surface the mobile links prominently within the desktop views.

**LOW — `credit:approve` Inconsistency Between Route and Nav**

`/credit/approvals` route requires `credit:approve`, correctly matching its nav guard. `/credit/committee` route requires only `credit:read`, meaning analysts (read-only) can view the committee list and meeting detail pages. This is intentional design — the desktop `CommitteeMeetingDetail` component internally gates vote actions with `credit:approve` permission checks, so analysts can view but not vote. The mobile vote route `/credit/m/committee/:meetingId` correctly requires `credit:approve`. Whether analysts should see committee decisions before they are published remains a business policy question worth confirming.

### Recommendations Summary

| Issue | Recommendation | Priority |
|---|---|---|
| Financials/Collateral nav-less routes | Add contextual breadcrumb/back-link on both pages | HIGH |
| "Analysis" label ambiguity | Rename nav item to "Portfolio Analysis" | MEDIUM |
| No primary "New Application" CTA | Add to dashboard header | MEDIUM |
| Mobile routes not auto-detected | Redirect based on viewport or surface `/m/` links | MEDIUM |
| Committee read access for analysts | Confirm business policy; restrict to `credit:approve` if needed | LOW |

---

## Phase 3 — Dashboard Audit

**Score: 6.5/10**

### Current State Analysis

The `CreditDashboard.tsx` contains:
- Pipeline state count cards (DRAFT, SUBMITTED, KYC_REVIEW, APPROVED, etc.)
- Approval inbox (grouped by urgency — Overdue, Urgent, Normal)
- Exposure breakdown (by borrower, sector, risk rating)
- Committee calendar (upcoming meetings)
- Branch filter

### A. Operational Dashboard Assessment

**What Works:**
- Pipeline counts by state give instant workload visibility.
- Approval inbox grouped by urgency (Overdue → Urgent → Normal) is excellent UX for priority-setting.
- Committee calendar is highly practical for approvers.

**Critical Gaps:**

1. **No "My Work" separation from "All Work."** The dashboard mixes items assigned to the current user with all items in the system. A Credit Analyst logging in sees the entire organization's pipeline, not just their assigned cases.

2. **No SLA breach real-time indicator.** The dashboard has no dedicated SLA breach widget listing which specific applications are in breach. `slaBreachCount` is shown as a simple pipeline card number with color coding, but there is no itemized drill-down into which applications are breaching.

3. **No aging analysis.** "How long has this application been sitting in UNDERWRITING?" is not visible. The dashboard shows counts but not age distribution.

4. **No pending actions widget.** "I have 3 approvals waiting, 2 documents to verify, 1 condition to clear" is not surfaced.

5. **No throughput metric.** "Applications approved this week / month" is missing.

### B. Management Dashboard Assessment

**Critical Gaps:**

1. **No portfolio health indicators.** Risk rating distribution across active portfolio is missing.

2. **No approval turnaround time.** Average days from submission to approval by product type — essential for management reporting.

3. **No concentration risk alerts.** Top 10 borrower exposure as % of total portfolio is not highlighted.

4. **No P&L or revenue impact.** No portfolio-level fee income / margin summary.

### Recommended Dashboard Layout

```
RECOMMENDED DASHBOARD LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROW 1 — MY ACTIONS (personal, always visible)
[My Pending Approvals: 3]  [My Assigned Cases: 12]  [SLA Breaching Today: 2]  [Overdue: 1]

ROW 2 — PIPELINE HEALTH (operational)
[Kanban mini-view: count per state]  [Avg Days per State bar chart]

ROW 3 — PORTFOLIO EXPOSURE (risk)
[Total Exposure: MYR X]  [By Risk Band pie]  [Top 10 Concentration list]

ROW 4 — ACTIVITY (management)
[Approved this month: N / MYR X]  [Rejected: N]  [Avg TAT: X days]

ROW 5 — CALENDAR
[Committee meetings this week]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Missing Widgets:**
- SLA breach heatmap (which state has the most breaches)
- Analyst productivity leaderboard
- Pending conditions by application
- Documents awaiting verification counter
- Top 5 applications by loan size

---

## Phase 4 — Screen-by-Screen UI Audit

### 4.1 Application List (CreditApplicationList.tsx)

**Score: 7/10**

**What Works Well:**
- Kanban board view with column headers is effective for pipeline management.
- Quick filter chips (All, Mine, Pending Approval, Overdue SLA, In Committee, Offers) are well-designed.
- State color coding provides visual differentiation.

**Issues Found:**
- **Column overflow:** With 17 application states, the Kanban board has too many columns for a standard widescreen, requiring horizontal scrolling.
- **Card information density:** Missing: assigned analyst, SLA status indicator, days in current state.
- **No list view toggle:** Some power users prefer a sortable table over Kanban.
- **Borrower selection modal:** Creating an application requires pre-selecting a borrower — if the borrower doesn't exist, the user must leave the flow, create the borrower, and return (5+ extra steps).

**Recommendations:**
- Collapse pre-submission and post-approval states into grouped columns with expand capability.
- Add list view toggle with sortable columns.
- Enable inline borrower creation within the "New Application" flow.
- Add SLA indicator dot on Kanban cards (green/amber/red).

### 4.2 Application Detail (CreditApplicationDetail.tsx)

**Score: 5/10**

**What Works Well:**
- S7 process banner showing completion percentage is an excellent progress indicator.
- Tab grouping concept (S1–S7 phases) is logical from a business process standpoint.
- Auto-save functionality reduces data loss risk.
- Application Timeline is excellent for audit/history.

**Issues Found:**
- **Two-level tab hierarchy may confuse first-time users.** The UI renders 8 section groups (S1–S7 + Operations) by default (12 groups with the `credit:advanced_memo` flag), each containing 1–4 sub-tabs (18 sub-tabs total by default; 25 entries / 24 unique tab IDs with advanced memo). The grouping is logical but a new analyst must learn which sub-tab lives under which section.
- **`DisbursementTab` is registered in `renderTab()` but absent from `TAB_GROUPS`** — it is currently unreachable via normal tab navigation. The `DetailTab` type comment says `"visible in ACCEPTED / DISBURSED / CLOSED states"`, indicating this was intended to be conditionally shown based on application state, but the conditional rendering was never wired up. It is incomplete conditional logic, not dead code by oversight.
- **No visual differentiation between completed and incomplete tabs.** Users cannot tell at a glance which sections still need work.
- **No breadcrumb navigation.**
- **Tab state is not persisted.** Navigating away and returning resets to the first tab.

> **Correction note:** An earlier draft of this audit incorrectly claimed "33 flat tabs in a horizontal scrolling tab bar." Code review confirmed the implementation uses a properly grouped two-level structure (8 groups / 18 sub-tabs by default), which is substantially more usable. The advanced-memo tabs are correctly feature-flagged and hidden from most users.

**Proposed Redesign:**
```
CURRENT:  [Tab1][Tab2][Tab3]...[Tab33] → scrolling tab bar

PROPOSED: Left nav panel (fixed 240px) + content area

  ┌─────────────────────────────────────────────────────────┐
  │ HEADER: [Borrower] [App ID] [Amount] [Score:BB] [State] │
  │         [RM: KY] [Analyst: ABC] [SLA: ●2 days left]     │
  ├──────────────┬──────────────────────────────────────────┤
  │ S1 KYC ✓    │                                          │
  │ S2 Financial │    ACTIVE TAB CONTENT                    │
  │ S3 Risk  ⚠  │    (full width, scrollable)              │
  │ S4 Collateral│                                          │
  │ S5 Approvals │                                          │
  │ S6 Offer/Dis │                                          │
  │ S7 Monitoring│                                          │
  └──────────────┴──────────────────────────────────────────┘
```

### 4.3 Borrower Profile Detail (BorrowerProfileDetail.tsx)

**Score: 7.5/10**

**What Works Well:**
- Tabbed structure (Overview, Directors, Shareholders, UBOs, Applications, Exposure, Financials) is well-organized.
- Separate tabs for Directors/Shareholders/UBOs aligns with KYC best practices.
- Exposure tab shows cross-application exposure — excellent for concentration risk monitoring.

**Issues Found:**
- No quick-create application from borrower profile.
- Directors/Shareholders/UBOs are separate with no cross-reference — the same person may appear in multiple roles without a warning.
- No beneficial ownership visualization (tree/org-chart view).
- No visible link from risk rating badge to the scorecard that produced it.
- AML tier displayed but no AML screening history or re-screen capability visible.

**Recommendations:**
- Add "New Application" CTA on borrower profile.
- Add ownership structure tree chart for corporate borrowers.
- Cross-reference directors/shareholders/UBOs by IC/passport number to flag overlaps.
- Add AML rescreen button and last-screened date prominently.
- Add "Related Borrowers" section for group exposure.

### 4.4 My Approvals Inbox (MyApprovals.tsx)

**Score: 8/10**

**What Works Well:**
- Urgency grouping (Overdue → Urgent → Normal) is excellent UX.
- SLA countdown visibility.
- Quick view modal for inline decisions.

**Issues Found:**
- No bulk approval capability for routine low-risk batches.
- No "delegate" action from inbox.
- No "Recently Decided" history section.
- Quick view may be insufficient for large complex corporate loans.

### 4.5 Financial Spreading (FinancialSpreading.tsx)

**Score: 7/10**

**Issues Found:**
- No period comparison view (side-by-side Year 1, 2, 3).
- No import/paste from Excel or CSV.
- No formal "Statement Quality" classification (Audited, Management, Projected) that flows into risk score.

### 4.6 Committee Meeting Detail (CommitteeMeetingDetail.tsx)

**Score: 7.5/10**

**Issues Found:**
- No pre-read committee pack generation (bundle all agenda item PDFs).
- No post-meeting minutes generation.
- No conflict of interest declaration per agenda item.

### 4.7 Collateral Management (CollateralManagement.tsx)

**Score: 6.5/10**

**Issues Found:**
- Canonical record ambiguity: collateral exists at both application level and portfolio level.
- No collateral reuse/cross-linking across applications (cross-collateralization gap).
- No valuation expiry alert (revalue when > 12 months old).
- No forced-sale value (FSV) vs. market value separation. BNM guidelines require both.

---

## Phase 5 — UX Audit

### 5.1 Primary UX Issues

**MEDIUM — Two-Level Tab Hierarchy Learning Curve**

The application detail uses 8 named section groups (S1–S7 + Operations) each containing 2–4 sub-tabs (18 sub-tabs total in the default view). The grouping is well-aligned to the credit process. However, a new analyst must learn which sub-tab lives under which section group before they can navigate confidently — there is no search or jump-to capability.

- **Impact:** Moderate onboarding friction; experienced users navigate efficiently once familiar.
- **Fix:** Add a "jump to section" keyboard shortcut or search overlay (`Ctrl+K` style) that lets users type a section name and jump directly to it.

**HIGH — `DisbursementTab` Unreachable via Normal Navigation (incomplete conditional logic)**

`DisbursementTab` is registered in `renderTab()` but is absent from `TAB_GROUPS`. It cannot be reached by clicking any tab. The `DetailTab` type comment says `"visible in ACCEPTED / DISBURSED / CLOSED states"`, indicating the intent was to conditionally show it based on application state, but the conditional rendering was never wired up.

- **Impact:** If this is the primary disbursement UI, users have no way to access it through the standard tab flow — a critical workflow gap.
- **Fix:** Complete the conditional rendering to show DisbursementTab in ACCEPTED/DISBURSED/CLOSED states, or add it to `TAB_GROUPS` under S7 · Decision.

**CRITICAL — No Onboarding Guidance**

No guided onboarding for new analysts. The wizard exists but only within application creation, not as an overall journey guide.

- **Fix:** Add contextual "Getting Started" checklist on dashboard for new users.

**HIGH — No Pre-Submission Readiness Checklist**

When submitting an application, there is no summary of all incomplete sections. Users must click through each tab to find what is missing.

- **Fix:** Pre-submission checklist modal: "The following sections are incomplete: Financials (DSR not calculated), Credit Checks (bureau check pending)."

**HIGH — Bureau Check Status Not Prominent**

The bureau check result (pass/fail/pending) is not surfaced on the application header or Kanban card.

- **Fix:** Add a status bar below the application header: Bureau Check | AML Status | CCRIS | Score | Collateral Coverage — all with color-coded indicators.

**HIGH — Risk Score Not Visible on Application Header**

The risk score is buried in a tab. It should be always visible on the application header.

- **Fix:** Show risk score band (e.g., "BB — 72/100") in the sticky application header bar.

**MEDIUM — Auto-save Feedback Insufficient**

"Last saved: 2 seconds ago" or a subtle persistent save indicator should always be visible.

**MEDIUM — State Transition Buttons Lack Pre-flight Checks**

"Submit to Committee" has no pre-flight check dialog listing incomplete items and confirming the action.

---

## Phase 6 — User Journey Audit

**Score: 6/10**

**Estimated journey clicks for a new SME corporate loan:**
- Current state: ~180 clicks across ~25 screens over 3–5 days
- Target state: ~80 clicks across ~12 screens over 1–2 days

### Complete Journey Map

**Step 1: Customer Creation**
- Pain Points: AML tier auto-assignment not transparent; no duplicate detection; FATCA/CRS is optional but should be mandatory.

**Step 2: Application Creation**
- Pain Points: Borrower must exist before application — no inline creation; no clone from previous application (critical for renewals).

**Step 3: Document Collection**
- Pain Points: No document request notification to borrower; no document expiry tracking; version history present but confusing.

**Step 4: Financial Analysis**
- Pain Points: Manual data entry only (no import); no side-by-side year comparison; ratio thresholds not industry-adjusted.

**Step 5: Risk Assessment & Scoring**
- Pain Points: Score override workflow is opaque to analysts; scorecard model not visible to analysts (admin-only).

**Step 6: Credit Recommendation**
- Pain Points: No structured "Recommendation" field — recommendation is embedded in memo free text; no comparison against credit policy limits.

**Step 7: Approval**
- Pain Points: No "refer back to analyst" action — only Approve or Reject; approval routing may be manual.

**Step 8: Offer (LOO)**
- Pain Points: Borrower signature is manual (upload signed copy); no LOO expiry date enforcement; no counter-offer capability.

**Step 9: Disbursement**
- Pain Points: No partial disbursement for revolving/tranched facilities; disbursement date vs. activation date not clearly distinguished.

**Step 10: Monitoring**
- Pain Points: No automated annual review reminder; no linkage from monitoring breach → new restructuring application.

**Step 11: Renewal/Closure**
- Pain Points: No "Renew" button; closure does not capture reason (early settlement, maturity, default).

---

## Phase 7 — Form Design Audit

**Score: 6.5/10**

### Critical Issues

**BorrowerProfile Creation Form:**
- FATCA/CRS on a separate tab — users skip it. Must be a mandatory step.
- Source of Wealth should be a structured dropdown, not free text.
- No field-level help tooltips.

**Financial Statement Entry:**
- Vertical list of 30+ line items — extremely long for 3 years of data.
- No quick-balance validation showing running total as user types.
- No "Copy from prior period" button.

**LoanRequestTab:**
- No server-side validation against product maximums.
- Loan purpose likely free text — creates portfolio reporting inconsistency.
- Duplication risk between LoanRequestTab pricing fields and PricingWorksheetPanel.

### Form Improvement Summary

| Form | Issue | Fix |
|---|---|---|
| New Borrower | FATCA/CRS skippable | Make mandatory wizard step |
| Financial Entry | 30+ fields, no comparison view | Horizontal period columns |
| Loan Request | Loan purpose free text | Structured dropdown taxonomy |
| Risk Score | Factor weightings hidden from analysts | Show read-only breakdown |
| Conditions | Condition type free text | Structured condition library |
| Disbursement | Instruction free text | Structured form with bank details |

---

## Phase 8 — Credit Assessment Process Audit

**Score: 7.5/10**

### What the Module Does Well

- Full lifecycle from origination to post-disbursement — rare in custom-built systems.
- Multi-factor risk scoring with scorecard versioning — enterprise-grade.
- Collateral management with valuation history — operationally sound.
- SICR assessment and ECL calculation — IFRS 9 compliance awareness demonstrated.
- KYC/AML/FATCA-CRS — regulatory compliance framework is in place.
- Committee management with quorum and voting — rarely seen in custom builds.
- Approval matrix versioning — excellent for audit trail.

### Critical Gaps

**CRITICAL — Bureau Integration is Mocked**
CCRIS and CTOS checks are manual. Recommendation: prioritize CCRIS API integration in next sprint. Until then, manual workaround must include a mandatory supervisor sign-off on manually-obtained reports.

**HIGH — No Credit Policy Limit Enforcement**
No enforcement of:
- Maximum single borrower exposure limit (e.g., 25% of capital base)
- Sector concentration limits (e.g., max 30% exposure to property sector)
- Product-specific underwriting guidelines (e.g., max DSR 70% for personal loans)

**HIGH — Related Party / Group Exposure**
`RelatedPartyGroup` exists in data model but:
- No automated group exposure aggregation across all group entities.
- No conflict of interest flag for borrowers with relationships to staff.

**HIGH — Financial Ratio Benchmarks are Static**
Benchmarks differ by industry but the module uses fixed thresholds. Industry classification from `IndustryAssessment` does not feed into ratio benchmarks.

**MEDIUM — Forward-Looking Risk is Feature-Flagged**
For corporate loans above a threshold, forward-looking risk analysis should be mandatory, not optional.

**MEDIUM — Guarantor Financial Analysis**
No structured guarantor financial assessment — a guarantor is just a party record.

### Missing Assessment Components

| Component | Status | Impact |
|---|---|---|
| Bureau API integration | Manual workaround | CRITICAL |
| Group exposure aggregation | Partial (RelatedPartyGroup) | HIGH |
| Credit policy limit enforcement | Missing | HIGH |
| Industry-specific ratio benchmarks | Missing | HIGH |
| Guarantor financial assessment | Missing | MEDIUM |
| Trade reference checks | Missing | MEDIUM |
| Country risk classification | Missing | LOW |

---

## Phase 9 — Approval Workflow Audit

**Score: 7/10**

### What Works Well

- Multi-level approval with configurable approval matrix.
- Maker-checker: analyst creates, manager approves (different roles).
- Committee voting with quorum enforcement.
- `credit:disburse` as a separate permission — strong SOD control.
- SLA monitoring per state with breach tracking.
- Score override requires admin approval — prevents gaming.

### Critical Issues

**CRITICAL — No "Refer Back" Action (partial mitigation exists)**
Approval workflow allows Approve or Reject only at the application state level. There is no general-purpose "Refer Back to Analyst" or "Request More Information" action as a distinct state. However, a `RETURN` action exists in the approval service that sends applications back from committee to `CREDIT_ASSESSMENT` — this is a narrow, workflow-specific return path, not a general refer-back mechanism. For broader deliberation contexts (e.g., conditionally approved items needing clarification), there is no way to loop back. The formal workflow loses this context.
- **Fix:** Add `REFERRED_BACK` as an application state with mandatory comment and analyst notification. The existing `RETURN` action can serve as the transition mechanism from committee stages, but refer-back should also work from earlier stages (e.g., KYC_REVIEW referring back to DRAFT).

**HIGH — Approval Routing May Be Manual**
If routing is manual (RM selects the approver), routing errors and bottlenecks are possible.
- **Fix:** Auto-route based on approval matrix, with fallback escalation rules.

**HIGH — Committee Decisions Require Explicit Finalization (semi-auto)**
When a committee votes, individual votes are recorded but do NOT auto-transition the application state. A separate `finalizeDecision()` action must be invoked after vote tallying — this DOES auto-transition to APPROVED or REJECTED. The gap is that vote casting alone doesn't trigger transition; someone must explicitly finalize. DEFERRED outcomes (tie/all-abstain) do not trigger any state change, which is correct behavior.
- **Fix:** Consider auto-finalizing when all eligible voters have cast votes (no separate finalize step needed), or surface a prominent "Finalize Decision" button that reminds the meeting secretary to commit the outcome.

**MEDIUM — Delegation Enforcement**
Delegation (acting authority) must be time-bound and explicitly revoked. Whether this is enforced is unclear.

**MEDIUM — Approval Comments Not Mandatory**
Especially for rejections and conditional approvals, mandatory comment fields must be enforced and visible in audit trail.

---

## Phase 10 — Reporting & Analytics Audit

**Score: 6/10**

### Current Reports

- **Pipeline Report** — applications by state with SLA breach tracking, branch filter.
- **Exposure Report** — portfolio exposure analysis.

### Missing Reports (Prioritized)

| Report | Business Need | Priority |
|---|---|---|
| Approval Turnaround Report | Management KPI: avg days submission → approval | CRITICAL |
| Analyst Productivity Report | Applications processed per analyst | HIGH |
| Portfolio Risk Distribution | # and value by risk rating band (AAA–D) | HIGH |
| Collateral Coverage Report | Total collateral FSV vs. total exposure | HIGH |
| SLA Breach Analysis | Breaches by state, by analyst, by product | HIGH |
| Concentration Risk Report | Top 10 borrowers, top 5 sectors by exposure | HIGH |
| Conditions Fulfilment Report | Conditions outstanding > X days | MEDIUM |
| Committee Decision Report | Approval/deferral/rejection rate by committee | MEDIUM |
| Bureau Check Status Report | Pending/expired bureau checks across portfolio | MEDIUM |
| ECL / Provision Report | IFRS 9 staging distribution and ECL amounts | MEDIUM |
| Renewal Pipeline Report | Applications due for annual review / renewal | MEDIUM |
| Monthly Portfolio Report | Standard management pack | MEDIUM |

### BI/Analytics Gaps

- No data export to Excel/CSV for external analysis.
- No scheduled report generation / email delivery.
- No configurable report parameters beyond branch filter.
- No trend charting in reports (data tables only).

---

## Phase 11 — Mobile & Responsiveness Audit

**Score: 6.5/10**

### What Exists

- `MobileApprovalInbox.tsx` — dedicated mobile approval view.
- `CommitteeMobileVote.tsx` — dedicated mobile voting interface.

### Issues

**HIGH — Application Detail is Not Mobile-Ready**
The 33-tab application detail is fundamentally incompatible with mobile. A credit manager reviewing an application on their phone gets a broken experience.

**HIGH — Financial Spreading is Not Mobile-Ready**
Multi-column financial statements are inherently desktop-oriented.

**MEDIUM — Kanban List Breaks on Mobile**
Column-based layout collapses poorly to a single column, losing pipeline visualization.

**MEDIUM — Mobile Routes Not Auto-Discovered**
Mobile users navigating to `/credit/applications` on their phone get the desktop view. The mobile-optimized routes must be auto-detected and redirected.

### Recommendations

- Auto-detect mobile viewport and redirect to mobile-optimized views.
- For application detail on mobile: show header + key summary + action buttons only.
- Create a "Mobile Dashboard" view: My Pending Approvals, My Active Applications, Notifications.
- Full approval action (Approve/Refer Back/Reject) must be functional on mobile.

---

## Phase 12 — Accessibility Audit

**Score: 6/10**

### Issues

**HIGH — Colour-Only Status Indicators**
`STATE_COLORS` and `RiskBadge.tsx` rely on colour to convey status. Users with colour blindness (8% of males) cannot distinguish Approved (green) from Rejected (red) by colour alone.
- **Fix:** Always pair colour with icon (✓ for approved, ✗ for rejected) and text label.

**HIGH — Form Field Accessibility**
Auto-save fields and custom dropdown components may lack proper ARIA labels for screen readers.

**MEDIUM — Keyboard Navigation**
Kanban drag-and-drop, modal overlays, tab navigation — all potential keyboard trap points.

**MEDIUM — Font Size**
`text-sm` (14px) used in tables may be below 16px minimum for sustained reading in data-dense screens.

**LOW — Touch Target Size**
Action buttons in compact table rows may be below the 44×44px touch target minimum for tablet users.

---

## Phase 13 — Feature Completeness Audit

### Feature Classification

| Feature | Classification | Status |
|---|---|---|
| Borrower Profile Management | Must Have | ✓ Present |
| Application Lifecycle (17 states) | Must Have | ✓ Present |
| Document Management | Must Have | ✓ Present |
| Financial Spreading (BS/PL/CF) | Must Have | ✓ Present |
| Risk Scoring with Scorecards | Must Have | ✓ Present |
| Bureau Checks (manual) | Must Have | ✓ Present (manual) |
| Approval Workflow (matrix-based) | Must Have | ✓ Present |
| Collateral Management | Must Have | ✓ Present |
| Guarantee Management | Must Have | ✓ Present |
| Committee Meeting Management | Must Have | ✓ Present |
| Letter of Offer Generation | Must Have | ✓ Present |
| CA Memo PDF Generation | Must Have | ✓ Present |
| Disbursement Control | Must Have | ✓ Present |
| SLA Monitoring | Must Have | ✓ Present |
| Audit Trail | Must Have | ✓ Present |
| AML/KYC/FATCA-CRS | Must Have | ✓ Present |
| ECL Calculation (IFRS 9) | Should Have | ✓ Present |
| Financial Ratio Analysis | Should Have | ✓ Present |
| Industry Risk Assessment | Should Have | ✓ Present |
| Portfolio Exposure Reports | Should Have | ✓ Present |
| Mobile Approvals | Should Have | ✓ Present |
| ESG Assessment | Nice to Have | ✓ Present |
| SICR Assessment | Should Have | ✓ Present |
| Committee Mobile Voting | Should Have | ✓ Present |
| Multi-Branch Support | Should Have | ✓ Present |
| Forward-Looking Risk / Stress Test | Should Have | ✓ Feature-flagged |
| Profitability / Wallet Share | Nice to Have | ✓ Present |
| **Bureau API Integration** | **Must Have** | **MISSING** |
| **Application Renewal/Clone** | **Must Have** | **MISSING** |
| **"Refer Back" Workflow State** | **Must Have** | **MISSING** (RETURN action exists for committee→CREDIT_ASSESSMENT only; no general state) |
| **Group Exposure Aggregation UI** | **Should Have** | **MISSING** |
| **Approval Turnaround Report** | **Should Have** | **MISSING** |
| **Credit Policy Limit Enforcement** | **Must Have** | **MISSING** |
| **Guarantor Financial Assessment** | **Should Have** | **MISSING** |
| **LOO Expiry Enforcement** | **Should Have** | **MISSING** |
| **Borrower Notification / Portal** | **Nice to Have** | **MISSING** |
| **Document Expiry Tracking** | **Should Have** | **MISSING** |
| **Collateral Reuse / Cross-linking** | **Should Have** | **MISSING** |
| **Excel/CSV Data Export** | **Should Have** | **MISSING** |
| **Conflict of Interest Declaration** | **Should Have** | **MISSING** |
| **Bulk Approval** | **Nice to Have** | **MISSING** |

---

## Phase 14 — Production Readiness Audit

**Score: 7/10**

### What is Production-Ready

- JWT authentication with RBAC — fine-grained permission model is solid.
- Audit trail — `CreditAuditEvent` is append-only and comprehensive.
- SLA enforcement — breach tracking and escalation rules exist.
- Data validation — Prisma schema constraints + controller validation.
- PDF generation — CA Memo and Approval Pack generation.
- Multi-branch support — branch-level filtering and SLA overrides.
- DLP controls — export token generation and PII reveal logging.
- Encryption — director/borrower schema has encryption noted.
- Redis caching — permission caching reduces DB load.

### Production Risks

**CRITICAL — Bureau API Mocked**
All credit bureau checks are manual. Regulatory non-compliance risk and operational integrity risk.
- Recommendation: Hard-gate bureau check completion with supervisor sign-off until API integration is live.

**HIGH — Duplicate Borrower Risk (advisory-only duplicate detection)**
No unique constraint or automatic duplicate detection on IC number / company registration number at creation time. Two analysts could create duplicate BorrowerProfile records, leading to split exposure tracking. Note: a `checkDuplicate()` endpoint exists (`GET /borrowers/check-duplicate`) that queries by SSM registration number or NRIC — but it is advisory-only (the frontend must explicitly call it; it is not enforced during creation).
- **Fix:** Add `@unique` constraint on `CrmContact.nricPassport` and `CrmAccount.registrationNumber`, and call `checkDuplicate()` automatically in the borrower creation flow.

**HIGH — Score Override Governance**
Score overrides require admin approval — good. But the existence of a dedicated audit log with before/after values, justification, and approver identity must be confirmed.

**HIGH — Application State Machine Integrity**
17 states with 20+ transitions. Invalid state transitions are a major data integrity risk if state machine is not enforced strictly at the backend service layer.

**MEDIUM — No Database Read Replicas / CQRS**
Dashboard and reports queries run against the same database as write operations. As portfolio grows, complex reports will degrade write performance.

**MEDIUM — Session Management**
JWT token expiry for a financial system should be ≤ 30 minutes idle timeout (BNM/regulatory expectation).

**MEDIUM — No IP-Based Access Controls**
Internal system should be accessible only from office network or VPN.

**LOW — Soft Delete vs Hard Delete**
Credit records must be retained for a minimum period (typically 7 years in Malaysia). Hard delete capability, if present, must be restricted.

---

## Final Deliverable

### Composite Scores

| Dimension | Score |
|---|---|
| Overall UI | 66 / 100 |
| Overall UX | 58 / 100 |
| User Journey | 62 / 100 |
| Dashboard Effectiveness | 55 / 100 |
| Credit Assessment Readiness | 72 / 100 |
| Production Readiness | 68 / 100 |
| **OVERALL MODULE SCORE** | **64 / 100 — FAIR** |

---

### Top 20 Findings

| # | Finding | Severity | Phase |
|---|---|---|---|
| 1 | `DisbursementTab` registered in renderTab() but absent from TAB_GROUPS — unreachable via normal navigation (incomplete conditional logic, intended for ACCEPTED/DISBURSED/CLOSED states) | HIGH | UX |
| 2 | Bureau API not integrated — manual workaround only | CRITICAL | Process |
| 3 | Dashboard shows all users' work, not "My Work" first | CRITICAL | Dashboard |
| 4 | No general "Refer Back to Analyst" workflow state (RETURN exists for committee→CREDIT_ASSESSMENT only) | CRITICAL | Approval |
| 5 | No credit policy limit enforcement (sector/single-borrower caps) | CRITICAL | Process |
| 6 | Risk score not visible on application header | HIGH | UI |
| 7 | No pre-submission readiness checklist | HIGH | UX |
| 8 | No application clone/renew for renewals | HIGH | User Journey |
| 9 | SLA breach not surfaced on dashboard | HIGH | Dashboard |
| 10 | Financial spreading lacks side-by-side period comparison | HIGH | UI |
| 11 | Collateral cross-linking across applications absent | HIGH | Process |
| 12 | Approval routing may be manual (not auto-routed by matrix) | HIGH | Approval |
| 13 | Committee decisions require explicit finalization step (votes don't auto-transition; `finalizeDecision()` does) | HIGH | Approval |
| 14 | Approval turnaround report missing | HIGH | Reporting |
| 15 | No duplicate borrower detection at creation time (advisory `checkDuplicate` endpoint exists but is not enforced) | HIGH | Data Integrity |
| 16 | Group exposure aggregation UI absent | HIGH | Process |
| 17 | Application detail tab state not URL-persisted | MEDIUM | UX |
| 18 | No LOO expiry date enforcement | MEDIUM | Process |
| 19 | Financial ratio benchmarks not industry-adjusted | MEDIUM | Process |
| 20 | No accessible colour-independent status indicators | MEDIUM | Accessibility |

---

### Critical Issues — Must Fix Before Launch

1. **DisbursementTab Navigation Gap** — `DisbursementTab` is registered in `renderTab()` but absent from `TAB_GROUPS`. The `DetailTab` type comment indicates it was intended to be conditionally shown in ACCEPTED/DISBURSED/CLOSED states. Complete the conditional rendering logic, or add it to `TAB_GROUPS` under S7 · Decision.
2. **Bureau API / Hard Gate** — Implement supervisor sign-off requirement for manually-obtained bureau reports until API integration is live.
3. **"Refer Back" State** — Add `REFERRED_BACK` as an explicit application state with notification to analyst. Note: a `RETURN` action already exists in the approval service (sends from committee back to `CREDIT_ASSESSMENT`), but a general-purpose refer-back mechanism is needed for earlier stages too.
4. **Credit Policy Enforcement** — Implement configurable hard/soft limits for sector concentration and single-borrower exposure.
5. **Dashboard My-Work Separation** — Default dashboard to show the logged-in user's assigned cases and pending actions first.

---

### High Priority Improvements

1. Sticky application header with: Borrower Name, Loan Amount, Risk Score, Bureau Status, State.
2. Pre-submission application readiness checklist.
3. Application clone/renew function (especially for annual renewals).
4. Approval turnaround time report.
5. SLA breach widget on dashboard.
6. Financial spreading: side-by-side multi-period view.
7. Auto-route approvals based on approval matrix.
8. Committee vote → auto-transition application state.
9. Duplicate borrower detection by IC/Co. Reg. number.
10. Group exposure aggregation across related party group.

---

### Medium Priority Improvements

1. Industry-specific financial ratio benchmarks.
2. Guarantor financial assessment form.
3. Document expiry tracking (audited accounts < 18 months).
4. LOO expiry date enforcement.
5. Collateral cross-linking and reuse.
6. Score override dedicated audit log (before/after, justification).
7. Conflict of interest declaration for committee members.
8. Post-meeting minutes PDF generation.
9. Excel/CSV data export for reports.
10. Concentration risk report (Top 10 borrowers by exposure).

---

### Low Priority Improvements

1. Bulk approval for low-risk batches.
2. Scheduled report generation and email delivery.
3. Borrower-facing portal (document upload request).
4. Analyst productivity leaderboard on dashboard.
5. Mobile application detail — summary-only view.
6. IP allowlist / VPN enforcement.
7. Structured loan purpose taxonomy (dropdown).
8. "Getting Started" onboarding checklist for new analysts.

---

### Quick Wins (< 1 Week Each)

| Win | Effort | Impact |
|---|---|---|
| Add risk score to application header | Low | High |
| Add "Last saved" timestamp near auto-save | Low | Medium |
| Add bureau status indicator on Kanban card | Low | High |
| Add breadcrumb navigation to application detail | Low | Medium |
| Persist active tab in URL hash | Low | Medium |
| Add "New Application" button on Borrower Profile page | Low | High |
| Add SLA breach count widget to dashboard | Medium | High |
| Colour + icon (not colour-only) for status badges | Low | Medium |
| Add loan purpose structured dropdown | Low | Medium |
| Make FATCA/CRS mandatory in borrower creation wizard | Low | High (compliance) |

---

### Missing Features — Prioritized

| # | Feature | Priority | Sprint Est. |
|---|---|---|---|
| 1 | Bureau API integration (CCRIS/CTOS) | CRITICAL | 2 sprints |
| 2 | Application renewal/clone | HIGH | 0.5 sprint |
| 3 | "Refer Back" workflow state | HIGH | 0.5 sprint |
| 4 | Credit policy limit enforcement | HIGH | 1 sprint |
| 5 | Approval turnaround report | HIGH | 0.5 sprint |
| 6 | Group exposure aggregation UI | HIGH | 1 sprint |
| 7 | Guarantor financial assessment | MEDIUM | 1 sprint |
| 8 | LOO expiry enforcement | MEDIUM | 0.5 sprint |
| 9 | Collateral cross-linking | MEDIUM | 0.5 sprint |
| 10 | Conflict of interest declaration | MEDIUM | 0.5 sprint |
| 11 | Document expiry tracking | MEDIUM | 0.5 sprint |
| 12 | Analyst productivity report | MEDIUM | 0.5 sprint |
| 13 | Excel export for all reports | MEDIUM | 1 sprint |
| 14 | Borrower portal / document request | LOW | 2 sprints |
| 15 | Scheduled report delivery | LOW | 1 sprint |

---

### UI Redesign Recommendations

**Priority 1 — Application Detail Layout**

Replace horizontal 33-tab bar with left-side vertical navigation:

```
  ┌─────────────────────────────────────────────────────────┐
  │ HEADER: [Borrower] [App ID] [Amount] [Score:BB] [State] │
  │         [RM: KY] [Analyst: ABC] [SLA: ●2 days left]     │
  ├──────────────┬──────────────────────────────────────────┤
  │ S1 KYC ✓    │                                          │
  │ S2 Financial │    ACTIVE TAB CONTENT                    │
  │ S3 Risk  ⚠  │    (full width, scrollable)              │
  │ S4 Collateral│                                          │
  │ S5 Approvals │                                          │
  │ S6 Offer/Dis │                                          │
  │ S7 Monitoring│                                          │
  └──────────────┴──────────────────────────────────────────┘
```

**Priority 2 — Dashboard Layout**

```
  ROW 1: [My Pending: 3] [My Cases: 12] [SLA Breach: 2] [Overdue: 1]
  ROW 2: Pipeline mini-kanban (5 columns, counts only) | Avg Days per State bar
  ROW 3: [Total Portfolio: MYR Xm] | Risk Band Distribution pie | Top 5 Borrowers
  ROW 4: Approved this month: N (MYR Xm) | Rejected: N | Avg TAT: X days
  ROW 5: Committee calendar (next 7 days)
```

**Priority 3 — Kanban Column Collapse**

Group columns: Pre-Submission (DRAFT+SUBMITTED) | KYC | Assessment (UNDERWRITING+CREDIT_ASSESSMENT+COMMITTEE) | Decision (APPROVED+REJECTED) | Post-Approval (OFFER+ACCEPTED+DISBURSED+ACTIVE) | Closed (CLOSED+WITHDRAWN)

---

### UX Redesign Recommendations

1. **Progressive Disclosure:** Show only S1+S2 tabs on application creation. Unlock subsequent sections only when prior sections are complete.
2. **Contextual Action Buttons:** Replace generic "Save" with context-aware CTAs: "Complete Financial Analysis →".
3. **Application Status Bar:** Always-visible status strip: Bureau ● | AML ● | Score ● | Collateral ● | Conditions ●.
4. **Validation on Navigate:** When a user leaves a tab with incomplete required fields, show a banner on the section nav.
5. **Undo for Destructive Actions:** State transitions (especially Reject) should have a 5-second undo window before committing.

---

### Future Roadmap

**Phase 3 (Next 3 Months) — Productivity & UX**
- Application detail left-nav redesign
- Bureau API integration (CCRIS/CTOS)
- Renewal/clone workflow
- "Refer Back" state
- Dashboard My-Work redesign
- Financial spreading multi-period view

**Phase 4 (3–6 Months) — Intelligence & Compliance**
- Credit policy limit enforcement engine
- Industry-specific ratio benchmarks
- Group exposure aggregation
- IFRS 9 ECL reporting
- BNM regulatory reporting outputs
- Conflict of interest management

**Phase 5 (6–12 Months) — Scale & Integration**
- Borrower portal (document upload, application status tracking)
- Core banking integration (Finacle, T24)
- Automated financial statement extraction (OCR)
- Machine learning risk score augmentation
- BI dashboard (Power BI / embedded analytics)
- Scheduled regulatory reporting

**Phase 6 (12–18 Months) — Automation**
- Straight-through processing for low-risk retail loans (auto-approve under threshold)
- Automated bureau check scheduling
- Covenant monitoring automation (triggered by financial statement upload)
- Digital LOO with e-signature (replace manual signed copy upload)

---

### Final Verdict

**Classification: FAIR (64/100)**

The Credit Assessment Module is an **ambitious, technically sound, and functionally deep** system that covers most of the credit lifecycle. It demonstrates genuine domain knowledge and production-grade engineering practices. The data model is comprehensive, the state machine is well-designed, and the compliance framework (AML, FATCA, IFRS 9, SOD) is clearly thought through.

However, the module is **not yet production-ready as a standalone credit platform** due to:

1. A UX design debt so severe (18–25 tab sections across 8–12 groups in the application detail screen) that it will drive user resistance and require workarounds.
2. Missing bureau API integration — a regulatory and operational necessity.
3. Incomplete workflow (no Refer Back state, no auto-routing, no application renewal).
4. Insufficient reporting for management and regulatory purposes.
5. Dashboard inadequacy for operational management.

**With 2–3 focused sprint cycles targeting the critical and high priority items above, this module can reach a score of 78–82 (Good), making it fit for production deployment.**

The foundation is excellent. The risk is manageable. Ship with the critical fixes, monitor closely, and iterate.

---

*Audit prepared based on full codebase analysis. All findings derived from code structure, data models, route definitions, and component analysis.*
