# S7 Decision — Approvals / Sign-off UX Fix

**Date:** 2026-06-02  
**Status:** Planning  
**Area:** Frontend only — no backend changes required

---

## Problem

RM sees two tabs in S7 that both feel like "approval":

- **"Approvals"** = Authority chain (matrix-driven multi-stage approvers deciding Approve / Reject / Return / Escalate)
- **"Sign-off"** = CA Memo document signatures (Prepared By → Reviewed By → Concurred By)

The relationship and ordering between them is unclear. The RM doesn't know what must happen before submitting to Committee Review, and the SOD block (RM can't approve own app) feels contradictory when they're already "approving" via sign-off.

---

## Root Cause Analysis

Two independent gate mechanisms exist in the backend, both named with approval-adjacent language:

| Aspect | Sign-off Tab | Approvals Tab |
|--------|-------------|---------------|
| Purpose | Signature on CA Memo document | Authority chain credit decision |
| Who | Prepared By / Reviewed By / Concurred By | Approver per matrix (exposure + rating) |
| Order | Sequential (Prepared By → Reviewed By → Concurred By) | Sequential stages (Stage 1, Stage 2, ...) |
| RM role | RM typically signs "Prepared By" | RM is **blocked** (SOD policy) |
| Gate | Blocks `submit_to_committee` if incomplete | Blocks `approve`/`reject` from COMMITTEE_REVIEW if incomplete |
| Model | `ApplicationSignoff` (max 3 rows, unique per role) | `CreditDecision` (unlimited rows per application) |

---

## Correct Process Flow

```
┌──────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│  Step 1           │     │  Step 2                  │     │  Step 3               │
│  CA Memo Sign-off │────►│  Submit to Committee     │────►│  Authority Approval   │
│                  │     │  Review (transition)     │     │  Chain (Approvals)    │
│ ✍ 3 signers      │     │ ⛔ blocked if sign-offs   │     │ ✅/❌ matrix-driven   │
│  sequential       │     │    incomplete             │     │    multi-stage        │
└──────────────────┘     └─────────────────────────┘     └──────────────────────┘

State flow:
  CREDIT_ASSESSMENT ──[sign-offs complete]──► submit_to_committee ──► COMMITTEE_REVIEW ──[all approvals]──► APPROVED
```

### Backend Gates (already implemented, no changes needed)

1. **§1.1b — Sign-off completion gate** (`creditApplication.service.ts` line 735-751)  
   `submit_to_committee` is blocked unless all 3 sign-off roles (PREPARED_BY, REVIEWED_BY, CONCURRED_BY) have signed.

2. **§2.5 — Approval chain completion gate** (`creditApplication.service.ts` line 753-800)  
   `approve` / `reject` from COMMITTEE_REVIEW is blocked unless the required number of distinct approvers (per approval matrix) have submitted APPROVE decisions.

3. **SOD check** (`approvalAction.service.ts` line 103-118)  
   RM (`assignedRmId`) cannot approve their own application.

4. **Sign-off sequence enforcement** (`signoff.service.ts` line 26-31)  
   REVIEWED_BY requires `preparedAt`, CONCURRED_BY requires `reviewedAt`.

---

## Implementation Tasks

### Task 1 — Rename & reorder S7 tabs

**Scope:** Frontend only · **Effort:** 15 min · **Impact:** Immediately disambiguates the two concepts

| Change | File | Detail |
|--------|------|--------|
| Rename "Approvals" → "Approval Chain" | `frontend/pages/credit/creditUtils.ts` | Tab label in S7 group |
| Reorder S7 tabs | `frontend/pages/credit/creditUtils.ts` | Move `signoff` before `approvals` |

Current tab order: `approvals, signoff, conditions, summary`  
New tab order: `signoff, approvals, conditions, summary`

Rationale: Sign-off is the prerequisite gate. Putting it first matches the actual workflow — finish signing the CA Memo before you can submit to committee, then the approval chain opens. The RM's first action in S7 is "Prepared By" sign-off, not the approval chain they're blocked from.

---

### Task 2 — S7 process flow banner

**Scope:** Frontend only · **Effort:** 30 min · **Impact:** Shows the 3-step flow visually

Add a process indicator at the top of each S7 sub-tab showing which step the application is on, with completion checkmarks.

**New file:** `frontend/src/components/credit/S7ProcessBanner.tsx`

Props: `{ app, signoffs, allSigned, approvals, canApprove, isRmOnApplication }`

Logic for step completion:

```
Step 1: Sign-off     → ✅ complete if concurredAt !== null (all 3 signatures done)
Step 2: Committee     → ✅ complete if state has passed COMMITTEE_REVIEW (APPROVED/OFFER/ACCEPTED/etc.)
Step 3: Approval Chain → ✅ complete if all required approvers have approved
```

