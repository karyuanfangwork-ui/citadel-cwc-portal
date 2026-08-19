# Borrower Workspace for Relationship Managers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/credit/borrowers/:id` into an RM-focused Borrower Workspace that makes readiness, blockers, relationship context, and application progression immediately actionable.

**Architecture:** Keep `BorrowerProfileDetail.tsx` as the route orchestrator, but move the first-view experience into focused `borrower360` components. Calculate first-release readiness in a pure frontend module from the existing borrower profile, Borrower 360 summary, documents, and applications; use the existing filtered applications API rather than adding a backend workspace endpoint. Preserve existing tab-only fetches, modals, permission checks, and application detail routes.

**Tech Stack:** React 19, TypeScript, React Router v7, Axios service layer, Tailwind utility classes plus scoped Financial Core tokens, Vitest + Testing Library, Playwright.

## Global Constraints

- Do not change credit approval authority, application submission gates, or application detail behavior.
- Keep `credit:read`, `credit:write`, and `credit:create` enforcement aligned with existing backend routes.
- Do not expose new PII; preserve explicit PII reveal and PII logging behavior.
- Reuse existing `BorrowerProfile`, `Borrower360Summary`, `Borrower360Activity`, `CreditApplication`, and `CreditDocument` contracts.
- Use existing Financial Core tokens and credit component conventions under `.credit-module`.
- Preserve individual versus corporate/SME conditional behavior.
- Do not add a backend workspace endpoint in the first implementation; add one only if an implementation test demonstrates that existing contracts cannot supply the required first-view data.
- Preserve the existing borrower detail render smoke journey and add coverage for the new RM workflow.

---

## File map

### Files to create

- `frontend/src/components/credit/borrower360/borrowerReadiness.ts` — pure readiness rules, action types, and application-primary-action derivation.
- `frontend/src/components/credit/borrower360/borrowerPresentation.ts` — shared borrower labels, status tone mapping, date/currency formatting, and application-state labels.
- `frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx` — RM-focused borrower identity, relationship context, status badges, and primary/secondary actions.
- `frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx` — readiness status, completion, and outstanding count.
- `frontend/src/components/credit/borrower360/BorrowerNextActions.tsx` — prioritized action cards with direct callbacks.
- `frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx` — filtered borrower applications and navigation to application detail.
- `frontend/src/components/credit/borrower360/BorrowerRelationshipSnapshot.tsx` — relationship owner, segment, contact preference, industry/occupation, and CRM status.
- `frontend/src/components/credit/borrower360/BorrowerExposureSnapshot.tsx` — compact exposure and facility summary with a link to the Exposure tab.
- `frontend/src/components/credit/borrower360/BorrowerActivityTimeline.tsx` — reusable activity timeline and empty state.
- `frontend/src/components/credit/borrower360/BorrowerOverview.tsx` — first-view composition for retail and corporate/SME borrowers.
- `frontend/src/components/credit/borrower360/__tests__/borrowerReadiness.test.ts` — readiness and primary-action unit tests.
- `frontend/src/components/credit/borrower360/__tests__/borrowerPresentation.test.ts` — shared formatting and tone tests.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceHeader.test.tsx` — header permission and primary-action tests.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerReadinessStrip.test.tsx` — readiness presentation tests.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerNextActions.test.tsx` — action ordering and callback tests.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx` — application card rendering and links.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx` — composition, empty states, and borrower-type behavior.
- `frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceAccessibility.test.tsx` — named controls, tabs, and non-color status tests.
- `frontend/pages/__tests__/BorrowerProfileDetail.test.tsx` — route data loading, retry, URL tab, and permission integration tests.
- `frontend/e2e/credit/borrower-workspace.spec.ts` — RM borrower workspace journey.

### Files to modify

- `frontend/pages/BorrowerProfileDetail.tsx` — route orchestration, URL tab state, application loading, workspace callbacks, and replacement of the old overview composition.
- `frontend/src/services/credit.service.ts` — add a typed borrower application query helper if the existing generic `listApplications` call is not sufficiently typed at the page boundary.
- `frontend/src/components/credit/borrower360/RetailOverview.tsx` — retain detailed retail financial/bureau content while removing duplicate first-view alerts/activity when rendered through the new overview.
- `frontend/src/components/credit/borrower360/CorporateOverview.tsx` — retain detailed corporate risk/business content while removing duplicate first-view alerts/activity when rendered through the new overview.
- `frontend/e2e/credit/render-smoke-detail.spec.ts` — update borrower assertions only if the new accessible headings change the existing smoke contract.
- `.gitignore` — retain narrow exceptions for the committed design and implementation plan documents.

### Files explicitly not changed in the first implementation

- `backend/src/credit/routes/creditApplication.routes.ts` — existing `borrowerProfileId` filtering is sufficient.
- `backend/src/credit/controllers/creditApplication.controller.ts` — no new endpoint required.
- `backend/prisma/schema.prisma` — no schema change required.
- `frontend/pages/CreditApplicationDetail.tsx` — application detail is outside scope.

---

## Task 1: Define and test borrower readiness rules

**Files:**
- Create: `frontend/src/components/credit/borrower360/borrowerReadiness.ts`
- Create: `frontend/src/components/credit/borrower360/__tests__/borrowerReadiness.test.ts`
- Modify: `frontend/src/services/credit.service.ts:172-290` only if the readiness module needs a missing nullable field added to an existing interface.

**Interfaces:**

- Consumes: `BorrowerProfile`, `Borrower360Summary`, and `CreditApplication`.
- Produces:

```ts
export type BorrowerReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';
export type BorrowerActionSeverity = 'BLOCKER' | 'WARNING' | 'INFO' | 'DONE';

