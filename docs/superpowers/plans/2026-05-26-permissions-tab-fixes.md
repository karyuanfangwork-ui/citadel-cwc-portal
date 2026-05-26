# Permissions Tab — Bug Fixes & UX Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs and 5 UX issues in the Permission Matrix admin page so admins can manage role permissions correctly and efficiently.

**Architecture:** All changes are confined to `frontend/src/components/admin/PermissionsTab.tsx`. No backend changes required. Improvements include: parallel save, sticky table header, React Portal modals, unsaved-change guard, column/permission filtering, bulk select, dirty column highlighting, improved delete icon visibility, and role description tooltips.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, `ReactDOM.createPortal`

---

## Files

- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

---

### Task 1: Fix sequential `saveAll` — use `Promise.all`

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx:124-129`

- [ ] **Step 1: Replace the `for...of` loop with `Promise.all`**

Find this block (around line 124):
```tsx
const saveAll = async () => {
    const dirtyRoles = Array.from(dirty);
    for (const roleId of dirtyRoles) {
        await save(roleId);
    }
};
```

Replace with:
```tsx
const saveAll = async () => {
    await Promise.all(Array.from(dirty).map(roleId => save(roleId)));
};
```

- [ ] **Step 2: Verify in browser**

Open Admin Console → Permissions, toggle several checkboxes across different roles, click **Save All**. Confirm the network tab shows all save requests firing in parallel (not waterfall).

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "fix(permissions): saveAll fires role saves in parallel via Promise.all"
```

---

