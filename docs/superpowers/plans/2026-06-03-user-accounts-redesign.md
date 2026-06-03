# User Accounts Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate horizontal scrolling on the User Accounts admin table by reducing columns, compacting padding, collapsing actions into an overflow menu, and unifying the header bar — all using CWC design system tokens.

**Architecture:** All changes are isolated to a single component file (`UserAccountsTab.tsx`). No backend changes, no prop interface changes, no new files. The overflow menu is implemented as local React state with a `useEffect` outside-click handler.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + React Testing Library

---

## Files

| Action | Path |
|--------|------|
| Modify | `frontend/src/components/admin/UserAccountsTab.tsx` |
| Create | `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx` |

---

### Task 1: Write tests for the new layout behaviour

These tests verify the four structural changes before touching the component.

**Files:**
- Create: `frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserAccountsTab } from '../UserAccountsTab';

const baseProps = {
  users: [],
  usersLoading: false,
  userPagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  userSearch: '',
  userRoleFilter: '',
  userStatusFilter: '' as const,
  userStats: { total: 0, active: 0, disabled: 0, agents: 0 },
  availableRoles: [],
  entities: [],
  approverEntityMap: {},
  onSearch: vi.fn(),
  onRoleFilter: vi.fn(),
  onStatusFilter: vi.fn(),
  onFetchUsers: vi.fn(),
  onCreateUser: vi.fn(),
  onImportStaff: vi.fn(),
  onEditUser: vi.fn(),
  onManageRoles: vi.fn(),
  onResetPassword: vi.fn(),
  onAssignAgentTeam: vi.fn(),
  onToggleUserStatus: vi.fn(),
};

const agentUser = {
  id: 'u1',
  firstName: 'Nurul',
  lastName: 'Hidayah',
  email: 'nurul@company.com',
  isActive: true,
  agentTeam: 'IT Support',
  roles: [{ role: { name: 'AGENT' } }],
};

const adminUser = {
  id: 'u2',
  firstName: 'Ahmad',
  lastName: 'Razali',
  email: 'ahmad@company.com',
  isActive: true,
  agentTeam: null,
  roles: [{ role: { name: 'Admin' } }],
};

describe('UserAccountsTab', () => {
  it('does NOT render an "Agent Team" column header', () => {
    render(<UserAccountsTab {...baseProps} />);
    expect(screen.queryByText(/agent team/i)).toBeNull();
  });

  it('renders Import Staff button in the same row as Create User', () => {
    render(<UserAccountsTab {...baseProps} />);
    const importBtn = screen.getByRole('button', { name: /import staff/i });
    const createBtn = screen.getByRole('button', { name: /create user/i });
    // Both should be in the DOM (unified bar)
    expect(importBtn).toBeTruthy();
    expect(createBtn).toBeTruthy();
    // They must share the same parent container
    expect(importBtn.parentElement).toBe(createBtn.parentElement);
  });

  it('shows agent team badge inline under user name for AGENT users', () => {
    render(<UserAccountsTab {...baseProps} users={[agentUser]} />);
    expect(screen.getByText('IT Support')).toBeTruthy();
  });

  it('does NOT show agent team badge for non-agent users', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    // adminUser has no agentTeam and no AGENT role
    expect(screen.queryByText(/unassigned/i)).toBeNull();
  });

  it('renders Edit button per row', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    expect(screen.getByRole('button', { name: /edit ahmad razali/i })).toBeTruthy();
  });

  it('shows overflow menu when ··· button is clicked', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    const moreBtn = screen.getByRole('button', { name: /more actions for ahmad razali/i });
    fireEvent.click(moreBtn);
    expect(screen.getByText(/manage roles/i)).toBeTruthy();
    expect(screen.getByText(/reset password/i)).toBeTruthy();
  });

  it('closes overflow menu on outside click', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    const moreBtn = screen.getByRole('button', { name: /more actions for ahmad razali/i });
    fireEvent.click(moreBtn);
    expect(screen.getByText(/manage roles/i)).toBeTruthy();
    fireEvent.mousedown(document.body);
    expect(screen.queryByText(/manage roles/i)).toBeNull();
  });

  it('shows "Assign Agent Team" in overflow menu only for AGENT users', () => {
    render(<UserAccountsTab {...baseProps} users={[agentUser, adminUser]} />);
    // Open agent user menu
    fireEvent.click(screen.getByRole('button', { name: /more actions for nurul hidayah/i }));
    expect(screen.getByText(/assign agent team/i)).toBeTruthy();
    // Close and open admin user menu
    fireEvent.mousedown(document.body);
    fireEvent.click(screen.getByRole('button', { name: /more actions for ahmad razali/i }));
    expect(screen.queryByText(/assign agent team/i)).toBeNull();
  });

  it('calls onEditUser when Edit button is clicked', () => {
    const onEditUser = vi.fn();
    render(<UserAccountsTab {...baseProps} users={[adminUser]} onEditUser={onEditUser} />);
    fireEvent.click(screen.getByRole('button', { name: /edit ahmad razali/i }));
    expect(onEditUser).toHaveBeenCalledWith(adminUser);
  });

  it('calls onToggleUserStatus from overflow menu', () => {
    const onToggleUserStatus = vi.fn();
    render(<UserAccountsTab {...baseProps} users={[adminUser]} onToggleUserStatus={onToggleUserStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions for ahmad razali/i }));
    fireEvent.click(screen.getByText(/disable account/i));
    expect(onToggleUserStatus).toHaveBeenCalledWith(adminUser);
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd frontend && npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
```