export interface BorrowerNextAction {
  id: string;
  severity: BorrowerActionSeverity;
  title: string;
  description: string;
  actionLabel: string;
  target: 'profile' | 'income' | 'bureau' | 'documents' | 'risk' | 'application';
}

export interface BorrowerReadiness {
  status: BorrowerReadinessStatus;
  completionPct: number;
  outstandingCount: number;
  actions: BorrowerNextAction[];
}

export function calculateBorrowerReadiness(input: {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  applications: CreditApplication[];
}): BorrowerReadiness;

export function getPrimaryApplicationAction(applications: CreditApplication[]): {
  label: 'Start application' | 'Continue application' | 'View application';
  applicationId: string | null;
};
```

- [ ] **Step 1: Write failing readiness tests**

Cover these concrete cases:

```ts
it('blocks a borrower with missing KYC, income, and stale bureau data', () => {
  const result = calculateBorrowerReadiness({ profile: individualProfile(), summary: summaryWithStaleBureau(), applications: [] });
  expect(result.status).toBe('BLOCKED');
  expect(result.actions.map(action => action.id)).toEqual(['kyc', 'income', 'bureau']);
});

it('returns warning when only a stale bureau report remains', () => {
  const result = calculateBorrowerReadiness({ profile: verifiedIndividual(), summary: summaryWithStaleBureau(), applications: [] });
  expect(result.status).toBe('WARNING');
  expect(result.outstandingCount).toBe(1);
});

it('returns ready when required borrower information is present', () => {
  const result = calculateBorrowerReadiness({ profile: readyIndividual(), summary: readySummary(), applications: [] });
  expect(result.status).toBe('READY');
  expect(result.completionPct).toBe(100);
  expect(result.actions).toEqual([]);
});

it('requires financial information for corporate borrowers', () => {
  const result = calculateBorrowerReadiness({ profile: readyCorporateWithoutTurnover(), summary: readySummary(), applications: [] });
  expect(result.actions.some(action => action.id === 'financials')).toBe(true);
});

it('selects the draft application before an active application', () => {
  expect(getPrimaryApplicationAction([activeApplication(), draftApplication()])).toEqual({
    label: 'Continue application',
    applicationId: 'draft-1',
  });
});
```

Use local factory helpers in the test file to create complete typed fixtures; do not cast arbitrary partial objects to `BorrowerProfile` or `CreditApplication`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/borrowerReadiness.test.ts`

Expected: FAIL because `borrowerReadiness.ts` and its exported functions do not yet exist.

- [ ] **Step 3: Implement the pure readiness module**

Implement deterministic checks in this order:

1. Required identity: display name plus `nricPassport` for individuals or `registrationNumber` for business borrowers.
2. KYC: `profile.kycVerifiedAt` exists.
3. Income/financials: `summary.income` exists for individuals; `profile.annualTurnover` or financial statements exist for corporate/SME borrowers.
4. Bureau: `summary.bureau.daysOld` is present and not stale.
5. Documents: `summary.docCompletionPct >= 80`.
6. Risk: `profile.creditRiskRating` or `summary.riskRating` exists when the borrower has an application or completed onboarding inputs.

