# S7 Improvement Plan: Sign-off, Conditions, Summary

**Date:** 2026-06-01
**Status:** Pending Implementation
**Application:** CWC 2.0 — Credit Application Portal

---

## Overview

S7 (Decision) contains 4 sub-tabs: Approvals, Sign-off, Conditions, Summary. This plan addresses bugs and improvements for Sign-off, Conditions, and Summary tabs. Approach and decisions confirmed by product owner.

---

## Item 1: Sign-off Tab — Fix State Gate + Add Committee Review Block

### Problem

Current `readOnly` gate is inverted: `readOnly = application.state !== 'DRAFT'`

- Sign-off is ONLY allowed in DRAFT state — when the CA Memo isn't finalized yet
- Sign-off is BLOCKED in CREDIT_ASSESSMENT / COMMITTEE_REVIEW / APPROVED — exactly when it should be allowed

### Business Rule

CA Memo sign-off (Prepared By → Reviewed By → Concurred By) is a prerequisite for committee review. The system should **block the CREDIT_ASSESSMENT → COMMITTEE_REVIEW transition** if all 3 sign-offs are not complete.

### Changes

#### 1a. Fix SignoffTab state gate (Frontend — `SignoffTab.tsx`)

Replace `readOnly = application.state !== 'DRAFT'` with:

```ts
const SIGNOFF_ELIGIBLE_STATES = new Set([
  'UNDERWRITING',
  'CREDIT_ASSESSMENT',
  'COMMITTEE_REVIEW',
  'APPROVED',
  'OFFER',
  'ACCEPTED',
  'DISBURSED',
  'ACTIVE',
  'CLOSED',
]);
const readOnly = !SIGNOFF_ELIGIBLE_STATES.has(application.state);
```

**Blocked states (read-only / no sign):** `DRAFT`, `SUBMITTED`, `KYC_REVIEW`, `KYC_APPROVED`, `KYC_REJECTED`, `REJECTED`, `WITHDRAWN`

**Note on post-approval states (`OFFER → ACTIVE → CLOSED`):** Sign-off tab renders as read-only in these states — sign-off records are already complete and viewable for audit purposes but no new signing is permitted.

> **`KYC_REJECTED` was missing from the original plan** — it is in the `ApplicationState` enum and must be explicitly blocked.

#### 1b. Add sign-off completion gate on `submit_to_committee` (Backend — `creditApplication.service.ts`)

In the `transitionApplication()` method (not `transition()`), before allowing `CREDIT_ASSESSMENT → COMMITTEE_REVIEW`:

- Query `ApplicationSignoff` for the application
- Verify all 3 roles (`PREPARED_BY`, `REVIEWED_BY`, `CONCURRED_BY`) exist with `signedAt` not null
- The `ApplicationSignoff` model has `@@unique([applicationId, role])`, so a count of 3 is sufficient
- If incomplete: throw 400 error with message:
  > "Cannot submit to committee — CA Memo sign-off incomplete. All sign-off roles (Prepared By, Reviewed By, Concurred By) must sign before committee review."

```ts
// Inside transitionApplication(), before the state update for submit_to_committee:
if (action === 'submit_to_committee') {
  const signoffs = await this.prisma.applicationSignoff.findMany({
    where: { applicationId: id },
    select: { role: true, signedAt: true },
  });
  const signed = new Set(signoffs.filter(s => s.signedAt).map(s => s.role));
  const required = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as const;
  if (!required.every(r => signed.has(r))) {
    throw new BadRequestException(
      'Cannot submit to committee — CA Memo sign-off incomplete. All sign-off roles (Prepared By, Reviewed By, Concurred By) must sign before committee review.'
    );
  }
}
```

#### 1c. Add sign-off gate visual indicator (Frontend — `CreditApplicationDetail.tsx`)

**Data flow:** The transition buttons panel lives in `CreditApplicationDetail.tsx` (lines 592–616). The sign-off status must be fetched at the parent level and used to gate the `submit_to_committee` button.

