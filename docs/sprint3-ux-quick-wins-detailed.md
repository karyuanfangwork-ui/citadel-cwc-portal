# Sprint 3 — UX Quick Wins: Detailed Implementation Plan

**Parent:** 2026-06-09-credit-audit-implementation-plan.md
**Sprint:** 3 of 8
**Estimate:** 6 dev-days (1 BE + 5 FE)
**Prerequisite:** Sprint 2 complete (My Work tab, SLA widget, duplicate detection)
**Sprint 1 status:** COMPLETE (DisbursementTab, REFER_BACK, breadcrumbs, sticky header)
**Sprint 2 status:** COMPLETE (My Work tab, SLA breach widget, duplicate borrower enforcement)

---

## 3.1 Pre-Submission Readiness Checklist (HIGH — Original Finding #7)

### Problem

No summary of incomplete sections before submission. Users can submit applications with required fields missing, leading to back-and-forth with approvers. `getPhaseCompletion()` exists but is not surfaced as a blocking/modal UX before submission.

### Current State

- **`getPhaseCompletion(app)`** in `frontend/pages/credit/creditUtils.ts` (line ~315) — returns `{ [phaseKey]: 'complete' | 'incomplete' | 'optional' }` for each section
- **`CreditApplicationDetail.tsx`** imports and calls `getPhaseCompletion` (line ~327), stores in `phaseCompletion` state — but only uses it for tab completion badges (S3.2)
- **ApprovalChainPanel** has a "Submit for Review" flow but no readiness gate
- No modal or checklist UI surfaces completion status before submission

### Implementation Steps

#### FE Step 1: Create `ReadinessChecklistModal` component

**New file:** `frontend/src/components/credit/ReadinessChecklistModal.tsx`

```tsx
interface ReadinessChecklistModalProps {
  open: boolean;
  onClose: () => void;
  phaseCompletion: Record<string, 'complete' | 'incomplete' | 'optional'>;
  applicationState: string;
  onSubmitAnyway: () => void;
  onNavigateToSection: (tabId: string) => void;
}
```

UI layout:
- Title: "Submit for Review — Readiness Check"
- Phase list with icons: ✓ (complete, green), ⚠ (incomplete, amber), — (optional, gray)
- Each incomplete row has a "Go to section →" link that calls `onNavigateToSection(tabId)` and closes modal
- Bottom action bar:
  - **Primary**: "Submit anyway" (amber if any incomplete, green if all complete)
  - **Secondary**: "Cancel" → closes modal
- Track which phases are required vs optional using the existing PHASE_LABELS map

Key details:
- Phase labels come from the existing `SECTION_LABELS` or `PHASE_LABELS` map in creditUtils.ts
- Each incomplete required section should show the specific missing fields if available (fall back to "Required fields missing")
- The modal should NOT block submission — it warns but allows override

#### FE Step 2: Wire readiness check into submission flow

**File:** `frontend/pages/CreditApplicationDetail.tsx`

In the "Submit for Review" action handler (in ApprovalChainPanel or wherever submission is triggered):

1. Before calling `submitForReview()`, check `phaseCompletion`
2. If any required section is `incomplete`, open `ReadinessChecklistModal`
3. If all required sections are `complete`, proceed directly to submission

```tsx
const handleSubmitForReview = () => {
  const incomplete = Object.entries(phaseCompletion)
    .filter(([_, status]) => status === 'incomplete');
  
  if (incomplete.length > 0) {
    setReadinessModalOpen(true);
    return;
  }
  submitForReview();
};
```

#### FE Step 3: Map phase keys to tab IDs for navigation

**File:** `frontend/pages/credit/creditUtils.ts`

Add a `PHASE_TO_TAB_MAP` constant that maps phase completion keys to tab group IDs for navigation:

```ts
export const PHASE_TO_TAB_MAP: Record<string, string> = {
  s1: 's1',
  s2: 's2',
  s3: 's3',
  s4: 's4',
  s5: 's5',
  s6: 's6',
  s7: 's7',
  // sub-sections map to their parent group
  facilities: 's1',
  borrowing: 's2',
  financials: 's3',
  riskRating: 's4',
  bureau: 's5',
  collateral: 's6',
  decision: 's7',
};
```

This allows the "Go to section" link in the modal to scroll to and activate the correct tab.

### Pitfalls

- `getPhaseCompletion()` may return keys that don't directly map to tab IDs — the mapping must be explicit
- The modal should NOT prevent submission — it's a warning, not a hard block. Hard blocks (missing required fields) are handled by backend validation
- Phase completion status is re-derived from app data on each render — no stale state issue
- Don't duplicate field-level validation here; the purpose is *section-level* completeness, not field-level

### Verification

