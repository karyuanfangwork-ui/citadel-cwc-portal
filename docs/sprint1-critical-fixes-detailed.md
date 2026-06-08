# Sprint 1 — Critical Fixes & Navigation: Detailed Implementation Plan

**Parent:** 2026-06-09-credit-audit-implementation-plan.md
**Sprint:** 1 of 8
**Estimate:** 9 dev-days (4 BE + 5 FE)
**Prerequisites:** None — all standalone items

---

## 1.1 DisbursementTab: Wire Into TAB_GROUPS with State Gating

### Problem
`DisbursementTab` exists in `renderTab()` and `DetailTab` type (with comment `"visible in ACCEPTED / DISBURSED / CLOSED states"`) but is absent from `TAB_GROUPS`. No navigation element can ever set `activeTab = 'disbursement'`. The tab is effectively unreachable.

### Architecture Decision
Add disbursement as a tab group that is conditionally shown based on application state, using the existing `getVisibleTabGroups()` function with a new `applicationState` parameter. This keeps the gating logic centralized and declarative.

### Step-by-Step Changes

#### Step 1: Create Shared Sticky Header Component

**New file:** `frontend/src/components/credit/AppStickyHeader.tsx`

This will be reused by Sprint 1.4 so create it first since DisbursementTab needs app state context.

```tsx
// Minimal placeholder — full implementation in 1.4
// Will contain: borrower name, app no, amount, state badge, risk rating, SLA countdown
export function AppStickyHeader({ application }: { application: CreditApplication }) {
  // Implemented in 1.4
}
```

#### Step 2: Add `states` Property to `TabGroup` Interface

**File:** `frontend/pages/credit/creditUtils.ts`

```ts
export interface TabGroup {
  id: string;
  label: string;
  tabs: TabDefinition[];
  /** Whether this group is only visible with credit:advanced_memo flag */
  advancedOnly?: boolean;
  /** Application states in which this group is visible. Undefined = always visible. */
  states?: ApplicationState[];
}
```

#### Step 3: Add Disbursement Tab Group toTAB_GROUPS

**File:** `frontend/pages/credit/creditUtils.ts` — Insert after the S7 group (before meta):

```ts
// After S7 group, before meta group
{
  id: 's7-disbursement',
  label: 'Disbursement',
  tabs: [
    { id: 'disbursement', label: 'Disbursement Orders' },
  ],
  // Only visible when application is in these states
  states: ['ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED'],
},
```

Note: Added `ACTIVE` and `CLOSED` in addition to the type comment's `ACCEPTED / DISBURSED / CLOSED`. `ACTIVE` is needed because after disbursement completes, the app transitions to ACTIVE — users need to see disbursement details (read-only) in ACTIVE state too.

#### Step 4: Update `getVisibleTabGroups()` to Accept and Filter by `applicationState`

**File:** `frontend/pages/credit/creditUtils.ts`

Change signature:
```ts
// Before
export function getVisibleTabGroups(advancedMemo: boolean, borrowerType?: string | null): TabGroup[]

// After
export function getVisibleTabGroups(
  advancedMemo: boolean,
  borrowerType?: string | null,
  applicationState?: string | null,
): TabGroup[] {
  return TAB_GROUPS
    .filter(g => !g.advancedOnly || advancedMemo)
    .filter(g => !g.states || !applicationState || g.states.includes(applicationState as ApplicationState))
    .map(g => {
      // ... existing retail label mapping
    })
    .filter(g => g.tabs.length > 0);
}
```

This means:
- Groups without `states` property = always visible (all current groups)
- Groups with `states` = only visible when application state matches
- `applicationState` is optional — if not provided, all groups show (backwards compatible)

#### Step 5: Update Call Sites

**File:** `frontend/pages/credit/CreditApplicationDetail.tsx`

Line ~121 (the only call site):
```tsx
// Before
const visibleTabGroups = getVisibleTabGroups(advancedMemo, app?.borrowerProfile?.borrowerType);

// After
const currentState = (app?.state || app?.status) as ApplicationState;
const visibleTabGroups = getVisibleTabGroups(advancedMemo, app?.borrowerProfile?.borrowerType, currentState);
```

