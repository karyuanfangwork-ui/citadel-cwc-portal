# Retail Loan S1-S7 Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all UX and scoring gaps that make the S1-S7 credit application flow incorrect or noisy for individual/retail borrowers — wiring DSR into the scoring engine, hiding corporate-only tabs for individuals, and relabelling the "Directors & UBOs" tab.

**Architecture:** Three layers of change: (1) backend scoring logic to use DSR-based cashflow for retail borrowers, (2) `creditUtils.ts` to make tab visibility borrower-type-aware, (3) minor UI tweaks in `PartiesTab` and `CreditApplicationDetail` to suppress irrelevant corporate sections. All changes are additive and non-breaking for existing corporate borrowers.

**Tech Stack:** Node.js/Express/TypeScript (backend), React 19/TypeScript/Vite (frontend), Prisma ORM, Jest (backend tests).

---

## Files Modified

| File | Change |
|------|--------|
| `backend/src/credit/services/scoring.service.ts` | Fetch `retailIncome.dsrPercent` for INDIVIDUAL/SOLE_PROPRIETOR; compute `cashflow` score from DSR instead of financial ratios |
| `backend/src/__tests__/scoring.service.test.ts` | New — unit tests for DSR-based cashflow score path |
| `frontend/pages/credit/creditUtils.ts` | Add borrower-type-aware tab group filtering; rename "Directors & UBOs" label for retail |
| `frontend/pages/CreditApplicationDetail.tsx` | Pass `borrowerType` to `getVisibleTabGroups`; hide Payment Capability tab for INDIVIDUAL |
| `frontend/pages/credit/tabs/PartiesTab.tsx` | Show informational note when borrower is INDIVIDUAL; no structural change to data |

---

## Task 1: DSR → Cashflow Score in Scoring Engine

**Context:** `scoring.service.ts` line 266-269 computes `cashflow` factor score via `computeCashflowScore(ratioMap)`. For INDIVIDUAL/SOLE_PROPRIETOR borrowers there are no financial statement ratios — `ratioMap` is always empty — so the score is always 50. The `retailIncome` record (model `RetailIncome`, field `dsrPercent`) already stores the computed DSR. We need to fetch it and convert it to a 0-100 score where DSR ≤60% = ~80, DSR ≤70% = ~50, DSR >70% = ~20.

**Files:**
- Modify: `backend/src/credit/services/scoring.service.ts`
- Create: `backend/src/__tests__/scoring.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/__tests__/scoring.service.test.ts`:

```typescript
import { computeDsrCashflowScore } from '../credit/services/scoring.service';

describe('computeDsrCashflowScore', () => {
  it('returns ~80 for DSR at exactly 60% (pass boundary)', () => {
    expect(computeDsrCashflowScore(60)).toBeCloseTo(80, 0);
  });

  it('returns ~80 for DSR well below 60%', () => {
    expect(computeDsrCashflowScore(30)).toBeGreaterThan(80);
  });

  it('returns ~50 for DSR at exactly 65% (midpoint of warning band)', () => {
    expect(computeDsrCashflowScore(65)).toBeCloseTo(50, 0);
  });

  it('returns ~20 for DSR at exactly 70% (fail boundary)', () => {
    expect(computeDsrCashflowScore(70)).toBeCloseTo(20, 0);
  });

  it('returns 0 for DSR far above 70%', () => {
    expect(computeDsrCashflowScore(100)).toBeLessThanOrEqual(20);
  });

  it('returns 100 for DSR of 0%', () => {
    expect(computeDsrCashflowScore(0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern="scoring.service.test" 2>&1 | tail -10
```
Expected: `Cannot find module` or `computeDsrCashflowScore is not a function`.

- [ ] **Step 3: Export `computeDsrCashflowScore` from scoring.service.ts**

In `backend/src/credit/services/scoring.service.ts`, add after `computeCashflowScore`:

```typescript
/**
 * Convert a DSR percentage to a 0-100 cashflow score.
 * DSR 0% → 100, DSR 60% → 80, DSR 70% → 20, DSR ≥80% → 0
 * Uses a two-segment linear scale: 0-60% maps to 80-100, 60-70% maps to 20-80, >70% clamps at 0.
 */
export function computeDsrCashflowScore(dsrPercent: number): number {
  if (dsrPercent <= 0) return 100;
  if (dsrPercent <= 60) {
    // Linear: 0% → 100, 60% → 80
    return 100 - (dsrPercent / 60) * 20;
  }
  if (dsrPercent <= 70) {
    // Linear: 60% → 80, 70% → 20
    return 80 - ((dsrPercent - 60) / 10) * 60;
  }
  // >70%: linear to 0 at 80%, clamp at 0
  return Math.max(0, 20 - ((dsrPercent - 70) / 10) * 20);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern="scoring.service.test" 2>&1 | tail -10
```
Expected: `6 passed`.

