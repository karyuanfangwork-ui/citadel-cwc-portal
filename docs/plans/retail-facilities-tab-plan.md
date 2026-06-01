# Retail Facilities Tab — Implementation Plan

## Problem

S1 · Loan Request contains two sub-tabs: **Loan Request** (high-level ask) and **Facilities**
(bank-grade facility line items). The Facilities tab (`RequestsFacilitiesTab`) renders identically
for ALL borrower types — showing 8-column corporate tables, 10-bucket Exposure Summary, and
Request Items (Renewal/Variation/SICR/Policy Breach) that are meaningless for retail borrowers.

For an INDIVIDUAL applying for a simple RM250,000 personal term loan, 6 of 8 table columns and
2 entire sub-sections are irrelevant. The user is confused and the "At least one credit facility
required" message doesn't explain what a facility is.

## Precedent

**FinancialsTab** already demonstrates the correct pattern (lines 44–52):

```tsx
const borrowerType = application.borrowerProfile?.borrowerType;
if (borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') {
  return (
    <CaMemoSection title="Retail Income Assessment" phase="S3">
      <RetailIncomeTab applicationId={application.id} />
    </CaMemoSection>
  );
}
// else: full corporate financial spreader
```

**CreditFacility model** (Prisma): only `facilityType` + `amount` are required.
All bank-grade fields (existingLimit, proposedChange, newLimit, outstandingBalance,
undisbursedLimit, approvingLevel, pricingLabel, requestItemId) are nullable/optional.

**creditService API**: `createFacility(applicationId, Partial<CreditFacility>)` accepts
any subset — no backend changes needed.

---

## Changes Overview

| # | File | Change |
|---|------|--------|
| 1 | `frontend/pages/credit/tabs/RetailFacilitiesTab.tsx` | **NEW** — simplified facility form for retail |
| 2 | `frontend/pages/credit/tabs/RequestsFacilitiesTab.tsx` | Add `borrowerType` conditional at top |
| 3 | `frontend/pages/CreditApplicationDetail.tsx` | Pass `onFacilitiesChange` callback to refresh facilities count |
| 4 | `frontend/pages/credit/creditUtils.ts` | No changes needed (completion logic already checks `facilities.length > 0`) |

**Total: 1 new file, 2 modified files, 0 backend changes.**

---

## Step 1: Create `RetailFacilitiesTab.tsx`

**Path:** `frontend/pages/credit/tabs/RetailFacilitiesTab.tsx`

### UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ S1  Retail Loan Facility                                     │
│                                                              │
│  ℹ️ Every loan application needs at least one facility to    │
│     define the product and amount being offered. We've      │
│     pre-filled this from your loan request.                  │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ Facility Type *      │  │ Loan Amount (RM) *    │         │
│  │ [Term Loan       ▼]  │  │ [250,000          ]  │         │
│  └──────────────────────┘  └──────────────────────┘         │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ Tenor (months) *      │  │ Interest Rate (%)     │         │
│  │ [60              ]   │  │ [                ]   │         │
│  └──────────────────────┘  └──────────────────────┘         │
│  ┌───────────────────────────────────────────────┐         │
│  │ Purpose                                        │         │
│  │ [Pre-filled from S1 Loan Request            ]  │         │
│  └───────────────────────────────────────────────┘         │
│                                                              │
│  [Save Facility]                                             │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  Saved Facilities                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Term Loan │ RM250,000 │ 60 mo │ 4.50% │ [Edit] [Del]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  💡 Tip: Add multiple facilities if the borrower needs more  │
│     than one product (e.g. Term Loan + Overdraft).           │
└─────────────────────────────────────────────────────────────┘
```

### Retail vs Corporate Field Mapping

| Retail Field | DB Field | Notes |
|---|---|---|
| Facility Type | `facilityType` | Restricted to: TERM_LOAN, OVERDRAFT, REVOLVING_CREDIT |
| Loan Amount | `amount` (= `newLimit`) | Maps to both `amount` and `newLimit` |
| Tenor (months) | `tenorMonths` | Same field |
| Interest Rate (%) | `ratePct` | Human-readable % instead of BFR+1% |
| Purpose | `purpose` | Same field |

**Not shown** (stays null): existingLimit, proposedChange, outstandingBalance,
undisbursedLimit, approvingLevel, pricingLabel, requestItemId.

### Component Props

```tsx
type Props = {
  application: CreditApplication;
  onDirtyChange?: (dirty: boolean) => void;
};
```

### Behavior

1. **Pre-fill from S1 Loan Request**: On mount, if no facilities exist and application has
   `requestedAmount` + `productType`, pre-fill the form:
   - `facilityType` ← from `application.productType` (mapped: TERM_LOAN→TERM_LOAN, etc.)
   - `amount` ← from `application.requestedAmount`
   - `tenorMonths` ← from `application.requestedTenor`
   - `purpose` ← from `application.purpose`

2. **Save**: Calls `creditService.createFacility(appId, { facilityType, amount, newLimit: amount, tenorMonths, ratePct, purpose })`

3. **List saved facilities**: After save, reload via `creditService.listFacilities(appId)` and show
   a simple card-style summary (not the 8-column table).

4. **Edit/Delete**: Inline editing via same simplified form; delete with confirmation.

5. **Add another**: Button to add a second facility if borrower needs multiple products.

6. **Autosave**: Uses `useAutosave` hook if editing existing facility inline. New facility
   creation uses explicit "Save Facility" button (same pattern as AddFacilityForm in
   RequestsFacilitiesTab).

### Facility Type Options (Retail)

```tsx
const RETAIL_FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' },
  { value: 'OVERDRAFT', label: 'Overdraft' },
  { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
];
```

Only these 3 are shown. No LC, BG, Trust Receipt, Trade Finance, Bridge Loan, or Islamic
variants — those are corporate/trade products.

---

## Step 2: Modify `RequestsFacilitiesTab.tsx`

Add borrower type detection at the top of the component, before any other logic:

```tsx
// At top of RequestsFacilitiesTab component, after props destructuring:
const borrowerType = (application as any).borrowerProfile?.borrowerType;
if (borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') {
  return <RetailFacilitiesTab application={application} onDirtyChange={onDirtyChange} />;
}
```

This follows the exact same pattern as `FinancialsTab` lines 44–52.

Import the new component:

```tsx
import RetailFacilitiesTab from './RetailFacilitiesTab';
```

---

## Step 3: Verify `CreditApplicationDetail.tsx` — No Changes Needed

The `facilities` state is already fetched and passed to `getPhaseCompletion()`.
The S1 completion check in `creditUtils.ts` already checks `app.facilities.length > 0`.

When `RetailFacilitiesTab` saves a facility via `creditService.createFacility()`, the
backend creates the record. The next time `fetchApp()` or `fetchFacilities()` runs
(e.g. on tab switch), the completion status will update automatically.

**Possible enhancement** (optional, not blocking): add `onFacilitiesChange` callback
to immediately refresh the facilities count after save, so the "6 sections incomplete"
badge updates without tab switch. This is a nice-to-have, not required.

---

## Step 4: No Backend Changes

The backend `POST /credit/applications/:id/facilities` endpoint already accepts
`Partial<CreditFacility>`. The Prisma model only requires `facilityType` + `amount`.
All other fields are nullable. No migration, no route changes, no validation changes needed.

---

## Testing Checklist

- [ ] INDIVIDUAL borrower → sees RetailFacilitiesTab (simplified form)
- [ ] SOLE_PROPRIETOR borrower → sees RetailFacilitiesTab
- [ ] CORPORATE borrower → sees existing RequestsFacilitiesTab (8-col table + exposure + request items)
- [ ] JOINT borrower → sees existing RequestsFacilitiesTab (no special retail treatment)
- [ ] RetailFacilitiesTab pre-fills from S1 Loan Request data
- [ ] RetailFacilitiesTab saves facility → S1 section turns green
- [ ] "At least one credit facility required" readiness error clears after saving
- [ ] Can edit saved retail facility inline
- [ ] Can delete saved retail facility
- [ ] Can add a second facility (e.g. Term Loan + Overdraft)
- [ ] Existing corporate facilities tab still works (regression)
- [ ] Advanced Memo flag tab still works (regression)

---

## Effort Estimate

| Task | Time |
|------|------|
| Create RetailFacilitiesTab.tsx | 1.5h |
| Modify RequestsFacilitiesTab.tsx (5 lines) | 10min |
| Test retail flow | 20min |
| Test corporate regression | 10min |
| **Total** | **~2.5h** |