Expected: all tests FAIL (component not yet updated)

---

### Task 2: Unify the action bar (remove sub-header, merge Import Staff)

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx` (lines 81–139)

- [ ] **Step 1: Remove the standalone Import Staff sub-header block**

Delete lines 81–89 (the `<div className="px-8 pt-6 pb-0 flex justify-end">` block containing Import Staff).

- [ ] **Step 2: Add Import Staff into the filter bar, update Create User to brand-700, reduce filter bar padding**

Replace the filter bar `<div>` (currently starts at `<div className="px-8 pb-6 border-b ...">`) with:

```tsx
{/* Header / Filters */}
<div className="px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row gap-3">
    <div className="relative flex-1">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
        <input
            type="text"
            placeholder="Search by name, email, entity..."
            className="w-full pl-11 pr-5 py-[10px] bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#1D2D5E]/10 focus:border-[#1D2D5E] outline-none"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
        />
    </div>
    <div className="relative">
        <select
            className={`pl-4 pr-10 py-[10px] bg-white border rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#1D2D5E]/10 focus:border-[#1D2D5E] outline-none appearance-none ${userRoleFilter ? 'border-[#1D2D5E] text-[#1D2D5E]' : 'border-gray-200 text-[#44546f]'}`}
            value={userRoleFilter}
            onChange={e => onRoleFilter(e.target.value)}
        >
            <option value="">All Roles</option>
            {availableRoles.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
            ))}
        </select>
        {userRoleFilter && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#1D2D5E]" />
        )}
    </div>
    <div className="flex items-center rounded-2xl border border-gray-200 bg-white overflow-hidden text-sm font-bold">
        {([['', 'All'], ['active', 'Active'], ['disabled', 'Disabled']] as const).map(([val, label]) => (
            <button
                key={val}
                onClick={() => onStatusFilter(val)}
                className={`px-3 py-[10px] transition-colors whitespace-nowrap ${
                    userStatusFilter === val
                        ? 'bg-[#1D2D5E] text-white'
                        : 'text-[#44546f] hover:bg-gray-50'
                }`}
            >
                {label}
            </button>
        ))}
    </div>
    <button
        onClick={onImportStaff}
        className="flex items-center gap-2 px-4 py-[10px] bg-white border border-gray-200 text-[#44546f] text-sm font-bold rounded-2xl hover:bg-gray-50 transition-colors whitespace-nowrap"
    >
        <span className="material-symbols-outlined text-sm">upload_file</span>
        Import Staff
    </button>
    <button
        onClick={onCreateUser}
        className="flex items-center gap-2 px-4 py-[10px] bg-[#1D2D5E] text-white text-sm font-bold rounded-2xl hover:bg-[#2E4A7A] transition-colors whitespace-nowrap"
    >
        <span className="material-symbols-outlined text-sm">person_add</span>
        Create User
    </button>