Emit stable action IDs (`identity`, `kyc`, `income`, `financials`, `bureau`, `documents`, `risk`), sort blockers before warnings before informational items, and calculate `completionPct` as completed checks divided by total applicable checks, rounded to an integer.

Do not mark the borrower `READY` when a `BLOCKER` exists. Mark `WARNING` when only warning actions remain. Return `READY` with an empty action list when all applicable checks pass.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/borrowerReadiness.test.ts`

Expected: PASS with all readiness and primary-application-action cases green.

- [ ] **Step 5: Commit the readiness contract**

```bash
git add frontend/src/components/credit/borrower360/borrowerReadiness.ts frontend/src/components/credit/borrower360/__tests__/borrowerReadiness.test.ts frontend/src/services/credit.service.ts
git commit -m "feat(credit): define borrower workspace readiness rules"
```

---

## Task 2: Centralize borrower and application presentation rules

**Files:**
- Create: `frontend/src/components/credit/borrower360/borrowerPresentation.ts`
- Create: `frontend/src/components/credit/borrower360/__tests__/borrowerPresentation.test.ts`
- Modify: `frontend/src/components/credit/borrower360/Borrower360Header.tsx` only if shared presentation helpers are reused during the transition.

**Interfaces:**

- Consumes: typed borrower/application/status values.
- Produces:

```ts
export function formatBorrowerType(type: string): string;
export function formatApplicationState(state: ApplicationState): string;
export function formatProductType(type: CreditProductType): string;
export function formatBorrowerDate(value: string | null | undefined): string;
export function formatMyr(value: number | string | null | undefined): string;
export function getApplicationStateTone(state: ApplicationState): 'neutral' | 'info' | 'warn' | 'pos' | 'neg';
export function getReadinessTone(status: BorrowerReadinessStatus): 'pos' | 'warn' | 'neg';
```

- [ ] **Step 1: Write failing formatter tests**

```ts
it('renders enum labels as human-readable title case', () => {
  expect(formatProductType('REVOLVING_CREDIT')).toBe('Revolving credit');
  expect(formatApplicationState('UNDERWRITING')).toBe('Underwriting');
});

it('formats MYR with no decimal places', () => {
  expect(formatMyr(500000)).toMatch(/RM\s?500,000/);
});