- [ ] **Step 5: Wire DSR into the executeScore function**

In `scoring.service.ts`, the `getRetailIncome` import is in `retailIncome.service.ts`. Add the import at the top of `scoring.service.ts`:

```typescript
import { getRetailIncome } from './retailIncome.service';
```

Then, after line ~230 where `isRetail` is set, add DSR fetch:

```typescript
// Step 5a: For retail borrowers, fetch DSR for cashflow scoring
let dsrPercent: number | null = null;
if (isRetail) {
  const retailIncome = await getRetailIncome(applicationId);
  if (retailIncome) {
    dsrPercent = Number(retailIncome.dsrPercent);
  }
}
```

Then replace the `cashflow` factor score entry (currently line ~266-270):

```typescript
cashflow: {
  weight: factorWeights.cashflow,
  score: (isRetail && dsrPercent !== null)
    ? computeDsrCashflowScore(dsrPercent)
    : computeCashflowScore(ratioMap),
  weightedScore: 0,
},
```

- [ ] **Step 6: Run full backend tests**

```bash
cd backend && npm test 2>&1 | tail -15
```
Expected: All passing. No regressions.

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit/services/scoring.service.ts backend/src/__tests__/scoring.service.test.ts
git commit -m "feat(credit/scoring): use DSR for retail cashflow factor score instead of financial ratios"
```

---

## Task 2: Hide Payment Capability Tab for Individual Borrowers

**Context:** `PaymentCapabilityTab` shows corporate cashflow projections and sensitivity scenarios — it's a CA Memo section designed for businesses. For `INDIVIDUAL` borrowers it's irrelevant noise. The tab is defined in `creditUtils.ts` TAB_GROUPS under S4 and rendered in `CreditApplicationDetail.tsx`.

**Strategy:** Make `getVisibleTabGroups` accept an optional `borrowerType` parameter. When `borrowerType === 'INDIVIDUAL'`, exclude `payment-capability` from the S4 group. This keeps all existing logic intact for corporate borrowers.

**Files:**
- Modify: `frontend/pages/credit/creditUtils.ts`
- Modify: `frontend/pages/CreditApplicationDetail.tsx`

- [ ] **Step 1: Update `getVisibleTabGroups` to accept borrowerType**

In `frontend/pages/credit/creditUtils.ts`, replace:

```typescript
/** Return the default tab groups (S1-S7 + meta), optionally including bank-only groups */
export function getVisibleTabGroups(advancedMemo: boolean): TabGroup[] {
  return TAB_GROUPS.filter(g => !g.advancedOnly || advancedMemo);
}
```

with:

```typescript
/** Return the default tab groups (S1-S7 + meta), optionally including bank-only groups.
 *  Pass borrowerType to suppress tabs irrelevant for individual/retail borrowers. */
export function getVisibleTabGroups(advancedMemo: boolean, borrowerType?: string | null): TabGroup[] {
  const isRetail = borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR';
  return TAB_GROUPS
    .filter(g => !g.advancedOnly || advancedMemo)
    .map(g => {
      if (!isRetail) return g;
      // For retail borrowers: hide payment-capability (corporate cashflow projections)
      const filteredTabs = g.tabs.filter(t => t.id !== 'payment-capability');
      return filteredTabs.length !== g.tabs.length ? { ...g, tabs: filteredTabs } : g;
    })
    .filter(g => g.tabs.length > 0);
}
```

- [ ] **Step 2: Pass borrowerType in CreditApplicationDetail**

In `frontend/pages/CreditApplicationDetail.tsx`, find line ~91:

```typescript
const visibleTabGroups = getVisibleTabGroups(advancedMemo);
```

Replace with:

```typescript
const visibleTabGroups = getVisibleTabGroups(advancedMemo, app?.borrowerProfile?.borrowerType);
```

Note: `app` may be null on initial load, so `?.` is required.

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/credit/creditUtils.ts frontend/pages/CreditApplicationDetail.tsx
git commit -m "feat(credit/ui): hide Payment Capability tab for individual/retail borrowers"
```

---

## Task 3: Rename and Contextualise "Directors & UBOs" for Retail

