# Credit Assessment Module — Audit Implementation Plan

**Source:** 2026-06-07-credit-assessment-uiux-audit.md (codebase-verified and corrected)
**Created:** 9 June 2026
**Approach:** Sprint-based delivery, 2-week sprints, prioritized by severity and dependency order

---

## Sprint Overview

| Sprint | Theme | Items |
|--------|-------|-------|
| S1 | Critical Fixes & Navigation | DisbursementTab, Refer Back state, breadcrumb/back-links, sticky header |
| S2 | Dashboard My-Work & SLA | My Work tab, SLA breach widget, duplicate borrower enforcement |
| S3 | UX Quick Wins | Pre-submission checklist, auto-save indicator, tab completion badges, Kanban SLA dots |
| S4 | Approval & Committee | Auto-route approvals, committee finalize UX, mandatory comments, mobile redirect |
| S5 | Financial Spreading & Reporting | Multi-period view, approval turnaround report, data export |
| S6 | Missing Features Part 1 | Application clone/renew, credit policy limits, LOO expiry enforcement |
| S7 | Missing Features Part 2 | Collateral cross-linking, group exposure UI, guarantor assessment |
| S8 | Polish & Accessibility | Colour+icon indicators, keyboard shortcuts, mobile summary view, FATCA mandatory step |

---

## Sprint 1 — Critical Fixes & Navigation (Week 1–2)

### 1.1 DisbursementTab: Wire Into TAB_GROUPS (CRITICAL — Finding #1)

**Problem:** `DisbursementTab` exists in `renderTab()` and `DetailTab` type but is absent from `TAB_GROUPS`. The type comment says `"visible in ACCEPTED / DISBURSED / CLOSED states"` — conditional rendering was intended but never wired.

**Files to change:**
- `frontend/pages/credit/creditUtils.ts` — Add disbursement tab to S7 group with state gating
- `frontend/pages/credit/CreditApplicationDetail.tsx` — Ensure tab navigation shows/hides based on application state

**Implementation:**
```
// In creditUtils.ts — add to S7 group with state gating
{
  id: 's7',
  label: 'S7 · Decision',
  tabs: [
    { id: 'signoff', label: 'Sign-off' },
    { id: 'approvals', label: 'Approval Chain' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'disbursement', label: 'Disbursement' },  // NEW
    { id: 'summary', label: 'Summary' },
  ],
  // Show disbursement tab only in these states
  visibleInStates: ['ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED'],
},
```

Update `getVisibleTabGroups()` to accept `applicationState` parameter and filter tabs whose `visibleInStates` (if set) doesn't include the current state.

**Pitfalls:**
- `ALL_TABS` is derived from `TAB_GROUPS.flatMap(...)` — adding `disbursement` there will automatically include it. Make sure `visibleInStates` filtering happens in `getVisibleTabGroups()`, not `ALL_TABS`.
- Phase completion logic (`getPhaseCompletion`) doesn't need to cover disbursement — it's optional (only visible post-approval).

**Verification:** Create application in APPROVED state → navigate to detail → S7 should show Disbursement tab. In DRAFT state → Disbursement tab should be hidden.

---

### 1.2 Add REFER_BACK Application State (CRITICAL — Finding #4)

**Problem:** No general-purpose "refer back to analyst" state. A `RETURN` action exists (committee → CREDIT_ASSESSMENT) but no state for broader refer-back flows.

**Files to change:**
- `backend/prisma/schema.prisma` — Add `REFERRED_BACK` to `ApplicationState` enum
- `backend/src/services/creditApplication.service.ts` — Add transition rules: `REFERRED_BACK → UNDERWRITING` (analyst picks up), add `REFERRED_BACK` to valid transitions from `KYC_REVIEW`, `CREDIT_ASSESSMENT`, `COMMITTEE_REVIEW`
- `backend/src/services/approvalAction.service.ts` — Add `REFER_BACK` decision type, triggers state → `REFERRED_BACK`
- `backend/src/controllers/creditApplication.controller.ts` — Handle `referBack` action
- `backend/src/routes/creditApplication.routes.ts` — Add `POST /:id/refer-back` endpoint
- `frontend/pages/credit/tabs/ApprovalsTab.tsx` — Add "Refer Back" button with mandatory comment dialog
- `frontend/src/services/credit.service.ts` — Add `referBackApplication()` method
- `frontend/pages/credit/creditUtils.ts` — Add `REFERRED_BACK` to state colors and labels
- Seed data: update `ApplicationState` enum values

