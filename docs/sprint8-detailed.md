# Sprint 8 — Polish & Accessibility

**Parent doc:** `docs/2026-06-09-credit-audit-implementation-plan.md` (S8, Week 15–16)
**Created:** 9 June 2026
**Status:** COMPLETE ✓

---

## 8.1 Colour+Icon Status Indicators (Finding #20)

**Problem:** `STATE_COLORS` relies on colour alone — inaccessible for colour-blind users.

**Solution:**
- Added `STATE_ICONS` map to `creditUtils.ts` — one Material Symbol per state
- Created reusable `StateBadge` component (`src/components/credit/StateBadge.tsx`) rendering icon + label + colour with `role="status" aria-label`
- Replaced all inline `STATE_COLORS[state]` badge patterns in 3 files:
  - `CreditApplicationDetail.tsx` — sticky header state badge
  - `CreditApplicationList.tsx` — table cells + kanban cards
  - `AuditTab.tsx` — state transition arrows (old → new)

**Files changed:**
- `frontend/pages/credit/creditUtils.ts` — STATE_ICONS map
- `frontend/src/components/credit/StateBadge.tsx` — new component
- `frontend/pages/CreditApplicationDetail.tsx` — import + replace
- `frontend/pages/CreditApplicationList.tsx` — import + replace x2
- `frontend/pages/credit/tabs/AuditTab.tsx` — import + replace

---

## 8.2 FATCA/CRS Mandatory Step (Quick Win)

**Problem:** FATCA/CRS tab is skippable — corporate borrowers can proceed without declaration.

**Solution:**
- `FatcaCrsSection` now eagerly loads declaration on mount (not just on expand)
- Added `onDeclarationLoaded` callback to bubble declaration state up
- `BorrowerProfileTab` tracks `fatcaIsComplete`: INDIVIDUAL = always true, CORPORATE = requires submitted declaration
- Red warning banner with `warning` icon shown when incomplete for corporate borrowers
- `onFatcaComplete` prop exposed for parent tab gating

**Files changed:**
- `frontend/pages/credit/tabs/BorrowerProfileTab.tsx` — eager load, callback, banner

---

## 8.3 Mobile Application Summary View (MEDIUM)

**Problem:** Application detail page is not mobile-ready.

**Solution:**
- New `CreditApplicationMobileSummary.tsx` (268 lines) — card-based mobile layout
- Shows: borrower name, requested amount (formatCurrency), risk rating, state badge (StateBadge), product type, tenor, submission date
- Approve/Reject action buttons gated by `credit:approve` permission + `COMMITTEE_REVIEW` state
- Reject requires reason in bottom-sheet modal with required field validation
- Link to full detail page
- Route at `/credit/m/applications/:id` with `ProtectedRoute` (login required)

**Files changed:**
- `frontend/pages/credit/CreditApplicationMobileSummary.tsx` — new
- `frontend/App.tsx` — route + import

---

## 8.4 "New Application" CTA on Dashboard & Borrower Profile (Quick Win)

**Problem:** No prominent way to start a new application.

**Solution:**
- CreditDashboard header: "New Application" primary CTA button (blue-700) with `add_circle` icon → `/credit/applications/new`
- BorrowerProfileDetail header: "New Application for [Borrower]" button → `/credit/applications/new?borrowerId=`
- Consistent blue-700 styling across both locations

**Files changed:**
- `frontend/pages/credit/CreditDashboard.tsx` — CTA button in header
- `frontend/pages/BorrowerProfileDetail.tsx` — CTA button with borrowerId param

---

## Verification

- BE: `tsc --noEmit` — 0 errors
- FE: `vite build` — built in 2.87s, 0 errors
- Commit: `fcaf2cb` on `dev2.0`