**Context:** The S2 `parties` tab is labelled "Directors & UBOs" — a corporate concept. For individual borrowers this tab still serves a purpose (adding guarantors, co-borrowers, sponsors) but the label is misleading. We fix two things:
1. Rename the tab label to "Guarantors & Parties" for retail borrowers in `creditUtils.ts`.
2. In `PartiesTab.tsx`, show a contextual note for INDIVIDUAL borrowers explaining the tab's purpose.

**Files:**
- Modify: `frontend/pages/credit/creditUtils.ts`
- Modify: `frontend/pages/credit/tabs/PartiesTab.tsx`

- [ ] **Step 1: Make tab label borrower-type-aware in getVisibleTabGroups**

In `frontend/pages/credit/creditUtils.ts`, in the `getVisibleTabGroups` function, extend the retail mapping block:

```typescript
export function getVisibleTabGroups(advancedMemo: boolean, borrowerType?: string | null): TabGroup[] {
  const isRetail = borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR';
  return TAB_GROUPS
    .filter(g => !g.advancedOnly || advancedMemo)
    .map(g => {
      if (!isRetail) return g;
      // For retail: hide payment-capability, relabel parties tab
      const filteredTabs = g.tabs
        .filter(t => t.id !== 'payment-capability')
        .map(t => t.id === 'parties' ? { ...t, label: 'Guarantors & Parties' } : t);
      return filteredTabs.length !== g.tabs.length || filteredTabs.some((t, i) => t.label !== g.tabs[i]?.label)
        ? { ...g, tabs: filteredTabs }
        : g;
    })
    .filter(g => g.tabs.length > 0);
}
```

- [ ] **Step 2: Add contextual note in PartiesTab for individual borrowers**

In `frontend/pages/credit/tabs/PartiesTab.tsx`, find the `PartiesTabProps` interface and add `borrowerType`:

```typescript
interface PartiesTabProps {
  app: CreditApplication;
  borrowerType?: string | null;
}
```

Update the component signature:

```typescript
const PartiesTab: React.FC<PartiesTabProps> = ({ app, borrowerType }) => {
```

Then, just after the opening `<div>` wrapper of the tab content (before the parties list), add:

```tsx
{(borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') && (
  <div className="flex items-start gap-3 p-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
    <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5 shrink-0">info</span>
    <p>For individual borrowers, Directors and Shareholders do not apply. Use this section to add <strong>guarantors</strong>, <strong>co-borrowers</strong>, or <strong>sponsors</strong> linked to this application.</p>
  </div>
)}
```

- [ ] **Step 3: Pass borrowerType from CreditApplicationDetail to PartiesTab**

In `frontend/pages/CreditApplicationDetail.tsx`, find the `case 'parties':` render:

```typescript
case 'parties': return <PartiesTab app={app!} />;
```

Replace with:

```typescript
case 'parties': return <PartiesTab app={app!} borrowerType={app?.borrowerProfile?.borrowerType} />;
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/credit/creditUtils.ts frontend/pages/credit/tabs/PartiesTab.tsx frontend/pages/CreditApplicationDetail.tsx
git commit -m "feat(credit/ui): relabel Directors & UBOs to Guarantors & Parties for retail; add contextual note"
```

---

## Task 4: S2 Phase Completion — Fix for Individual Borrowers

**Context:** `getPhaseCompletion` in `creditUtils.ts` marks S2 complete when `registrationNumber` is set AND `parties.length > 0`. For INDIVIDUAL borrowers, `registrationNumber` is a business registration number — never applicable. The check should use `contact.nricPassport` or simply omit the `registrationNumber` requirement for retail. Also, `parties.length > 0` is a corporate requirement (directors); for retail it should be optional.

**Files:**
- Modify: `frontend/pages/credit/creditUtils.ts`

- [ ] **Step 1: Fix S2 completion logic**

In `creditUtils.ts`, find the `s2` entry in `getPhaseCompletion`:

```typescript
s2: (
  hasValue(app.borrowerType) &&
  (hasValue(app.registrationNumber)) &&
  (app.parties && app.parties.length > 0)
) ? 'complete' : 'incomplete',
```

Replace with:

```typescript
s2: (() => {
  if (!hasValue(app.borrowerType)) return false;
  const isRetail = app.borrowerType === 'INDIVIDUAL' || app.borrowerType === 'SOLE_PROPRIETOR';
  if (isRetail) {
    // For retail: borrowerType set is sufficient (NRIC is on CrmContact, not the application)
    return true;
  }
  // For corporate: need registrationNumber + at least one director/party
  return hasValue(app.registrationNumber) && (app.parties && app.parties.length > 0);
})() ? 'complete' : 'incomplete',
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/credit/creditUtils.ts
git commit -m "fix(credit/ui): S2 completion gate no longer requires registrationNumber for individual borrowers"
```

