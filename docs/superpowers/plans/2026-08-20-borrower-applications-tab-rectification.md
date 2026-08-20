# Borrower Applications Tab Rectification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the borrower Applications tab use the same compact application presentation as Overview, provide a useful empty state, and request a supported newest-first sort.

**Architecture:** Keep one borrower-scoped application fetch in `BorrowerProfileDetail`. Make `BorrowerApplicationSummary` the shared presentation component for both Overview and the Applications tab, adding an optional create action for the empty state. Preserve backend RM scope and filtering; change only the unsupported frontend sort parameter.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind utility classes, Vitest, Testing Library, Playwright.

## Global Constraints

- Keep borrower filtering and RM row-level access unchanged.
- Do not add application records, alter seed ownership, or change application visibility rules.
- Keep the Applications tab as a compact list; do not replace it with a full data table.
- Write each behavior test before its production change and verify the test fails first.
- Preserve unrelated user worktree changes.

---

### Task 1: Add failing shared-application-summary tests

**Files:**
- Create: `frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx`
- Reference: `frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx`

**Interfaces:**
- Consumes the existing `CreditApplication` shape and a new optional `onStartApplication?: () => void` prop.
- Produces the tested shared empty state and application-row presentation used by Overview and the Applications tab.

- [ ] **Step 1: Write the failing tests**

Create tests with the existing Vitest/Testing Library conventions:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BorrowerApplicationSummary from '../BorrowerApplicationSummary';

const renderSummary = (applications: any[], onStartApplication?: () => void) =>
  render(
    <MemoryRouter>
      <BorrowerApplicationSummary applications={applications} onStartApplication={onStartApplication} />
    </MemoryRouter>,
  );