</div>
```

- [ ] **Step 3: Run the "Import Staff in same row as Create User" test**

```bash
cd frontend && npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx -t "Import Staff"
```

Expected: PASS

---

### Task 3: Reduce cell padding on all `<th>` and `<td>`

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Update all `<th>` padding**

Find all `<th className="px-8 py-5 ...">` in the thead and change to `px-5 py-3`:

```tsx
<th className="px-5 py-3">User</th>
<th className="px-5 py-3">Entity</th>
<th className="px-5 py-3">Roles</th>
<th className="px-5 py-3">Status</th>
<th className="px-5 py-3 text-right">Actions</th>
```

(The "Agent Team" `<th>` will be removed in Task 4 — skip it here.)

- [ ] **Step 2: Update all `<td>` padding**

Find every `px-8 py-5` in the `<td>` elements and replace with `px-5 py-4`. There are 6 `<td>` elements per data row plus the loading skeleton `<td>` elements. Also update the empty-state `<td colSpan={6}>` to `colSpan={5}` (one fewer column after Task 4) and change its padding to `px-5 py-16`.

Loading skeleton `<td>` padding: change `px-8 py-5` → `px-5 py-4` on all 6 skeleton cells.

- [ ] **Step 3: Run tests — still passing**

```bash
cd frontend && npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
```

Expected: same tests passing as after Task 2, remainder still failing

---

### Task 4: Remove Agent Team column; add inline badge in User cell

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Remove the Agent Team `<th>` from the header**

Delete:
```tsx
<th className="px-5 py-3">Agent Team</th>
```

- [ ] **Step 2: Remove the Agent Team `<td>` from the data row**

Delete the entire `<td>` block (currently ~lines 221–229):
```tsx
<td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
    {user.roles?.some(...) ? (
        <span ...>{user.agentTeam || 'Unassigned'}</span>
    ) : (
        <span ...>—</span>
    )}
</td>
```

- [ ] **Step 3: Remove the Agent Team `<td>` from the loading skeleton rows**

Delete the Agent Team skeleton `<td>` from the 5 skeleton rows:
```tsx
<td className="px-8 py-5"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
```

- [ ] **Step 4: Add agent team badge inline in the User `<td>`**

In the User `<td>`, after the email line, add:

```tsx
<td className={`px-5 py-4 ${!user.isActive ? 'opacity-50' : ''}`}>
    <div className="font-bold text-[#111827]">{user.firstName} {user.lastName}</div>
    <div className="text-sm text-[#44546f]">{user.email}</div>
    {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && user.agentTeam && (
        <div className="mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fffbeb] text-[#d97706] text-[10px] font-black uppercase rounded-full border border-[#fde68a]">
                <span className="material-symbols-outlined text-[10px]">support_agent</span>
                {user.agentTeam}
            </span>
        </div>
    )}