---

## Task 5: Wire DSR into Submission Readiness as a Soft Warning

**Context:** The submission readiness validator (`submissionReadiness.service.ts`) currently only checks document presence and bureau freshness for retail borrowers. It should warn (non-blocking) if a retail borrower has no `retailIncome` record or if DSR > 70% (fail status). This surfaces the gap early in the submission panel UI.

**Files:**
- Modify: `backend/src/credit/services/submissionReadiness.service.ts`

- [ ] **Step 1: Add DSR warning to submission readiness**

In `submissionReadiness.service.ts`, after the existing Check 7 (financial statements warning), add:

```typescript
// ---- Check 10: Retail DSR warning ----
const isRetailBorrower = ['INDIVIDUAL', 'SOLE_PROPRIETOR'].includes(
  application.borrowerProfile.borrowerType as string
);
if (isRetailBorrower) {
  const retailIncome = await prisma.retailIncome.findUnique({
    where: { applicationId },
    select: { dsrPercent: true },
  });
  if (!retailIncome) {
    warnings.push({
      field: 'retailIncome',
      message: 'Retail income / DSR assessment not completed — required for individual borrowers',
      severity: 'warning',
    });
  } else {
    const dsr = Number(retailIncome.dsrPercent);
    if (dsr > 70) {
      errors.push({
        field: 'retailIncome',
        message: `DSR of ${dsr.toFixed(1)}% exceeds 70% threshold — application is high risk`,
        severity: 'error',
      });
    } else if (dsr > 60) {
      warnings.push({
        field: 'retailIncome',
        message: `DSR of ${dsr.toFixed(1)}% is in the warning band (60-70%)`,
        severity: 'warning',
      });
    }
  }
}
```

- [ ] **Step 2: Run backend tests to confirm no regressions**

```bash
cd backend && npm test 2>&1 | tail -15
```
Expected: All passing.

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/submissionReadiness.service.ts
git commit -m "feat(credit/readiness): add DSR gate to submission readiness for retail borrowers"
```

---

## Task 6: End-to-End Verification

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Test with an INDIVIDUAL borrower application**

Open `http://localhost:5173/credit/applications/<any-individual-app-id>`.

Verify:
1. **S2 nav label** shows "Guarantors & Parties" (not "Directors & UBOs")
2. **S4 nav** has no "Payment Capability" entry
3. **Parties tab** shows the blue info banner about guarantors/co-borrowers
4. **S2 completion dot** is green as soon as borrowerType is set (no registrationNumber needed)

- [ ] **Step 3: Test DSR scoring**

1. Go to S3 Financials → fill in monthly gross income + commitments → save
2. Go to S4 Risk Score → click "Run Score"
3. Confirm the `cashflow` factor score in the scorecard breakdown reflects DSR (not 50)
4. Check: if DSR ≤60%, cashflow score should be >80

- [ ] **Step 4: Test submission readiness panel**

1. With no retail income entered, the readiness panel should show a warning "Retail income / DSR assessment not completed"
2. With DSR >70% entered, should show a blocking error
3. With DSR between 60-70%, should show a warning (not blocking)

- [ ] **Step 5: Verify no regression for CORPORATE borrowers**

Open any CORPORATE borrower application. Verify:
1. "Directors & UBOs" label still present
2. "Payment Capability" tab still present in S4
3. S2 still requires `registrationNumber` for completion

---

## Self-Review Checklist

**Spec coverage:**
- ✅ DSR wired into cashflow score (Task 1)
- ✅ Payment Capability tab hidden for retail (Task 2)
- ✅ Directors & UBOs relabelled + note added (Task 3)
- ✅ S2 completion gate fixed for retail (Task 4)
- ✅ DSR added to submission readiness gates (Task 5)
- ✅ Industry Outlook: left visible (still relevant to capture employer industry for retail)
- ✅ Risk & Mitigators: left visible and unchanged (appropriate for retail)
- ✅ Collateral: left visible and unchanged (optional path, gate only triggers if records exist)
- ✅ Security & Guarantees: left visible and unchanged

**Not in scope (assessed as non-issues):**
- `IndustryOutlookTab` — marginally relevant for retail (employer's industry); leaving as-is avoids scope creep
- `RiskMitigatorsTab` — appropriate for all borrower types; no change needed
- `CollateralTab` / `SecurityGuaranteesTab` — both correct; optional for unsecured retail