**Transition rules:**
```
KYC_REVIEW → REFERRED_BACK      (KYC refers back for more info)
CREDIT_ASSESSMENT → REFERRED_BACK  (underwriter refers back)
COMMITTEE_REVIEW → REFERRED_BACK   (committee refers back for clarification)
REFERRED_BACK → UNDERWRITING       (analyst picks up and continues)
REFERRED_BACK → SUBMITTED          (analyst resubmits)
```

**Pitfalls:**
- After `prisma db push` with a new enum value on existing data, must DROP DEFAULT first, ALTER TYPE, then SET DEFAULT. See memory: "Prisma `db push` fails on enum column type changes when data exists".
- The existing `RETURN` action in `approvalAction.service.ts` sends to `CREDIT_ASSESSMENT` — keep this as-is, it's a different semantic (committee returns to underwriter). `REFER_BACK` is a broader mechanism.
- Mandatory comment — the `referBack` request must include a `reason` field (min 10 chars). Add Zod validation.

**Verification:** Approver clicks "Refer Back" on an application in `COMMITTEE_REVIEW` → state transitions to `REFERRED_BACK` → analyst sees it in their dashboard → analyst resubmits → state transitions back to `UNDERWRITING`.

---

### 1.3 Breadcrumb Navigation & Back-Links (HIGH)

**Problem:** `/credit/financials` and `/credit/collateral` are reachable only via deep-links with no visible way back.

**Files to change:**
- `frontend/pages/credit/FinancialSpreading.tsx` — Add breadcrumb/header: `← Back to [Borrower Name]`
- `frontend/pages/credit/CollateralManagement.tsx` — Add breadcrumb/header: `← Back to Application #[id]`
- Both should accept `?borrowerProfileId=` / `?applicationId=` query params and construct back-link URL.

**Implementation:**
```tsx
// In FinancialSpreading.tsx
const breadcrumb = borrowerName
  ? <Link to={`/credit/borrowers/${borrowerProfileId}`} className="text-blue-600 hover:underline">
      ← Back to {borrowerName}
    </Link>
  : <Link to="/credit/borrowers" className="text-blue-600 hover:underline">
      ← Back to Borrowers
    </Link>;
```

**Verification:** Navigate to `/credit/financials?borrowerProfileId=xxx` → breadcrumb shows borrower name and links back.

---

### 1.4 Sticky Application Header with Key Indicators (HIGH — Finding #6)

**Problem:** Risk score, bureau status, and other critical info are buried in tabs. Not visible at a glance.

**Files to change:**
- `frontend/pages/credit/CreditApplicationDetail.tsx` — Add sticky header bar below main navigation

**Implementation:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Borrower Name] · CA-001234 · MYR 500K · Score: BB (72) · ● Bureau: Pass │
│ RM: John · Analyst: Jane · SLA: ● 2 days left · State: UNDERWRITING     │
└──────────────────────────────────────────────────────────────────────────┘
```

Fields to show:
- Borrower name (linked to borrower profile)
- Application number
- Requested amount with currency
- Risk rating badge (from `app.riskRating`)
- Bureau status indicator (from `app.creditBureauChecks` — pass/fail/pending)
- RM and Analyst names
- SLA countdown (from backend SLA service)
- Current state badge

The header should be sticky (`position: sticky; top: 0; z-index: 30`) so it remains visible when scrolling through tab content.

**Pitfalls:**
- Must handle null values gracefully — `riskRating`, `creditBureauChecks` may be empty for new applications.
- Bureau status needs aggregation logic: if all checks pass → green, any fail → red, none → gray.
- SLA countdown: call `/api/v1/credit/applications/:id/sla-status` or derive from `app.slaDeadline`.

---

## Sprint 2 — Dashboard My-Work & SLA (Week 3–4)

### 2.1 Dashboard "My Work" Tab (CRITICAL — Finding #3)

**Problem:** Dashboard shows organization-wide pipeline, not the user's own work first.

**Files to change:**
- `frontend/pages/credit/CreditDashboard.tsx` — Add "My Work" tab as default view
- `backend/src/services/dashboard.service.ts` — Add query param for `assignedToMe=true` filtering
- `backend/src/controllers/dashboard.controller.ts` — Pass `req.user.id` to filter

**Implementation:**
```
Dashboard tabs: [My Work] [Pipeline] [Approval Inbox] [Exposure] [Committee]

