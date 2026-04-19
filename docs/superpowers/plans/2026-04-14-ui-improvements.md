# UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement four UI quality improvements: skeleton loading states, empty states for AgentDashboard, nav active indicator underline, and lazy-loaded modals in RequestDetail.

**Architecture:** Each improvement is independent — implement in order. Tasks 1–3 are pure UI changes with no backend impact. Task 4 (lazy-load) uses React.lazy + Suspense to code-split the 11 workflow modal components that are currently eagerly imported inside RequestDetail.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (no config file, uses `@import "tailwindcss"`), Vite, React Router v7 HashRouter, Material Symbols (Google font icon class `material-symbols-outlined`)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/SkeletonRow.tsx` | **Create** | Reusable animated skeleton row for tables |
| `frontend/pages/Dashboard.tsx` | **Modify** | Replace spinner with skeleton rows during loading |
| `frontend/pages/AgentDashboard.tsx` | **Modify** | Replace spinner with skeleton rows; improve empty state with filter-aware messaging |
| `frontend/App.tsx` | **Modify** | Add active underline indicator to nav links |
| `frontend/pages/RequestDetail.tsx` | **Modify** | Lazy-load all 11 workflow modal imports; wrap in Suspense |

---

## Task 1: SkeletonRow component

**Files:**
- Create: `frontend/src/components/SkeletonRow.tsx`

- [ ] **Step 1: Create the SkeletonRow component**

Create `frontend/src/components/SkeletonRow.tsx` with the following content:

```tsx
// frontend/src/components/SkeletonRow.tsx
interface SkeletonRowProps {
  cols: number;
  /** Width pattern per column — Tailwind width class e.g. 'w-20', 'w-48', 'w-full'. Repeats if shorter than cols. */
  widths?: string[];
}

const SkeletonRow: React.FC<SkeletonRowProps> = ({ cols, widths = [] }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className={`h-4 bg-gray-200 rounded ${widths[i % widths.length] ?? 'w-full'}`} />
      </td>
    ))}
  </tr>
);