1. Open application in DRAFT state with incomplete S3 (Financials)
2. Click "Submit for Review" → ReadinessChecklistModal opens showing "S3 · Financials — incomplete"
3. Click "Go to section →" → modal closes, S3 tab becomes active
4. Fill out S3, click "Submit for Review" again → modal shows all complete, or submits directly if all sections are complete

---

## 3.2 Tab Completion Badges on Sidebar (MEDIUM)

### Problem

No visual differentiation between completed and incomplete tab groups in the sidebar. Users must click into each tab to see if it's filled out.

### Current State

- `getPhaseCompletion(app)` already computed in `CreditApplicationDetail.tsx`
- Sidebar tab groups rendered from `getVisibleTabGroups()` — no completion status shown
- Completion data exists but is not surfaced in navigation

### Implementation Steps

#### FE Step 1: Add completion badges to sidebar tab groups

**File:** `frontend/pages/CreditApplicationDetail.tsx`

In the sidebar rendering (where `TAB_GROUPS` are iterated to build the left nav), add a small badge next to each group label:

```tsx
// In the sidebar group rendering:
const groupStatus = phaseCompletion[groupId]; // 'complete' | 'incomplete' | 'optional'

<span className={cn(
  'ml-1 text-xs',
  groupStatus === 'complete' && 'text-green-600',
  groupStatus === 'incomplete' && 'text-amber-500',
  groupStatus === 'optional' && 'text-gray-400',
)}>
  {groupStatus === 'complete' && '✓'}
  {groupStatus === 'incomplete' && '⚠'}
</span>
```

Visual design:
- ✓ (green) next to completed groups
- ⚠ (amber) next to incomplete groups
- No badge for `optional` groups (gray/hide)
- Badges render only for groups visible in the current state (respect `getVisibleTabGroups` state gating)

#### FE Step 2: Add "Next Incomplete" button to FAB area

**File:** `frontend/pages/CreditApplicationDetail.tsx`

The existing FAB "Next Incomplete" button (from Sprint 1 audit remediation) should be enhanced to use `getNextIncompleteTab()` with the completion status:

```tsx
const handleNextIncomplete = () => {
  const nextTab = getNextIncompleteTab(phaseCompletion, currentState, getVisibleTabGroups());
  if (nextTab) setActiveTab(nextTab);
};
```

### Pitfalls

- Group `id` from `TAB_GROUPS` must align with keys returned by `getPhaseCompletion()` — if they differ, add a mapping
- State-gated groups (like `s7-disbursement`) should show no badge when not visible
- Must handle the case where `phaseCompletion` is empty (application still loading)

### Verification

1. Open application in DRAFT state → S1 complete, S3 incomplete
2. Sidebar shows "S1 · Loan Request ✓" (green check) and "S3 · Financials ⚠" (amber warning)
3. S7 group (not visible in DRAFT) shows no badge
4. Click "Next Incomplete" FAB → navigates to S3 tab

---

## 3.3 Kanban Card SLA Indicator (Quick Win)

### Problem

Kanban cards in `CreditApplicationList.tsx` lack SLA status indicators. Users can't tell at a glance which applications are approaching orbreaching SLA.

### Current State

- **`CreditApplicationList.tsx`** renders a Kanban board with columns per application state
- Each card shows: application number, borrower name, amount, product type
- **Backend SLA service** has `slaDeadline` computed from `CreditSlaPolicy`
- Dashboard already uses `SlaBreachWidget` (from Sprint 2) for breach data
- The Kanban card has no SLA information

### Implementation Steps

#### BE Step 1: Add `slaDeadline` to application list response

**File:** `backend/src/services/creditApplication.service.ts`

In the application list query (the one feeding `CreditApplicationList`), add a computed `slaDeadline` field:

```ts
// In the list query, for each application:
const slaStatus = await this.getSlaDeadline(app.id, app.state);
// slaDeadline = the earliest SLA breach target for the current state
```

If this is too expensive per-row, add a join on `CreditSlaPolicy` where `targetState = app.state`.

**Alternative (simpler):** Add `slaDeadline` as a virtual field in the list API response. The SLA breach data already exists in `CreditSlaBreach` table. For the Kanban, we just need `slaDeadline` (the policy target date for the current state).

```ts
// In application list response mapping:
slaDeadline: app.slaDeadline ?? null, // from CreditSlaPolicy join
slaStatus: app.slaDeadline 
  ? (new Date(app.slaDeadline) < new Date() ? 'breached' 
    : (new Date(app.slaDeadline).getTime() - Date.now() < 3 * 86400000 ? 'approaching' : 'within'))
  : 'none',
```

#### FE Step 2: Add SLA dot to Kanban cards

**File:** `frontend/pages/credit/CreditApplicationList.tsx`

On each Kanban card, add a small colored dot:

