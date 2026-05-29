# Wave 3 — UX Overhaul Implementation Plan

**Parent:** `27-implementation-plan-2026-05-29.md` (Wave 3, §3.1–3.9)
**Created:** 2026-05-30
**Status:** Ready for review

---

## Current State

Waves 0–2 are ~93% backend complete. Frontend gap: service layer + shared components exist, but credit page views are a flat 24-tab structure with no wizard, no mobile views, no PDF preview in approvals, and no consolidated tab merges. The only true backend gap from Wave 2 is MFA (§2.1), which is deferred per prior decision.

**What already exists:**
- `frontend/pages/credit/` — CreditDashboard, CreditReports, creditUtils
- `frontend/pages/credit/tabs/` — 22 tab components (all flat, no wizard)
- `frontend/src/components/credit/` — 8 shared components (CreditTable, CaMemoSection, ApprovalQuickView, RiskBadge, StateBadge, DocumentUpload, FinancialCharts, AutosaveTextField)
- `frontend/src/services/credit.service.ts` — ~1900 lines, covers all API calls
- `backend/src/credit/` — full backend (controllers, routes, services, validators, jobs, middleware)
- Committee API: `committeeApi` in frontend service with Sprint 4 types + backend routes
- CA Memo PDF backend: `caMemoPdf.controller.ts` + `caMemoPdf.service.ts`
- Submission readiness validator: backend `submissionReadiness.service.ts`
- ConfirmDialog shared component exists (not wired into credit flows)
- CreditTable has sticky header + zebra striping (§1.9 done)

---

## Execution Order

Items are sequenced by dependency chain. Parallelizable items are noted.

---

### 3.1 — Approval Pack PDF Preview (full)

**Track:** UX · **Effort:** L · **Deps:** §1.10 (done — CA memo PDF exists)

**Goal:** Reorganise CA Memo generator into a single "Approval Pack" template that includes: summary, parties, facilities, scoring, ECL, collateral, conditions, signoff. Embed in Approvals tab as primary review surface with sidebar for drill-down.

**Backend changes:**
1. Extend `caMemoPdf.service.ts` → `approvalPack.service.ts` that assembles all sections into one HTML/PDF document. Keep existing `/ca-memo` endpoint; add new `/approval-pack` endpoint.
2. New route: `GET /credit/applications/:id/approval-pack` returns PDF blob.
3. New route: `GET /credit/applications/:id/approval-pack?format=html` returns rendered HTML for in-app preview.

**Frontend changes:**
1. `ApprovalsTab.tsx` — add "Preview Approval Pack" button that opens a modal with an iframe/embed for the HTML preview, plus a "Download PDF" link.
2. Create `frontend/src/components/credit/ApprovalPackPreview.tsx` — modal component with:
   - Left sidebar: collapsible section outline (Summary, Parties, Facilities, Scoring, ECL, Collateral, Conditions, Signoff)
   - Main area: HTML preview rendered in sandboxed iframe
   - Bottom bar: Download PDF, Print buttons
3. The sidebar links scroll the iframe to the corresponding section anchor.

**Files to touch:**
- `backend/src/credit/services/approvalPack.service.ts` (new)
- `backend/src/credit/controllers/approvalPack.controller.ts` (new)
- `backend/src/credit/routes/approvalPack.routes.ts` (new)
- `frontend/src/components/credit/ApprovalPackPreview.tsx` (new)
- `frontend/pages/credit/tabs/ApprovalsTab.tsx` (modify)
- `frontend/src/services/credit.service.ts` (add `getApprovalPackHtml` + `downloadApprovalPackPdf`)

**AC:**
- Approver can click one button and review the full approval pack without leaving the Approvals tab.
- PDF download produces a single document with all sections.
- Sidebar section links scroll to the correct position.
- Works in ≥80% of approval scenarios (no need to navigate away).

---

### 3.2 — Mobile Committee Voting View

**Track:** UX · **Effort:** L · **Deps:** 3.1 (memo embed)

**Goal:** Dedicated route `/credit/m/committee/:meetingId` optimised for ≤768px. Single deal at a time: header + memo (collapsible) + vote (APPROVE / REJECT / ABSTAIN) + comment + next.

**Frontend changes:**
1. New route in App.tsx: `/credit/m/committee/:meetingId` → `CommitteeMobileVote.tsx`
2. Create `frontend/pages/credit/CommitteeMobileVote.tsx`:
   - Sticky top bar: meeting title, deal counter (3/8), back/next navigation
   - Collapsible approval pack preview (reuses §3.1 endpoint)
   - Vote card: three large buttons (APPROVE green, REJECT red, ABSTAIN amber)
   - Mandatory comment textarea on REJECT
   - Optional comment on APPROVE/ABSTAIN (collapsible)
   - Swipe gesture or next-arrow to advance to next agenda item
   - Bottom bar: progress dots