export default SkeletonRow;
```

> Note: No `import React` needed — React 19 JSX transform handles it. Add it only if your tsconfig requires it.

- [ ] **Step 2: Verify the file exists**

```bash
ls frontend/src/components/SkeletonRow.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SkeletonRow.tsx
git commit -m "feat: add reusable SkeletonRow component for table loading states"
```

---

## Task 2: Dashboard skeleton loading state

**Files:**
- Modify: `frontend/pages/Dashboard.tsx`

Currently: `loading` shows a full-page spinner (`animate-spin` div) that replaces the entire page content (lines 118–121). We replace this with skeleton rows inside the actual table card, so the page layout doesn't shift.

The Dashboard has two loading areas:
1. **Service desk cards** (3-column grid) — replace with 3 skeleton cards
2. **Recent requests table** (5 columns: Ref, Summary, Service, Status, Updated) — replace with 5 skeleton rows

- [ ] **Step 1: Add SkeletonRow import to Dashboard.tsx**

Open `frontend/pages/Dashboard.tsx`. At the top where other components are imported, add:

```tsx
import SkeletonRow from '../src/components/SkeletonRow';
```

- [ ] **Step 2: Replace the loading spinner with skeleton UI**

Find this block in Dashboard.tsx (around line 118):

```tsx
      {/* Service Desks */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
        </div>
      ) : error ? (
```

Replace it with:

```tsx
      {/* Service Desks */}
      {loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse p-8 bg-white border border-gray-100 rounded-2xl">
                <div className="w-14 h-14 bg-gray-200 rounded-xl mb-6" />
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-4/5" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="h-6 bg-gray-200 rounded w-36 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50">
                    {['w-24', 'w-48', 'w-28', 'w-20', 'w-20'].map((w, i) => (
                      <th key={i} className="px-6 py-4">
                        <div className={`h-3 bg-gray-200 rounded animate-pulse ${w}`} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[0, 1, 2, 3, 4].map(i => (
                    <SkeletonRow key={i} cols={5} widths={['w-24', 'w-48', 'w-28', 'w-20', 'w-16']} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : error ? (
```

- [ ] **Step 3: Check the dev server renders correctly**

Run `npm run dev` from `frontend/` and open the Dashboard. Temporarily slow the network in DevTools (Network tab → Throttling → Slow 3G) to see the skeleton state. Verify:
- 3 skeleton cards appear in the grid
- Skeleton table with 5 rows appears below
- No layout shift when data loads in

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat: replace Dashboard spinner with skeleton loading state"
```

---

## Task 3: AgentDashboard skeleton + improved empty state

**Files:**
- Modify: `frontend/pages/AgentDashboard.tsx`

Currently: loading shows a spinner (lines 221–225). Empty state (lines 226–233) shows a generic "No tickets here" message regardless of whether a request type filter is active.

The ticket table has 7 columns: Ref, Summary, Request Type, Priority, Status, SLA, Requester.

The `selectedRequestTypeId` state (non-empty string) indicates a filter is active.

- [ ] **Step 1: Add SkeletonRow import to AgentDashboard.tsx**

Open `frontend/pages/AgentDashboard.tsx`. Add import near the top with other component imports:

```tsx
import SkeletonRow from '../src/components/SkeletonRow';
```

- [ ] **Step 2: Replace loading spinner with skeleton rows**

Find this block (around line 221):

```tsx
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <span className="material-symbols-outlined text-5xl">inbox</span>
            <p className="text-base font-medium">No tickets here</p>
            <p className="text-sm">
              {activeTab === 'mine' ? 'You have no tickets assigned to you.' : 'No unassigned tickets at the moment.'}
            </p>
          </div>
        ) : (
```

Replace it with:

```tsx
        {loading ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Request Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-44">Requester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <SkeletonRow key={i} cols={7} widths={['w-20', 'w-40', 'w-28', 'w-16', 'w-24', 'w-16', 'w-28']} />
              ))}
            </tbody>
          </table>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <span className="material-symbols-outlined text-5xl opacity-40">
              {selectedRequestTypeId ? 'filter_alt_off' : 'inbox'}
            </span>
            <p className="text-base font-semibold text-gray-500">
              {selectedRequestTypeId ? 'No tickets match this filter' : 'No tickets here'}
            </p>
            <p className="text-sm text-center max-w-xs">
              {selectedRequestTypeId
                ? 'Try clearing the request type filter to see all tickets.'
                : activeTab === 'mine'
                ? 'You have no tickets assigned to you.'
                : 'No unassigned tickets at the moment.'}
            </p>
          </div>
        ) : (
```

- [ ] **Step 3: Check the dev server renders correctly**

Visit the Agent Dashboard. Temporarily add `await new Promise(r => setTimeout(r, 2000))` before `setLoading(false)` in the fetch, reload, and verify 6 skeleton rows appear. Remove the delay after verifying. Also verify:
- Filter active + no results shows `filter_alt_off` icon and filter-specific message
- No filter + no results shows `inbox` icon

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/AgentDashboard.tsx
git commit -m "feat: replace AgentDashboard spinner with skeleton; improve empty state messaging"
```

---

## Task 4: Nav active indicator underline

**Files:**
- Modify: `frontend/App.tsx`

Currently the active nav link gets `text-[#0052cc]` (blue text) but no structural indicator. We add a bottom border underline on the active link so it's visually unmistakable at a glance, matching standard app nav conventions.

The header is `h-16` (64px). Nav links are inline flex items inside the `<nav>` element.

- [ ] **Step 1: Update nav Link classes in App.tsx**

Open `frontend/App.tsx`. Find the `<nav>` block (lines 49–62). There are 6 `<Link>` elements, each with this pattern:

```tsx
<Link to="/" className={`text-sm font-semibold hover:text-[#0052cc] transition-colors ${isActive('/') ? 'text-[#0052cc]' : 'text-[#44546f]'}`}>Dashboard</Link>
```

Replace ALL 6 link className patterns with a version that adds `border-b-2` active indicator. Replace each link one by one. The new pattern is:

```tsx
<Link
  to="/"
  className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
    isActive('/') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
  }`}
>Dashboard</Link>
```

Apply the same pattern to all 6 links, substituting the correct `to` path and label:

```tsx
<Link
  to="/my-requests"
  className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
    isActive('/my-requests') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
  }`}
>My Requests</Link>

{(user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) && (
  <Link
    to="/agent"
    className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
      isActive('/agent') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
    }`}
  >Agent Dashboard</Link>
)}
{user?.roles?.includes('ADMIN') && (
  <Link
    to="/reports"
    className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
      isActive('/reports') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
    }`}
  >Reports</Link>
)}
<Link
  to="/kb"
  className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
    isActive('/kb') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
  }`}
>Knowledge Base</Link>
{user?.roles?.includes('ADMIN') && (
  <Link
    to="/admin/settings"
    className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
      isActive('/admin/settings') ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
    }`}
  >Admin Settings</Link>
)}
```

- [ ] **Step 2: Verify visually**

Open the app and navigate between pages. Verify:
- The active page link has a blue underline below the text
- Inactive links have no underline (transparent border preserves height so no layout shift on activation)
- The underline disappears when navigating away

- [ ] **Step 3: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat: add active underline indicator to header nav links"
```

---

## Task 5: Lazy-load workflow modals in RequestDetail

**Files:**
- Modify: `frontend/pages/RequestDetail.tsx`

Currently all 11 workflow modal components are imported from `../../src/components/request-detail/` using external component files. Wait — the exploration found that the modals in RequestDetail are actually **inline JSX** (not imported components) rendered conditionally from line 1562 onward. This means there's nothing to lazy-load via React.lazy; the JSX is inline in the file itself.

The actual modal *components* (`WorkflowApproveModal`, `VpApprovalModal`, etc.) live in `frontend/src/components/request-detail/` and are imported at the top of RequestDetail.

- [ ] **Step 1: Read the RequestDetail imports**

Open `frontend/pages/RequestDetail.tsx` lines 1–30 and identify all component imports from `request-detail/`.

Expected imports (from context):
```tsx
import WorkflowApproveModal from '../src/components/request-detail/WorkflowApproveModal';
import WorkflowRejectModal from '../src/components/request-detail/WorkflowRejectModal';
import AssignAgentModal from '../src/components/request-detail/AssignAgentModal';
import FulfilmentModal from '../src/components/request-detail/FulfilmentModal';
import HardwareOrderedModal from '../src/components/request-detail/HardwareOrderedModal';
import HardwareReceivedModal from '../src/components/request-detail/HardwareReceivedModal';
import ProcurementModal from '../src/components/request-detail/ProcurementModal';
import ResubmitModal from '../src/components/request-detail/ResubmitModal';
import SoftwareProvisionedModal from '../src/components/request-detail/SoftwareProvisionedModal';
import SubmitForApprovalModal from '../src/components/request-detail/SubmitForApprovalModal';
import VpApprovalModal from '../src/components/request-detail/VpApprovalModal';
```

If any of these are missing or named differently, adjust the lazy import in Step 2 accordingly.

- [ ] **Step 2: Replace static imports with React.lazy imports**

At the top of `frontend/pages/RequestDetail.tsx`, find the `import React` line (or the first line). Ensure `lazy` and `Suspense` are imported:

```tsx
import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
```

(If the file already imports `useState`, `useEffect` etc. from React, just add `lazy` and `Suspense` to that import.)

Then replace all 11 static modal imports with `lazy()` equivalents:

```tsx
const WorkflowApproveModal = lazy(() => import('../src/components/request-detail/WorkflowApproveModal'));
const WorkflowRejectModal = lazy(() => import('../src/components/request-detail/WorkflowRejectModal'));
const AssignAgentModal = lazy(() => import('../src/components/request-detail/AssignAgentModal'));
const FulfilmentModal = lazy(() => import('../src/components/request-detail/FulfilmentModal'));
const HardwareOrderedModal = lazy(() => import('../src/components/request-detail/HardwareOrderedModal'));
const HardwareReceivedModal = lazy(() => import('../src/components/request-detail/HardwareReceivedModal'));
const ProcurementModal = lazy(() => import('../src/components/request-detail/ProcurementModal'));
const ResubmitModal = lazy(() => import('../src/components/request-detail/ResubmitModal'));
const SoftwareProvisionedModal = lazy(() => import('../src/components/request-detail/SoftwareProvisionedModal'));
const SubmitForApprovalModal = lazy(() => import('../src/components/request-detail/SubmitForApprovalModal'));
const VpApprovalModal = lazy(() => import('../src/components/request-detail/VpApprovalModal'));
```

- [ ] **Step 3: Wrap each modal render site in Suspense**

`React.lazy` requires each lazily-loaded component to be wrapped in a `<Suspense>` boundary. In RequestDetail, the modals are rendered conditionally (e.g. `{showApproveModal && <WorkflowApproveModal ... />}`).

Search for all 11 modal render sites (grep for `showApproveModal`, `showRejectModal`, etc.). For each one, wrap in Suspense with a `null` fallback (modals are already mounted on demand, so no visible loading state needed):

Example — find:
```tsx
{showApproveModal && (
  <WorkflowApproveModal
    requestId={request.id}
    onSuccess={handleWorkflowSuccess}
    onClose={() => setShowApproveModal(false)}
  />
)}
```

Replace with:
```tsx
{showApproveModal && (
  <Suspense fallback={null}>
    <WorkflowApproveModal
      requestId={request.id}
      onSuccess={handleWorkflowSuccess}
      onClose={() => setShowApproveModal(false)}
    />
  </Suspense>
)}
```

Repeat for all 11 modal render sites. The pattern is always the same — wrap the existing conditional in `<Suspense fallback={null}>`.

- [ ] **Step 4: Verify no TypeScript errors**

Run from `frontend/`:

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. If you see "does not provide an export named 'default'", the modal component file is missing a default export — check the component file.

- [ ] **Step 5: Verify lazy loading in browser**

Open the app, navigate to any request detail page. Open DevTools → Network → JS. Open a modal (e.g. click Approve). Verify a new JS chunk is fetched on-demand (named something like `WorkflowApproveModal-[hash].js`). The modal should open normally.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/RequestDetail.tsx
git commit -m "perf: lazy-load workflow modal components in RequestDetail"
```

---

## Self-Review

**Spec coverage:**
- ✅ Skeleton/loading states — Task 1 (SkeletonRow component) + Task 2 (Dashboard) + Task 3 (AgentDashboard)
- ✅ Empty states AgentDashboard — Task 3 (filter-aware empty state messaging)
- ✅ Nav active indicator — Task 4
- ✅ Lazy-load modals — Task 5

**Placeholder scan:** No TBDs or TODOs. All code blocks are complete.

**Type consistency:**
- `SkeletonRow` props: `cols: number`, `widths?: string[]` — used identically in Task 2 and 3.
- `selectedRequestTypeId` referenced in Task 3 — confirmed exists in AgentDashboard state (line 47–54 per exploration).
- `isActive(path)` function in App.tsx — confirmed exists at line 27, used consistently in Task 4.
- All 11 modal component names match the files in `frontend/src/components/request-detail/`.