- **API:** `GET /api/v1/credit/applications/:id/signoffs` — via `signoffApi.list(applicationId)` (already defined in `frontend/src/services/credit.service.ts` line ~1987)
- Fetch signoff list in `CreditApplicationDetail` alongside `fetchApp()` and store in state: `const [signoffs, setSignoffs] = useState<ApplicationSignoff[]>([])`
- Derive: `const allSigned = ['PREPARED_BY','REVIEWED_BY','CONCURRED_BY'].every(role => signoffs.some(s => s.role === role && s.signedAt))`
- When app is in `CREDIT_ASSESSMENT` and `!allSigned`, show warning banner above the transition buttons:
  > "CA Memo sign-off must be completed before submitting to committee"
- Disable the `submit_to_committee` transition button when `!allSigned`

#### 1d. Sign-off status checkmarks on transition panel (Frontend — `CreditApplicationDetail.tsx`)

- Render inline sign-off completion indicators adjacent to the "Submit to Committee" button:
  ```
  ✓ Prepared By   ✓ Reviewed By   ✗ Concurred By
  ```
- Use the `signoffs` state fetched in 1c — no additional API call needed
- Only show when app is in `CREDIT_ASSESSMENT` state

---

## Item 2: Conditions Tab — No Bug Found

### Current State

Conditions are managed without a state gate. This is **correct** — conditions are set during APPROVED state and fulfilled pre-disbursement.

### No Changes Needed

- CP completion gate banner works correctly
- Complete/Waive actions function on individual conditions
- Backend `checkCpCompletion` endpoint validates completion

### Future Consideration (Out of Scope)

If blocking APPROVED → ACTIVE transition based on CP completion is desired, that would be a separate enhancement.

---

## Item 3: Summary Tab — Make Read-Only + Add CA Memo Fields

### Problems

1. "Run Score" and "Override" buttons duplicate S4 Risk Score tab
2. CA Memo narrative fields are NOT displayed in Summary
3. Dead props: `transitions`, `canApprove`, `onTransition` passed but unused

### Business Rule

Summary tab should be a **read-only overview** for approvers. Scoring actions belong exclusively in S4. CA Memo narrative fields should be consolidated here for quick review.

### Changes

#### 3a. Remove scoring actions (Frontend — `SummaryTab.tsx`)

- Remove "Run Score" button and `scoringApi.executeScore` call (line ~147)
- Remove "Override" button and `scoringApi.overrideScore` call (line ~183) — note: button label in code is `"Override"`, not `"Override Rating"`
- Remove related state variables: `scoreResult`, `overrideRating`, `overrideJustification`, etc.
- Remove unused props: `transitions`, `canApprove`, `onTransition`
- **Keep** the read-only score display (showing latest score run result)

#### 3b. Add CA Memo narrative section (Frontend — `SummaryTab.tsx`)

Add a "CA Memo Summary" section displaying narrative fields as read-only. All fields are on the `CreditApplication` model directly.

| Field | Model Property | Label | Type |
|-------|---------------|-------|------|
| Preamble | `preambleText` | Preamble | `String?` — render as paragraph |
| Matters to Highlight | `mattersToHighlight` | Matters to Highlight | `String?` — render as paragraph |
| Transaction Details | `transactionDetailsText` | Transaction Details | `String?` — render as paragraph |
| First Way Out | `firstWayOut` | First Way Out | `String?` — render as paragraph |
| Second Way Out | `secondWayOut` | Second Way Out | `String?` — render as paragraph |
| Other Way Out | `otherWayOut` | Other Way Out | `String?` — render as paragraph |
| Account Strategy | `accountStrategy` | Account Strategy | `AccountStrategy?` enum (`GROW \| MAINTAIN \| EXIT`) — **render as badge/pill, not paragraph** |
| Cross-Selling Initiatives | `crossSellingInitiatives` | Cross-Selling Initiatives | `String?` — render as paragraph |

> **`accountStrategy` is an enum, not free text.** It must be rendered as a coloured badge (e.g. green for `GROW`, amber for `MAINTAIN`, red for `EXIT`), not a paragraph block. All other fields are `String?` and render as text.