#### Step 6: Add REFER_BACK State Color/Label to creditUtils (for 1.2)

**File:** `frontend/pages/credit/creditUtils.ts`

Add to `STATE_COLORS` and `STATE_LABELS` maps:
```ts
REFERRED_BACK: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' }
// Label: 'Referred Back'
```

#### Step 7: Remove Dead Inline DisbursementTab Rendering

**File:** `frontend/pages/credit/CreditApplicationDetail.tsx`

Lines ~1038-1043 contain inline JSX:
```tsx
{activeTab === 'disbursement' && (
  <div role="tabpanel" ...>
    <DisbursementTab application={app} onUpdated={(updated) => setApp(updated)} />
  </div>
)}
```

This inline rendering is now redundant because the sidebar-driven tab system handles all tabs from `visibleTabGroups`. Remove this block entirely. The `renderTab('disbursement')` switch case at line 378 remains as the canonical render path.

### Verification Steps
1. Navigate to an application in DRAFT state → Disbursement tab should NOT appear in the sidebar
2. Transition application to APPROVED, then ACCEPTED → Disbursement tab should appear
3. Click Disbursement tab → should show `DisbursementTab` with readiness checklist
4. Transition to DISBURSED → Disbursement tab still visible, form is read-only
5. Transition back to UNDERWRITING → Disbursement tab disappears
6. Verify `ALL_TABS` includes `disbursement` (it will now since it's in `TAB_GROUPS`)
7. Verify `getPhaseCompletion()` still works — disbursement is not included in completion checks

### Edge Cases
- **Retail borrowers:** Disbursement tab should show for all borrower types (no retail-specific suppression needed)
- **Advanced memo flag:** Disbursement group is NOT `advancedOnly: true` — it's a standard group visible to all users in qualifying states
- **`getNextIncompleteTab()`**: This function iterates `TAB_GROUPS` and skips `advancedOnly` groups. It should also skip groups whose `states` don't include current application state. Update it to accept `applicationState`:
  ```ts
  export function getNextIncompleteTab(completion: Record<string, PhaseStatus>, applicationState?: string | null): DetailTab | null {
    for (const group of TAB_GROUPS) {
      if (group.advancedOnly) continue;
      if (group.states && applicationState && !group.states.includes(applicationState as ApplicationState)) continue;
      if (completion[group.id] === 'incomplete') return group.tabs[0].id;
    }
    return null;
  }
  ```

### Pitfalls
- `ALL_TABS` is derived from `TAB_GROUPS.flatMap(...)` — adding disbursement to `TAB_GROUPS` means it will appear in `ALL_TABS` even for DRAFT applications. This is fine because `ALL_TABS` is used for the `DetailTab` type union and `renderTab()` dispatch, not for determining visibility. The visibility is controlled by `getVisibleTabGroups()` with state filtering.
- The `DisbursementTab` component already has internal `readOnly` gating (`application.state !== 'ACCEPTED'`) — keep this as defense-in-depth even though the tab won't show in non-qualifying states.

---

## 1.2 Add REFER_BACK Application State

### Problem
No general-purpose "refer back" workflow state. `RETURN` exists in approval decisions (sends from committee back to `CREDIT_ASSESSMENT`), but there's no distinct `REFERRED_BACK` state for the application to enter while awaiting analyst action.

### Architecture Decision
Add `REFERRED_BACK` as a proper `ApplicationState` value. It sits between any review state and the state it returns to:

```
KYC_REVIEW ──── refer_back ────▶ REFERRED_BACK ──▶ resubmit ──▶ SUBMITTED
CREDIT_ASSESSMENT ── refer_back ──▶ REFERRED_BACK ──▶ resume ──▶ UNDERWRITING
COMMITTEE_REVIEW ── refer_back ──▶ REFERRED_BACK ──▶ resume ──▶ CREDIT_ASSESSMENT
```

The existing `RETURN` approval decision will now transition to `REFERRED_BACK` instead of directly to `CREDIT_ASSESSMENT`. The analyst then resumes work and transitions back to the appropriate stage.

### Step-by-Step Changes

#### Step 1: Prisma Schema — Add REFER_BACK Enum Values

**File:** `backend/prisma/schema.prisma`

**2.1** Add `REFERRED_BACK` to `ApplicationState` enum (after `WITHDRAWN`, before closing bracket):
```prisma
enum ApplicationState {
  DRAFT
  SUBMITTED
  KYC_REVIEW
  KYC_APPROVED
  KYC_REJECTED
  UNDERWRITING
  CREDIT_ASSESSMENT
  COMMITTEE_REVIEW
  APPROVED
  REJECTED
  OFFER
  ACCEPTED
  DISBURSED
  ACTIVE
  CLOSED
  WITHDRAWN
  REFERRED_BACK      // NEW
}
```

**2.2** Verify `ApprovalDecisionType` — `RETURN` already exists. No new decision type needed. The existing `RETURN` decision will now transition to `REFERRED_BACK` state instead of `CREDIT_ASSESSMENT`.

**2.3** Run migration:
```bash
cd backend
npx prisma db push
# If this fails due to enum default, use:
# ALTER TYPE "ApplicationState" ADD VALUE 'REFERRED_BACK';
```

**PITFALL:** The existing `ApplicationState` default on `CreditApplication` may be `DRAFT`. Since we're ADDING a value (not changing an existing one), `prisma db push` should work. But if it fails, follow the memory pattern: DROP DEFAULT → ALTER TYPE → SET DEFAULT.

#### Step 2: Backend — State Transition Rules

**File:** `backend/src/credit/services/creditApplication.service.ts`

Add to `TRANSITIONS` array:
```ts
// New refer-back transitions
{ from: 'KYC_REVIEW',        to: 'REFERRED_BACK', action: 'refer_back', reasonRequired: true },
{ from: 'CREDIT_ASSESSMENT',  to: 'REFERRED_BACK', action: 'refer_back', reasonRequired: true },
{ from: 'COMMITTEE_REVIEW',  to: 'REFERRED_BACK', action: 'refer_back', reasonRequired: true },

// Resume from referred back — target depends on which stage referred
{ from: 'REFERRED_BACK', to: 'KYC_REVIEW',        action: 'resume_kyc' },
{ from: 'REFERRED_BACK', to: 'UNDERWRITING',       action: 'resume_underwriting' },
{ from: 'REFERRED_BACK', to: 'CREDIT_ASSESSMENT',  action: 'resume_assessment' },
{ from: 'REFERRED_BACK', to: 'SUBMITTED',          action: 'resubmit' },
```

Add to `TRANSITION_PERMISSIONS`:
```ts
refer_back:            'credit:approve',
resume_kyc:            'credit:write',
resume_underwriting:   'credit:write',
resume_assessment:     'credit:write',
resubmit:              'credit:write',
```

Add to `ACTION_LABELS`:
```ts
refer_back: 'Refer Back',
resume_kyc: 'Resume KYC Review',
resume_underwriting: 'Resume Underwriting',
resume_assessment: 'Resume Assessment',
resubmit: 'Resubmit Application',
```

Add to `STATE_LABELS`:
```ts
REFERRED_BACK: { label: 'Referred Back', color: 'amber', icon: 'undo' },
```

#### Step 3: Backend — Update Approval RETURN Decision

**File:** `backend/src/credit/services/approvalAction.service.ts`

In the decision handling block (~line 224):
```ts
// Before
} else if (decision === 'RETURN') {
  // Send back to ANALYSING
  newState = ApplicationState.CREDIT_ASSESSMENT;
  isComplete = true;
}

// After
} else if (decision === 'RETURN') {
  // Send back to REFERRED_BACK state (analyst must resume)
  newState = ApplicationState.REFERRED_BACK;
  isComplete = true;
}
```

#### Step 4: Backend — Notification on Refer Back

**File:** `backend/src/credit/services/creditApplication.service.ts`

In the `transitionApplication` method, add a notification for `REFERRED_BACK`:
```ts
if (newState === ApplicationState.REFERRED_BACK) {
  // Notify the assigned RM and analyst
  await notificationService.send({
    subject: `Application ${app.applicationNo} Referred Back`,
    body: `Application ${app.applicationNo} for ${borrowerName} has been referred back. Reason: ${options.reason || 'Not specified'}`,
    channel: 'IN_APP',
    userIds: [app.assignedRmId, app.assignedAnalystId].filter(Boolean),
  });
}
```

Use the notification pattern from Phase 2: `subject`, `body`, `channel` fields (NOT `title`/`message`).

#### Step 5: Backend — Controller & Route

**File:** `backend/src/credit/controllers/creditApplication.controller.ts`

Add handler:
```ts
export const referBackApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason, targetStage } = req.body; // targetStage: 'KYC_REVIEW' | 'UNDERWRITING' | 'CREDIT_ASSESSMENT' | 'SUBMITTED'

  const app = await creditApplicationService.transitionApplication(id, 'refer_back', {
    userId: req.user!.id,
    reason,
  });

  res.json({ data: app });
});
```

No separate route needed — refer_back uses the existing `POST /applications/:id/transition` endpoint with `{ action: 'refer_back', reason: '...' }`.

#### Step 6: Frontend — Type Updates

**File:** `frontend/src/services/credit.service.ts`

Add `REFERRED_BACK` to the `ApplicationState` type union:
```ts
export type ApplicationState =
  | 'DRAFT' | 'SUBMITTED' | 'KYC_REVIEW' | 'KYC_APPROVED' | 'KYC_REJECTED'
  | 'UNDERWRITING' | 'CREDIT_ASSESSMENT' | 'COMMITTEE_REVIEW'
  | 'APPROVED' | 'REJECTED' | 'OFFER' | 'ACCEPTED'
  | 'DISBURSED' | 'ACTIVE' | 'CLOSED' | 'WITHDRAWN'
  | 'REFERRED_BACK';  // NEW
```

#### Step 7: Frontend — State Colors & Labels

**File:** `frontend/pages/credit/creditUtils.ts`

Add to `STATE_COLORS`:
```ts
REFERRED_BACK: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
```

Add to `STATE_LABELS`:
```ts
REFERRED_BACK: 'Referred Back',
```

#### Step 8: Frontend — Refer Back Button in ApprovalChainPanel

**File:** `frontend/src/components/credit/ApprovalChainPanel.tsx`

The existing `RETURN` decision button already exists:
```ts
{ decision: 'RETURN', label: 'Return', classes: 'border-blue-200 hover:bg-blue-50 text-blue-700' },
```

Update label and add mandatory comment requirement:
```ts
{ decision: 'RETURN', label: 'Refer Back', classes: 'border-amber-200 hover:bg-amber-50 text-amber-700' },
```

In the submit handler, when `selectedDecision === 'RETURN'`:
```ts
if (selectedDecision === 'RETURN' && !comment.trim()) {
  setError('A reason is required when referring an application back');
  return;
}
```

Update `DECISION_STYLES` for RETURN:
```ts
RETURN: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'undo' },
```

#### Step 9: Frontend — Resume Actions on Detail Page

**File:** `frontend/pages/credit/CreditApplicationDetail.tsx`

When `currentState === 'REFERRED_BACK'`, show action buttons for the analyst:

```tsx
{currentState === 'REFERRED_BACK' && canWrite && (
  <div className="flex gap-2 mt-4">
    {referredFrom === 'KYC_REVIEW' && (
      <button onClick={() => handleTransition('resume_kyc')} className="btn btn-primary">
        Resume KYC Review
      </button>
    )}
    {referredFrom === 'CREDIT_ASSESSMENT' && (
      <button onClick={() => handleTransition('resume_assessment')} className="btn btn-primary">
        Resume Assessment
      </button>
    )}
    {referredFrom === 'COMMITTEE_REVIEW' && (
      <button onClick={() => handleTransition('resume_underwriting')} className="btn btn-primary">
        Resume Underwriting
      </button>
    )}
    <button onClick={() => handleTransition('resubmit')} className="btn btn-secondary">
      Resubmit from Start
    </button>
  </div>
)}
```

#### Step 10: Seed Data — Update ApplicationState enum values

**File:** `backend/prisma/seed-credit.ts`

Ensure `REFERRED_BACK` is recognized in seed data application states. No new seed apps needed — just ensure the enum is available.

### Verification Steps
1. Create application in `COMMITTEE_REVIEW` state
2. As approver, click "Refer Back" button with reason → application transitions to `REFERRED_BACK`
3. Verify analyst gets in-app notification
4. As analyst, click "Resume Assessment" → application transitions to `CREDIT_ASSESSMENT`
5. Verify state badge shows amber "Referred Back" label
6. Verify `RETURN` decision from approval action still works (now goes to `REFERRED_BACK` instead of `CREDIT_ASSESSMENT`)
7. Verify audit trail records both the refer_back and resume transitions

### Pitfalls
- **Migration:** `prisma db push` adding a new enum value should work. If any `CreditApplication` has a `DEFAULT` constraint, drop it first, add value, then restore.
- **Notification fields:** Use `subject`/`body`/`channel`, NOT `title`/`message`. This was a Phase 2 pitfall.
- **`getNextIncompleteTab()`:** Add `REFERRED_BACK: 'incomplete'` to phase completion logic — it should show S5 (Bureau & Compliance) as the first incomplete section to re-check.
- **Kanban:** Add `REFERRED_BACK` column to the Kanban view in `CreditApplicationList.tsx`. It should appear between `CREDIT_ASSESSMENT` and `APPROVED`.
- **Dashboard:** Add `REFERRED_BACK` count to pipeline cards.

---

## 1.3 Breadcrumb Navigation & Back-Links

### Problem
`/credit/financials` and `/credit/collateral` are reachable only via deep-links with no visible way to navigate back to the originating context.

### Current State
- `FinancialSpreading.tsx`: Has breadcrumbs (`Credit / Borrowers / [Borrower] / Financial Spreading`) linking to borrower profile. Missing: link back to application if accessed from within an app.
- `CollateralManagement.tsx`: Has breadcrumbs (`Credit / Applications / [App ID] / Collateral`) but shows truncated UUID instead of borrower name. Does NOT fetch the application object.

### Step-by-Step Changes

#### Step 1: CollateralManagement — Fetch Application and Show Context

**File:** `frontend/pages/credit/CollateralManagement.tsx`

Currently the page fetches `collateralApi.list(applicationId)` and `guaranteeApi.list(applicationId)` but not the application itself. Add:

```tsx
// Add to imports
import { creditService } from '../../src/services/credit.service';

// Add state
const [application, setApplication] = useState<CreditApplication | null>(null);

// Add fetch in useEffect (alongside existing data fetching)
useEffect(() => {
  if (applicationId) {
    creditService.getApplication(applicationId).then(setApplication).catch(() => setApplication(null));
  }
}, [applicationId]);
```

Update breadcrumb to show borrower name:
```tsx
// Before
<span className="font-semibold">{applicationId?.slice(0, 8)}...</span>

// After
<span className="font-semibold">
  {application?.borrowerProfile?.account?.name
    || application?.borrowerProfile?.contact
      ? `${application.borrowerProfile.contact.firstName} ${application.borrowerProfile.contact.lastName}`
    : applicationId?.slice(0, 8)}
</span>
```

Remember the borrower displayName fallback pattern from memory:
```
account?.name → contact.firstName+lastName → profile.name → 'Unnamed Borrower'
```

#### Step 2: FinancialSpreading — Add Optional Application Context

**File:** `frontend/pages/credit/FinancialSpreading.tsx`

Add support for `?applicationId=xxx` query param. When present, show an additional breadcrumb link:
```
Credit / Borrowers / [Borrower Name] / [Application No] / Financial Spreading
```

```tsx
const [searchParams] = useSearchParams();
const applicationId = searchParams.get('applicationId');

// If applicationId is provided, also fetch the application for context
const [application, setApplication] = useState<CreditApplication | null>(null);
useEffect(() => {
  if (applicationId) {
    creditService.getApplication(applicationId).then(setApplication).catch(() => setApplication(null));
  }
}, [applicationId]);
```

Add to breadcrumbs:
```tsx
{application && (
  <>
    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
    <Link to={`/credit/applications/${applicationId}`} className="text-blue-600 hover:underline">
      {application.applicationNo}
    </Link>
  </>
)}
```

#### Step 3: Update Deep-Link References

**File:** `frontend/pages/credit/tabs/FinancialsTab.tsx` (or wherever financials deep-link is generated)

Update the "Open in Full Screen" or "Manage Financials" link to include `applicationId`:
```tsx
<Link to={`/credit/financials?borrowerProfileId=${borrowerProfileId}&applicationId=${applicationId}`}>
  Open Full Spreading View
</Link>
```

**File:** `frontend/pages/credit/tabs/CollateralTab.tsx`

Already passes `applicationId`:
```tsx
<Link to={`/credit/collateral?applicationId=${id}`}>
  Manage Collateral
</Link>
```

No change needed — but verify this link exists.

### Verification Steps
1. Open `/credit/collateral?applicationId=xxx` → breadcrumb shows borrower name, links back to app detail
2. Open `/credit/financials?borrowerProfileId=xxx&applicationId=yyy` → breadcrumb shows borrower name AND application number
3. Click breadcrumb links → navigate correctly back to context
4. Open `/credit/financials?borrowerProfileId=xxx` (without applicationId) → works as before (borrower-only context)

---

## 1.4 Sticky Application Header with Key Indicators

### Problem
Risk score, bureau status, SLA countdown, and other critical information are buried in tabs. They should be visible at all times in a sticky header.

### Current State
`CreditApplicationDetail.tsx` already has a header section (lines 476-595) showing:
- Progress ring with completion percentage
- Borrower name (h1)
- State badge
- Product type badge
- Incomplete sections count
- Key info chips: Amount, Approved Amount, Tenor, Currency, Risk Rating, RM, Analyst

But it is NOT sticky — it scrolls away when the user scrolls through tab content.

### Step-by-Step Changes

#### Step 1: Create `AppStickyHeader` Component

**New file:** `frontend/src/components/credit/AppStickyHeader.tsx`

```tsx
import { CreditApplication } from '../../src/services/credit.service';

interface AppStickyHeaderProps {
  application: CreditApplication;
  currentState: string;
  progressPct: number;
  facilities?: any[];
}

export function AppStickyHeader({ application: app, currentState, progressPct, facilities }: AppStickyHeaderProps) {
  const borrowerName = app.borrowerProfile?.account?.name
    || (app.borrowerProfile?.contact
      ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
      : app.borrowerProfile?.name || 'Unnamed Borrower');

  const approvedTotal = facilities?.reduce(
    (sum, f) => sum + Number(f.approvedAmount ?? f.amount ?? 0), 0
  ) || 0;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      {/* Row 1: Progress + Borrower + State */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Progress ring */}
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none"
              stroke={progressPct >= 100 ? '#22c55e' : progressPct >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3" strokeDasharray={`${progressPct} ${100 - progressPct}`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {progressPct}%
          </span>
        </div>

        {/* Borrower name */}
        <h1 className="text-lg font-semibold text-gray-900 truncate">{borrowerName}</h1>

        {/* State badge */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[currentState]?.bg} ${STATE_COLORS[currentState]?.text}`}>
          {STATE_LABELS[currentState] || currentState}
        </span>

        {/* Product type */}
        {app.productType && (
          <span className="text-xs text-gray-500">{PRODUCT_LABELS[app.productType] || app.productType}</span>
        )}
      </div>

      {/* Row 2: Key indicators */}
      <div className="flex items-center gap-4 px-4 pb-2 text-sm text-gray-600 overflow-x-auto">
        <span className="flex items-center gap-1">
          <span className="text-gray-400">ID:</span>
          <span className="font-medium text-gray-900">{app.applicationNo}</span>
        </span>

        <span className="flex items-center gap-1">
          <span className="text-gray-400">Amount:</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(app.requestedAmount, app.currency)}
          </span>
        </span>

        {approvedTotal > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">Approved:</span>
            <span className="font-medium text-emerald-700">
              {formatCurrency(approvedTotal, app.currency)}
            </span>
          </span>
        )}

        {app.riskRating && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">Risk:</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">
              {app.riskRating}
            </span>
          </span>
        )}

        {app.borrowerProfile?.borrowerType && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">Type:</span>
            <span className="font-medium">{app.borrowerProfile.borrowerType}</span>
          </span>
        )}

        {/* Bureau status - derived from creditBureauChecks */}
        <BureauStatusIndicator application={app} />

        {/* SLA countdown */}
        <SlaCountdown application={app} />
      </div>
    </div>
  );
}
```

#### Step 2: Create Bureau Status Indicator

**Within** `AppStickyHeader.tsx` or as a separate component:

```tsx
function BureauStatusIndicator({ application }: { application: CreditApplication }) {
  const checks = application.creditBureauChecks || [];
  if (checks.length === 0 && !application.bureauChecklist) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-gray-400">Bureau:</span>
        <span className="text-gray-400 text-xs">Not started</span>
      </span>
    );
  }

  const cl = application.bureauChecklist;
  const allClear = cl?.ccrisUploaded && cl?.ctosUploaded && cl?.amlScreeningDone;
  const anyFail = checks.some(c => c.outcome === 'ADVERSE');
  const pending = checks.some(c => c.outcome === 'PENDING');

  const status = anyFail ? 'fail' : pending ? 'pending' : allClear ? 'pass' : 'incomplete';
  const colors = {
    pass: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-yellow-100 text-yellow-800',
    fail: 'bg-red-100 text-red-800',
    incomplete: 'bg-gray-100 text-gray-600',
  };
  const labels = { pass: 'Bureau: ✓ Pass', pending: 'Bureau: ⏳ Pending', fail: 'Bureau: ✗ Adverse', incomplete: 'Bureau: ○ Incomplete' };

  return (
    <span className="flex items-center gap-1">
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    </span>
  );
}
```

#### Step 3: Create SLA Countdown Indicator

```tsx
function SlaCountdown({ application }: { application: CreditApplication }) {
  // SLA deadline is computed from the application's current state entry time
  // The backend provides slaDeadline or we compute from state + SLA config
  const slaDeadline = application.slaDeadline; // if available on the model
  if (!slaDeadline) return null;

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-gray-400">SLA:</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          ● Breached ({Math.abs(diffDays)}d overdue)
        </span>
      </span>
    );
  }

  const color = diffDays <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  const label = diffDays === 0 ? `${diffHours}h remaining` : `${diffDays}d remaining`;

  return (
    <span className="flex items-center gap-1">
      <span className="text-gray-400">SLA:</span>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
        ● {label}
      </span>
    </span>
  );
}
```

**Note:** If `slaDeadline` is not on the `CreditApplication` model, we need to either:
- Add it to the API response (backend: `creditApplication.service.ts` compute SLA deadline from state + SLA config)
- Or compute client-side from `app.updatedAt` + SLA hours for the current state

#### Step 4: Integrate into CreditApplicationDetail

**File:** `frontend/pages/credit/CreditApplicationDetail.tsx`

Replace the existing header section (lines 476-595) with the new `<AppStickyHeader>` component. Keep the existing data loading and pass it as props:

```tsx
import { AppStickyHeader } from '../../src/components/credit/AppStickyHeader';