describe('BorrowerApplicationSummary', () => {
  it('renders a clear empty state and start action when supplied', () => {
    const onStartApplication = vi.fn();
    renderSummary([], onStartApplication);

    expect(screen.getByRole('heading', { name: 'Applications' })).toBeVisible();
    expect(screen.getByText('No applications yet.')).toBeVisible();
    screen.getByRole('button', { name: /start application/i }).click();
    expect(onStartApplication).toHaveBeenCalledOnce();
  });

  it('renders application details and links to the application workspace', () => {
    renderSummary([{
      id: 'app-1', applicationNo: 'CA-2026-00001', productType: 'TERM_LOAN',
      state: 'UNDERWRITING', requestedAmount: 500000,
      updatedAt: '2026-08-20T00:00:00.000Z',
    }]);

    expect(screen.getByRole('link', { name: 'CA-2026-00001' })).toHaveAttribute('href', '/credit/applications/app-1');
    expect(screen.getByText(/term loan/i)).toBeVisible();
    expect(screen.getByText(/underwriting/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run from `frontend/`:

```bash
npm test -- src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx
```

Expected: FAIL because `BorrowerApplicationSummary` does not yet accept or render `onStartApplication`, and the new row assertions establish the required shared behavior.

- [ ] **Step 3: Commit the failing-test checkpoint**

```bash
git add -- frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx
git commit -m "test: define borrower application summary states"
```

### Task 2: Implement the shared presentation and page integration

**Files:**
- Modify: `frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx`
- Modify: `frontend/pages/BorrowerProfileDetail.tsx:127-146,253-258`
- Modify: `frontend/src/components/credit/borrower360/BorrowerOverview.tsx:20-30`

**Interfaces:**
- `BorrowerApplicationSummary` accepts `{ applications: CreditApplication[]; onStartApplication?: () => void }`.
- `BorrowerOverview` accepts the existing application array and continues to render the shared summary without changing its public prop contract.
- `BorrowerProfileDetail` passes `onStartApplication={() => navigate(`/credit/applications/new?borrowerId=${profile.id}`)}` only when `canCreate` is true.

- [ ] **Step 1: Extend the summary component minimally**

Keep the current card, status-pills, currency/date formatting, and application links. Add an optional callback and render a compact button in the empty state only when it exists:

```tsx
export const BorrowerApplicationSummary: React.FC<{
  applications: CreditApplication[];
  onStartApplication?: () => void;
}> = ({ applications, onStartApplication }) => (
  <section aria-labelledby="borrower-applications-heading" className="rounded-fc border border-fc-outline bg-fc-surface p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id="borrower-applications-heading" className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Applications</h2>
      <span className="text-xs text-fc-on-variant">{applications.length} total</span>
    </div>
    {applications.length === 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fc-on-variant">No applications yet.</p>
        {onStartApplication ? <button type="button" onClick={onStartApplication} className="rounded-fc border border-fc-primary px-3 py-2 text-xs font-semibold text-fc-primary">Start application</button> : null}
      </div>
    ) : (
      <ul className="space-y-3">{/* existing mapped rows */}</ul>
    )}
  </section>
);
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```bash
npm test -- src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx
```

Expected: PASS with both tests green.

- [ ] **Step 3: Replace the Applications-tab duplicate markup**

In `BorrowerProfileDetail`, retain the existing error panel, then render `BorrowerApplicationSummary` for the successful result. Pass the create callback only when `canCreate` is true. Keep the existing `role="tabpanel"` and `aria-label="Applications"` wrapper so URL/tab behavior remains unchanged.

- [ ] **Step 4: Change the fetch request to a supported sort field**

Replace the unsupported request:

```ts
sortBy: 'updatedAt'
```

with:

```ts
sortBy: 'createdAt'
```

and retain `sortDir: 'desc'`. Do not modify the backend sort map or RM scope behavior.

- [ ] **Step 5: Run the component and existing borrower-workspace tests**

Run from `frontend/`:

```bash
npm test -- src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx
```

Expected: PASS, with Overview still showing the application summary and the Applications tab using the same component.

- [ ] **Step 6: Commit the implementation**

```bash
git add -- frontend/pages/BorrowerProfileDetail.tsx frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx frontend/src/components/credit/borrower360/BorrowerOverview.tsx frontend/src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx
git commit -m "fix: align borrower applications tab with overview"
```

### Task 3: Verify end-to-end borrower tab behavior and repository health

**Files:**
- Modify only if assertions need adjustment: `frontend/e2e/credit/borrower-workspace.spec.ts`
- Do not modify backend application filtering files.

**Interfaces:**
- Browser behavior must preserve `/credit/borrowers/:id?tab=applications` and expose the Applications tab panel.
- The API response remains the source of truth for visible application count; no client-side bypass may be added.

- [ ] **Step 1: Add a browser assertion for the shared empty-state wording**

Extend the existing borrower workspace test only if the demo fixture used by the test has no visible applications:

```ts
await page.getByRole('tab', { name: 'Applications' }).click();
await expect(page.getByRole('tabpanel', { name: 'Applications' })).toContainText(/applications/i);
```

If the fixture contains applications, assert the application link or count instead of forcing an empty result. Keep the test data-agnostic and do not seed or delete records in the test.

- [ ] **Step 2: Run the focused frontend suite and build**

Run from `frontend/`:

```bash
npm test -- src/components/credit/borrower360/__tests__/BorrowerApplicationSummary.test.tsx src/components/credit/borrower360/__tests__/BorrowerOverview.test.tsx
npm run build
```

Expected: both test files pass and the Vite production build completes successfully.

- [ ] **Step 3: Run the existing backend application-list regression test**

Run from `backend/`:

```bash
npm test -- src/credit/services/__tests__/creditApplication.list.test.ts
```

Expected: the existing borrower/filter/sort service contract passes unchanged, confirming the rectification did not alter backend access rules.

- [ ] **Step 4: Review the final diff and working tree**

Run from the repository root:

```bash
git diff --check
git status --short --branch
git diff HEAD~1 -- frontend/pages/BorrowerProfileDetail.tsx frontend/src/components/credit/borrower360/BorrowerApplicationSummary.tsx frontend/src/components/credit/borrower360/BorrowerOverview.tsx
```

Expected: no whitespace errors; only the intended implementation files are in the rectification commit, while pre-existing user changes remain identifiable and untouched.