- Show `"Not provided"` placeholder for null/empty fields
- These fields are currently edited in S5/S6 tabs (PaymentCapability, HeaderBackground, ProfitabilityWallet, RiskScore). Summary consolidates them for approver review.

#### 3c. Clean up parent component (Frontend — `CreditApplicationDetail.tsx`)

- Remove `transitions`, `canApprove`, `onTransition` props from the `<SummaryTab>` render call (line ~312)
- Update `SummaryTabProps` interface in `SummaryTab.tsx` to remove those three props

---

## Implementation Order

| Step | Item | Layer | Est. Complexity | Depends On |
|------|------|-------|-----------------|------------|
| 1 | 1a. Fix SignoffTab state gate | Frontend | Low | — |
| 2 | 3a. Remove scoring actions from Summary | Frontend | Low | — |
| 3 | 3b. Add CA Memo narrative fields to Summary | Frontend | Medium | Step 2 |
| 4 | 3c. Clean up Summary dead props | Frontend | Low | Step 2 |
| 5 | 1b. Add sign-off gate to `transitionApplication()` | Backend | Medium | Step 1 |
| 6 | 1c. Fetch signoffs in parent + warning banner | Frontend | Medium | Step 5 |
| 7 | 1d. Sign-off status checkmarks on transition panel | Frontend | Low | Step 6 |
| 8 | TypeScript build check (`npx tsc --noEmit`) | Both | — | All |
| 9 | Browser verification | Frontend | — | All |

Steps 1–4 are independent frontend changes and can be done in parallel.
Steps 5–7 are the backend + frontend gate implementation (sequential dependency).
Step 5 (backend gate) is the most critical — it enforces the business rule.

---

## Key Files

| File | Role |
|------|------|
| `frontend/pages/credit/tabs/SignoffTab.tsx` | S7 Sign-off tab — needs state gate fix |
| `frontend/pages/credit/tabs/SummaryTab.tsx` | S7 Summary tab — needs scoring removal + CA Memo fields |
| `frontend/pages/CreditApplicationDetail.tsx` | Parent component — prop cleanup + sign-off gate visual (lines 592–616 for transition panel) |
| `backend/src/credit/services/creditApplication.service.ts` | `transitionApplication()` method — sign-off gate on submit_to_committee |
| `frontend/src/services/credit.service.ts` | `signoffApi.list(applicationId)` — fetches `GET /api/v1/credit/applications/:id/signoffs` |
| `backend/prisma/schema.prisma` | `ApplicationSignoff` model + `AccountStrategy` enum |

---

## Verification Checklist

- [ ] SignoffTab allows sign-off in UNDERWRITING / CREDIT_ASSESSMENT / COMMITTEE_REVIEW / APPROVED / OFFER / ACCEPTED / DISBURSED / ACTIVE / CLOSED
- [ ] SignoffTab blocks sign-off in DRAFT / SUBMITTED / KYC_REVIEW / KYC_APPROVED / KYC_REJECTED / REJECTED / WITHDRAWN
- [ ] Backend rejects `submit_to_committee` when sign-offs incomplete (returns 400)
- [ ] Frontend shows warning banner when sign-offs incomplete in CREDIT_ASSESSMENT
- [ ] "Submit to Committee" button disabled until all 3 sign-offs complete
- [ ] Sign-off status checkmarks visible (e.g. ✓ ✓ ✗) beside Submit to Committee button
- [ ] SummaryTab has no "Run Score" or "Override" buttons
- [ ] SummaryTab shows all 8 CA Memo narrative fields (read-only)
- [ ] `accountStrategy` renders as a badge/pill (`GROW` / `MAINTAIN` / `EXIT`), not plain text
- [ ] Empty CA Memo fields show "Not provided" placeholder
- [ ] Unused props (`transitions`, `canApprove`, `onTransition`) removed from SummaryTab and parent
- [ ] `npx tsc --noEmit` passes