// In the render:
<AppStickyHeader
  application={app}
  currentState={currentState}
  progressPct={progressPct}
  facilities={facilities}
/>
```

Remove the duplicate header JSX from `CreditApplicationDetail.tsx`. The tab content starts immediately below the sticky header.

#### Step 5: Add SLA Deadline to Backend Response

**File:** `backend/src/credit/services/creditApplication.service.ts`

If `slaDeadline` is not already computed, add it to the `getApplication()` response:

```ts
// In getApplication or toApplicationDto:
const slaConfig = await this.getSlaConfig(app.state);
const stateEntryTime = app.stateUpdatedAt || app.updatedAt;
const slaDeadline = stateEntryTime ? new Date(stateEntryTime.getTime() + slaConfig.hours * 60 * 60 * 1000) : null;

return {
  ...app,
  slaDeadline: slaDeadline?.toISOString() || null,
};
```

### Verification Steps
1. Scroll down through application detail → header stays visible at the top of the viewport
2. Verify borrower name, state badge, amount, risk rating are all visible in the sticky header
3. Verify bureau status indicator shows correct status (pass/pending/fail/incomplete)
4. Verify SLA countdown shows time remaining or "breached" indicator
5. Test with different application states — verify all state colors display correctly
6. Test on mobile viewport — sticky header should not take up too much space

---

## Dependency Order

```
1.1 DisbursementTab ──► (1.2 REFER_BACK can run in parallel)
1.2 REFER_BACK ──► (1.4 sticky header can start after schema migration)
1.3 Breadcrumbs ──► (independent, can start any time)
1.4 Sticky Header ──► (needs 1.1's getVisibleTabGroups update for state gating context)
```

Recommended execution order:
1. **Day 1-2:** Start 1.1 (DisbursementTab TAB_GROUPS) + 1.2 (REFER_BACK Prisma migration) in parallel
2. **Day 2-3:** 1.2 backend services (transition rules, approval RETURN change, notifications)
3. **Day 3-4:** 1.1 frontend wiring + 1.3 (breadcrumbs) + 1.4 (sticky header component creation)
4. **Day 4-5:** 1.2 frontend (ApprovalChainPanel REFER_BACK, state colors) + 1.4 integration
5. **Day 5:** End-to-end testing of all 4 items

---

## Testing Checklist

### 1.1 DisbursementTab
- [ ] Application in DRAFT → Disbursement tab NOT visible in sidebar
- [ ] Application in UNDERWRITING → Disbursement tab NOT visible
- [ ] Application APPROVED → Disbursement tab NOT visible (not in states list)
- [ ] Application ACCEPTED → Disbursement tab IS visible, form is editable
- [ ] Application DISBURSED → Disbursement tab IS visible, form is read-only
- [ ] Transition ACCEPTED → UNDERWRITING → Disbursement tab disappears

### 1.2 REFER_BACK
- [ ] Application in COMMITTEE_REVIEW → Click "Refer Back" → Status changes to REFERRED_BACK
- [ ] Notification received by assigned RM and analyst
- [ ] REFERRED_BACK badge shows amber color
- [ ] Analyst clicks "Resume Assessment" → Status changes to CREDIT_ASSESSMENT
- [ ] Audit trail records both transitions
- [ ] Kanban view shows REFERRED_BACK column

### 1.3 Breadcrumbs
- [ ] `/credit/collateral?applicationId=xxx` → Shows borrower name, links back to app
- [ ] `/credit/financials?borrowerProfileId=xxx&applicationId=yyy` → Shows both contexts
- [ ] `/credit/financials?borrowerProfileId=xxx` → Works as before

### 1.4 Sticky Header
- [ ] Application detail → Scroll down → Header stays visible
- [ ] Bureau status shows "Pass" for completed checks
- [ ] Bureau status shows "Breached" for overdue SLA
- [ ] Risk rating always visible
- [ ] Works on mobile viewport (no overflow)