### Task 2: Fix sticky table header (role names disappear on scroll)

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx` (thead `<tr>`)

- [ ] **Step 1: Make the `<thead>` row sticky**

Find the `<thead>` block (around line 378):
```tsx
<thead>
    <tr className="bg-[#f7f8fa]">
        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#44546f] w-56 sticky left-0 bg-[#f7f8fa] z-10 border-r border-[#e8eaf0]">
            Permission
        </th>
        {roles.map(role => (
            <th key={role.id} className="px-4 py-4 text-center min-w-[100px]">
```

Replace with:
```tsx
<thead className="sticky top-0 z-20">
    <tr className="bg-[#f7f8fa]">
        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#44546f] w-56 sticky left-0 bg-[#f7f8fa] z-30 border-r border-[#e8eaf0]">
            Permission
        </th>
        {roles.map(role => (
            <th key={role.id} className="px-4 py-4 text-center min-w-[100px] bg-[#f7f8fa]">
```

Note: `z-30` on the corner cell so it sits above both the sticky column and sticky header. `z-20` on `<thead>` and explicit `bg-[#f7f8fa]` on each `<th>` so cells don't become transparent.

- [ ] **Step 2: Verify in browser**

Open Permissions tab and scroll down past 10+ permission rows. Confirm role names stay visible at the top of the table.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "fix(permissions): make table header row sticky so role names stay visible on scroll"
```

---

### Task 3: Fix resource group row bleeding on horizontal scroll

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx` (resource separator row ~line 407)

- [ ] **Step 1: Fix the resource group row sticky cell**

Find:
```tsx
<tr className="bg-[#f0f2f5]">
    <td
        colSpan={roles.length + 1}
        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-[#44546f] sticky left-0"
    >
        {resource}
    </td>
</tr>
```

Replace with:
```tsx
<tr className="bg-[#f0f2f5]">
    <td
        colSpan={roles.length + 1}
        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-[#44546f] sticky left-0 z-10 bg-[#f0f2f5]"
    >
        {resource}
    </td>
</tr>
```

- [ ] **Step 2: Verify in browser**

Scroll horizontally across the permission matrix. Confirm the resource group headers (e.g. "ADMIN", "REPORT") stay pinned at left and no cell content bleeds through them.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "fix(permissions): resource group separator sticky cell gets z-10 and explicit bg to stop bleed"
```

---

### Task 4: Fix modals — wrap in React Portal to escape overflow clipping

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

- [ ] **Step 1: Add ReactDOM import at top of file**

Find:
```tsx
import React, { useEffect, useState, useCallback } from 'react';
```

Replace with:
```tsx
import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
```

- [ ] **Step 2: Create a `Modal` portal wrapper component (add above `PermissionsTab`)**

Add this function after the `groupByResource` helper (around line 28):
```tsx
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            {children}
        </div>,
        document.body
    );
}
```

- [ ] **Step 3: Replace all three modal overlay divs with `<Modal>`**

**Create/Edit Role Modal** — find (around line 474):
```tsx
{roleModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRoleModal(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
```
Replace with:
```tsx
{roleModal && (
    <Modal onClose={() => setRoleModal(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
```
And close it: replace the closing `</div>\n)}` (two closing divs) with `</div>\n</Modal>\n)}`.

**Create Permission Modal** — find (around line 523):
```tsx
{permModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setPermModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
```
Replace with:
```tsx
{permModal && (
    <Modal onClose={() => setPermModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
```
And fix closing tags similarly.

**Delete Confirm Modal** — find (around line 593):
```tsx
{deleteConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
```
Replace with:
```tsx
{deleteConfirm && (
    <Modal onClose={() => setDeleteConfirm(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
```
And fix closing tags similarly.

- [ ] **Step 4: Verify in browser**

Open Permissions, click **Add Role**. Confirm modal appears above all content and is not clipped by any container. Test all three modal triggers.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "fix(permissions): wrap all three modals in ReactDOM portal to escape overflow clipping"
```

---

### Task 5: Unsaved-changes navigation guard

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

- [ ] **Step 1: Add `useEffect` for `beforeunload` guard**

After the existing `useEffect(() => { load(); }, [load]);` (around line 90), add:

```tsx
useEffect(() => {
    if (dirty.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
}, [dirty.size]);
```

- [ ] **Step 2: Add a visible unsaved-changes banner above the table**

In the JSX, after the Toast block (around line 332), add:

```tsx
{dirty.size > 0 && (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <span className="material-symbols-outlined text-base">warning</span>
        You have unsaved changes in {dirty.size} role{dirty.size > 1 ? 's' : ''}. Click <strong className="mx-1">Save All</strong> or save each column individually.
    </div>
)}
```

- [ ] **Step 3: Verify in browser**

Toggle a checkbox, then try to close/refresh the tab — browser should show a "Leave site?" dialog. Also confirm the amber banner appears and lists the correct count.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "feat(permissions): warn on navigation with unsaved changes + show dirty-count banner"
```

---

### Task 6: Add permission search + role column filter

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

- [ ] **Step 1: Add filter state variables**

After the `const [permModal, ...]` line (around line 54), add:

```tsx
const [permSearch, setPermSearch] = useState('');
const [hiddenRoles, setHiddenRoles] = useState<Set<string>>(new Set());

const toggleRoleVisibility = (roleId: string) => {
    setHiddenRoles(prev => {
        const next = new Set(prev);
        if (next.has(roleId)) next.delete(roleId);
        else next.add(roleId);
        return next;
    });
};
```

- [ ] **Step 2: Compute filtered data**

Replace the existing computed values block (around line 268):
```tsx
const grouped = groupByResource(permissions);
const resources = Object.keys(grouped).sort();
const dirtyCount = dirty.size;
```
With:
```tsx
const visibleRoles = roles.filter(r => !hiddenRoles.has(r.id));
const filteredPermissions = permSearch.trim()
    ? permissions.filter(p =>
        p.action.toLowerCase().includes(permSearch.toLowerCase()) ||
        p.resource.toLowerCase().includes(permSearch.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(permSearch.toLowerCase())
      )
    : permissions;
const grouped = groupByResource(filteredPermissions);
const resources = Object.keys(grouped).sort();
const dirtyCount = dirty.size;
```

- [ ] **Step 3: Add search bar above the table**

Just before the `{/* Permission Matrix Table */}` comment (around line 374), insert:

```tsx
{/* Search + column visibility */}
<div className="flex items-center gap-3 flex-wrap">
    <div className="relative flex-1 min-w-[200px] max-w-xs">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-base pointer-events-none">search</span>
        <input
            type="text"
            value={permSearch}
            onChange={e => setPermSearch(e.target.value)}
            placeholder="Search permissions…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#e8eaf0] rounded-lg focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
        />
        {permSearch && (
            <button onClick={() => setPermSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#44546f] hover:text-[#101418]">
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        )}
    </div>
    {hiddenRoles.size > 0 && (
        <button
            onClick={() => setHiddenRoles(new Set())}
            className="text-xs font-semibold text-[#0052cc] hover:underline"
        >
            Show all {hiddenRoles.size} hidden role{hiddenRoles.size > 1 ? 's' : ''}
        </button>
    )}
</div>
```

- [ ] **Step 4: Make role pills in the header section toggle column visibility**

In the roles pill section (around line 341), update each pill's `onClick`:
```tsx
<div
    key={role.id}
    onClick={() => toggleRoleVisibility(role.id)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
        hiddenRoles.has(role.id)
            ? 'bg-white border-[#c1c7d0] text-[#8993a4] line-through opacity-50'
            : dirty.has(role.id)
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : 'bg-[#f0f2f5] border-[#e8eaf0] text-[#101418]'
    }`}
    title={hiddenRoles.has(role.id) ? 'Click to show column' : 'Click to hide column'}
>
```

- [ ] **Step 5: Use `visibleRoles` instead of `roles` in the table**

In the `<thead>` roles map (around line 382) and the `<tbody>` roles map (around line 439), replace `roles.map` with `visibleRoles.map`.

- [ ] **Step 6: Add "no results" empty state for filtered permissions**

After the `<tbody>` opening tag, before `resources.map`, wrap with:
```tsx
<tbody>
    {resources.length === 0 && permSearch && (
        <tr>
            <td colSpan={visibleRoles.length + 1} className="px-6 py-12 text-center text-sm text-[#44546f]">
                No permissions match "<strong>{permSearch}</strong>"
            </td>
        </tr>
    )}
    {resources.map(resource => (
```

- [ ] **Step 7: Verify in browser**

1. Type "report" in the search box — only report-related rows should show.
2. Click the clear button — all rows return.
3. Click a role pill — that column disappears from the table.
4. Click "Show all hidden roles" — all columns return.

- [ ] **Step 8: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "feat(permissions): add permission search filter + role column show/hide via pill toggle"
```

---

### Task 7: Bulk select/deselect per column (role) and per row (permission)

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

- [ ] **Step 1: Add bulk toggle helpers**

After the `toggle` function (around line 107), add:

```tsx
const toggleAllForRole = (roleId: string) => {
    if (!canAdminSettings) return;
    const allPermIds = permissions.map(p => p.id);
    setMatrix(prev => {
        const current = prev[roleId];
        const allGranted = allPermIds.every(id => current.has(id));
        const next = allGranted ? new Set<string>() : new Set<string>(allPermIds);
        return { ...prev, [roleId]: next };
    });
    setDirty(prev => new Set(prev).add(roleId));
};

const toggleAllForPermission = (permId: string) => {
    if (!canAdminSettings) return;
    const allRoleIds = roles.map(r => r.id);
    const allGranted = allRoleIds.every(rId => matrix[rId]?.has(permId));
    setMatrix(prev => {
        const next = { ...prev };
        allRoleIds.forEach(rId => {
            next[rId] = new Set(next[rId]);
            if (allGranted) next[rId].delete(permId);
            else next[rId].add(permId);
        });
        return next;
    });
    setDirty(prev => new Set([...prev, ...allRoleIds]));
};
```

- [ ] **Step 2: Add "select all" toggle in each role column header**

In the `<th>` for each role (around line 383), after the role name span:
```tsx
{canAdminSettings && (
    <button
        onClick={() => toggleAllForRole(role.id)}
        className="text-[#8993a4] hover:text-[#0052cc] transition-colors"
        title={permissions.every(p => matrix[role.id]?.has(p.id)) ? 'Deselect all' : 'Select all'}
    >
        <span className="material-symbols-outlined text-sm">
            {permissions.every(p => matrix[role.id]?.has(p.id)) ? 'remove_done' : 'done_all'}
        </span>
    </button>
)}
```

- [ ] **Step 3: Add "grant to all roles" toggle on each permission row**

In the permission row's sticky `<td>` (around line 420), after the delete button:
```tsx
{canAdminSettings && (
    <button
        onClick={() => toggleAllForPermission(perm.id)}
        className="text-[#b0b5bf] hover:text-[#0052cc] transition-colors flex-shrink-0"
        title={roles.every(r => matrix[r.id]?.has(perm.id)) ? 'Remove from all roles' : 'Grant to all roles'}
    >
        <span className="material-symbols-outlined text-xs">
            {roles.every(r => matrix[r.id]?.has(perm.id)) ? 'remove_done' : 'done_all'}
        </span>
    </button>
)}
```

- [ ] **Step 4: Verify in browser**

1. Click the `done_all` icon on a role column header — all checkboxes in that column should check.
2. Click again — all uncheck.
3. Click `done_all` on a permission row — all roles get that permission.
4. Click again — all roles lose it.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "feat(permissions): bulk select/deselect per role column and per permission row"
```

---

### Task 8: Dirty column highlight + improved delete icon visibility + role description tooltips

**Files:**
- Modify: `frontend/src/components/admin/PermissionsTab.tsx`

- [ ] **Step 1: Highlight dirty columns in the matrix**

In the `<tbody>` permission cell (around line 442), update the `<td>` className:
```tsx
<td key={role.id} className={`px-4 py-3 text-center ${dirty.has(role.id) ? 'bg-amber-50/40' : ''}`}>
```

- [ ] **Step 2: Improve delete permission icon visibility**

Find (around line 431):
```tsx
className="text-[#b0b5bf] hover:text-red-500 transition-colors flex-shrink-0"
```
Replace with:
```tsx
className="text-[#8993a4] hover:text-red-500 transition-colors flex-shrink-0"
title="Delete permission"
```

- [ ] **Step 3: Add role description tooltip to role pill**

In the role pills section (around line 342), update to show the description as a native tooltip:
```tsx
<div
    key={role.id}
    onClick={() => toggleRoleVisibility(role.id)}
    title={role.description ? `${role.name}: ${role.description}` : `Click to hide column`}
    ...
>
```

- [ ] **Step 4: Add role description tooltip to column header**

In the `<th>` for each role column (around line 383):
```tsx
<th key={role.id} className="px-4 py-4 text-center min-w-[100px] bg-[#f7f8fa]" title={role.description ?? undefined}>
```

- [ ] **Step 5: Verify in browser**

1. Toggle a checkbox — that column should have a subtle amber background tint.
2. Hover over delete permission icon — it should be more visible (medium grey).
3. Hover over a role pill or column header with a description — browser tooltip should show the description text.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/components/admin/PermissionsTab.tsx
git commit -m "feat(permissions): dirty column amber highlight, improved delete icon, role description tooltips"
```

---

## Self-Review Checklist

- [x] **Bug: saveAll parallel** — Task 1
- [x] **Bug: sticky header** — Task 2
- [x] **Bug: resource group row bleed** — Task 3
- [x] **Bug: modals not portalled** — Task 4
- [x] **Bug: unsaved navigation** — Task 5
- [x] **UX: search/filter** — Task 6
- [x] **UX: bulk select** — Task 7
- [x] **UX: dirty column highlight** — Task 8
- [x] **UX: delete icon visibility** — Task 8
- [x] **UX: role description tooltips** — Task 8
- [x] No TBDs or placeholder steps
- [x] Types consistent: `visibleRoles`, `filteredPermissions`, `hiddenRoles` all introduced in Task 6 before use in same task
