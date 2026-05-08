# Admin Account Management UX Refinement — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Elevate the Admin Console's User Accounts tab from a basic CRUD table to an enterprise-grade account management experience with search UX, loading states, accessibility, password reset, modal consistency, URL routing, and summary metrics.

**Architecture:** Incremental refinement of existing components — no full rewrite. Each task is a targeted improvement to a single file or tight group of files. Reuse existing admin service layer and modal patterns. Follow the CreateUserModal as the visual reference (rounded-2xl, blue-50 header, consistent button styling).

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React Router v7, existing `adminService` + `useAdminState`

**Current State (from audit):**
- Score: 5.1/10 production readiness
- 10 critical/high issues, 10 quick wins identified
- Zero ARIA, no debounce, inconsistent modals, no password reset, no tab URL routing, no skeleton loading

---

## Phase 1: Critical Quick Wins (Estimated: 1.5 days)

### Task 1: Add debounced search to UserAccountsTab

**Objective:** Prevent API spam on every keystroke by debouncing the search input (300ms).

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

**Step 1: Create a `useDebounce` hook inline in UserAccountsTab**

Add this hook at the top of the file (below imports):

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

**Step 2: Debounce the search value**

In the component body, add:

```tsx
const [searchInput, setSearchInput] = useState(userSearch);
const debouncedSearch = useDebounce(searchInput, 300);

useEffect(() => {
  if (debouncedSearch !== userSearch) {
    onSearch(debouncedSearch);
  }
}, [debouncedSearch]);
```

**Step 3: Wire the local state to the input**

Change the input from controlled by `userSearch` to controlled by `searchInput`:

```tsx
<input
    type="text"
    placeholder="Search by name or email..."
    className="..."
    value={searchInput}
    onChange={e => setSearchInput(e.target.value)}
/>
```

**Step 4: Sync external changes (role filter resets search)**

Add effect to sync when `userSearch` changes externally:

```tsx
useEffect(() => {
  setSearchInput(userSearch);
}, [userSearch]);
```

**Verification:** Type in search box rapidly — only one API call fires after 300ms of inactivity. Network tab shows fewer requests.

---

### Task 2: Add skeleton loading rows to UserAccountsTab

**Objective:** Replace the plain "Loading users..." text with animated skeleton rows for professional perception.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

**Step 1: Replace the loading block**

Replace:

```tsx
{usersLoading ? (
    <div className="p-16 text-center text-[#44546f] font-bold">Loading users...</div>
) : (
```

With:

```tsx
{usersLoading ? (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded-lg w-32" /></td>
          <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded-lg w-24" /></td>
          <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded-lg w-20" /></td>
          <td className="px-8 py-5"><div className="flex gap-1"><div className="h-5 bg-gray-200 rounded-full w-14" /><div className="h-5 bg-gray-200 rounded-full w-10" /></div></td>
          <td className="px-8 py-5"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
          <td className="px-8 py-5"><div className="h-5 bg-gray-200 rounded-full w-14" /></td>
          <td className="px-8 py-5"><div className="flex gap-2 justify-end"><div className="h-10 w-10 bg-gray-200 rounded-xl" /><div className="h-10 w-10 bg-gray-200 rounded-xl" /></div></td>
        </tr>
      ))}
    </div>
) : (
```

Note: wrap the skeletons inside `<tbody>` since the table structure expects it. Use the same `<table>` shell but replace the `<tbody>` content.

**Verification:** Navigate to User Accounts tab — see 5 animated shimmer rows instead of "Loading users..." text.

---

### Task 3: Standardize UserEditModal styling to match CreateUserModal

**Objective:** Unify the visual style of UserEditModal to use the same rounded-2xl, blue-50 header, consistent button styling as CreateUserModal.

**Files:**
- Modify: `frontend/src/components/admin/UserEditModal.tsx`

**Step 1: Update the modal overlay**

Replace:
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
```
With:
```tsx
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
```

**Step 2: Update the modal container**

Replace:
```tsx
<div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden">
```
With:
```tsx
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
```

**Step 3: Update the header**

Replace the gradient header:
```tsx
<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
  <h2 className="text-lg font-bold text-gray-900">Edit Employee</h2>
