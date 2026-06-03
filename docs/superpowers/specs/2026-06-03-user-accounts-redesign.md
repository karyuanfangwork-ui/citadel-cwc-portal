# User Accounts Tab — Redesign Spec
**Date:** 2026-06-03  
**Status:** Approved  
**File:** `frontend/src/components/admin/UserAccountsTab.tsx`

---

## Problem

The User Accounts table causes horizontal scrolling at standard desktop widths (~1280px) due to three compounding issues:

1. **Excessive cell padding** — `px-8 py-5` (32px/20px) on every cell
2. **Sparse "Agent Team" column** — always visible but shows `—` for ~90% of non-agent users
3. **Wide actions column** — up to 5 inline icon buttons (~220px minimum width)
4. **Disconnected header** — "Import Staff" floats in its own row above the filter bar

---

## Design Decisions

### 1. Column count: 6 → 5
Remove the standalone "Agent Team" column. Move the agent team badge inline under the user's name (third line), shown only when the user has the `AGENT` role. This is consistent with how the "Approver" badge already works in the Entity cell.

**Before:**
```
User | Entity | Roles | Agent Team | Status | Actions
```
**After:**
```
User (+ agent team badge inline) | Entity | Roles | Status | Actions
```

### 2. Cell padding: comfortable density
Change all table cells from `px-8 py-5` → `px-5 py-4` (20px/16px). Saves ~144px of total row width across 6 columns. Consistent with the `--space-5` / `--space-4` design tokens.

### 3. Actions: Edit button + overflow menu
Replace the 5 inline icon buttons with a compact two-element pattern:
- **"✏️ Edit" button** — primary action, always visible, text label so intent is clear
- **"···" overflow button** — opens a dropdown with the remaining actions

Overflow menu contents:
| Item | Condition |
|------|-----------|
| 🛡️ Manage Roles | Always |
| 🔑 Reset Password | Always |
| 👥 Assign Agent Team | Only when user has AGENT role |
| 🚫 Disable Account | When `isActive: true` |
| ✅ Enable Account | When `isActive: false` |

The overflow menu is a standard `<div>` positioned dropdown, closed on outside click or Escape key.

### 4. Action bar: unified single row
Remove the separate "Import Staff" sub-header row. Merge all controls into one bar:

```
[ 🔍 Search... ] [ All Roles ▾ ] [ All | Active | Disabled ] [ 📤 Import Staff ] [ ＋ Create User ]
```

"Import Staff" is a secondary outlined button. "Create User" is the primary brand-colored button.

---

## Design System Tokens

All values must use CWC tokens, not hardcoded hex:

| Element | Token |
|---------|-------|
| Primary button background | `--color-brand-700` (#1D2D5E) |
| Primary button hover | `--color-brand-600` (#2E4A7A) |
| Role badges | `--color-it-50/100/500` |
| Active status badge | `--color-hr-50/100/500` |
| Agent team badge | `--color-fin-50/100/500` |
| Disabled status badge | `--color-surface-muted`, `--color-text-secondary`, `--color-border` |
| Approver badge | violet (retain existing `bg-violet-50 text-violet-700`) |
| Button/input border radius | `--radius-lg` (16px) |
| Badge border radius | `--radius-full` (9999px) |
| Action button border radius | `--radius-sm` (6px) |
| Table header background | `--color-surface-subtle` |
| Row hover background | `--color-surface-subtle` |
| Row divider | `--color-border-subtle` |
| Typography | Plus Jakarta Sans (`--font-sans`) |

---

## Component Changes

### `UserAccountsTab.tsx`
- Remove the `pt-6 pb-0 flex justify-end` sub-header block (Import Staff button)
- Add Import Staff button into the main filter bar row
- Change cell padding: `px-8 py-5` → `px-5 py-4` on all `<td>` and `<th>`
- Remove `<th>Agent Team</th>` column header
- Remove Agent Team `<td>` cell from each row
- In the User `<td>`: add a third line rendering the agent team badge when `user.agentTeam` is set and user has AGENT role
- Replace the 5-button actions cluster with Edit button + `···` overflow menu
- Add local state `openMenuId: string | null` to track which row's menu is open
- Add `useEffect` for outside-click to close menu

### No backend changes required.
### No prop interface changes required — all data already available.

---

## Non-Goals
- No changes to the UserEditModal
- No changes to pagination
- No changes to the stats cards layout
- No changes to empty state UI
- No mobile-specific layout changes