3. Touch targets ≥ 44px, font size ≥ 16px for readability.

**Backend changes:** None — reuses existing `committeeApi` methods.

**Files:**
- `frontend/pages/credit/CommitteeMobileVote.tsx` (new)
- `frontend/src/App.tsx` (add route)
- `frontend/src/services/credit.service.ts` (may need `castVote` convenience method if not present)

**AC:**
- Committee chair can vote on a meeting from a phone end-to-end.
- Works on iOS Safari + Android Chrome at 375px width.
- Touch targets ≥ 44px.
- Vote state persists (if user navigates away and returns, their vote is preserved).

---

### 3.3 — Mobile Approval Card

**Track:** UX · **Effort:** M · **Deps:** 3.1

**Goal:** Mobile-optimised approval inbox; one-tap APPROVE / REJECT / DEFER with mandatory comment on reject.

**Frontend changes:**
1. New route: `/credit/m/approvals` → `MobileApprovalInbox.tsx`
2. Create `frontend/pages/credit/MobileApprovalInbox.tsx`:
   - Card-based list: borrower name, product, amount, urgency badge, days waiting
   - Tap card → slide-up detail sheet (approval pack preview from §3.1)
   - Action bar: APPROVE (green), REJECT (red — requires comment modal), DEFER (grey)
   - Pull-to-refresh
   - Filter chips: urgent / awaiting me / all
3. Reuse `dashboardApi.getApprovalInbox()` endpoint.

**Backend changes:** None.

**Files:**
- `frontend/pages/credit/MobileApprovalInbox.tsx` (new)
- `frontend/src/App.tsx` (add route)

**AC:**
- Same approval flow works on phone browsers.
- Touch targets ≥ 44px.
- REJECT requires comment (enforced client-side and server-side).
- Approval pack preview opens in slide-up sheet.

---

### 3.4 — Consolidate Facilities + Requests-Facilities Tabs

**Track:** UX · **Effort:** M · **Deps:** none (can start in parallel)

**Goal:** Merge `FacilitiesTab` and `RequestsFacilitiesTab` into a single Facilities surface with a "Request type" filter (NEW / RENEWAL / VARIATION / POLICY_BREACH / SICR_IMPAIRMENT).

**Frontend changes:**
1. Merge `FacilitiesTab.tsx` and `RequestsFacilitiesTab.tsx` into a single `FacilitiesConsolidatedTab.tsx`.
2. Add a filter bar at the top with request-type chips. Default: show all.
3. Table columns: request type badge, facility name, product, amount, tenor, status, actions.
4. Preserve all CRUD operations from both tabs — "Add Facility" and "Add Request Item" buttons.
5. Remove the old `RequestsFacilitiesTab.tsx` and update the tab registry to use the consolidated version.

**Backend changes:** None (data comes from same endpoints).

**Files:**
- `frontend/pages/credit/tabs/FacilitiesConsolidatedTab.tsx` (new — merged)
- `frontend/pages/credit/tabs/FacilitiesTab.tsx` (keep as fallback / reference, remove from tab list)
- `frontend/pages/credit/tabs/RequestsFacilitiesTab.tsx` (keep as reference, remove from tab list)
- Tab registry (wherever tabs are enumerated) — update

**AC:**
- One tab shows all facilities + request items.
- Request type filter works.
- Add facility + add request item both accessible.
- No functionality lost from old separate tabs.

---

### 3.5 — Consolidate ESG + SICR into "Forward-Looking Risk" Tab

**Track:** UX · **Effort:** S · **Deps:** none (can start in parallel)

**Goal:** Merge `EsgTab` and `SicrTab` into one tab, both datasets editable.

**Frontend changes:**
1. Create `ForwardLookingRiskTab.tsx` with two sub-sections: ESG Assessment (top) and SICR Triggers (bottom), each collapsible.
2. Preserve `esgApi` and `sicrApi` calls — these stay separate on the backend.
3. Remove old tabs from the tab registry.

**Files:**
- `frontend/pages/credit/tabs/ForwardLookingRiskTab.tsx` (new)
- Tab registry update

**AC:**
- Single tab, both datasets visible and editable.
- Collapsible sections for each sub-area.
- No lost functionality.

---

### 3.6 — Submission Wizard Restructure (3-step + 6-group rail)