```
With:
```tsx
<div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
  <div className="flex items-center gap-3">
    <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
      <span className="material-symbols-outlined text-[#0052cc]">edit</span>
    </div>
    <div>
      <h2 className="font-bold text-base text-gray-900">Edit Employee</h2>
      <p className="text-xs text-gray-500">{user.firstName} {user.lastName}</p>
    </div>
  </div>
```

**Step 4: Update all input styling**

Replace all instances of:
```tsx
className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
```
With:
```tsx
className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
```

**Step 5: Update all select styling**

Same pattern — replace `border-gray-300` with `border-gray-200`, `focus:ring-2 focus:ring-blue-500` with `focus:border-[#0052cc]`, add `bg-white`.

**Step 6: Update the footer/button area**

Replace:
```tsx
<div className="flex gap-3 pt-4 border-t border-gray-100">
  <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
  <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
```
With:
```tsx
<div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
  <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
  <button type="submit" disabled={loading} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50 disabled:cursor-not-allowed">
```

**Verification:** Open UserEditModal — it should visually match CreateUserModal (same border radius, header icon, button styling).

---

### Task 4: Standardize RoleAssignmentModal styling

**Objective:** Normalize the ultra-pill rounded-[40px] style to match the standard rounded-2xl pattern.

**Files:**
- Modify: `frontend/src/components/admin/RoleAssignmentModal.tsx`

**Step 1: Update the modal container**

Replace:
```tsx
<div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]">
```
With:
```tsx
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
```

**Step 2: Update the header**

Replace:
```tsx
<div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
    <div>
        <h2 className="text-2xl font-black text-[#101418]">Assign Roles</h2>
        <p className="text-sm text-[#44546f] mt-1">{user.firstName} {user.lastName}</p>
    </div>
    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
        <span className="material-symbols-outlined text-3xl">close</span>
    </button>
</div>
```
With matching CreateUserModal pattern:
```tsx
<div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
    <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">admin_panel_settings</span>
        </div>
        <div>
            <h2 className="font-bold text-base text-gray-900">Assign Roles</h2>
            <p className="text-xs text-gray-500">{user.firstName} {user.lastName}</p>
        </div>
    </div>
    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
        <span className="material-symbols-outlined text-gray-400">close</span>
    </button>
</div>
```

**Step 3: Update the body and button area**

Replace the oversized padding (`p-10`) with standard spacing (`p-5`), and normalize button styling:

```tsx
<div className="p-5 overflow-y-auto">
    ...
    <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={onSave} disabled={selectedRoles.length === 0} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50 disabled:cursor-not-allowed">Save Roles</button>
    </div>
</div>
```

**Verification:** Open RoleAssignmentModal — matches CreateUserModal visual pattern.

---

### Task 5: Standardize AgentTeamModal styling

**Objective:** Same normalization as Task 4 — rounded-[40px] → rounded-2xl, consistent header/footer.

**Files:**
- Modify: `frontend/src/components/admin/AgentTeamModal.tsx`

**Step 1: Container**

Replace `rounded-[40px]` with `rounded-2xl`, remove `scale-in`.

**Step 2: Header**

Same pattern as Task 4 — icon + title + user name in a blue-50 badge, close button sized like CreateUserModal.

**Step 3: Footer buttons**

Replace `rounded-3xl` with `rounded-lg`, normalize to `px-4 py-2.5` sizing, use `bg-[#0052cc]` / `bg-gray-100` pattern.

**Verification:** Open AgentTeamModal — consistent with other modals.

---

### Task 6: Add URL-based tab routing to AdminSettings

**Objective:** Admin tab state persists in URL so `/admin/settings?tab=users` opens directly to the User Accounts tab. Enables deep linking and bookmarking.

**Files:**
- Modify: `frontend/pages/AdminSettings.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`

**Step 1: Read URL search params on mount**

In `AdminSettings.tsx`, add `useSearchParams` from react-router-dom:

```tsx
import { useSearchParams } from 'react-router-dom';

const AdminSettings = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const admin = useAdminState();
    ...
```

**Step 2: Initialize tab from URL param**

After `admin` is initialized, add a sync effect:

```tsx
useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ADMIN_TABS.some(t => t.id === tabFromUrl)) {
        admin.setActiveTab(tabFromUrl as AdminTabId);
    }
}, [searchParams]);
```

**Step 3: Update URL when tab changes**

In `useAdminState.ts`, update the `setActiveTab` to be wrapped:

Export a wrapper in AdminSettings that also updates the URL:

```tsx
const handleTabChange = (tabId: AdminTabId) => {
    admin.setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
};
```

Then use `handleTabChange` instead of `admin.setActiveTab` in the sidebar `onClick`.

**Step 4: Clean up the useEffect in useAdminState**

In `useAdminState.ts`, the existing `useEffect` that fetches data based on `activeTab` should remain unchanged — it already reacts to `activeTab` changes. The URL sync is purely additive.

**Verification:** Navigate to `/admin/settings?tab=users` — User Accounts tab opens. Click "Permissions" — URL updates to `?tab=permissions`. Refresh page — same tab is shown.

---

### Task 7: Add user count summary cards above the table

**Objective:** Show at-a-glance metrics: Total Users, Active, Disabled, Agents — above the user table.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

**Step 1: Compute stats from users array**

Add a `useMemo` at the top of the component:

```tsx
const stats = useMemo(() => {
    const total = userPagination.total;
    const active = users.filter(u => u.isActive).length;
    const disabled = users.filter(u => !u.isActive).length;
    const agents = users.filter(u => u.roles?.some((ur: any) => ur.role?.name === 'AGENT')).length;
    return { total, active, disabled, agents };
}, [users, userPagination.total]);
```

**Step 2: Render summary cards**

Add after the header/filters div and before the table:

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-8 pt-0 -mt-2">
    {[
        { label: 'Total Users', value: stats.total, icon: 'group', color: 'bg-blue-50 text-blue-600' },
        { label: 'Active', value: stats.active, icon: 'check_circle', color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Disabled', value: stats.disabled, icon: 'block', color: 'bg-gray-100 text-gray-500' },
        { label: 'Agents', value: stats.agents, icon: 'support_agent', color: 'bg-amber-50 text-amber-600' },
    ].map(card => (
        <div key={card.label} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                <span className="material-symbols-outlined text-lg">{card.icon}</span>
            </div>
            <div>
                <p className="text-xl font-black text-[#101418] leading-tight">{card.value}</p>
                <p className="text-[10px] font-bold text-[#44546f] uppercase tracking-wider">{card.label}</p>
            </div>
        </div>
    ))}
</div>
```

**Note:** The `active` and `disabled` counts are from the current page only (not global). If global counts are needed, the backend `listUsers` response should include `totalActive` / `totalDisabled`. For now, page-level counts are acceptable — add a footnote: "Showing counts for current page".

**Verification:** User Accounts tab shows 4 stat cards above the search/filter bar.

---

## Phase 2: Admin Password Reset (Estimated: 0.5 day)

### Task 8: Add "Reset Password" backend endpoint

**Objective:** Allow admins to trigger a password reset for a user, generating a new temp password (similar to `createUser`).

**Files:**
- Create: `backend/src/controllers/auth.controller.ts` (add method if not exists)
- Modify: `backend/src/routes/user.routes.ts`

**Step 1: Add the reset method to userController**

In `backend/src/controllers/user.controller.ts`, add a new method:

```typescript
resetUserPassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const tempPassword = crypto.randomBytes(12).toString('base64url').slice(0, 16);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.update({
        where: { id },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // Force-revoke all active sessions
    await tokenService.revokeAllUserTokens(id);

    await auditLog('USER_PASSWORD_RESET', req.user!.id, { targetUserId: id });

    res.json({
        status: 'success',
        data: { tempPassword },
    });
});
```

**Step 2: Add route**

In `backend/src/routes/user.routes.ts`, add:

```typescript
router.post('/:id/reset-password', authorize('ADMIN'), userController.resetUserPassword);
```

**Step 3: Add to admin.service.ts**

In `frontend/src/services/admin.service.ts`, add:

```typescript
async resetUserPassword(userId: string): Promise<{ tempPassword: string }> {
    const response = await apiClient.post(`/users/${userId}/reset-password`);
    return response.data.data;
}
```

**Verification:** `curl -X POST http://localhost:3000/api/v1/users/{id}/reset-password -H "Authorization: Bearer {admin_jwt}"` returns `{ data: { tempPassword: "..." } }`.

---

### Task 9: Add "Reset Password" button and modal to UserAccountsTab

**Objective:** Admin can click a key icon to reset a user's password. A modal shows the new temp password with copy-to-clipboard.

**Files:**
- Create: `frontend/src/components/admin/ResetPasswordModal.tsx`
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`
- Modify: `frontend/pages/AdminSettings.tsx`
- Modify: `frontend/src/components/admin/index.ts`

**Step 1: Create ResetPasswordModal.tsx**

```tsx
import React, { useState } from 'react';
import { adminService } from '../../services/admin.service';

interface ResetPasswordModalProps {
    user: { id: string; firstName: string; lastName: string; email: string };
    onClose: () => void;
    onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
    const [phase, setPhase] = useState<'confirm' | 'result'>('confirm');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState('');
    const [copied, setCopied] = useState(false);

    const handleReset = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await adminService.resetUserPassword(user.id);
            setTempPassword(result.tempPassword);
            setPhase('result');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-amber-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-amber-600">key</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Reset Password</h2>
                            <p className="text-xs text-gray-500">{user.firstName} {user.lastName} ({user.email})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto">
                    {phase === 'confirm' ? (
                        <div>
                            <div className="p-5 space-y-4">
                                <p className="text-sm text-[#44546f]">
                                    This will generate a new temporary password for <strong>{user.firstName} {user.lastName}</strong>.
                                    Their current password and all active sessions will be invalidated.
                                </p>
                                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            </div>
                            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="button" onClick={handleReset} disabled={loading} className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    <span className="text-sm font-bold">Password reset successfully</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">New Temporary Password</p>
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                        <code className="flex-1 text-sm font-mono font-bold text-amber-800">{tempPassword}</code>
                                        <button type="button" onClick={handleCopy} className="text-amber-600 hover:text-amber-800 transition-colors">
                                            <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5">Share this with the user. They must change it after logging in.</p>
                                </div>
                            </div>
                            <div className="flex justify-end p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={() => { onSuccess(); onClose(); }} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3]">Done</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordModal;
```

**Step 2: Add state to useAdminState.ts**

Add:

```typescript
const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
```

Return `resetPasswordUser` and `setResetPasswordUser` from the hook.

**Step 3: Add "Reset Password" button to UserAccountsTab actions column**

Add a new icon button between edit and manage-roles:

```tsx
<button
    onClick={() => onResetPassword(user)}
    className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
    title="Reset password"
>
    <span className="material-symbols-outlined text-xl">key</span>
</button>
```

Add `onResetPassword` to `UserAccountsTabProps`.

**Step 4: Wire in AdminSettings.tsx**

Add the modal and wire the handler:

```tsx
{admin.resetPasswordUser && (
    <ResetPasswordModal
        user={admin.resetPasswordUser}
        onClose={() => admin.setResetPasswordUser(null)}
        onSuccess={() => admin.fetchUsers(admin.userPagination.page)}
    />
)}
```

Update UserAccountsTab props:

```tsx
onResetPassword={(user) => admin.setResetPasswordUser(user)}
```

**Step 5: Export from index.ts**

```typescript
export { default as ResetPasswordModal } from './ResetPasswordModal';
```

**Verification:** Admin clicks key icon on a user row → confirm modal → reset → new temp password shown with copy button. User's old sessions are revoked.

---

## Phase 3: Accessibility Foundation (Estimated: 1 day)

### Task 10: Add ARIA labels to UserAccountsTab table and actions

**Objective:** Make the user table navigable by screen readers with proper labels, roles, and descriptions.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

**Step 1: Add role and aria-label to the table**

```tsx
<table className="w-full text-left" role="table" aria-label="User accounts">
```

**Step 2: Add aria-label to action buttons**

Each action button gets a descriptive label:

```tsx
<button aria-label={`Edit ${user.firstName} ${user.lastName}`} ...>
<button aria-label={`Manage roles for ${user.firstName} ${user.lastName}`} ...>
<button aria-label={`Reset password for ${user.firstName} ${user.lastName}`} ...>
<button aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.firstName} ${user.lastName}`} ...>
```

**Step 3: Add role="status" to loading and empty states**

```tsx
<div role="status" className="divide-y divide-gray-100 animate-pulse">
```

```tsx
<td colSpan={7} role="status" className="...">No users found.</td>
```

**Verification:** Navigate the table using a screen reader (VoiceOver/NVDA) — each cell and action button is announced correctly.

---

### Task 11: Add keyboard focus trap to all admin modals

**Objective:** When a modal opens, focus is trapped inside it. Tab cycles through the modal's interactive elements. Escape closes.

**Files:**
- Modify: `frontend/src/components/admin/CreateUserModal.tsx`
- Modify: `frontend/src/components/admin/UserEditModal.tsx`
- Modify: `frontend/src/components/admin/RoleAssignmentModal.tsx`
- Modify: `frontend/src/components/admin/AgentTeamModal.tsx`
- Create: `frontend/src/hooks/useFocusTrap.ts`

**Step 1: Create a reusable `useFocusTrap` hook**

```typescript
// frontend/src/hooks/useFocusTrap.ts
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Focus the first focusable element
    const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let the parent close handler manage this
        return;
      }
      if (e.key !== 'Tab') return;

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}
```

**Step 2: Apply to each modal**

In each modal component, add:

```tsx
const containerRef = useFocusTrap(true);
```

And add `ref={containerRef}` to the outermost modal `<div>`.

Also add Escape key handling to the onClose:

```tsx
useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

**Step 3: Add `role="dialog"` and `aria-modal="true"`**

```tsx
<div ref={containerRef} className="fixed inset-0 ..." role="dialog" aria-modal="true" aria-label="Create User">
```

**Verification:** Open any modal → Tab cycles through elements → Shift+Tab goes backward → Escape closes → focus never leaves the modal.

---

## Phase 4: Data Quality & Email Safety (Estimated: 0.5 day)

### Task 12: Add department datalist with existing values

**Objective:** Replace free-text department input with a `<datalist>` that suggests existing departments from the database.

**Files:**
- Modify: `frontend/src/components/admin/CreateUserModal.tsx`
- Modify: `frontend/src/components/admin/UserEditModal.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts`

**Step 1: Compute unique department list in useAdminState**

Add to the return value:

```typescript
const departments = useMemo(() => {
    const deptSet = new Set<string>();
    users.forEach(u => { if (u.department) deptSet.add(u.department); });
    return Array.from(deptSet).sort();
}, [users]);
```

**Step 2: Pass departments down to CreateUserModal and UserEditModal**

Add `departments: string[]` to both modal prop interfaces.

**Step 3: Use datalist in both modals**

In the department input:

```tsx
<input
    name="department"
    value={form.department}
    onChange={handleChange}
    placeholder="e.g. IT, HR, Finance"
    className="..."
    list="department-suggestions"
/>
<datalist id="department-suggestions">
    {departments.map(d => (
        <option key={d} value={d} />
    ))}
</datalist>
```

Note: Use a unique `id` per modal instance to avoid conflicts if both modals could be open simultaneously (they can't, but defensive coding). Use `department-suggestions-create` and `department-suggestions-edit`.

**Verification:** Department input shows autocomplete suggestions from existing departments. Users can still type custom values (datalist does not restrict).

---

### Task 13: Add email change confirmation step

**Objective:** When admin changes a user's email in UserEditModal, require an explicit confirmation before saving.

**Files:**
- Modify: `frontend/src/components/admin/UserEditModal.tsx`

**Step 1: Track if email was changed**

```tsx
const [emailChangeConfirmed, setEmailChangeConfirmed] = useState(false);
const originalEmail = user?.email || '';
const emailChanged = formData.email !== originalEmail && originalEmail !== '';
```

**Step 2: Show confirmation checkbox when email changes**

Add before the submit button, only visible when email has changed:

```tsx
{emailChanged && !emailChangeConfirmed && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm font-bold text-amber-800 mb-2">
            ⚠️ You are changing this user's login email from <code className="bg-amber-100 px-1 rounded">{originalEmail}</code> to <code className="bg-amber-100 px-1 rounded">{formData.email}</code>
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={emailChangeConfirmed}
                onChange={e => setEmailChangeConfirmed(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded"
            />
            <span className="text-sm font-semibold text-amber-700">Yes, update the login email</span>
        </label>
    </div>
)}
```

**Step 3: Gate the save button**

```tsx
<button
    type="submit"
    disabled={loading || (emailChanged && !emailChangeConfirmed)}
    className="..."
>
```

**Step 4: Reset confirmation when email reverts**

```tsx
useEffect(() => {
    setEmailChangeConfirmed(false);
}, [formData.email]);
```

**Verification:** Change a user's email → see amber warning box → Save button is disabled until checkbox is ticked. Revert email back → warning disappears, Save enabled.

---

## Phase 5: Enhanced Empty State & Navigation (Estimated: 0.5 day)

### Task 14: Add illustrated empty state to UserAccountsTab

**Objective:** Replace the plain "No users found." with a visual empty state that provides guidance.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

**Step 1: Replace the empty row**

```tsx
{users.length === 0 && (
    <tr>
        <td colSpan={7} className="px-8 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-gray-400">person_off</span>
                </div>
                <div>
                    <p className="text-sm font-bold text-[#101418]">
                        {userSearch || userRoleFilter ? 'No users match your filters' : 'No users yet'}
                    </p>
                    <p className="text-xs text-[#44546f] mt-1">
                        {userSearch || userRoleFilter
                            ? 'Try adjusting your search or role filter.'
                            : 'Create your first user to get started.'}
                    </p>
                </div>
                {!userSearch && !userRoleFilter && (
                    <button
                        onClick={onCreateUser}
                        className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0047b3] transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">person_add</span>
                        Create User
                    </button>
                )}
            </div>
        </td>
    </tr>
)}
```

**Verification:** With no users or with filters that match nothing — context-aware empty state appears with icon, message, and optional action button.

---

### Task 15: Fix the Agent Team button that opens Role Modal instead

**Objective:** The "groups" icon button for agents currently calls `onManageRoles(user)` instead of opening the agent team modal. Fix it to call the correct handler.

**Files:**
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`
- Modify: `frontend/src/components/admin/useAdminState.ts` or `frontend/pages/AdminSettings.tsx`

**Step 1: Add `onAssignAgentTeam` prop to UserAccountsTabProps**

```typescript
onAssignAgentTeam: (user: any) => void;
```

**Step 2: Update the groups button**

Replace:
```tsx
<button
    onClick={() => onManageRoles(user)}
    className="..."
    title="Assign agent team (IT/HR)"
>
```
With:
```tsx
<button
    onClick={() => onAssignAgentTeam(user)}
    className="..."
    title="Assign agent team (IT/HR)"
>
```

**Step 3: Wire the handler in AdminSettings.tsx**

Add to UserAccountsTab props:
```tsx
onAssignAgentTeam={(user) => { admin.setRoleModalUser(user); admin.setShowAgentTeamModal(true); }}
```

**Verification:** Click the "groups" icon on an agent row → Agent Team modal opens (not the Role Assignment modal).

---

## Summary

| Phase | Tasks | Est. Time | Impact |
|-------|-------|-----------|--------|
| Phase 1: Quick Wins | T1-T7 | 1.5 days | Search UX, loading polish, visual consistency, URL routing, summary stats |
| Phase 2: Password Reset | T8-T9 | 0.5 day | Critical admin capability |
| Phase 3: Accessibility | T10-T11 | 1 day | ARIA, focus traps, keyboard nav |
| Phase 4: Data Quality | T12-T13 | 0.5 day | Department suggestions, email safety |
| Phase 5: UX Polish | T14-T15 | 0.5 day | Empty states, bug fix |
| **Total** | **15 tasks** | **4 days** | **Score 5.1 → ~7.5/10** |

**Scope explicitly excluded** (future phases):
- Bulk operations toolbar (Phase 6, ~2 days)
- CSV import/export (Phase 7, ~1.5 days)
- User detail/profile page (Phase 8, ~2-3 days)
- User impersonation (Phase 9, ~1 day)
- Mobile responsive card layout (Phase 10, ~1 day)
- Configurable agent teams from DB (Phase 11, ~1 day)