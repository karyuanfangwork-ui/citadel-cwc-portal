# Credit Assessment Module — Enterprise UI/UX Audit Report

**Framework:** React 19 + TypeScript + Vite + Tailwind CSS  
**Backend:** Node.js + Express + Prisma + PostgreSQL  
**Audit Date:** 2026-05-21  
**Audit Scope:** 15 frontend files, 21-tab application detail, 4-screen dashboard hub  
**Auditor:** Claude Code (Enterprise UI/UX Audit)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Overall UI/UX Scorecard](#2-overall-uiux-scorecard)
3. [Financial Workflow UX Findings](#3-financial-workflow-ux-findings)
4. [Responsive & Mobile Findings](#4-responsive--mobile-findings)
5. [Credit Analyst Productivity Findings](#5-credit-analyst-productivity-findings)
6. [Approval Workflow Findings](#6-approval-workflow-findings)
7. [Accessibility Findings](#7-accessibility-findings)
8. [Frontend Performance Findings](#8-frontend-performance-findings)
9. [Enterprise Design System Findings](#9-enterprise-design-system-findings)
10. [Security UX Findings](#10-security-ux-findings)
11. [Critical UI Problems Summary](#11-critical-ui-problems-summary)
12. [High Priority Improvements](#12-high-priority-improvements)
13. [Quick Wins](#13-quick-wins)
14. [Long-Term UX Improvements](#14-long-term-ux-improvements)
15. [UI Modernization Recommendations](#15-ui-modernization-recommendations)
16. [Production Readiness Verdict](#16-production-readiness-verdict)

---

## 1. Executive Summary

The Credit Assessment Module has a **structurally sound foundation** — well-typed services, clear state machine, readable color system, and functional approval workflow. However, it has critical UX debt that will compound rapidly under real operational load: 21 tabs with no grouping or completion signals, inconsistent read-only indicators, absent inline validation, stub-level tab implementations, and table-heavy UIs that collapse poorly on mobile.

The system is **feature-rich but not yet operationally mature**. A credit analyst encountering the application detail page for the first time faces a wall of 21 unlabeled tabs with no guidance on sequencing, completion status, or which sections require action. This is the single most urgent UX problem.

### Application Architecture

| Screen | File | Purpose |
|---|---|---|
| Dashboard | `pages/credit/CreditDashboard.tsx` | 4-tab hub: Pipeline, Approval Inbox, Exposure, Committee Calendar |
| Application List | `pages/CreditApplicationList.tsx` | Kanban board (6 workflow state columns) |
| Application Detail | `pages/CreditApplicationDetail.tsx` | 21-tab CA Memo interface with stepper |
| Approvals Hub | `pages/MyApprovals.tsx` | Urgency-grouped approval queue |
| Utilities | `pages/credit/creditUtils.ts` | Centralized state labels, colors, stepper stages |

### Application Lifecycle (State Machine)

```
DRAFT → SUBMITTED → KYC_REVIEW → KYC_APPROVED/REJECTED
     → UNDERWRITING → CREDIT_ASSESSMENT → COMMITTEE_REVIEW
     → APPROVED/REJECTED → OFFER → ACCEPTED → DISBURSED → ACTIVE → CLOSED/WITHDRAWN
```

---

## 2. Overall UI/UX Scorecard

| Dimension | Score | Rationale |
|---|---|---|
| **UI Quality** | 6.5 / 10 | Clean Tailwind design, good color system, inconsistent component patterns |
| **UX Efficiency** | 5.5 / 10 | Too many clicks, 21-tab overload, no workflow guidance |
| **Enterprise Readiness** | 6.0 / 10 | Solid architecture, incomplete CA Memo phases, no export suite |
| **Mobile Experience** | 4.5 / 10 | Responsive grid used but tabs, tables, and modals fail on mobile |
| **Financial Workflow Usability** | 6.0 / 10 | Approval UX is strong; CA Memo UX is incomplete and inconsistent |
| **Accessibility** | 5.0 / 10 | ARIA roles present, keyboard nav on tabs, missing ARIA validation + skip links |
| **Frontend Performance** | 5.5 / 10 | Lazy tab loading used but no caching layer, heavy API calls |
| **Design System Consistency** | 6.5 / 10 | `creditUtils.ts` is excellent; button/link styles inconsistent |

**Composite Score: 5.9 / 10**

---

## 3. Financial Workflow UX Findings

### FINDING F-01 — 21-Tab Application Detail: Cognitive Overload

| Attribute | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Affected Module** | Application Detail (`CreditApplicationDetail.tsx:314–336`) |
| **Root Cause** | All CA Memo phases (6 phases × multiple sections) flattened into a single linear tab bar |
| **User Impact** | Analysts cannot determine which sections require action, which are complete, or which are locked in the current application state |
| **Business Impact** | Risk of missed required sections (e.g., collateral, conditions) before committee submission — directly increases credit decision error rate |
| **Operational Risk** | HIGH — incomplete CA Memos submitted to committee |
| **Priority** | P0 — Sprint 1 |

**Recommended Fix:**

Group tabs into 7 phase buckets with collapsible accordion or sticky sidebar navigation:

- **Phase 1:** Header & Background
- **Phase 2:** Facilities & Requests
- **Phase 3:** Risk Rating & ECL
- **Phase 4:** Security & Guarantees
- **Phase 5:** Credit Checks
- **Phase 6:** Summary & Conditions
- **Meta:** Parties, Documents, Approvals, Audit

Additional improvements:
- Add **completion badges** (green tick, amber partial, red missing) per phase group
- Add **"Next Required Section"** floating action button for guided workflow
- Show **"X sections incomplete"** counter in application header

---

### FINDING F-02 — Inconsistent Tab Maturity Across CA Memo Phases

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | All `pages/credit/tabs/*.tsx` files |
| **Root Cause** | Tabs were built in separate implementation phases with no enforced UX contract between them |
| **User Impact** | Analysts experience jarring UX inconsistency — some tabs autosave, some don't; some show read-only badge, some silently disable inputs |
| **Business Impact** | Analyst confidence in data integrity is reduced; unclear whether changes are persisted |
| **Operational Risk** | MEDIUM — data loss in tabs without autosave |
| **Priority** | P1 — Sprint 2 |

**Tab Maturity Assessment:**

| Tab | Lines | State | Problem |
|---|---|---|---|
| `HeaderBackgroundTab` | 196 | Full autosave + sections | Reference implementation — use as template |
| `FacilitiesTab` | 12 | Stub delegating to `RequestsFacilitiesTab` | Incomplete |
| `DocumentsTab` | 16 | Stub delegating to borrower profile | Unclear ownership |
| `SecurityGuaranteesTab` | ~150 | Read-only display only | No editing capability |
| `RiskRatingEclTab` | ~150 | Functional but dense table | No pagination |
| `SummaryTab` | 284 | Solid — credit scoring + override | Reference implementation |
| `ApprovalsTab` | 141 | Clean timeline + decision panel | Reference implementation |
| `PartiesTab` | 185 | Good form validation | Reference implementation |

**Recommended Fix:** Define a shared `CaMemoTabTemplate` component with: section header, edit/read-only badge, save button, autosave indicator, dirty-state warning. All editable tabs must conform.

---

### FINDING F-03 — No Financial Data Visualization in CA Memo Tabs

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `RiskRatingEclTab.tsx`, `PaymentCapabilityTab.tsx`, `FinancialSpreading.tsx` |
| **Root Cause** | CA Memo tabs present financial ratios, ECL, and projections as raw data tables with no charts or sparklines |
| **User Impact** | Analysts must mentally process tabular data to identify trends — increases cognitive load and decision latency |
| **Business Impact** | Slower credit decisions, higher risk of misreading trend direction in multi-year data |
| **Operational Risk** | MEDIUM |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:**
- Add sparkline trend charts to financial ratio rows (3-year trend)
- Add ECL waterfall chart (current vs. projected)
- Add sensitivity scenario comparison bar chart
- Add borrower sector comparison mini-chart on summary tab

---

## 4. Responsive & Mobile Findings

### FINDING M-01 — Tab Navigation Unusable on Mobile

| Attribute | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Affected Module** | `CreditApplicationDetail.tsx:314–336` |
| **Root Cause** | 21 tabs rendered in a horizontal scroll container. On 375px screen, user sees ~3 tabs and must scroll horizontally to find others |
| **User Impact** | Management approvers reviewing applications on iPhone cannot navigate the application efficiently |
| **Business Impact** | Approvals delayed because management cannot comfortably review application details on mobile — undermines the "mobile approval" capability |
| **Operational Risk** | HIGH |
| **Priority** | P0 — Sprint 1 |

**Recommended Fix:**
- Replace tab bar with a **bottom sheet selector on mobile** (sheet opens tab list by phase group)
- OR implement **side-drawer navigation on tablet+**
- On mobile: reduce to 3 primary tabs (Summary, Risk, Approvals) with expandable "More" menu

---

### FINDING M-02 — Financial Tables Break on Mobile

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `RiskRatingEclTab.tsx`, `RequestsFacilitiesTab.tsx`, `CreditDashboard.tsx` (Exposure tab) |
| **Root Cause** | Tables wrapped in `overflow-x-auto` but column count (8–12 columns) makes them unreadable on mobile even with scroll |
| **User Impact** | Relationship managers on mobile cannot read exposure summaries or ECL tables |
| **Operational Risk** | MEDIUM |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix — Card-collapse pattern on screens < 768px:**

Convert table rows to stacked cards on mobile, showing only 3 critical columns with row expand for detail:

```
[Borrower Name]          [Limit: RM 2.5M]
Rating: BBB | ECL: 1.2% | [▼ Details]
```

---

### FINDING M-03 — Modal Dialogs Obscured by Mobile Keyboard

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditApplicationList.tsx` (create modal), `MyApprovals.tsx` (approval modal) |
| **Root Cause** | Modal dialogs are centered in `fixed` position viewport without viewport-fit consideration. When keyboard opens on mobile, modal input fields slide behind keyboard |
| **Operational Risk** | LOW-MEDIUM |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:**
- Set `overflow-y: auto` on modal body, not container
- Use `env(safe-area-inset-bottom)` for iOS bottom padding
- Use `visualViewport` API for keyboard-aware positioning

---

### FINDING M-04 — Kanban Board Column Collapse

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditApplicationList.tsx` |
| **Root Cause** | 6-column kanban set to `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`. On 375px mobile, 2-column layout shows only 2 of 6 workflow states |
| **User Impact** | Users cannot see if applications are stuck in hidden pipeline stages |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:**
- On mobile: switch to vertical list with state filter chips at top
- Alternatively: horizontal scroll with state header sticky-pinned and cards scrolling beneath

---

## 5. Credit Analyst Productivity Findings

### FINDING P-01 — No Workflow Guidance for New Applications

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `CreditApplicationDetail.tsx` (DRAFT state) |
| **Root Cause** | When an analyst creates a new application, they land on the Summary tab with no guided sequence |
| **User Impact** | Junior analysts do not know which tabs to fill in which order for a complete CA Memo. Senior analysts must onboard them manually |
| **Business Impact** | Onboarding time increased; higher error rate for new analysts |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:**
- Add a **Setup Wizard** for new DRAFT applications (3-step: Borrower selection → Product type → Initial assessment)
- Add **progress checklist sidebar** listing required sections per CA Memo phase
- Add "Sections remaining" counter in application header

---

### FINDING P-02 — No Autosave on Most Tabs

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | All editable tabs except `HeaderBackgroundTab.tsx` |
| **Root Cause** | `HeaderBackgroundTab.tsx` implements autosave (debounced 1500ms). All other tabs do not |
| **User Impact** | Analysts filling in `RiskRatingEclTab`, `PaymentCapabilityTab`, or `SecurityGuaranteesTab` lose work on accidental navigation, browser refresh, or session timeout |
| **Business Impact** | Repeated data re-entry increases analyst time-on-task. Risk of incomplete data if session times out mid-form |
| **Operational Risk** | HIGH — data loss |
| **Priority** | P0 — Sprint 1 |

**Recommended Fix:**
- Standardize autosave with debounce across all editable tabs (copy pattern from `HeaderBackgroundTab.tsx`)
- Add browser `beforeunload` warning on dirty forms system-wide
- Add "Last saved at [time]" indicator on all editable tabs

---

### FINDING P-03 — SLA Logic Duplicated Across Components

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditApplicationList.tsx` and `MyApprovals.tsx` |
| **Root Cause** | Both components implement `getSLAInfo()` independently |
| **Business Impact** | Future SLA rule changes require updates in two places; risk of divergence |
| **Priority** | P3 — Backlog |

**Recommended Fix:** Extract to `creditUtils.ts` alongside existing `STATE_COLORS` and `STEPPER_STAGES`.

---

### FINDING P-04 — Weak Application List Filtering

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `CreditApplicationList.tsx:178–196` |
| **Root Cause** | Only 4 filters: text search, productType, state, borrowerProfileId |
| **User Impact** | In portfolios with 50+ applications, finding specific cases requires manually scanning all kanban columns |
| **Business Impact** | Analyst time wasted on navigation instead of analysis |
| **Priority** | P1 — Sprint 2 |

**Missing filters:**
- Date range (application date, submission date, last action)
- Facility amount range
- Risk rating
- Relationship manager
- Assigned analyst
- SLA breach status

**Recommended Fix:**
- Add collapsible advanced filter panel
- Add quick filter presets: "My Applications", "SLA Breached", "Awaiting My Action"
- Persist filter state in URL params for bookmarking/sharing

---

### FINDING P-05 — No Bulk Operations

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditApplicationList.tsx` |
| **Root Cause** | No multi-select on application list |
| **User Impact** | Operations team cannot perform bulk assignment, bulk archival, or batch status transitions |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Add checkbox multi-select with "Bulk Actions" dropdown for: assign analyst, export selected, bulk status update (admin only).

---

## 6. Approval Workflow Findings

### FINDING A-01 — Approval Inbox Lacks Decision Context

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `MyApprovals.tsx` |
| **Root Cause** | Approval cards show borrower name, facility type, amount, urgency — but not the credit recommendation, risk rating, or analyst summary |
| **User Impact** | Approvers must navigate: approval list → application detail → Summary tab → Approvals tab — minimum 4 clicks before they can make a decision |
| **Business Impact** | Slower approval turnaround time. Management frustration with approval workflows |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:**
- Expand approval card to show: Risk Rating, Credit Score, Recommended Decision, Analyst Name
- Add "Quick View" slide-over panel showing CA Memo summary without leaving approvals list
- Enable approve/reject directly from approval card with one-click confirmation (for clear-cut cases)

---

### FINDING A-02 — No Delegation or Reassignment Workflow

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `MyApprovals.tsx` |
| **Root Cause** | Approval inbox shows items assigned to the current user only. No delegation or out-of-office workflow |
| **Business Impact** | If an approver is unavailable, applications stall with no coverage mechanism |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Add "Delegate to" button on approval items. Add OOO mode that auto-delegates to deputy.

---

### FINDING A-03 — Committee Review Calendar Is Visual-Only

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditDashboard.tsx` — Committee Calendar tab |
| **Root Cause** | Calendar displays committee meetings but clicking a date has no action |
| **User Impact** | Credit officers cannot see which applications are scheduled for which committee session without navigating separately |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Clicking a committee date should show: list of applications scheduled, committee members, agenda status, countdown to next meeting.

---

## 7. Accessibility Findings

**Accessibility Score: 5.0 / 10**

### What Works

- Semantic HTML: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `role="dialog"`
- ARIA landmarks and roles on major sections
- Keyboard navigation on tabs (arrow keys, Home, End) via `handleTabKeyDown`
- Focus management on dialogs (auto-focus cancel button, focus restoration)
- Semantic `<button>`, `<select>`, `<textarea>` elements

### Gaps

---

### FINDING ACC-01 — No Inline Form Validation ARIA

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | All form tabs (`PartiesTab`, `HeaderBackgroundTab`, `RiskRatingEclTab`, etc.) |
| **Root Cause** | Form fields lack `aria-invalid`, `aria-required`, `aria-describedby` linking to error messages |
| **User Impact** | Screen reader users receive no feedback when a required field is empty or invalid |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:**

```tsx
<input
  aria-required="true"
  aria-invalid={!!errors.fieldName}
  aria-describedby={errors.fieldName ? 'fieldName-error' : undefined}
/>
{errors.fieldName && (
  <span id="fieldName-error" role="alert">{errors.fieldName}</span>
)}
```

---

### FINDING ACC-02 — Color-Only Status Indicators

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `creditUtils.ts` (`STATE_COLORS`), `MyApprovals.tsx` (urgency indicators), `CreditDashboard.tsx` |
| **Root Cause** | Application states, urgency levels, and risk ratings communicated purely through color |
| **User Impact** | Color-blind users (8% of male population) cannot distinguish urgency levels or risk tiers |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:** Add text labels and icons alongside color. Example: "🔴 Overdue", "🟡 Urgent", "🟢 Normal" — or text suffixes: "HIGH RISK", "OVERDUE".

---

### FINDING ACC-03 — No Skip Navigation Links

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Root Cause** | Keyboard users must tab through entire header/navigation before reaching main content |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:**

```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>
```

---

### FINDING ACC-04 — Icon-Only Buttons Without Labels

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Root Cause** | Several action buttons use only Material Symbols icons (edit, delete, download) without `aria-label` |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Add `aria-label="Edit party"` / `aria-label="Download CA Memo"` to all icon-only buttons.

---

### FINDING ACC-05 — Color Contrast Risk on Small Badges

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Root Cause** | `STATE_COLORS.KYC_REVIEW` (#3b82f6 text on white background) is ~4.5:1 — passes WCAG AA for large text but fails for badge text below 18px |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Darken badge text colors or increase badge font size to 14px minimum.

---

## 8. Frontend Performance Findings

### FINDING PERF-01 — No Client-Side Caching Layer

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | `frontend/src/services/credit.service.ts` |
| **Root Cause** | All API calls go through bare `axios`. No React Query, SWR, or equivalent |
| **User Impact** | Switching tabs in application detail re-fetches data on every visit |
| **Business Impact** | Unnecessary API load; slow tab switching on large applications |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:** Wrap API calls with React Query `useQuery`. Cache TTL:
- 2–5 minutes for reference data (borrowers, product types)
- 30 seconds for mutable data (facilities, approvals)

---

### FINDING PERF-02 — Dashboard Loads All Borrower Data at Once

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditDashboard.tsx` — Exposure tab |
| **Root Cause** | Exposure dashboard fetches complete borrower + exposure data without pagination |
| **Business Impact** | For portfolios with 500+ borrowers, this becomes slow and risks browser memory pressure |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Add server-side pagination to exposure API endpoint. Implement virtual scrolling (`react-virtual`) for exposure table.

---

### FINDING PERF-03 — No Shape-Matched Loading Skeletons

| Attribute | Detail |
|---|---|
| **Severity** | LOW-MEDIUM |
| **Root Cause** | Loading states use generic `pulse` divs without matching the shape of actual content |
| **User Impact** | Screen flashes from blank to loaded state; no visual cue of what is loading |
| **Priority** | P3 — Backlog |

**Recommended Fix:** Build `CreditApplicationCardSkeleton`, `ApprovalCardSkeleton`, `KpiCardSkeleton` matching actual component shapes.

---

## 9. Enterprise Design System Findings

### FINDING DS-01 — Inline Styles Mixed With Tailwind

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Root Cause** | Some components use `style={{background: 'none', border: 'none'}}` inline rather than Tailwind classes |
| **Priority** | P3 — Backlog |

**Recommended Fix:** Enforce Tailwind-only styling via ESLint `no-inline-styles` rule. Refactor during normal maintenance.

---

### FINDING DS-02 — No Shared Credit-Domain Component Library

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Root Cause** | UI patterns like "risk badge", "state badge", "facility card", and "approval decision button" are re-implemented per component |
| **Business Impact** | Future design changes require updates in multiple files; inconsistency risk grows with team size |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** Create `frontend/src/components/credit/` with:

| Component | Purpose |
|---|---|
| `StateBadge.tsx` | Takes `state`, renders `STATE_COLORS` badge |
| `RiskBadge.tsx` | Risk rating color + label |
| `FacilityCard.tsx` | Standard facility summary card |
| `ApprovalDecisionBar.tsx` | Approve/reject/refer buttons |
| `CaMemoSection.tsx` | Section wrapper with title, edit/read-only badge, save button |

---

### FINDING DS-03 — Acronyms Used Without Tooltips

| Attribute | Detail |
|---|---|
| **Severity** | LOW |
| **Affected Module** | All CA Memo tabs |
| **Root Cause** | Financial domain acronyms appear without explanation |
| **User Impact** | Junior analysts or operations staff face comprehension barriers |
| **Priority** | P3 — Backlog |

**Acronyms to address:** DSCR, EBITDA, ECL, LTV, CASA, CCRIS, CTOS, PD, LGD, NIM, ROA, ROE

**Recommended Fix:** Wrap in `<abbr title="Debt Service Coverage Ratio">DSCR</abbr>` or implement a `<Tooltip>` component triggered on hover/tap.

---

## 10. Security UX Findings

### FINDING SEC-01 — No Unsaved Changes Warning on Tab Navigation

| Attribute | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Affected Module** | All editable tabs except `HeaderBackgroundTab.tsx` |
| **Root Cause** | When an analyst edits a form field and clicks another tab, changes are silently discarded (no autosave, no warning) |
| **Business Impact** | Data loss. Analyst re-enters data, increasing time-on-task and frustration |
| **Operational Risk** | HIGH — incomplete financial data persisted to database |
| **Priority** | P0 — Sprint 1 |

**Recommended Fix:** Implement a `useDirtyFormGuard` hook that:
1. Detects unsaved changes (dirty state)
2. On tab change, shows: "You have unsaved changes. Save before leaving?"
3. Offers: Save → navigate | Discard → navigate | Cancel → stay

---

### FINDING SEC-02 — Destructive Actions Missing Double-Confirmation

| Attribute | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Affected Module** | `CreditApplicationDetail.tsx` (state transition dialogs) |
| **Root Cause** | Application state transitions (REJECT, WITHDRAW) show a single confirmation dialog. For high-impact decisions, single confirmation is insufficient |
| **Business Impact** | Accidental rejections or withdrawals are hard to reverse; compliance audit trail compromised |
| **Priority** | P2 — Sprint 3 |

**Recommended Fix:** For irreversible transitions (REJECTED, WITHDRAWN, CLOSED, DISBURSED): require the user to type the application reference number to confirm.

---

### FINDING SEC-03 — Session Timeout During Long CA Memo Entry

| Attribute | Detail |
|---|---|
| **Severity** | HIGH |
| **Affected Module** | All editable tabs, session management |
| **Root Cause** | No visible session expiry warning. Users filling in long CA Memo forms (30–45 minutes) may submit to a 401 error with data lost |
| **Business Impact** | Work loss, analyst frustration, delayed credit decisions |
| **Priority** | P1 — Sprint 2 |

**Recommended Fix:**
- Show "Session expiring in 5 minutes" warning banner with "Extend Session" button
- Auto-save all dirty forms before session expiry
- On re-login, restore in-progress form state from `localStorage`

---

### FINDING SEC-04 — PII/Financial Data in Browser URL

| Attribute | Detail |
|---|---|
| **Severity** | LOW |
| **Affected Module** | All credit module routes |
| **Root Cause** | Borrower IDs and application IDs appear in URLs as raw UUIDs |
| **Recommendation** | Flag for compliance review; implement opaque URL slugs if regulatory requirement arises |
| **Priority** | P4 — Compliance Review |

---

## 11. Critical UI Problems Summary

| # | Finding ID | Problem | Severity | Sprint |
|---|---|---|---|---|
| 1 | F-01 | 21-tab overload — no grouping, no completion signals | CRITICAL | S1 |
| 2 | SEC-01 | No unsaved changes warning on tab switch | CRITICAL | S1 |
| 3 | M-01 | Tab navigation unusable on mobile | CRITICAL | S1 |
| 4 | P-02 | Autosave only on HeaderBackgroundTab | HIGH | S1 |
| 5 | M-02 | Financial tables unreadable on mobile | HIGH | S2 |
| 6 | A-01 | Approval cards missing credit summary context | HIGH | S2 |
| 7 | ACC-01 | No inline form validation ARIA | HIGH | S2 |
| 8 | P-01 | No workflow guidance for new applications | HIGH | S2 |
| 9 | PERF-01 | No client-side caching layer | HIGH | S2 |
| 10 | SEC-03 | Session timeout during long CA Memo entry | HIGH | S2 |

---

## 12. High Priority Improvements

1. **Tab Architecture Redesign** — Phase-grouped sidebar or accordion for application detail (F-01)
2. **Autosave Standardization** — All editable tabs must use the `HeaderBackgroundTab.tsx` autosave pattern (P-02)
3. **Unsaved Changes Guard** — `useDirtyFormGuard` hook across all editable tabs (SEC-01)
4. **Mobile Approval Optimization** — Reduce approval flow to 3 steps on mobile; bottom sheet tab selector (M-01)
5. **Advanced Filtering** — Date range, amount, risk rating, analyst filters on application list (P-04)
6. **React Query Integration** — Cache layer to reduce redundant API calls (PERF-01)
7. **Shared Credit Component Library** — StateBadge, RiskBadge, FacilityCard, CaMemoSection (DS-02)
8. **ARIA Validation** — `aria-invalid`, `aria-required`, `aria-describedby` on all form fields (ACC-01)
9. **Session Expiry Warning** — In-app warning + auto-save before session timeout (SEC-03)
10. **Approval Card Context** — Risk rating, credit score, recommendation on approval card (A-01)

---

## 13. Quick Wins (Under 1 Day Each)

| # | Task | Time Est. | Impact |
|---|---|---|---|
| 1 | Add completion dot badge to each tab (green if any data saved) | 2 hrs | HIGH — improves workflow awareness |
| 2 | Add read-only banner to all locked tabs (single shared component) | 1 hr | MEDIUM — reduces analyst confusion |
| 3 | Add `aria-label` to all icon-only buttons | 1 hr | HIGH — accessibility |
| 4 | Extract `getSLAInfo()` to `creditUtils.ts` | 30 min | LOW — maintainability |
| 5 | Add browser `beforeunload` warning for dirty forms | 2 hrs | CRITICAL — data loss prevention |
| 6 | Wrap acronyms in `<abbr>` tags (DSCR, EBITDA, ECL, LTV, CCRIS, CTOS) | 1 hr | LOW — usability for junior staff |
| 7 | Add "Skip to main content" link | 15 min | MEDIUM — accessibility |
| 8 | Add `aria-invalid` + `aria-describedby` to validated fields | 2 hrs | HIGH — accessibility |

---

## 14. Long-Term UX Improvements

1. **Guided Assessment Wizard** — Step-by-step CA Memo completion wizard for new DRAFT applications, replacing the blank 21-tab experience. Reduces onboarding time for junior analysts.

2. **Portfolio Analytics Dashboard** — Sector concentration heat map, vintage analysis, roll rate charts, delinquency trends. Supports management review and risk committee preparation.

3. **Collaborative Editing Indicators** — Show when another analyst is actively viewing the same application. Prevents conflicting edits on shared applications.

4. **In-App Notification System** — Real-time alerts for: SLA breach, approval required, application status change, document upload. Replaces reliance on email notifications.

5. **Document Intelligence** — AI-assisted extraction from uploaded financial statements pre-populating financial spreading fields. Reduces manual data entry by 40–60%.

6. **Audit Trail Timeline** — Visual horizontal timeline of all state changes, approvals, and edits on application detail. Supports compliance review and exception handling.

7. **Offline Support** — Service worker to allow CA Memo draft editing during poor connectivity, with sync on reconnect. Supports relationship managers in the field.

8. **Approval Delegation Engine** — Full OOO delegation with delegation rules (by type, amount, date range), delegation audit trail, and auto-expiry.

---

## 15. UI Modernization Recommendations

| Area | Current State | Target State |
|---|---|---|
| Application Detail Navigation | 21-tab horizontal scroll | Phase-grouped sidebar + tab content |
| Financial Tables | Dense HTML table | Responsive card-collapse on mobile |
| Status Badges | Color-only `STATE_COLORS` | Color + icon + text label |
| Loading States | Generic pulse divs | Shape-matched skeleton components |
| Form Feedback | Error banner at top | Inline field-level validation errors |
| Approval Workflow | Tab-based within detail | Side drawer accessible from any tab |
| Analytics Charts | Bar charts only | Mixed: bar, sparkline, waterfall, heatmap |
| Empty States | Inconsistent / missing | Illustrated empty states with action CTA |
| Keyboard Shortcuts | None | `Alt+1..6` for phases, `Ctrl+S` to save |
| Financial Ratios | Tabular only | Sparkline trend + threshold indicators |
| Acronyms | Raw text | `<abbr>` tooltips or info popovers |
| Session Management | Silent timeout | Warning banner + extend session |

---

## 16. Production Readiness Verdict

**Status: CONDITIONALLY READY — Not Ready for Full Enterprise Rollout**

| Criterion | Status | Blocker? |
|---|---|---|
| Core credit workflow functional | ✅ PASS | No |
| Application state machine complete | ✅ PASS | No |
| Approval workflow functional | ✅ PASS | No |
| Stepper progression clear | ✅ PASS | No |
| Dashboard analytics functional | ✅ PASS | No |
| CA Memo all phases complete (tabs) | ⚠️ PARTIAL | **YES** — several tabs are stubs |
| Autosave coverage | ❌ FAIL | **YES** — 1 of ~15 editable tabs has autosave |
| Unsaved changes guard | ❌ FAIL | **YES** — analyst data loss risk |
| Mobile approval workflow | ❌ FAIL | **YES** — tab nav unusable on mobile |
| Form validation accessibility | ⚠️ PARTIAL | No — usability risk |
| Advanced filtering | ⚠️ PARTIAL | No — workaround possible |
| Performance at scale (500+ apps) | ⚠️ UNKNOWN | No — untested |

### Rollout Thresholds

| Rollout Scope | Readiness | Blockers |
|---|---|---|
| **Pilot (5–15 power users)** | READY (with workaround awareness) | Communicate tab save behavior to users |
| **Department-wide (50+ users)** | NOT READY | Requires Sprint 1 fixes: autosave, unsaved-changes guard, mobile approval, all CA Memo tab stubs completed |
| **Enterprise-wide (200+ users)** | NOT READY | Requires Sprints 1–2 complete + performance testing at scale |

### Minimum Requirements Before Department Rollout

- [ ] SEC-01: Unsaved changes warning on tab navigation
- [ ] P-02: Autosave on all editable tabs
- [ ] M-01: Mobile approval flow workable (bottom sheet or equivalent)
- [ ] F-02: All CA Memo phase tabs functional and non-stub (no 12-line delegate wrappers)
- [ ] SEC-03: Session expiry warning with auto-save

---

*Report generated: 2026-05-21 | Framework: React 19 + TypeScript + Vite + Tailwind CSS | Module: Credit Assessment*