</td>
```

- [ ] **Step 5: Run tests for agent team badge**

```bash
cd frontend && npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx -t "agent team"
```

Expected: both agent team badge tests PASS

---

### Task 5: Replace 5-button actions with Edit + overflow menu

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Add `openMenuId` state at the top of the component**

After the existing `useState` declarations, add:

```tsx
const [openMenuId, setOpenMenuId] = useState<string | null>(null);
```

- [ ] **Step 2: Add outside-click handler to close the menu**

After the existing `useEffect` blocks, add:

```tsx
useEffect(() => {
    if (!openMenuId) return;
    const handle = (e: MouseEvent) => {
        const target = e.target as Element;
        if (!target.closest('[data-overflow-menu]')) {
            setOpenMenuId(null);
        }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
}, [openMenuId]);
```

- [ ] **Step 3: Replace the actions `<td>` with Edit button + overflow menu**

Replace the entire actions `<td>` block (the one containing the 5 icon buttons) with:

```tsx
<td className="px-5 py-4 text-right">
    <div className="flex justify-end items-center gap-1" data-overflow-menu>
        {/* Edit — primary visible action */}
        <button
            onClick={() => onEditUser(user)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-bold text-[#44546f] bg-white hover:bg-gray-50 hover:text-[#1D2D5E] hover:border-[#d0e8f5] transition-all whitespace-nowrap"
            aria-label={`Edit ${user.firstName} ${user.lastName}`}
        >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit
        </button>

        {/* Overflow trigger */}
        <div className="relative">
            <button
                onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-[#44546f] bg-white hover:bg-gray-50 hover:text-[#111827] transition-all text-sm font-black tracking-tighter"
                aria-label={`More actions for ${user.firstName} ${user.lastName}`}
                aria-expanded={openMenuId === user.id}
            >
                ···
            </button>

            {openMenuId === user.id && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                    <button
                        onClick={() => { onManageRoles(user); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#44546f] hover:bg-gray-50 hover:text-[#1D2D5E] transition-colors text-left"
                    >
                        <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        Manage Roles
                    </button>
                    <button
                        onClick={() => { onResetPassword(user); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#44546f] hover:bg-gray-50 hover:text-amber-600 transition-colors text-left"
                    >
                        <span className="material-symbols-outlined text-base">key</span>
                        Reset Password
                    </button>
                    {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
                        <button
                            onClick={() => { onAssignAgentTeam(user); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#44546f] hover:bg-gray-50 hover:text-amber-600 transition-colors text-left"
                        >
                            <span className="material-symbols-outlined text-base">groups</span>
                            Assign Agent Team
                        </button>
                    )}
                    <div className="my-1 border-t border-gray-100" />
                    <button
                        onClick={() => { onToggleUserStatus(user); setOpenMenuId(null); }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors text-left ${
                            user.isActive
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-base">{user.isActive ? 'block' : 'check_circle'}</span>
                        {user.isActive ? 'Disable Account' : 'Enable Account'}
                    </button>
                </div>
            )}
        </div>
    </div>
</td>
```

- [ ] **Step 4: Run all tests**

```bash
cd frontend && npx vitest run src/components/admin/__tests__/UserAccountsTab.test.tsx
```

Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/UserAccountsTab.tsx \
        frontend/src/components/admin/__tests__/UserAccountsTab.test.tsx
git commit -m "feat(admin): redesign user accounts table — fix horizontal scroll"
```

---

### Task 6: Visual verification

- [ ] **Step 1: Start the frontend dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Open the page and verify**

Navigate to `http://localhost:5173/admin/settings?tab=users`

Checklist:
- [ ] No horizontal scrollbar at 1280px viewport width
- [ ] Import Staff button sits next to Create User in one row
- [ ] Agent Team column header is gone
- [ ] Agent users show their team badge under their name in the User column
- [ ] Non-agent users show no team badge in the User column
- [ ] Each row shows "Edit" button + "···" button only
- [ ] Clicking "···" opens a dropdown with Manage Roles, Reset Password, (Assign Agent Team for agents), Disable/Enable
- [ ] Clicking outside the dropdown closes it
- [ ] Primary button (Create User) and status toggle active state use navy (#1D2D5E), not IT-blue (#0052cc)
- [ ] Row hover background is `surface-subtle` (#f8fafc)

- [ ] **Step 3: Run full frontend test suite to check for regressions**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass
