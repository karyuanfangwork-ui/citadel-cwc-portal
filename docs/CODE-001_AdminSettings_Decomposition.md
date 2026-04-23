# CODE-001: Decompose `AdminSettings.tsx`

**Priority:** P1 (High)  
**Effort:** 2 days  
**Created:** April 23, 2026  
**Status:** Not Started

---

## Overview

`AdminSettings.tsx` is 1,808 LOC — the largest file in the frontend. The goal is to extract each inline tab into its own component, reducing the parent to a ~150 LOC shell responsible only for sidebar navigation and tab routing.

---

## Current State

Four tabs are **already extracted** as separate components:

| Tab | Component | File |
|-----|-----------|------|
| `workflow-config` | `WorkflowTransitionTab` | `frontend/src/components/admin/WorkflowTransitionTab.tsx` |
| `banner-config` | `BannerConfigTab` | `frontend/src/components/admin/BannerConfigTab.tsx` |
| `status-definitions` | `StatusDefinitionsTab` | `frontend/src/components/admin/StatusDefinitionsTab.tsx` |
| `permissions` | `PermissionsTab` | `frontend/src/components/admin/PermissionsTab.tsx` |

Four tabs are **still inline** in `AdminSettings.tsx`:

| Tab | Lines | Approx LOC |
|-----|-------|------------|
| `service-desks` | 660–854 | ~195 |
| `users` | 855–1003 | ~149 |
| `onboarding-tasks` | 1004–1175 | ~172 |
| `offboarding-tasks` | 1176–1710 | ~535 |

The remaining ~600 LOC (before `return`) is state declarations and handlers shared across these tabs.

---

## Target File Structure

```
frontend/src/components/admin/
├── ServiceDesksTab.tsx       ← new
├── UsersTab.tsx              ← new
├── OnboardingTasksTab.tsx    ← new
├── OffboardingTasksTab.tsx   ← new
├── StatusDefinitionsTab.tsx  (existing)
├── WorkflowTransitionTab.tsx (existing)
├── BannerConfigTab.tsx       (existing)
└── PermissionsTab.tsx        (existing)
```

`AdminSettings.tsx` → reduced to ~150 LOC.

---

## Shared Interface Pattern

All new tab components receive this prop signature:

```typescript
interface TabProps {
  showToast: (type: 'error' | 'success', text: string) => void;
  setPendingAction: (action: { message: string; onConfirm: () => Promise<void> } | null) => void;
}
```

`toastMsg`, `showToast`, `pendingAction`, and `executePendingAction` stay in the parent — they are UI chrome shared across all tabs.

---

## Step-by-Step Implementation

### Step 1 — Extract `ServiceDesksTab`

Create `frontend/src/components/admin/ServiceDesksTab.tsx`.

**State to move in:**
- `serviceDesks`, `selectedDesk`, `categories`, `loading`
- `modalOpen`, `editingCategory`, `formData`
- `requestTypes`, `selectedCategory`, `formBuilderOpen`
- `selectedType`, `serviceModalOpen`, `serviceFormData`
- `editingTypeName`, `editTypeForm`, `savingTypeName`

**Handlers to move:**
- `fetchServiceDesks`, `fetchCategories`
- All category and request-type CRUD handlers

**Props from parent:** `showToast`, `setPendingAction`

---

### Step 2 — Extract `UsersTab`

Create `frontend/src/components/admin/UsersTab.tsx`.

**State to move in:**
- `users`, `userPagination`, `userSearch`, `userRoleFilter`
- `availableRoles`, `usersLoading`
- `roleModalUser`, `roleModalSelected`
- `showAgentTeamModal`, `selectedAgentTeam`
- `showCreateUserModal`, `showEditUserModal`, `editingUser`

**Handlers to move:**
- `fetchUsers`, `fetchRoles`
- All user management handlers (role assignment, create, edit, delete)

**Props from parent:** `showToast`, `setPendingAction`

---

### Step 3 — Extract `OnboardingTasksTab`

Create `frontend/src/components/admin/OnboardingTasksTab.tsx`.

**State to move in:**
- `templates`, `templatesLoading`, `templateError`
- `editingTemplate`, `showTemplateForm`, `templateForm`

**Handlers to move:**
- `fetchTemplates`, `handleSaveTemplate`, `handleDeleteTemplate`, `handleEditTemplate`

**Props from parent:** `showToast`, `setPendingAction`

---

### Step 4 — Extract `OffboardingTasksTab`

Create `frontend/src/components/admin/OffboardingTasksTab.tsx`.

**State to move in:**
- `offboardingTemplates`, `offboardingTemplatesLoading`, `offboardingTemplateError`
- `editingOffboardingTemplate`, `showOffboardingTemplateForm`, `offboardingTemplateForm`

**Handlers to move:**
- `fetchOffboardingTemplates` (line ~221)
- `handleSaveOffboardingTemplate` (line ~234)
- `handleDeleteOffboardingTemplate` (line ~251)
- `handleEditOffboardingTemplate` (line ~261)

**Props from parent:** `showToast`, `setPendingAction`

---

### Step 5 — Slim Down `AdminSettings.tsx`

What remains in the parent after all extractions:

- `activeTab` state + sidebar nav JSX
- `toastMsg` + `showToast` helper
- `pendingAction` + `ConfirmDialog` + `executePendingAction`
- Imports and tab routing to all 8 tab components

---

## Execution Order

Extract tabs in this order to manage risk — smallest/simplest first:

1. `OnboardingTasksTab` (~172 LOC, self-contained)
2. `UsersTab` (~149 LOC, self-contained)
3. `OffboardingTasksTab` (~535 LOC — largest, but handlers are grouped near line 234)
4. `ServiceDesksTab` (~195 LOC — most internal state, extract last)

Verify the UI renders correctly after each extraction before moving to the next.

---

## Risk Notes

- **`OffboardingTasksTab`** has handlers defined early in the file (lines 234–273) that are far from their JSX (lines 1176–1710). These must be identified and moved together.
- **`ServiceDesksTab`** has the most state variables (12+) — extract last or most carefully.
- All new tab components will need the same top-level imports (`apiClient`, `adminService`, `serviceDeskService`, etc.) currently consolidated at the top of `AdminSettings.tsx`.
- The `useEffect` on line 147 that triggers data fetches on tab change must be broken up — each tab component should own its own `useEffect` for initial data loading.

---

## Definition of Done

- [ ] `ServiceDesksTab.tsx` extracted and rendering correctly
- [ ] `UsersTab.tsx` extracted and rendering correctly
- [ ] `OnboardingTasksTab.tsx` extracted and rendering correctly
- [ ] `OffboardingTasksTab.tsx` extracted and rendering correctly
- [ ] `AdminSettings.tsx` reduced to ≤ 200 LOC
- [ ] No TypeScript errors (`npm run build` passes in `frontend/`)
- [ ] All 8 tabs function identically to pre-refactor behavior
- [ ] `IMPLEMENTATION_CHECKLIST.md` CODE-001 marked complete