My Work tab shows:
- [My Pending Approvals: N] — count of applications awaiting user's approval
- [My Assigned Cases: N] — count of applications where user is RM or analyst
- [SLA Breaching Today: N] — applications in user's portfolio breaching SLA
- [Overdue: N] — applications past SLA deadline
```

**Pitfalls:**
- The `assignedToMe` filter needs to check both `assignedRmId` and `assignedAnalystId` fields.
- Approval inbox must also filter by `pendingApprovals.userId` for the current user.
- Make "My Work" the DEFAULT tab on load, with Pipeline as secondary.

---

### 2.2 SLA Breach Itemized Widget (HIGH — Finding #9)

**Problem:** `slaBreachCount` is shown as a simple number, not a drill-down list.

**Files to change:**
- `frontend/pages/credit/CreditDashboard.tsx` — Add SLA breach list component
- `backend/src/services/dashboard.service.ts` — Add `getSlaBreaches(userId?)` method returning itemized list

**Implementation:**
```
SLA Breaches component:
- Clickable count badge (expands on click)
- List: [App No] [Borrower] [Current State] [Days Overdue] [SLA Deadline]
- Each row links to application detail
- Filters: All breaches / My breaches only
```

---

### 2.3 Duplicate Borrower Detection Enforcement (HIGH — Finding #15)

**Problem:** `checkDuplicate()` endpoint exists but is not called at creation time.

**Files to change:**
- `backend/src/services/borrowerProfile.service.ts` — Call `checkDuplicate()` inside `create()` before Prisma create. If duplicates found, return 409 with duplicate details.
- `frontend/pages/credit/BorrowerProfileCreate.tsx` — On 409 response, show modal listing duplicates with "Create Anyway" override (requires `credit:admin` permission for override).

**Pitfalls:**
- Don't add `@unique` on `CrmContact.nricPassport` yet — it's a nullable field and there may be existing null values. Add a partial unique index instead: `@@unique([nricPassport], where: { nricPassport: NOT null })` — but Prisma doesn't support partial unique indexes. Alternative: application-level check only, with a DB migration to clean up existing duplicates first.
- The override-by-admin flow needs audit logging.

---

## Sprint 3 — UX Quick Wins (Week 5–6)

### 3.1 Pre-Submission Readiness Checklist (HIGH — Finding #7)

**Problem:** No summary of incomplete sections before submission.

**Files to change:**
- `frontend/pages/credit/creditUtils.ts` — `getPhaseCompletion()` already exists. Wire it into a checklist modal.
- `frontend/pages/credit/CreditApplicationDetail.tsx` — Add "Submit for Review" button that triggers checklist modal.

**Implementation:**
```tsx
// Pre-submission modal
const completion = getPhaseCompletion(app);
const incomplete = Object.entries(completion)
  .filter(([_, status]) => status === 'incomplete')
  .map(([section]) => sectionLabels[section]);

