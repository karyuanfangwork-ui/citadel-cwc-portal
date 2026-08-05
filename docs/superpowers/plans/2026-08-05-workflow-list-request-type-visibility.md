# Workflow List Request Type Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each workflow's bound request type names on the `/admin/workflows` cards and let admins filter the grid by request type name, so it is obvious which workflow governs e.g. Purchase Requisition.

**Architecture:** Purely presentational, front-end only. `WorkflowSummary.requestTypes` is already `{ id, name }[]` in the API payload; today the card renders only `.length`. Task 1 renders the names as chips inside `WorkflowListCard`. Task 2 adds a client-side search box to the `WorkflowList` page that matches workflow code, workflow name, and request type name. No backend, service, hook, or type changes.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes with literal hex colors, React Router v7, Vitest + React Testing Library (jsdom).

## Global Constraints

- No backend, API, Prisma, service-layer, or type-definition changes. `RequestTypeSummary.name` already exists in `frontend/src/services/workflow-version.service.ts`.
- Vitest only collects tests matching `include: ['src/**/*.{test,spec}.{ts,tsx}']` (see `frontend/vite.config.ts`). Every test file must live under `frontend/src/`, even when the component under test lives in `frontend/pages/`.
- All commands run from the `frontend/` directory.
- Styling matches the surrounding file: Tailwind classes with literal hex colors (e.g. `text-[#44546f]`), no theme tokens, no new CSS files.
- Chip cap is exactly 3 visible names; the rest collapse into one `+N more` pill.
- Copy strings, verbatim: `Not bound to any request type`, `Search workflows or request types`, `Clear search`.
- Components in this codebase are written with dense single-line JSX for wrapper elements. Follow the existing density of the file you are editing; do not reformat untouched lines.

---

### Task 1: Request type chips on the workflow card

Replaces the self-restating count line (`Bound request types: 2 · affects 2 request types`) with the actual request type names, and flags workflows bound to nothing.

**Files:**
- Modify: `frontend/src/components/workflow/WorkflowListCard.tsx:23-26` (the `<p>` holding the count)
- Create: `frontend/src/components/workflow/__tests__/WorkflowListCard.test.tsx`
- Modify: `frontend/src/pages/__tests__/WorkflowList.test.tsx:21` (existing assertion on the removed copy)

**Interfaces:**
- Consumes: `WorkflowSummary` and `RequestTypeSummary` from `frontend/src/services/workflow-version.service.ts`. `RequestTypeSummary` is `{ id: string; name: string }`. `WorkflowListCard` keeps its current props exactly: `{ workflow: WorkflowSummary; onCreateDraft: (workflow: WorkflowSummary) => void }`.
- Produces: a chip container with `data-testid="workflow-request-types"` on every card. Task 2 does not depend on this markup, only on the names being rendered somewhere in the card.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/workflow/__tests__/WorkflowListCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkflowListCard from '../WorkflowListCard';
import type { RequestTypeSummary, WorkflowSummary } from '../../../services/workflow-version.service';

const types = (...names: string[]): RequestTypeSummary[] =>
  names.map((name, index) => ({ id: `rt-${index}`, name }));

const workflow = (requestTypes: RequestTypeSummary[]): WorkflowSummary => ({
  id: 'wt-1',
  code: 'IT_PROCUREMENT',
  name: 'IT Procurement',
  requestTypes,
  activeVersion: { id: 'v-1', version: 1, status: 'ACTIVE', publishedAt: null },
  draftVersion: null,
});

const renderCard = (requestTypes: RequestTypeSummary[]) =>
  render(
    <MemoryRouter>
      <WorkflowListCard workflow={workflow(requestTypes)} onCreateDraft={vi.fn()} />
    </MemoryRouter>,
  );