Visual design:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Step 1: CA Memo Sign-off   ⬚ Step 2: Committee Review   ⬚ Step 3: Approval Chain  │
│     All 3 roles signed            Submit for review              Authority decision     │
└─────────────────────────────────────────────────────────────────────┘
```

- Active step = bold + brand colour
- Complete steps = green checkmark
- Future steps = grey
- Each step label is clickable — navigates to the corresponding tab

**Integration point:** `frontend/pages/CreditApplicationDetail.tsx` — render `<S7ProcessBanner>` above tab content when `activeTab` is any S7 tab (`signoff`, `approvals`, `conditions`, `summary`).

---

### Task 3 — RM-aware contextual messages

**Scope:** Frontend only · **Effort:** 20 min · **Impact:** RM knows what they can/cannot do

#### Sign-off tab (`frontend/pages/credit/tabs/SignoffTab.tsx`)

- If the current user is the RM AND "Prepared By" is not yet signed, show:
  > *"As the Relationship Manager, you should sign as Prepared By to certify the CA Memo is accurate. This is separate from the approval authority decision."*

- If all 3 sign-offs are complete, the existing "CA Memo Fully Signed" banner remains (no change).

#### Approvals tab (`frontend/src/components/credit/ApprovalChainPanel.tsx`)

- Enhance the existing SOD warning banner. Currently says:  
  *"You are the assigned Relationship Manager for this application. Due to SOD policy, you cannot approve your own application."*

  Add a clarifying sentence:  
  *"Sign-off (Prepared By) confirms the CA Memo is accurate. Approval is the authority decision on this credit — these are separate gates."*

- When sign-offs are incomplete (based on the `signoffs` data from the parent), show an advisory:  
  > *"⚠️ CA Memo sign-off must be completed before this application can be submitted to Committee Review."*

  This requires passing `signoffs` / `allSigned` as props to `ApprovalChainPanel`, or fetching sign-offs in `ApprovalsTab`.

---

### Task 4 — Committee Review gate on transition dialog

**Scope:** Frontend only · **Effort:** 25 min · **Impact:** Prevents failed submits, shows sign-off status

Currently the "Submit to Committee Review" button shows a generic reason dialog. If sign-offs are incomplete, the backend rejects it with an error.

**File:** `frontend/pages/CreditApplicationDetail.tsx`

Changes:

1. When rendering the transition dialog for `submit_to_committee`, add a sign-off status summary:

```
CA Memo Sign-off Status:
✅ Prepared By — John Doe, 12 May 2026
✅ Reviewed By — Jane Smith, 13 May 2026
⬚ Concurred By — (pending)

⛔ Submit to Committee is blocked until all sign-offs are complete.
```

2. Disable the submit button in the dialog when `!allSigned` (the `allSigned` derived state already exists at line 167-169).

3. Add a tooltip on the disabled button: "Complete all CA Memo sign-offs first".

This prevents the user from even attempting the action that will fail on the backend.

---

### Task 5 — Backend: no changes needed

All backend gates are correctly implemented:

- **§1.1b** — Sign-off gate blocks `submit_to_committee` (creditApplication.service.ts line 735-751)
- **§2.5** — Approval chain gate blocks `approve`/`reject` from COMMITTEE_REVIEW (creditApplication.service.ts line 753-800)
- **SOD check** — RM blocked from approving own app (approvalAction.service.ts line 103-118)
- **Sign-off sequence** — PREPARED_BY → REVIEWED_BY → CONCURRED_BY enforced (signoff.service.ts line 26-31)

---

## Key Files

| File | Role |
|------|------|
| `frontend/pages/credit/creditUtils.ts` | Tab labels, ordering, S7 group definition |
| `frontend/pages/CreditApplicationDetail.tsx` | Main detail page — S7ProcessBanner integration, transition dialog gate |
| `frontend/pages/credit/tabs/SignoffTab.tsx` | Sign-off tab — RM contextual message |
| `frontend/pages/credit/tabs/ApprovalsTab.tsx` | Approvals tab — sign-off incomplete advisory |
| `frontend/src/components/credit/ApprovalChainPanel.tsx` | Approval chain — SOD message enhancement |
| `frontend/src/components/credit/S7ProcessBanner.tsx` | **NEW** — Process flow banner component |
| `backend/src/credit/services/creditApplication.service.ts` | Sign-off gate (§1.1b) + approval chain gate (§2.5) — no changes |
| `backend/src/credit/services/signoff.service.ts` | Sign-off sequence enforcement — no changes |
| `backend/src/credit/services/approvalAction.service.ts` | SOD check + approval action logic — no changes |

---

## Effort Summary

| # | Task | Scope | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | Rename tab + reorder S7 tabs | `creditUtils.ts` | 15 min | Disambiguates two concepts |
| 2 | S7 process flow banner | New component + Detail | 30 min | Visual 3-step flow |
| 3 | RM-aware contextual messages | SignoffTab + ApprovalChainPanel | 20 min | RM knows what to do |
| 4 | Committee gate on transition dialog | Detail | 25 min | Prevents failed submits |
| 5 | Backend | — | 0 min | — |
| **Total** | | | **~1.5 hrs** | |