if (incomplete.length > 0) {
  // Show warning modal: "The following sections are incomplete: S1, S3, S5"
  // Allow "Submit anyway" or "Go to S1"
}
```

**Verification:** Click "Submit for Review" with incomplete S3 → modal shows "S3 · Financials incomplete" with option to navigate there.

---

### 3.2 Tab Completion Badges on Sidebar (MEDIUM)

**Problem:** No visual differentiation between completed and incomplete tabs.

**Files to change:**
- `frontend/pages/credit/CreditApplicationDetail.tsx` — In sidebar nav, render `getPhaseCompletion()` statuses as ✓/⚠ badges next to each group

**Implementation:**
```
S1 · Loan Request ✓
S2 · Borrower Profile ✓
S3 · Financials ⚠       ← incomplete, amber warning
S4 · Risk Score
S5 · Bureau & Compliance
S6 · Collateral & Guarantees ✓
S7 · Decision
```

Use existing `getPhaseCompletion()` function — add checkmark icon for `complete`, warning icon for `incomplete`, hide for `optional`.

---

### 3.3 Kanban Card SLA Indicator (Quick Win)

**Problem:** Kanban cards lack SLA status indicators.

**Files to change:**
- `frontend/pages/credit/CreditApplicationList.tsx` — Add SLA dot to Kanban cards

**Implementation:** Small colored dot on each card: green (within SLA), amber (approaching deadline), red (breached). Color derived from `app.slaDeadline - now`.

---

### 3.4 Persist Active Tab in URL Hash (MEDIUM — Finding #17)

**Problem:** Tab state resets on navigation.

**Files to change:**
- `frontend/pages/credit/CreditApplicationDetail.tsx` — Use `useSearchParams` to persist active tab

**Implementation:**
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || defaultTab;
const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });
```

This makes tab state shareable via URL and persistent across navigation.

---

### 3.5 Auto-Save Timestamp Indicator (Quick Win)

**Problem:** No visible save confirmation.

**Files to change:**
- Already exists as "last saved" text in some forms — standardize it across all tabs.
- Add a small `↳ Saved 2 seconds ago` indicator next to the section title, using a 3-sec debounce.

---

## Sprint 4 — Approval & Committee (Week 7–8)

### 4.1 Committee Finalize UX (HIGH — Finding #13)

**Problem:** Committee vote casting doesn't auto-transition. `finalizeDecision()` must be called separately.

**Files to change:**
- `frontend/pages/credit/CommitteeMeetingDetail.tsx` — After all votes are cast, show prominent "Finalize Decision" CTA button with confirmation dialog
- Show clear status: "All N votes cast · Awaiting finalization by Chair/Secretary"

**Implementation:** When `votes.length >= quorum`, render a highlighted banner:
```
✓ All 5 votes cast (3 Approve, 1 Reject, 1 Abstain)
[Finalize as APPROVED]  [Finalize as REJECTED]  [Defer]
```

---

### 4.2 Approval Auto-Routing (HIGH — Finding #12)

**Problem:** Approval routing may be manual.

**Files to change:**
- `backend/src/services/approvalAction.service.ts` — Add `autoRouteNextApprover()` method that:
  1. Looks up the `ApprovalMatrix` for the application's product type and amount range
  2. Finds the next approver in the chain
  3. Creates a `CreditDecision` record with `decision: PENDING` for that approver
  4. Sends notification
- Wire into the state transition: after APPROVE by current level, auto-create next level's pending decision

**Pitfalls:** The approval matrix may have gaps (no rule for amount range). Need fallback to RM's manager or credit admin.

---

### 4.3 Mandatory Comments on Rejection/Conditional Approval (MEDIUM)

**Problem:** Approval comments are not mandatory for rejections.

**Files to change:**
- `backend/src/controllers/approvalAction.controller.ts` — Add Zod validation: if `decision === 'REJECT' || decision === 'CONDITIONAL'`, `reason` is required (min 10 chars).
- `frontend/pages/credit/tabs/ApprovalsTab.tsx` — Make comment textarea required when REJECT or CONDITIONAL is selected.

---

### 4.4 Mobile Auto-Redirect (MEDIUM)

**Problem:** Mobile users navigating to `/credit/committee/:meetingId` get desktop view.

**Files to change:**
- `frontend/pages/credit/CommitteeMeetingDetail.tsx` — Add viewport detection on mount. If `window.innerWidth < 768`, redirect to `/credit/m/committee/:meetingId`.
- `frontend/pages/credit/MyApprovals.tsx` — Same redirect to `/credit/m/approvals`.