describe('WorkflowListCard', () => {
  it('names each bound request type instead of only counting them', () => {
    renderCard(types('Purchase Requisition', 'Hardware Request'));
    expect(screen.getByText('Purchase Requisition')).toBeInTheDocument();
    expect(screen.getByText('Hardware Request')).toBeInTheDocument();
    expect(screen.queryByText(/affects/)).not.toBeInTheDocument();
  });

  it('collapses more than three request types into a titled overflow pill', () => {
    renderCard(types('One', 'Two', 'Three', 'Four', 'Five'));
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.queryByText('Four')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toHaveAttribute('title', 'Four, Five');
  });

  it('flags a workflow that is bound to nothing', () => {
    renderCard([]);
    expect(screen.getByText('Not bound to any request type')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/workflow/__tests__/WorkflowListCard.test.tsx`

Expected: FAIL. All three tests fail — the card currently renders `Bound request types: 2 · affects 2 request types`, so `getByText('Purchase Requisition')` finds nothing and `queryByText(/affects/)` finds a match.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/workflow/WorkflowListCard.tsx`, add these two derived values immediately after the existing `const draft = workflow.draftVersion;` line:

```tsx
  const visibleTypes = workflow.requestTypes.slice(0, 3);
  const overflowTypes = workflow.requestTypes.slice(3);
```

Then replace the whole `<p className="mt-4 ...">…</p>` block (lines 23-26) with:

```tsx
      <div className="mt-4 flex flex-wrap items-center gap-1.5" data-testid="workflow-request-types">
        {workflow.requestTypes.length === 0 && (
          <span className="rounded-full border border-dashed border-[#e0c48a] px-2.5 py-1 text-xs font-semibold text-[#8a5a00]">
            Not bound to any request type
          </span>
        )}
        {visibleTypes.map((requestType) => (
          <span key={requestType.id} className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-xs font-semibold text-[#44546f]">
            {requestType.name}
          </span>
        ))}
        {overflowTypes.length > 0 && (
          <span
            className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-xs font-semibold text-[#8993a4]"
            title={overflowTypes.map((requestType) => requestType.name).join(', ')}
          >
            +{overflowTypes.length} more
          </span>
        )}
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/workflow/__tests__/WorkflowListCard.test.tsx`

Expected: PASS, 3 tests.

- [ ] **Step 5: Fix the pre-existing assertion this change invalidates**

`frontend/src/pages/__tests__/WorkflowList.test.tsx` line 21 asserts the copy just deleted:

```tsx
    expect(screen.getByText(/affects\s+2\s+request type/)).toBeInTheDocument();
```

Replace that single line with assertions on the new chips (the fixture on line 13 binds `Hardware` and `Access`):

```tsx
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
```

- [ ] **Step 6: Run the full workflow test suite to confirm nothing else asserted the old copy**

Run: `npm test -- src/pages/__tests__/WorkflowList.test.tsx src/components/workflow`

Expected: PASS. If any other test fails on the removed `affects N request type` string, update it the same way — assert the request type names from that test's own fixture.

- [ ] **Step 7: Commit**

```bash
git add src/components/workflow/WorkflowListCard.tsx src/components/workflow/__tests__/WorkflowListCard.test.tsx src/pages/__tests__/WorkflowList.test.tsx
git commit -m "feat(workflow): name bound request types on workflow cards"
```

---

### Task 2: Filter the grid by request type name

Adds the reverse lookup: an admin who knows only "Purchase Requisition" types it and the grid narrows to the governing workflow.

**Files:**
- Modify: `frontend/pages/WorkflowList.tsx` (header block on line 33, and the three render branches on lines 36-37)
- Modify: `frontend/src/pages/__tests__/WorkflowList.test.tsx` (add a describe block; the file already mocks the service)

**Interfaces:**
- Consumes: `useWorkflowVersions()` from `frontend/src/hooks/useWorkflowVersions.ts`, returning `{ workflows: WorkflowSummary[]; loading: boolean; error: string | null; reload: () => Promise<void> }`. Unchanged. The card chips from Task 1 are already rendering.
- Produces: nothing consumed by later tasks. This is the final task.

- [ ] **Step 1: Write the failing test**

Append this describe block to `frontend/src/pages/__tests__/WorkflowList.test.tsx`, after the existing `describe('WorkflowList', …)` block. It declares its own two-workflow fixture so it does not disturb the existing single-workflow `beforeEach`:

```tsx
const procurement = { id: 'wt-2', code: 'IT_PROCUREMENT', name: 'IT Procurement', requestTypes: [{ id: 'rt-9', name: 'Purchase Requisition' }], activeVersion: { id: 'v-9', version: 1, status: 'ACTIVE' as const, publishedAt: null }, draftVersion: null };

describe('WorkflowList search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listWorkflows.mockResolvedValue({ workflows: [workflow, procurement] });
  });

  const search = () => screen.getByRole('searchbox', { name: 'Search workflows or request types' });

  it('filters by request type name', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    expect(await screen.findByText('IT Simple')).toBeInTheDocument();
    await user.type(search(), 'purchase');
    expect(screen.getByText('IT Procurement')).toBeInTheDocument();
    expect(screen.queryByText('IT Simple')).not.toBeInTheDocument();
  });

  it('filters by workflow code', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    await user.type(await screen.findByRole('searchbox', { name: 'Search workflows or request types' }), 'IT_SIMPLE');
    expect(screen.getByText('IT Simple')).toBeInTheDocument();
    expect(screen.queryByText('IT Procurement')).not.toBeInTheDocument();
  });

  it('offers a distinct empty state that clears the query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    await user.type(await screen.findByRole('searchbox', { name: 'Search workflows or request types' }), 'nothing matches this');
    expect(screen.getByText('No workflows match "nothing matches this"')).toBeInTheDocument();
    expect(screen.queryByText('No active workflows')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('IT Simple')).toBeInTheDocument();
    expect(search()).toHaveValue('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/WorkflowList.test.tsx`

Expected: FAIL. The three new tests fail on `getByRole('searchbox', …)` — no search input exists yet. The two original tests still pass.

- [ ] **Step 3: Add the query state and derived list**

In `frontend/pages/WorkflowList.tsx`, add the state next to the existing `useState` calls (after line 13's `createError` state):

```tsx
  const [query, setQuery] = useState('');
```

Then, after the `createDraft` function and before the `return`, add:

```tsx
  const trimmedQuery = query.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(trimmedQuery);
  const visible = trimmedQuery
    ? workflows.filter((workflow) => matches(workflow.code) || matches(workflow.name) || workflow.requestTypes.some((requestType) => matches(requestType.name)))
    : workflows;
```

- [ ] **Step 4: Add the search input to the header**

In the header `<div>` on line 33, insert this block between the closing `</div>` of the title group and the legacy-config `<Link>`:

```tsx
<div className="w-full max-w-xs"><label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-[#8993a4]" htmlFor="workflow-search">Search</label><input aria-label="Search workflows or request types" className="w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm text-[#101418] placeholder:text-[#8993a4] focus:border-[#0052cc] focus:outline-none" id="workflow-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows or request types" type="search" value={query} /></div>
```

Two accessibility details the tests depend on, so do not simplify them away:

- `type="search"` gives the input the `searchbox` role, which is what `getByRole('searchbox', …)` matches. Changing it to `type="text"` breaks all three tests.
- The visible `<label>` reads `Search`, which is too vague to be the accessible name, so `aria-label="Search workflows or request types"` supplies the full name and wins over the label. The `htmlFor`/`id` pairing stays for pointer users clicking the label.

- [ ] **Step 5: Switch the render branches to the filtered list**

Replace the two branches on lines 36-37 (the `workflows.length === 0` empty state and the grid) with three branches. The order matters: the no-data state must win over the no-match state.

```tsx
        {!loading && !error && workflows.length === 0 && <div className="rounded-2xl border border-dashed border-[#c9d4e5] bg-white p-10 text-center"><h2 className="text-lg font-bold text-[#101418]">No active workflows</h2><p className="mt-2 text-sm text-[#44546f]">There are no workflow types available for administration.</p></div>}
        {!loading && !error && workflows.length > 0 && visible.length === 0 && <div className="rounded-2xl border border-dashed border-[#c9d4e5] bg-white p-10 text-center"><h2 className="text-lg font-bold text-[#101418]">No workflows match "{query.trim()}"</h2><p className="mt-2 text-sm text-[#44546f]">Try a workflow name, its code, or a request type it governs.</p><button className="mt-4 rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white" onClick={() => setQuery('')}>Clear search</button></div>}
        {!loading && !error && visible.length > 0 && <div className="grid gap-5 lg:grid-cols-2">{visible.map((workflow) => <WorkflowListCard key={workflow.id} workflow={workflow} onCreateDraft={(item) => { setSelected(item); setCreateError(null); }} />)}</div>}
```

Note the heading interpolates `query.trim()`, not `trimmedQuery` — the displayed query keeps the admin's original casing while matching stays case-insensitive.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/pages/__tests__/WorkflowList.test.tsx`

Expected: PASS, 5 tests (2 original + 3 new).

- [ ] **Step 7: Typecheck and run the full frontend suite**

Run: `npm run build && npm test`

Expected: build succeeds; the test suite shows no new failures versus the pre-change baseline. If the suite had failures before this work, compare against that baseline rather than requiring a fully green run — and report any pre-existing failures instead of fixing them here.

- [ ] **Step 8: Commit**

```bash
git add pages/WorkflowList.tsx src/pages/__tests__/WorkflowList.test.tsx
git commit -m "feat(workflow): filter workflow list by request type name"
```

---

## Verification

Manual check, after both tasks:

1. `npm run dev` from `frontend/`, log in as `admin@test.local` / `abc@123`.
2. Visit `http://localhost:5173/admin/workflows`.
3. Each card names its request types instead of counting them. `IT_PROCUREMENT` and `IT_HARDWARE_PROCUREMENT` are now distinguishable at a glance.
4. Type `purchase` in the search box — the grid narrows to the workflow governing Purchase Requisition.
5. Type nonsense — the no-match panel appears with a working **Clear search** button.
