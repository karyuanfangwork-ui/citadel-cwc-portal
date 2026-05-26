# User Accounts Tab — Bug Fixes & UX Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs and 6 UX issues in the User Accounts admin tab so admins can correctly see totals, safely toggle statuses, and efficiently filter/manage users.

**Architecture:** Changes span three files: `UserAccountsTab.tsx` (display + stats props + status filter), `useAdminState.ts` (real stats via parallel API calls, confirm-before-disable, fix save-roles silent no-op, fix stale closure), and `AdminSettings.tsx` (wire status filter + confirm modal for disable). No backend changes needed — the existing `/users` endpoint already supports `isActive` and `role` filter params.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, existing `adminService.listUsers`

---

## Files

- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/pages/AdminSettings.tsx`

---

### Task 1: Fix stats cards — fetch real totals from backend

The stats currently filter the `users` array (current page only). Fix: fetch 3 parallel count queries using `limit=1` and read `pagination.total` from each. Store results in `useAdminState` and pass them as a prop.

**Files:**
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Add `userStats` state and `fetchUserStats` in `useAdminState.ts`**

Find the `userPagination` state declaration (around line 315):
```ts
const [userPagination, setUserPagination] = useState<UserPagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
```
After it, add:
```ts
const [userStats, setUserStats] = useState({ total: 0, active: 0, disabled: 0, agents: 0 });
```

Then find `fetchUsers` (around line 444) and add a `fetchUserStats` function right after the `fetchUsers` closing `}, [showToast]);`:
```ts
const fetchUserStats = useCallback(async () => {
    try {
        const [allRes, activeRes, disabledRes, agentRes] = await Promise.all([
            adminService.listUsers({ page: 1, limit: 1 }),
            adminService.listUsers({ page: 1, limit: 1, isActive: true }),
            adminService.listUsers({ page: 1, limit: 1, isActive: false }),
            adminService.listUsers({ page: 1, limit: 1, role: 'AGENT' }),
        ]);
        setUserStats({
            total: allRes.pagination.total,
            active: activeRes.pagination.total,
            disabled: disabledRes.pagination.total,
            agents: agentRes.pagination.total,
        });
    } catch {
        // stats are non-critical, silently ignore
    }
}, []);
```

- [ ] **Step 2: Call `fetchUserStats` alongside `fetchUsers` in the tab activation effect**

Find the `useEffect` that calls `fetchUsers` when the tab activates (around line 1026):
```ts
fetchUsers(1, '', '');
```
Change to:
```ts
fetchUsers(1, '', '');
fetchUserStats();
```

Also call `fetchUserStats()` inside `handleToggleUserStatus` after the status update succeeds, so stats stay accurate. Find (around line 862):
```ts
fetchUsers(userPagination.page);
showToast('success', `Account ${!user.isActive ? 'enabled' : 'disabled'}.`);
```
Change to:
```ts
fetchUsers(userPagination.page);
fetchUserStats();
showToast('success', `Account ${!user.isActive ? 'enabled' : 'disabled'}.`);
```

- [ ] **Step 3: Export `userStats` and `fetchUserStats` from `useAdminState`**

Find the return object in `useAdminState.ts` (search for `userPagination,` in the return block, around line 1076) and add after it:
```ts
userStats,
fetchUserStats,
```

Also add the types to the interface. Find `userPagination: UserPagination;` (around line 116) and add after:
```ts
userStats: { total: number; active: number; disabled: number; agents: number };
fetchUserStats: () => Promise<void>;
```

- [ ] **Step 4: Pass `userStats` as a prop in `AdminSettings.tsx`**

Find the `<UserAccountsTab` usage (around line 189). Add the prop:
```tsx
userStats={admin.userStats}
```

- [ ] **Step 5: Update `UserAccountsTab` to accept and use `userStats` prop**

In `UserAccountsTab.tsx`, add to the props interface (after `approverEntityMap`):
```ts
userStats: { total: number; active: number; disabled: number; agents: number };
```

Add `userStats` to the destructured props:
```ts
    approverEntityMap,
    userStats,
    onSearch,