---

## Sprint 5 — Financial Spreading & Reporting (Week 9–10)

### 5.1 Financial Spreading Multi-Period View (HIGH — Finding #10)

**Problem:** No side-by-side year comparison for financial statements.

**Files to change:**
- `frontend/pages/credit/tabs/FinancialsTab.tsx` — Already has `SpreadViewTable` from Phase 2.2. Enhance it.
- Add horizontal period columns: Y1 | Y2 | Y3 with YoY % change.

**Note:** `SpreadViewTable` was implemented in Phase 2.2 (multi-year comparison). Verify it works correctly and add ratio comparison rows with threshold badges.

---

### 5.2 Approval Turnaround Report (HIGH — Finding #14)

**Problem:** No report showing average days from submission to approval.

**Files to change:**
- `backend/src/services/reports.service.ts` — Add `getApprovalTurnaround(filters)` method
- `backend/src/routes/reports.routes.ts` — Add `GET /credit/reports/approval-turnaround`
- `frontend/pages/credit/CreditReports.tsx` — Add new report tab/column

**Implementation:**
```
Query: For each completed application (APPROVED/REJECTED/CLOSED):
  - submitted_at → first_approval_at = turnaround days
  - Group by: product_type, month, assigned_rm
  - Aggregates: avg days, median days, P90
```

---

### 5.3 CSV/Excel Data Export (MEDIUM)

**Problem:** No data export capability for reports.

**Files to change:**
- `backend/src/services/reports.service.ts` — Add `exportToCsv(reportType, filters)` returning CSV string
- `backend/src/routes/reports.routes.ts` — Add `GET /credit/reports/:type/export?format=csv`
- Frontend: Download button on each report section

---

## Sprint 6 — Missing Features Part 1 (Week 11–12)

### 6.1 Application Clone/Renew (HIGH — Finding #8)

**Problem:** No clone or renew function for applications. The `rejection.service.ts` already has `copyToNewApplication()` for rejected apps — extend this.

**Files to change:**
- `backend/src/services/creditApplication.service.ts` — Add `cloneApplication(appId, options)` method
- `backend/src/routes/creditApplication.routes.ts` — Add `POST /:id/clone`
- `frontend/pages/credit/CreditApplicationList.tsx` — Add "Clone" option in application actions menu
- `frontend/pages/credit/CreditApplicationDetail.tsx` — Add "Clone to New Application" and "Renew" buttons in header (for APPROVED/ACTIVE/CLOSED states)

**Implementation:** Reuse `copyToNewApplication()` logic from rejection service. Clone borrower link, parties, facilities. Do NOT clone: decisions, documents, conditions, scores. Set state to DRAFT with `parentApplicationId` link.

---

### 6.2 Credit Policy Limit Enforcement (CRITICAL — Finding #5)

**Problem:** No enforcement of single-borrower exposure limit or sector concentration caps.

**Files to change:**
- `backend/prisma/schema.prisma` — Add `CreditPolicyLimit` model: id, type (SINGLE_BORROWER/SECTOR/PRODUCT), maxValue, thresholdPct, isActive, createdBy, createdAt
- `backend/src/services/policyLimit.service.ts` — New service: `checkExposureLimit(borrowerProfileId, newAmount)`, `checkSectorConcentration(sector, newAmount)`, `evaluatePolicy(appId)` returning hard/soft blocks
- `backend/src/routes/policyLimit.routes.ts` — CRUD for policy limits (admin only)
- `frontend/pages/credit/tabs/ApprovalsTab.tsx` — Show policy limit warnings as amber banners, hard blocks as red errors that prevent submission

**Pitfalls:**
- Single-borrower limit: sum all `ApplicationFacility.approvedAmount ?? amount` for the borrower's active applications + new amount.
- Sector limit: aggregate by `BorrowerProfile.industry` → compare against limit.
- Hard limit = cannot submit (error). Soft limit = warning (can submit with justification).

---

### 6.3 LOO Expiry Enforcement (MEDIUM — Finding #18)

**Problem:** LOO expiry gate exists for `OFFER → ACCEPTED` but no proactive alerts.