```tsx
const getSlaDotColor = (slaStatus?: string) => {
  switch (slaStatus) {
    case 'breached': return 'bg-red-500';
    case 'approaching': return 'bg-amber-400';
    case 'within': return 'bg-green-500';
    default: return 'bg-gray-300';
  }
};

// In card rendering:
<span className={cn(
  'inline-block w-2 h-2 rounded-full mr-1',
  getSlaDotColor(app.slaStatus)
)} />
<span className="text-xs text-text-secondary">
  {app.slaDeadline ? formatDistanceToNow(new Date(app.slaDeadline)) : 'No SLA'}
</span>
```

### Pitfalls

- If the SLA policy doesn't cover every state, `slaDeadline` will be `null` for some applications — handle gracefully with gray dot and "No SLA" label
- `formatDistanceToNow` from date-fns provides human-readable "2 days left" / "3 days overdue" text
- Kanban boards may load many cards — the SLA computation must be O(1) per card, not a separate API call per card

### Verification

1. Application in `COMMITTEE_REVIEW` with SLA policy of 5 days → card shows amber dot "3 days left"
2. Application past SLA deadline → card shows red dot "2 days overdue"
3. Application in `DRAFT` (no SLA policy for that state) → card shows gray dot "No SLA"

---

## 3.4 Persist Active Tab in URL Hash (MEDIUM — Original Finding #17)

### Problem

Tab state resets when navigating away and back. Users lose their context when switching between tabs and applications.

### Current State

- **`CreditApplicationDetail.tsx`** uses `useState<string>('overview')` for active tab
- Tab state is lost on navigation away and back
- Deep-linking to a specific tab is not possible (e.g., sharing a link to the Financials tab)

### Implementation Steps

#### FE Step 1: Replace useState with URL search params

**File:** `frontend/pages/CreditApplicationDetail.tsx`

Replace the tab state management:

```tsx
// BEFORE:
const [activeTab, setActiveTab] = useState<string>('overview');

// AFTER:
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'overview';
const setActiveTab = (tab: string) => {
  setSearchParams(prev => {
    prev.set('tab', tab);
    return prev;
  }, { replace: true });
};
```

Add `useSearchParams` import from `react-router-dom`.

#### FE Step 2: Update tab click handlers

All `onClick` handlers that call `setActiveTab` will continue to work as-is since `setActiveTab` has the same signature. Verify:

- Sidebar tab clicks → `setActiveTab(tabId)` → updates URL → re-renders
- "Next Incomplete" FAB → `setActiveTab(nextTab)` → updates URL
- Mobile tab navigation → same
- Direct URL with `?tab=financials` → loads Financials tab directly

#### FE Step 3: Handle default tab based on application state

The default tab should still be context-aware. If no `tab` param in URL:

```tsx
const getDefaultTab = (state: string): string => {
  // If application is in COMMITTEE_REVIEW or later, default to s7 (Decision)
  if (['COMMITTEE_REVIEW', 'REFERRED_BACK', 'ACCEPTED', 'REJECTED'].includes(state)) return 's7';
  return 's1';
};

const activeTab = searchParams.get('tab') || getDefaultTab(application?.state || 'DRAFT');
```

### Pitfalls

- `useSearchParams` is from `react-router-dom` v6+ — verify project uses React Router v7 (it does per CLAUDE.md)
- `setSearchParams` with `replace: true` avoids pushing browser history entries for every tab switch
- The `tab` param value must match `TAB_GROUPS` group/sub-tab IDs, not display labels
- Test that tab state survives: application list → detail (tab=preserved) → back to list → same detail (tab=previous or default)

### Verification

1. Navigate to application detail → click "Financials" tab → URL changes to `?tab=financials`
2. Copy URL, open in new tab → loads directly to Financials tab
3. Navigate away to borrower list → back to same application → Financials tab is still active
4. No `tab` param → default tab loads based on application state

---

## 3.5 Auto-Save Timestamp Indicator (Quick Win)

### Problem

No visible save confirmation in forms. Users don't know if their changes were saved.

### Current State

- **`useAutosave` hook** (from F-02 remediation) exists at `frontend/src/hooks/useAutosave.ts`
- Some tabs using `CaMemoSection` show "Saved HH:MM" indicator
- But not all tabs use `useAutosave` + `CaMemoSection` consistently
- No standardized "last saved" indicator across all tabs

### Implementation Steps

#### FE Step 1: Standardize "Saved X ago" across all autosave tabs

**File:** `frontend/src/components/credit/CaMemoSection.tsx`

The `CaMemoSection` component already has `savedAt` and `saving` props. Verify all tabs using `useAutosave` pass `savedAt` to their `CaMemoSection`:

```tsx
// CaMemoSection already renders:
{saving && <SavingSpinner />}
{savedAt && <span className="text-xs text-text-secondary">Saved {formatDistanceToNow(savedAt)}</span>}
```