it('maps terminal and rejected states to negative tone', () => {
  expect(getApplicationStateTone('REJECTED')).toBe('neg');
  expect(getApplicationStateTone('APPROVED')).toBe('pos');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/borrowerPresentation.test.ts`

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Implement the helpers**

Move the page-local date and currency behavior into this module, preserve `en-MY`, use a single application/product label map, and return an em dash for null/invalid values. Keep the module free of React and browser state.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/borrowerPresentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the presentation helpers**

```bash
git add frontend/src/components/credit/borrower360/borrowerPresentation.ts frontend/src/components/credit/borrower360/__tests__/borrowerPresentation.test.ts frontend/src/components/credit/borrower360/Borrower360Header.tsx
git commit -m "refactor(credit): centralize borrower workspace presentation"
```

---

## Task 3: Build the RM workspace header and readiness components

**Files:**
- Create: `frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx`
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceHeader.test.tsx`
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerReadinessStrip.test.tsx`
- Modify: `frontend/src/components/credit/borrower360/primitives.tsx` only if a missing accessible primitive is required.

**Interfaces:**

```ts
interface BorrowerWorkspaceHeaderProps {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  primaryAction: { label: string; applicationId: string | null };
  canWrite: boolean;
  canCreate: boolean;
  onPrimaryAction: () => void;
  onEdit: () => void;
  onUploadBureau: () => void;
  onRunKyc: () => void;
  onRecalculateRisk: () => void;
}

interface BorrowerReadinessStripProps {
  readiness: BorrowerReadiness;
  onAction: (action: BorrowerNextAction) => void;
}
```

- [ ] **Step 1: Write failing component tests**

Test the rendered behavior, not implementation details:

```tsx
it('shows borrower identity and Continue application for a draft', () => {
  render(<BorrowerWorkspaceHeader {...propsForDraftApplication()} />);
  expect(screen.getByRole('heading', { name: /Ahmad bin Rahman/i })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Continue application' })).toBeVisible();
});

it('hides write actions for read-only users', () => {
  render(<BorrowerWorkspaceHeader {...propsForReadOnly()} />);
  expect(screen.queryByRole('button', { name: 'Edit borrower' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Verify KYC' })).not.toBeInTheDocument();
});

it('renders readiness status, count, and action label', () => {
  render(<BorrowerReadinessStrip readiness={blockedReadiness()} onAction={vi.fn()} />);
  expect(screen.getByText('Not ready')).toBeVisible();
  expect(screen.getByText(/3 items need attention/i)).toBeVisible();
  expect(screen.getByRole('button', { name: /Upload bureau report/i })).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerWorkspaceHeader.test.tsx src/components/credit/borrower360/__tests__/BorrowerReadinessStrip.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the header**

Render breadcrumb, display name, borrower number/registration number, type/segment, KYC/risk/bureau badges, relationship owner/contact context, and one prominent primary button. Put secondary controls in a compact `More actions` menu or secondary group. Wire explicit button names and preserve permission-gated visibility.

- [ ] **Step 4: Implement the readiness strip**

Render status text, completion percentage, outstanding count, and the first blocker explanation. Render action buttons from `readiness.actions`; invoke `onAction` with the complete typed action object. Use `aria-live="polite"` for status updates and ensure severity is conveyed by text/icon as well as tone.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerWorkspaceHeader.test.tsx src/components/credit/borrower360/__tests__/BorrowerReadinessStrip.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the header and readiness UI**

```bash
git add frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceHeader.test.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerReadinessStrip.test.tsx frontend/src/components/credit/borrower360/primitives.tsx
git commit -m "feat(credit): add RM borrower workspace header and readiness"
```

---

## Task 4: Build next actions, relationship, exposure, application, and activity cards

**Files:**
- Create: `frontend/src/components/credit/borrower360/BorrowerNextActions.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerRelationshipSnapshot.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerExposureSnapshot.tsx`
- Create: `frontend/src/components/credit/borrower360/BorrowerActivityTimeline.tsx`
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerNextActions.test.tsx`
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx`
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

**Interfaces:**

```ts
interface BorrowerNextActionsProps {
  actions: BorrowerNextAction[];
  onAction: (action: BorrowerNextAction) => void;
}

interface BorrowerApplicationSummaryProps {
  applications: CreditApplication[];
}

interface BorrowerRelationshipSnapshotProps {
  profile: BorrowerProfile;
}

interface BorrowerExposureSnapshotProps {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  onViewExposure: () => void;
}

interface BorrowerActivityTimelineProps {
  activity: Borrower360Activity[];
}
```

- [ ] **Step 1: Write failing tests for action ordering and application cards**

```tsx
it('renders blockers before warnings and invokes the selected action', async () => {
  const onAction = vi.fn();
  render(<BorrowerNextActions actions={[warningAction(), blockerAction()]} onAction={onAction} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons[0]).toHaveAccessibleName(blockerAction().actionLabel);
  await userEvent.click(buttons[0]);
  expect(onAction).toHaveBeenCalledWith(blockerAction());
});

it('links a draft application to its existing application detail route', () => {
  render(<BorrowerApplicationSummary applications={[draftApplication()]} />);
  expect(screen.getByRole('link', { name: /Continue/i })).toHaveAttribute('href', '/credit/applications/draft-1');
});

it('renders a direct start link when there are no applications', () => {
  render(<BorrowerApplicationSummary applications={[]} />);
  expect(screen.getByText(/No applications yet/i)).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerNextActions.test.tsx src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the action list and application summary**

Use a semantic list for actions, sort by the already-defined severity order, render title/description/action label, and keep completed actions visually distinct. For applications, use `Link` to `/credit/applications/${application.id}`, render application number/product/requested amount/state/updated timestamp, and use `formatApplicationState`/`formatProductType`.

- [ ] **Step 4: Implement relationship, exposure, and activity cards**

Use profile fields already returned by `getBorrowerProfile`. The relationship card must gracefully handle missing owner and CRM links. The exposure card must show total exposure, exposure limit when present, active applications, and facility count, with a button that switches to the Exposure tab. The activity timeline should reuse the event icon/tone mapping currently embedded in `RetailOverview` and `CorporateOverview`, and render a neutral empty state.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerNextActions.test.tsx src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the workspace cards**

```bash
git add frontend/src/components/credit/borrower360/BorrowerNextActions.tsx frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx frontend/src/components/credit/borrower360/BorrowerRelationshipSnapshot.tsx frontend/src/components/credit/borrower360/BorrowerExposureSnapshot.tsx frontend/src/components/credit/borrower360/BorrowerActivityTimeline.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerNextActions.test.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx
git commit -m "feat(credit): add borrower workspace action and context cards"
```

---

## Task 5: Compose the RM overview and preserve detailed borrower views

**Files:**
- Create: `frontend/src/components/credit/borrower360/BorrowerOverview.tsx`
- Modify: `frontend/src/components/credit/borrower360/RetailOverview.tsx`
- Modify: `frontend/src/components/credit/borrower360/CorporateOverview.tsx`
- Modify: `frontend/src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

**Interfaces:**

```ts
interface BorrowerOverviewProps {
  profile: BorrowerProfile;
  summary: Borrower360Summary | null;
  applications: CreditApplication[];
  readiness: BorrowerReadiness;
  activity: Borrower360Activity[];
  canWrite: boolean;
  onAction: (action: BorrowerNextAction) => void;
  onEditIncome: () => void;
  onViewExposure: () => void;
}
```

- [ ] **Step 1: Add failing composition tests**

```tsx
it('places readiness and next actions before detailed cards', () => {
  render(<BorrowerOverview {...retailOverviewProps()} />);
  const main = screen.getByRole('region', { name: /borrower overview/i });
  expect(main.textContent?.indexOf('Next actions')).toBeLessThan(main.textContent?.indexOf('Income vs Commitment') ?? Infinity);
});

it('renders corporate relationship and business context without retail income editor', () => {
  render(<BorrowerOverview {...corporateOverviewProps()} />);
  expect(screen.getByText(/Business information/i)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Edit income/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

Expected: FAIL because the new composition does not exist.

- [ ] **Step 3: Implement `BorrowerOverview`**

Compose the page in this order:

1. `BorrowerReadinessStrip`.
2. Two-column `BorrowerNextActions` and `BorrowerApplicationSummary`.
3. Two-column `BorrowerRelationshipSnapshot` and `BorrowerExposureSnapshot`.
4. `BorrowerActivityTimeline`.
5. Retail/corporate detailed overview content where appropriate.

Use a labelled `<section aria-labelledby="borrower-overview-heading">` and keep the first-view layout responsive from one to two columns.

- [ ] **Step 4: Remove duplicated first-view content from detailed overviews**

Keep `RetailOverview`’s income/commitment and debt breakdown content and `CorporateOverview`’s risk/business content available for the overview, but remove their duplicate alert and recent-activity blocks when those blocks are rendered through `BorrowerOverview`. Pass action callbacks from the new action list for bureau and income updates.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the overview composition**

```bash
git add frontend/src/components/credit/borrower360/BorrowerOverview.tsx frontend/src/components/credit/borrower360/RetailOverview.tsx frontend/src/components/credit/borrower360/CorporateOverview.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx
git commit -m "feat(credit): compose RM borrower workspace overview"
```

---

## Task 6: Integrate the workspace into the borrower detail route

**Files:**
- Modify: `frontend/pages/BorrowerProfileDetail.tsx`
- Modify: `frontend/src/services/credit.service.ts:1290-1300`
- Modify: `frontend/src/components/credit/borrower360/Borrower360Header.tsx` only if it is removed from the route and no longer has consumers.

**Interfaces:**

- Consumes: `BorrowerOverview`, `BorrowerWorkspaceHeader`, `BorrowerReadinessStrip` indirectly, `calculateBorrowerReadiness`, `getPrimaryApplicationAction`, `creditService.listApplications({ borrowerProfileId })`.
- Produces: a borrower detail route that loads profile, summary, activity, and borrower-filtered applications; preserves modal callbacks and tab-only exposure loading.

- [ ] **Step 1: Add route-level test coverage for the new data flow**

Extend or create a route test with mocked service calls that verifies:

```tsx
expect(creditService.listApplications).toHaveBeenCalledWith(expect.objectContaining({ borrowerProfileId: 'borrower-1', page: 1, limit: 20 }));
expect(screen.getByRole('button', { name: 'Start application' })).toBeVisible();
```

Also verify a service failure renders a retry state and does not navigate away from the borrower URL.

- [ ] **Step 2: Run the route test and verify it fails**

Run: `cd frontend && npm test -- pages/__tests__/BorrowerProfileDetail.test.tsx`

Expected: FAIL if the test file is new; if an existing route test is used, it must fail on the missing application call and new accessible action.

- [ ] **Step 3: Load borrower-filtered applications**

In `BorrowerProfileDetail`, add `applications` state and include this call in the initial `Promise.all`:

```ts
creditService.listApplications({ borrowerProfileId: id, page: 1, limit: 20, sortBy: 'updatedAt', sortDir: 'desc' })
```

Store `applicationData.applications`. Do not fetch exposure until the Exposure tab is active, preserving the existing lazy behavior.

If a read-only RM scope returns an empty application list, render the empty state; do not infer that no application exists from a failed request.

- [ ] **Step 4: Add URL-backed tab state**

Use `useSearchParams` and define:

```ts
const DETAIL_TABS = ['overview', 'applications', 'profile', 'financials', 'exposure', 'risk', 'documents'] as const;
type DetailTab = typeof DETAIL_TABS[number];
```

Initialize from `tab`, fall back to `overview` for invalid values, and update `tab` without replacing the borrower path. Preserve the existing conditional omission of Financials for individual borrowers only if that tab is truly unsupported; otherwise render the income view under Financials for individuals and keep the URL stable.

- [ ] **Step 5: Replace the old first-view header/KPI/overview composition**

Render `BorrowerWorkspaceHeader` and `BorrowerOverview` for the Overview tab. Calculate readiness with the pure module after profile/summary/applications are loaded. Keep existing profile, risk, bureau, documents, financials, and exposure tab contents intact until their navigation labels are updated.

Wire action targets:

- `profile` → set tab to `profile`.
- `income` → open `IncomeEditModal`.
- `bureau` → open `BureauUploadModal`.
- `documents` → set tab to `documents`.
- `risk` → set tab to `risk`.
- `application` → navigate to the selected application or `/credit/applications/new?borrowerId=${profile.id}`.

Use `canWrite` and `canCreate` separately; do not let `canWrite` alone control the primary application action.

- [ ] **Step 6: Run route tests and verify they pass**

Run: `cd frontend && npm test -- pages/__tests__/BorrowerProfileDetail.test.tsx`

Expected: PASS with application loading, readiness, primary action, tab URL, and retry behavior covered.

- [ ] **Step 7: Commit route integration**

```bash
git add frontend/pages/BorrowerProfileDetail.tsx frontend/src/services/credit.service.ts frontend/src/components/credit/borrower360/Borrower360Header.tsx frontend/pages/__tests__/BorrowerProfileDetail.test.tsx
git commit -m "feat(credit): integrate RM borrower workspace into detail route"
```

---

## Task 7: Complete responsive and accessibility behavior

**Files:**
- Modify: `frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx`
- Modify: `frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx`
- Modify: `frontend/src/components/credit/borrower360/BorrowerNextActions.tsx`
- Modify: `frontend/src/components/credit/borrower360/BorrowerOverview.tsx`
- Modify: `frontend/src/styles/credit-tokens.css` only for a narrowly scoped workspace utility that cannot be expressed with existing tokens/classes.
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceAccessibility.test.tsx`

- [ ] **Step 1: Write accessibility assertions**

```tsx
it('exposes selected tab and named primary actions', () => {
  render(<BorrowerWorkspaceHarness />);
  expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: 'Start application' })).toBeEnabled();
});

it('does not rely on tone alone for a blocked readiness state', () => {
  render(<BorrowerReadinessStrip readiness={blockedReadiness()} onAction={vi.fn()} />);
  expect(screen.getByText('Not ready')).toBeVisible();
  expect(screen.getByText(/items need attention/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerWorkspaceAccessibility.test.tsx`

Expected: FAIL until ARIA attributes and responsive semantics are complete.

- [ ] **Step 3: Implement responsive layout and semantics**

Use a two-column grid at `lg`/`xl`, collapse to one column below that breakpoint, keep action buttons reachable without horizontal scrolling, add `aria-selected`/`role="tab"`/`role="tabpanel"`, add `aria-live="polite"` to readiness updates, and ensure all icon-only controls have labels or `aria-hidden` decorative icons.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `cd frontend && npm test -- src/components/credit/borrower360/__tests__/BorrowerWorkspaceAccessibility.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit accessibility and responsive behavior**

```bash
git add frontend/src/components/credit/borrower360/BorrowerWorkspaceHeader.tsx frontend/src/components/credit/borrower360/BorrowerReadinessStrip.tsx frontend/src/components/credit/borrower360/BorrowerNextActions.tsx frontend/src/components/credit/borrower360/BorrowerOverview.tsx frontend/src/styles/credit-tokens.css frontend/src/components/credit/borrower360/__tests__/BorrowerWorkspaceAccessibility.test.tsx
git commit -m "fix(credit): make borrower workspace responsive and accessible"
```

---

## Task 8: Add RM end-to-end coverage and run verification

**Files:**
- Create: `frontend/e2e/credit/borrower-workspace.spec.ts`
- Modify: `frontend/e2e/credit/render-smoke-detail.spec.ts` if accessible selectors or content assertions changed.

- [ ] **Step 1: Write the end-to-end journey**

Use the existing `STATE_FILES` and seeded-data discovery pattern from `render-smoke-detail.spec.ts`:

```ts
test('RM sees borrower readiness and next actions', async ({ page }) => {
  await openFirstBorrower(page);
  await expect(page.getByRole('heading', { name: /borrower/i })).toBeVisible();
  await expect(page.getByText(/borrower readiness/i)).toBeVisible();
  await expect(page.getByText(/next actions/i)).toBeVisible();
});

test('borrower detail preserves the selected tab in the URL', async ({ page }) => {
  await openFirstBorrower(page);
  await page.getByRole('tab', { name: 'Documents' }).click();
  await expect(page).toHaveURL(/tab=documents/);
  await expect(page.getByRole('tabpanel')).toContainText(/documents/i);
});

test('read-only credit user cannot see borrower write actions', async ({ page }) => {
  await openFirstBorrower(page, STATE_FILES.sodAnalyst);
  await expect(page.getByRole('button', { name: 'Edit borrower' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Verify KYC' })).toHaveCount(0);
});
```

The helper must click the borrower name button from `/credit/borrowers`, as the existing borrower list opens a quick preview when the row itself is clicked.

- [ ] **Step 2: Run the credit E2E spec**

Run: `cd frontend && npm run test:e2e:credit -- e2e/credit/borrower-workspace.spec.ts`

Expected: PASS with seeded borrower data. If the environment has no seeded rows, fail loudly with the existing seed instruction rather than skipping.

- [ ] **Step 3: Run the existing borrower render smoke**

Run: `cd frontend && npm run test:e2e:credit -- e2e/credit/render-smoke-detail.spec.ts`

Expected: PASS for application detail, borrower detail, and mobile approval coverage; borrower detail has no uncaught page errors.

- [ ] **Step 4: Run frontend unit tests and build**

Run: `cd frontend && npm test`

Expected: PASS with no regressions in existing credit components.

Run: `cd frontend && npm run build`

Expected: PASS with TypeScript/Vite compilation successful.

- [ ] **Step 5: Run token and diff checks**

Run: `cd frontend && npm run check:tokens`

Expected: PASS with no unregistered credit token usage.

Run: `git diff --check HEAD~8..HEAD`

Expected: no whitespace errors.

- [ ] **Step 6: Commit E2E coverage and final verification changes**

```bash
git add frontend/e2e/credit/borrower-workspace.spec.ts frontend/e2e/credit/render-smoke-detail.spec.ts
git commit -m "test(credit): cover RM borrower workspace journey"
```

---

## Plan self-review checklist

- Design goal is covered by Tasks 1, 3, 4, 5, and 6.
- Readiness status and direct next actions are covered by Tasks 1 and 3.
- Active applications are covered by Tasks 4 and 6 using the existing `borrowerProfileId` filter.
- Relationship and exposure snapshots are covered by Task 4.
- Detailed tabs and URL state are preserved by Task 6.
- Permissions, PII, and approval boundaries are covered by Tasks 3, 6, and 8.
- Responsive and accessibility requirements are covered by Task 7.
- Unit, component, E2E, build, token, and diff verification are covered by Tasks 1–8.
- No new backend endpoint, schema migration, application detail redesign, or unrelated refactor is included.
- No placeholder steps remain; every implementation task names files, interfaces, tests, commands, and expected outcomes.