**Files to change:**
- `backend/src/services/loo.service.ts` — Add `checkAndNotifyExpiring()` — called by scheduled job, sends notifications when LOO is within 3 days of expiry
- `frontend/pages/credit/tabs/ApprovalsTab.tsx` — In LOO section, show expiry countdown badge (already partially implemented — verify it's working)

**Note:** The LOO expiry gate for `OFFER → ACCEPTED` was already implemented in Phase 2.3. What's missing is the proactive notification.

---

## Sprint 7 — Missing Features Part 2 (Week 13–14)

### 7.1 Collateral Cross-Linking (MEDIUM)

**Problem:** Collateral exists at both application and portfolio level with no cross-linking.

**Files to change:**
- `backend/prisma/schema.prisma` — Add `linkedApplicationIds` field on `Collateral` (or a join table `CollateralApplicationLink`)
- `backend/src/services/collateral.service.ts` — Add `linkToApplication(collateralId, appId)` and `getLinkedCollateral(appId)`
- `frontend/pages/credit/tabs/CollateralTab.tsx` — Add "Link Existing Collateral" button that searches portfolio collateral

---

### 7.2 Group Exposure Aggregation UI (HIGH — Finding #16)

**Problem:** `RelatedPartyGroup` exists in data model but no UI for group exposure.

**Files to change:**
- `frontend/pages/credit/BorrowerProfileDetail.tsx` — Add "Group Exposure" section showing: all entities in the group, total group exposure, individual contributions
- `backend/src/services/borrowerProfile.service.ts` — Add `getGroupExposure(borrowerProfileId)` aggregating across all group members

---

### 7.3 Guarantor Financial Assessment (MEDIUM)

**Problem:** Guarantors are just party records with no financial assessment.

**Files to change:**
- `backend/prisma/schema.prisma` — Add `GuarantorFinancial` model linked to `CreditApplicationParty`: netWorth, annualIncome, existingObligations, availableForGuarantee
- `backend/src/services/party.service.ts` — Add CRUD for guarantor financial details
- `frontend/pages/credit/tabs/SecurityTab.tsx` (or PartiesTab) — Add expandable section for each guarantor with financial fields

---

## Sprint 8 — Polish & Accessibility (Week 15–16)

### 8.1 Colour+Icon Status Indicators (MEDIUM — Finding #20)

**Problem:** `STATE_COLORS` relies on colour alone.

**Files to change:**
- `frontend/pages/credit/creditUtils.ts` — Update `STATE_ICONS` map to pair each state colour with an icon:
  ```
  APPROVED: { color: 'green', icon: '✓', label: 'Approved' }
  REJECTED: { color: 'red', icon: '✗', label: 'Rejected' }
  REFERRED_BACK: { color: 'amber', icon: '↩', label: 'Referred Back' }
  ```
- Audit all places that render state badges to include icon + label (not just colour dot)

---

### 8.2 FATCA/CRS Mandatory Step (Quick Win)

**Problem:** FATCA/CRS tab is skippable.

**Files to change:**
- `frontend/pages/credit/tabs/BorrowerProfileTab.tsx` — Add validation before allowing navigation away from S2. If `borrowerType === 'CORPORATE'` and FATCA fields are empty, show blocking dialog.

---

### 8.3 Mobile Application Summary View (MEDIUM)

**Problem:** Application detail is not mobile-ready.

**Files to change:**
- Create `frontend/pages/credit/CreditApplicationMobileSummary.tsx` — Minimal card-based view showing: borrower, amount, score, state, key actions (Approve/Reject)
- Add route at `/credit/m/applications/:id` with `credit:approve` guard

---

### 8.4 "New Application" CTA on Dashboard & Borrower Profile (Quick Win)

**Problem:** No prominent way to start a new application.

**Files to change:**
- `frontend/pages/credit/CreditDashboard.tsx` — Add primary "New Application" button in header
- `frontend/pages/credit/BorrowerProfileDetail.tsx` — Add "New Application for [Borrower]" button
- Both link to `/credit/applications?borrowerId=<id>` or the application wizard with pre-filled borrower

---

## Dependency Graph

```
S1.1 DisbursementTab ──────────────── standalone
S1.2 REFER_BACK state ─────────────── needs schema migration
S1.3 Breadcrumbs ──────────────────── standalone
S1.4 Sticky header ────────────────── needs SLA API (S2.2 can be stubbed)

S2.1 My Work ──────────────────────── needs backend filter param
S2.2 SLA Breach ──────────────────── needs backend query
S2.3 Duplicate enforcement ────────── needs schema consideration

S3.1 Pre-submission checklist ──────── uses existing getPhaseCompletion()
S3.2 Tab completion badges ─────────── uses existing getPhaseCompletion()
S3.3 Kanban SLA dots ──────────────── depends on SLA API from S2.2
S3.4 URL tab persistence ──────────── standalone
S3.5 Auto-save indicator ──────────── standalone

S4.1 Committee finalize UX ────────── uses existing finalizeDecision()
S4.2 Auto-routing ─────────────────── needs ApprovalMatrix data
S4.3 Mandatory comments ───────────── standalone
S4.4 Mobile redirect ──────────────── standalone

S5.1 Multi-period (already done) ──── verify only
S5.2 Turnaround report ────────────── needs new backend endpoint
S5.3 CSV export ───────────────────── needs new backend endpoint

S6.1 Clone/Renew ──────────────────── reuses copyToNewApplication()
S6.2 Policy limits ────────────────── new model + service
S6.3 LOO expiry alerts ─────────────── uses existing loo.service

S7.1 Collateral cross-link ────────── new model
S7.2 Group exposure UI ────────────── uses existing RelatedPartyGroup
S7.3 Guarantor assessment ─────────── new model

S8.1–S8.4 are all standalone
```

---

## What NOT to Build (Defer Indefinitely)

These audit items are valid but should be deferred beyond the initial 8-sprint plan:

| Item | Reason |
|------|--------|
| Bureau API integration (CCRIS/CTOS) | External dependency — requires bureau partner contracts |
| Borrower portal (document upload) | Separate product scope — needs its own design sprint |
| Structured loan purpose taxonomy | Data governance exercise, not a UI fix |
| Conflict of interest declaration | Business policy question, not tech |
| Analyst productivity leaderboard | Nice-to-have, not production-blocking |
| Scheduled report email delivery | Infrastructure (cron jobs, email templates) — S5 CSV export is sufficient for now |
| IP allowlist / VPN enforcement | Infrastructure/DevOps concern, not module code |
| Country risk classification | Deferred to Phase 5 roadmap |
| Core banking integration | Phase 6 scope |

---

## Estimated Effort

| Sprint | Backend Days | Frontend Days | Total Days |
|--------|-------------|--------------|------------|
| S1 | 4 | 5 | 9 |
| S2 | 3 | 4 | 7 |
| S3 | 1 | 5 | 6 |
| S4 | 4 | 3 | 7 |
| S5 | 3 | 3 | 6 |
| S6 | 5 | 4 | 9 |
| S7 | 4 | 3 | 7 |
| S8 | 1 | 4 | 5 |
| **Total** | **25** | **31** | **56** (~11 weeks, 1 developer) |

With 2 developers (1 BE + 1 FE) running in parallel: ~8 weeks elapsed time.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| REFER_BACK state migration — existing data | `prisma db push` with DROP DEFAULT first, then ALTER TYPE, then SET DEFAULT. Test on staging with production data snapshot. |
| DisbursementTab state gating — need application state in tab visibility logic | `getVisibleTabGroups()` already accepts params; add `applicationState` param. Pass from parent component. |
| Policy limits — new model may affect performance | Add indexes on `CreditPolicyLimit.type` and `CreditPolicyLimit.isActive`. Query only active limits. |
| Duplicate borrower — existing duplicates in DB | Run data cleanup script before enforcement: `SELECT nric_passport, COUNT(*) FROM crm_contacts WHERE nric_passport IS NOT NULL GROUP BY nric_passport HAVING COUNT(*) > 1`. Merge duplicates before enabling enforcement. |