```

Replace the `stats` useMemo (lines 65–71) with:
```ts
const stats = {
    total: userStats.total,
    active: userStats.active,
    disabled: userStats.disabled,
    agents: userStats.agents,
};
```

Remove the `useMemo` import if it's no longer used (check — it may still be used elsewhere; if only `stats` used it, remove it from the import).

- [ ] **Step 6: Verify in browser**

Open User Accounts tab. Stats cards should show correct total counts matching the pagination total. Change page — counts should not change.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx frontend/src/components/admin/useAdminState.ts frontend/pages/AdminSettings.tsx
git commit -m "fix(user-accounts): stats cards now show real totals via parallel backend count queries"
```

---

### Task 2: Fix disabled-row opacity hiding the Enable button

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Scope opacity to non-action cells only**

Find (around line 162):
```tsx
<tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
```
Replace with:
```tsx
<tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
```

Then on each `<td>` that should be dimmed for disabled users, add a conditional class. The pattern: add `${!user.isActive ? 'opacity-50' : ''}` to User, Entity, Roles, Agent Team, and Status cells — but NOT the Actions cell.

User cell (around line 163):
```tsx
<td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
```

Entity cell (around line 167):
```tsx
<td className={`px-8 py-5 text-sm text-[#44546f] ${!user.isActive ? 'opacity-50' : ''}`}>
```

Roles cell (around line 183):
```tsx
<td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
```

Agent Team cell (around line 192):
```tsx
<td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
```

Status cell (around line 201):
```tsx
<td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
```

Actions cell — leave unchanged (no opacity class).

- [ ] **Step 2: Verify in browser**

Disable a user. The name/email/roles should appear faded but the action buttons should remain at full opacity. The Enable button (check_circle icon) should be clearly clickable.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx
git commit -m "fix(user-accounts): scope opacity-50 to data cells only, keep action buttons fully visible for disabled users"
```

---

### Task 3: Fix save-roles silent no-op when zero roles selected

**Files:**
- Modify: `frontend/src/components/admin/useAdminState.ts`

- [ ] **Step 1: Replace silent guard with a toast error**

Find (around line 877):
```ts
const handleSaveRoles = useCallback(async () => {
    if (!roleModalUser || roleModalSelected.length === 0) return;
```
Replace with:
```ts
const handleSaveRoles = useCallback(async () => {
    if (!roleModalUser) return;
    if (roleModalSelected.length === 0) {
        showToast('error', 'A user must have at least one role.');
        return;
    }
```

- [ ] **Step 2: Verify in browser**

Open Manage Roles for a user, deselect all roles, click Save. A red toast should appear: "A user must have at least one role."

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/admin/useAdminState.ts
git commit -m "fix(user-accounts): show error toast when saving roles with zero roles selected instead of silent no-op"
```

---

### Task 4: Fix stale closure in debouncedSearch useEffect

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Add missing deps to the effect**

Find (around line 55):
```tsx
useEffect(() => {
    if (debouncedSearch !== userSearch) {
        onSearch(debouncedSearch);
    }
}, [debouncedSearch]);
```
Replace with:
```tsx
useEffect(() => {
    if (debouncedSearch !== userSearch) {
        onSearch(debouncedSearch);
    }
}, [debouncedSearch, userSearch, onSearch]);
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx
git commit -m "fix(user-accounts): add missing useEffect deps for debouncedSearch to prevent stale closure"
```

---

### Task 5: Add disable-account confirmation dialog

Disabling a user account is irreversible in the short term — it should require confirmation.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Add `confirmDisableUser` state in `useAdminState.ts`**

Find the block of modal state declarations (around line 100–130, look for `showCreateUserModal`). Add:
```ts
confirmDisableUser: any | null;
setConfirmDisableUser: (user: any | null) => void;
```

Find the corresponding `useState` declarations block and add:
```ts
const [confirmDisableUser, setConfirmDisableUser] = useState<any | null>(null);
```

Export both from the return object (find `handleToggleUserStatus,` and add after):
```ts
confirmDisableUser,
setConfirmDisableUser,
```

- [ ] **Step 2: Wire `onToggleUserStatus` to show confirm dialog for disabling only**

In `AdminSettings.tsx`, find the `onToggleUserStatus` prop (around line 195):
```tsx
onToggleUserStatus={admin.handleToggleUserStatus}
```
Replace with:
```tsx
onToggleUserStatus={(user) => {
    if (user.isActive) {
        admin.setConfirmDisableUser(user);
    } else {
        admin.handleToggleUserStatus(user);
    }
}}
```

- [ ] **Step 3: Add the confirmation modal in `AdminSettings.tsx`**

In the modals section (after the Reset Password Modal, around line 344), add:
```tsx
{/* Disable User Confirmation */}
{admin.confirmDisableUser && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => admin.setConfirmDisableUser(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-red-600">block</span>
                </div>
                <div>
                    <h3 className="text-base font-black text-[#101418]">Disable Account</h3>
                    <p className="text-sm text-[#44546f] mt-0.5">
                        Disable <strong className="text-[#101418]">{admin.confirmDisableUser.firstName} {admin.confirmDisableUser.lastName}</strong>? They will lose access immediately.
                    </p>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button
                    onClick={() => admin.setConfirmDisableUser(null)}
                    className="px-4 py-2 text-sm font-semibold text-[#44546f] hover:text-[#101418] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={() => { admin.handleToggleUserStatus(admin.confirmDisableUser); admin.setConfirmDisableUser(null); }}
                    className="flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                    Disable Account
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 4: Verify in browser**

Click the Disable (block) icon on an active user → confirmation modal appears. Click Cancel → nothing happens. Click Disable Account → user is disabled, stats update.

Click Enable (check_circle) on a disabled user → no modal, enables immediately.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx frontend/src/components/admin/useAdminState.ts frontend/pages/AdminSettings.tsx
git commit -m "feat(user-accounts): require confirmation before disabling a user account"
```

---

### Task 6: Add status filter (Active / Disabled) + active-filter indicator on role dropdown

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Add `userStatusFilter` state in `useAdminState.ts`**

Find `userRoleFilter` state (search for `setUserRoleFilter`). Add alongside it:
```ts
const [userStatusFilter, setUserStatusFilter] = useState<'' | 'active' | 'disabled'>('');
```

Export from return object (add after `userRoleFilter`):
```ts
userStatusFilter,
setUserStatusFilter,
```

Add to interface (after `userRoleFilter: string;`):
```ts
userStatusFilter: '' | 'active' | 'disabled';
setUserStatusFilter: (v: '' | 'active' | 'disabled') => void;
```

- [ ] **Step 2: Pass status filter into `fetchUsers`**

Update the `fetchUsers` call to include isActive. Find the `fetchUsers` function signature (around line 444):
```ts
const fetchUsers = useCallback(async (page = 1, search = '', roleFilter = '') => {
    setUsersLoading(true);
    try {
        const result = await adminService.listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined });
```
Replace with:
```ts
const fetchUsers = useCallback(async (page = 1, search = '', roleFilter = '', statusFilter: '' | 'active' | 'disabled' = '') => {
    setUsersLoading(true);
    try {
        const isActive = statusFilter === 'active' ? true : statusFilter === 'disabled' ? false : undefined;
        const result = await adminService.listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined, isActive });
```

Update the interface type for `fetchUsers` (around line 188):
```ts
fetchUsers: (page?: number, search?: string, roleFilter?: string, statusFilter?: '' | 'active' | 'disabled') => Promise<void>;
```

- [ ] **Step 3: Add `onStatusFilter` prop to `UserAccountsTab`**

In `UserAccountsTabProps` interface, add:
```ts
userStatusFilter: '' | 'active' | 'disabled';
onStatusFilter: (value: '' | 'active' | 'disabled') => void;
```

Add to destructured props:
```ts
    userStatusFilter,
    onStatusFilter,
```

- [ ] **Step 4: Render status filter buttons in the filter bar**

In `UserAccountsTab.tsx`, in the header filter row (after the role `<select>` and before the Create User button), insert:
```tsx
<div className="flex items-center rounded-2xl border border-gray-200 bg-white overflow-hidden text-sm font-bold">
    {([['', 'All'], ['active', 'Active'], ['disabled', 'Disabled']] as const).map(([val, label]) => (
        <button
            key={val}
            onClick={() => onStatusFilter(val)}
            className={`px-3 py-3 transition-colors whitespace-nowrap ${
                userStatusFilter === val
                    ? 'bg-[#0052cc] text-white'
                    : 'text-[#44546f] hover:bg-gray-50'
            }`}
        >
            {label}
        </button>
    ))}
</div>
```

- [ ] **Step 5: Add active-filter visual indicator on the role dropdown**

Wrap the role `<select>` in a relative div and show a blue dot when a filter is active:
```tsx
<div className="relative">
    <select
        className={`pl-4 pr-10 py-3 bg-white border rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none appearance-none ${userRoleFilter ? 'border-[#0052cc] text-[#0052cc]' : 'border-gray-200'}`}
        value={userRoleFilter}
        onChange={e => onRoleFilter(e.target.value)}
    >
        <option value="">All Roles</option>
        {availableRoles.map(r => (
            <option key={r.id} value={r.name}>{r.name}</option>
        ))}
    </select>
    {userRoleFilter && (
        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#0052cc]" />
    )}
</div>
```

- [ ] **Step 6: Wire status filter in `AdminSettings.tsx`**

Find the `<UserAccountsTab` prop block and add:
```tsx
userStatusFilter={admin.userStatusFilter}
onStatusFilter={(v) => { admin.setUserStatusFilter(v); admin.fetchUsers(1, admin.userSearch, admin.userRoleFilter, v); }}
```

Also update the existing `onRoleFilter` and `onSearch` wires to pass `userStatusFilter`:
```tsx
onRoleFilter={(v) => admin.fetchUsers(1, admin.userSearch, v, admin.userStatusFilter)}
onSearch={(v) => admin.fetchUsers(1, v, admin.userRoleFilter, admin.userStatusFilter)}
onFetchUsers={(page) => admin.fetchUsers(page, admin.userSearch, admin.userRoleFilter, admin.userStatusFilter)}
```

- [ ] **Step 7: Verify in browser**

1. Click **Active** filter button — only active users show, button is highlighted blue.
2. Click **Disabled** — only disabled users show.
3. Click **All** — all users return.
4. Select a role in the dropdown — the dropdown border turns blue.
5. Combine status + role filter — both apply simultaneously.

- [ ] **Step 8: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx frontend/src/components/admin/useAdminState.ts frontend/pages/AdminSettings.tsx
git commit -m "feat(user-accounts): add Active/Disabled status filter + active-filter indicator on role dropdown"
```

---

### Task 7: UX polish — action button grouping, Import Staff placement, empty state CTA

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Group action buttons — separate destructive from safe**

Find the actions cell `<div className="flex justify-end gap-2">` (around line 207). Replace with a version that uses a divider between safe and destructive actions:

```tsx
<div className="flex justify-end items-center gap-1">
    {/* Safe actions */}
    <button
        onClick={() => onEditUser(user)}
        className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
        title="Edit user details"
        aria-label={`Edit ${user.firstName} ${user.lastName}`}
    >
        <span className="material-symbols-outlined text-lg">edit</span>
    </button>
    <button
        onClick={() => onManageRoles(user)}
        className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
        title="Manage roles"
        aria-label={`Manage roles for ${user.firstName} ${user.lastName}`}
    >
        <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
    </button>
    <button
        onClick={() => onResetPassword(user)}
        className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
        title="Reset password"
        aria-label={`Reset password for ${user.firstName} ${user.lastName}`}
    >
        <span className="material-symbols-outlined text-lg">key</span>
    </button>
    {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
        <button
            onClick={() => onAssignAgentTeam(user)}
            className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
            title="Assign agent team"
            aria-label={`Assign agent team for ${user.firstName} ${user.lastName}`}
        >
            <span className="material-symbols-outlined text-lg">groups</span>
        </button>
    )}
    {/* Divider */}
    <div className="w-px h-6 bg-gray-200 mx-1" />
    {/* Destructive action */}
    <button
        onClick={() => onToggleUserStatus(user)}
        className={`w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${user.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'}`}
        title={user.isActive ? 'Disable account' : 'Enable account'}
        aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.firstName} ${user.lastName}`}
    >
        <span className="material-symbols-outlined text-lg">{user.isActive ? 'block' : 'check_circle'}</span>
    </button>
</div>
```

- [ ] **Step 2: Move Import Staff out of the primary filter bar into a secondary position**

Find the filter bar div (around line 76):
```tsx
<div className="p-8 border-b border-gray-100 flex flex-col md:flex-row gap-4 bg-gray-50/20">
```

Move the Import Staff button out of this row. Place it in a small secondary row above the filter bar:
```tsx
{/* Sub-header with Import Staff */}
<div className="px-8 pt-6 pb-0 flex justify-end">
    <button
        onClick={onImportStaff}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-[#44546f] text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
    >
        <span className="material-symbols-outlined text-sm">upload_file</span>
        Import Staff
    </button>
</div>
{/* Header / Filters */}
<div className="px-8 pb-6 border-b border-gray-100 flex flex-col md:flex-row gap-4">
```

Remove the Import Staff button from inside the filter bar row.

- [ ] **Step 3: Add Import Staff to empty state CTA**

Find the empty state block (around line 254):
```tsx
{!userSearch && !userRoleFilter && (
    <button
        onClick={onCreateUser}
        className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0047b3] transition-colors"
    >
        <span className="material-symbols-outlined text-sm">person_add</span>
        Create User
    </button>
)}
```
Replace with:
```tsx
{!userSearch && !userRoleFilter && !userStatusFilter && (
    <div className="mt-1 flex items-center gap-2">
        <button
            onClick={onCreateUser}
            className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0047b3] transition-colors"
        >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Create User
        </button>
        <button
            onClick={onImportStaff}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#0052cc] text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors"
        >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            Import Staff
        </button>
    </div>
)}
```

- [ ] **Step 4: Verify in browser**

1. Action buttons have a visible divider separating safe actions from the Disable/Enable button.
2. The Enable button on a disabled user is green, clearly distinct.
3. Import Staff button is in the top-right sub-header, not in the search bar.
4. Empty state shows both Create User and Import Staff.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/admin/UserAccountsTab.tsx
git commit -m "feat(user-accounts): group action buttons with divider, move Import Staff out of filter bar, add Import Staff to empty state"
```

---

## Self-Review Checklist

- [x] **Bug: stats page-scoped** — Task 1
- [x] **Bug: disabled row opacity hides Enable button** — Task 2
- [x] **Bug: save-roles silent no-op** — Task 3
- [x] **Bug: stale closure in debouncedSearch effect** — Task 4
- [x] **UX: disable confirmation** — Task 5
- [x] **UX: status filter** — Task 6
- [x] **UX: role filter active indicator** — Task 6
- [x] **UX: action button grouping** — Task 7
- [x] **UX: Import Staff placement** — Task 7
- [x] **UX: empty state Import Staff CTA** — Task 7
- [x] No TBDs or placeholder steps
- [x] `userStatusFilter` type `'' | 'active' | 'disabled'` consistent across all three files
- [x] `fetchUsers` signature extended with optional 4th param — backward compatible (default `''`)