**Track:** UX · **Effort:** XL · **Deps:** §1.7 (submission readiness done), §3.4, §3.5

**Goal:** Restructure the 24-tab flat page into a 3-step wizard with a 6-group side rail, completeness indicators, and deep-link routes for backward compatibility.

**Architecture:**

```
Step 1: Borrower & Request
  ├── (1) Header & Background
  ├── (2) Borrower Profile
  ├── (3) Parties (Directors, Shareholders, UBOs, Counterparties)
  └── (4) Documents

Step 2: Risk & Mitigants
  ├── (5) Facilities & Requests (consolidated §3.4)
  ├── (6) Collateral & Insurance
  ├── (7) Financial Analysis (statements, ratios, profitability, wallet)
  ├── (8) Scoring & Rating (credit checks, scorecard, industry, ECL)
  └── (9) Forward-Looking Risk (ESG + SICR §3.5)

Step 3: Decision & Monitoring
  ├── (10) Approvals & Signoff
  ├── (11) Conditions Precedent
  ├── (12) Monitoring (covenants, review schedule)
  └── (13) Audit Trail
```

**Frontend changes:**
1. Create `frontend/pages/credit/CreditApplicationWizard.tsx`:
   - Top progress bar: Step 1 → Step 2 → Step 3
   - Left sidebar: group rail with completeness indicators (green check / amber partial / red required-empty)
   - Main area: renders the active section tab component
   - Bottom bar: Previous / Save Draft / Next buttons
   - Submission readiness summary from `submissionReadiness.service.ts` shown before final submit
2. Create a `tabRegistry.ts` that maps the 13 sections to their components + routes.
3. Deep-link routes: `/credit/applications/:id/step/:step/section/:section` (redirects from legacy `/credit/applications/:id?tab=X`).
4. Submission gate: button disabled until `readinessCheck` passes; clicking shows specific missing items.

**Backend changes:** Minimal — the submission readiness endpoint already exists.

**Files:**
- `frontend/pages/credit/CreditApplicationWizard.tsx` (new — main wizard shell)
- `frontend/pages/credit/tabRegistry.ts` (new — section → component map)
- `frontend/pages/credit/CreditDashboard.tsx` (modify — link to wizard)
- `frontend/src/App.tsx` (add wizard routes, add redirect for legacy tab URLs)
- All 13 tab components stay as-is (they're rendered inside the wizard)

**AC:**
- Legacy tab URLs redirect into the wizard at the correct section.
- Existing E2E tests pass (or are updated).
- Click-count for typical SME deal cut by ≥30% (measurable via step navigation vs old tab-hopping).
- Completeness indicators show real-time status per section.
- Save Draft works from any step.

---

### 3.7 — Accessibility Pass

**Track:** UX · **Effort:** M · **Deps:** runs alongside other UX work

**Goal:** ARIA labels on icon-only buttons; keyboard nav across approvals, committee voting, document upload; colour-contrast review on RiskBadge amber states.

**Changes (apply incrementally alongside other items):**
1. Add `aria-label` to all icon-only buttons in credit components:
   - `ApprovalQuickView.tsx` — expand/collapse, refresh
   - `DocumentUpload.tsx` — delete, verify, reject
   - `CreditTable.tsx` — sort headers, row actions
   - `CaMemoSection.tsx` — edit/save toggles
2. Keyboard navigation:
   - Tab through approval decision radio buttons
   - Enter/Space to cast vote in committee view
   - Focus trap in modals (approval pack preview, confirm dialogs)
   - Escape closes modals
3. Colour contrast:
   - RiskBadge amber (#f59e0b) on white bg → ensure ≥4.5:1 ratio
   - State badge colours — verify all pass WCAG AA
4. Add `role="grid"`, `role="row"`, `role="gridcell"` to CreditTable
5. Add skip-to-content link on wizard pages

**AC:**
- axe-core CI check passes (add to test suite).
- Manual keyboard nav test: can navigate to any approval, cast a vote, close a modal using only keyboard.
- All icon-only buttons have meaningful aria-labels.
- RiskBadge amber passes WCAG AA contrast ratio.

---

### 3.8 — Progress Indicators on Long Calls

**Track:** UX · **Effort:** S · **Deps:** none (can start in parallel)

**Goal:** Score run, memo generate, bureau check, export — all show a determinate or indeterminate progress UI. No silent multi-second waits.

**Changes:**
1. Create `frontend/src/components/credit/ProgressOverlay.tsx`:
   - Indeterminate spinner with message: "Running scoring model…"
   - Determinate progress bar for known-percentage operations (PDF generation)
   - Auto-hide on completion
2. Wrap the following API calls:
   - `creditService.runScorecard()` → show "Calculating risk score…"
   - `creditService.downloadCaMemo()` / `downloadApprovalPackPdf()` → show "Generating approval pack…" with estimated progress
   - `bureauCheckApi.create()` → show "Running bureau check…"
   - `reportsApi.*` exports → show "Preparing export…"
3. Use React state `[loading, setLoading]` in each tab for the specific call.

**Files:**
- `frontend/src/components/credit/ProgressOverlay.tsx` (new)
- Each tab that calls long-running endpoints (modify to wrap calls)

**AC:**
- Every call that takes >1s shows a progress indicator.
- Progress indicator disappears immediately on success or error.

---

### 3.9 — Smart Defaults

**Track:** UX · **Effort:** S · **Deps:** none (can start in parallel)

**Goal:** Currency → borrower home currency; tenor → product default; assigned RM → CRM Account owner; reviewer suggestion in maker-checker.

**Changes:**
1. In the application create form (wizard Step 1):
   - `currency` defaults to `borrower.homeCurrency` (from borrower profile lookup)
   - `tenor` defaults to `product.defaultTenorMonths` (from product type selection)
   - `assignedRmId` defaults to current user if they have `credit:rm` role; otherwise auto-suggest from CRM account owner
   - On the approval submission, suggest reviewer: first user with `credit:approve` who is NOT the current maker
2. Add a `smartDefaults` helper in `creditUtils.ts`:
   ```ts
   export function getSmartDefaults(borrower, product, currentUser, usersWithApproveRole) { ... }
   ```
3. Frontend calls this on form mount; user can override all values.

**Files:**
- `frontend/pages/credit/creditUtils.ts` (add smart defaults helper)
- Application create form (in wizard Step 1)
- Approval submission component

**AC:**
- Defaults populate on form open.
- User can freely override every default.
- RM default matches CRM account owner when available.

---

## Dependency Graph

```
3.1 (Approval Pack PDF) ──► 3.2 (Mobile Committee) ──► 3.3 (Mobile Approval Card)
                                                                     
3.4 (Consolidate Facilities) ──┐
3.5 (Consolidate ESG+SICR) ───┼──► 3.6 (Submission Wizard) ──► 3.7 (Accessibility)
                               │
3.8 (Progress Indicators) ──── independent, start anytime
3.9 (Smart Defaults) ─────────── independent, start anytime
```

**Recommended execution order:**
1. Start §3.4, §3.5, §3.8, §3.9 in parallel (no dependencies, small scope)
2. Start §3.1 concurrently (no dependency on above, but needed for §3.2/3.3)
3. After §3.4 + §3.5 done, start §3.6 (wizard restructure)
4. After §3.1 done, start §3.2 (mobile committee) then §3.3 (mobile approval)
5. §3.7 (accessibility) runs as an ongoing pass alongside all other work

---

## Estimated Timeline

| Item | Effort | Calendar Days |
|------|--------|---------------|
| §3.4 Consolidate Facilities | M | 3-4d |
| §3.5 Consolidate ESG+SICR | S | 1-2d |
| §3.8 Progress Indicators | S | 1-2d |
| §3.9 Smart Defaults | S | 1-2d |
| §3.1 Approval Pack PDF | L | 5-7d |
| §3.6 Submission Wizard | XL | 8-10d |
| §3.2 Mobile Committee | L | 5-7d |
| §3.3 Mobile Approval Card | M | 3-4d |
| §3.7 Accessibility Pass | M | 3-4d (spread across sprint) |

**Total:** ~6 weeks with one developer (matching "Week 7-12" in the plan)

---

## Pre-requisites from Waves 0-2

| Item | Status | Notes |
|------|--------|-------|
| §1.7 Submission readiness gate | ✅ Done | `submissionReadiness.service.ts` |
| §1.10 CA Memo preview button | ✅ Done | `CaMemoSection.tsx` + `caMemoPdf.service.ts` |
| §1.9 Sticky headers + zebra | ✅ Done | `CreditTable.tsx` |
| §1.8 ConfirmModal consistency | ⚠️ Partial | Generic `ConfirmDialog.tsx` exists, not wired into credit flows |
| §2.1 MFA | ❌ Deferred | Not blocking for Wave 3 UI work |

**§1.8 gap:** Wire `ConfirmDialog.tsx` into credit destructive actions (delete document, withdraw application, finalise vote) as part of §3.6 or §3.7.