Ensure every tab that uses `useAutosave` also renders the `savedAt` prop:

```tsx
// In each autosave tab:
const autosave = useAutosave({ ... });
<CaMemoSection
  title="..."
  saving={autosave.saving}
  savedAt={autosave.savedAt}
  ...
/>
```

#### FE Step 2: Add brief "Saved ✓" flash animation

**File:** `frontend/src/components/credit/CaMemoSection.tsx`

When `savedAt` changes (new save just happened), briefly show a stronger visual cue:

```tsx
const [justSaved, setJustSaved] = useState(false);
const prevSavedAt = useRef(savedAt);

useEffect(() => {
  if (savedAt && savedAt !== prevSavedAt.current) {
    setJustSaved(true);
    prevSavedAt.current = savedAt;
    const timer = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timer);
  }
}, [savedAt]);

// In render:
{justSaved ? (
  <span className="text-xs text-green-600 font-medium animate-fade-out">
    ✓ Saved just now
  </span>
) : savedAt ? (
  <span className="text-xs text-text-secondary">
    ↳ Saved {formatDistanceToNow(savedAt)} ago
  </span>
) : null}
```

Add CSS animation in `frontend/src/index.css`:

```css
@keyframes fade-out {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0.4; }
}
.animate-fade-out {
  animation: fade-out 2s ease-out forwards;
}
```

### Pitfalls

- `useAutosave` returns `savedAt` as `Date | null` — handle both cases
- `formatDistanceToNow` from `date-fns` gives "2 seconds ago" / "1 minute ago" — add `addSuffix: true` option
- Only autosave tabs have this indicator; tabs without autosave (display-only, read-only) should show nothing
- Don't flash on initial load — only when `savedAt` changes from a previous value

### Verification

1. Open HeaderBackgroundTab → change a field → wait 3 seconds → "✓ Saved just now" flashes green, then fades to "↳ Saved 5 seconds ago" in gray
2. Open SummaryTab (read-only) → no save indicator shown
3. Navigate away and back → "Saved 2 minutes ago" persists

---

## Execution Order

| Day | Task | Files |
|-----|------|-------|
| 1 | BE: Add `slaDeadline` + `slaStatus` to application list API | `creditApplication.service.ts`, `creditApplication.controller.ts` |
| 1 | FE: Kanban SLA dots | `CreditApplicationList.tsx` |
| 2 | FE: ReadinessChecklistModal component | New `ReadinessChecklistModal.tsx` |
| 2 | FE: PHASE_TO_TAB_MAP in creditUtils.ts | `creditUtils.ts` |
| 3 | FE: Wire readiness modal into submission flow | `CreditApplicationDetail.tsx` |
| 3 | FE: Tab completion badges on sidebar | `CreditApplicationDetail.tsx` |
| 4 | FE: URL hash tab persistence (useSearchParams) | `CreditApplicationDetail.tsx` |
| 4 | FE: Auto-save flash animation in CaMemoSection | `CaMemoSection.tsx`, `index.css` |
| 5 | QA: End-to-end testing of all 5 features | — |

---

## Dependencies

- Sprint 2 must be complete (SLA service, My Work dashboard, duplicate detection)
- `getPhaseCompletion()` must return accurate completion data for readiness checklist (verify existing implementation)
- `useAutosave` hook must be wired in all editable tabs (verify from F-02 remediation)
- SLA policies must exist in `CreditSlaPolicy` for SLA dots to show data
- `CaMemoSection` component must be used on all tabs (completed in F-02 Sprint 1)

## Key Decisions

1. **Readiness checklist is a WARNING, not a hard block** — users can submit with incomplete sections, but the modal makes it very clear what's missing
2. **Kanban SLA status is computed at query time** — no separate API call per card, the `slaDeadline` is included in the list response
3. **Tab state uses `?tab=` search param** — not URL hash (`#tab=`), because search params are more React Router-friendly and work with `useSearchParams`
4. **Auto-save indicator is progressive** — "✓ Saved just now" flash (2s) → "↳ Saved X ago" persistent → no indicator if never saved
5. **Default tab is state-aware** — later-stage applications default to S7 (Decision), early-stage default to S1 (Loan Request)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `getPhaseCompletion()` may return stale keys | Add unit test verifying all TAB_GROUPS keys are covered; log warning for unmapped keys |
| SLA deadline expensive per row for large portfolios | Add `slaDeadline` as a computed field in the list query (single JOIN, not N+1) |
| Tab persistence breaks if tab IDs change | Use stable tab IDs from TAB_GROUPS (not display labels); add migration if IDs change |
| Auto-save flash jarring on rapid edits | Debounce to 3s after last keystroke (already in useAutosave); flash only on actual server save, not optimistic |