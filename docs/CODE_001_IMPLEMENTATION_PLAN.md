# CODE-001: Decompose AdminSettings.tsx — Implementation Plan

> **Task ID:** CODE-001  
> **Priority:** P1  
> **Effort:** 2 days  
> **Status:** [ ] Not Started  
> **Source:** IMPLEMENTATION_CHECKLIST.md  

---

## 1. Current State Analysis

`AdminSettings.tsx` is **1,808 lines / ~118KB** — a massive monolithic file containing:

- **45+ useState hooks**
- **10+ async handler functions**
- **8 conditional tab renders**
- **7 modal renders**
- **Tab navigation + sidebar layout**

Some tabs are already extracted (✅):

| Component | File | Size | Status |
|-----------|------|------|--------|
| WorkflowTransitionTab | `src/components/admin/WorkflowTransitionTab.tsx` | 14.7KB | ✅ Extracted |
| BannerConfigTab | `src/components/admin/BannerConfigTab.tsx` | 9.8KB | ✅ Extracted |
| StatusDefinitionsTab | `src/components/admin/StatusDefinitionsTab.tsx` | 10.3KB | ✅ Extracted |
| PermissionsTab | `src/components/admin/PermissionsTab.tsx` | 10.3KB | ✅ Extracted |

These were rendered inline at lines 1710-1720 of AdminSettings.tsx.

---

## 2. What Still Needs Extraction

Based on analysis of the remaining monolith, **8 components** need extraction:

| # | Component | Approx Lines | Source Lines | Description |
|---|-----------|-------------|--------------|-------------|
| 1 | `ServiceDesksTab.tsx` | ~200 | 660-853 | Service desk category management table + manage button |
| 2 | `UserAccountsTab.tsx` | ~150 | 855-1002 | User listing, search, filters, pagination |
| 3 | `OnboardingTasksTab.tsx` | ~170 | 1004-1174 | Onboarding template CRUD table + form |
| 4 | `OffboardingTasksTab.tsx` | ~170 | 1176-1344 | Offboarding template CRUD table + form |
| 5 | `CategoryModal.tsx` | ~115 | 1346-1460 | Category create/edit modal |
| 6 | `ServiceModal.tsx` | ~75 | 1476-1552 | New service request type modal |
| 7 | `RoleAssignmentModal.tsx` | ~50 | 1562-1610 | Role checkbox assignment modal |
| 8 | `AgentTeamModal.tsx` | ~70 | 1641-1708 | Agent team radio assignment modal |

### Plus Shared Module

| # | Module | Description |
|---|--------|-------------|
| 0 | `useAdminState.ts` | Custom hook encapsulating all shared state + handlers |

---

## 3. Target File Structure

```
frontend/src/components/admin/
├── AdminSettings.tsx          (THIN SHELL ~150 lines — just layout + tabs + modals)
├── useAdminState.ts           (CUSTOM HOOK ~300 lines — state + handlers)
├── adminConstants.ts          (SHARED CONSTANTS — CATEGORY_ICONS, COLOR_THEMES, ADMIN_TABS)
├── ServiceDesksTab.tsx        (~200 lines — category CRUD UI)
├── UserAccountsTab.tsx        (~150 lines — user table + search + pagination)
├── OnboardingTasksTab.tsx     (~170 lines — onboarding template management)
├── OffboardingTasksTab.tsx    (~170 lines — offboarding template management)
├── CategoryModal.tsx          (~115 lines — category create/edit modal)
├── ServiceModal.tsx           (~75 lines — new service type modal)
├── RoleAssignmentModal.tsx    (~50 lines — role checkbox modal)
├── AgentTeamModal.tsx         (~70 lines — agent team radio modal)
├── CreateUserModal.tsx        (EXISTS — no changes)
├── UserEditModal.tsx          (EXISTS — no changes)
├── WorkflowTransitionTab.tsx   (EXISTS — no changes)
├── BannerConfigTab.tsx         (EXISTS — no changes)
├── StatusDefinitionsTab.tsx    (EXISTS — no changes)
├── PermissionsTab.tsx          (EXISTS — no changes)
└── index.ts                    (barrel exports)
```

---

## 4. Implementation Phases

### PHASE 1 — Extract Custom Hook + Constants (DAY 1, 3-4 hours)

**Goal:** Move all state and logic out of AdminSettings.tsx into a reusable hook.

#### Step 1.1: Create `adminConstants.ts`

Move these constants out of AdminSettings.tsx:

```typescript
// frontend/src/components/admin/adminConstants.ts

export const CATEGORY_ICONS = [
    { name: 'laptop', label: 'Laptop/Hardware' },
    { name: 'apps', label: 'Applications' },
    { name: 'key', label: 'Access/Security' },
    { name: 'mail', label: 'Email' },
    { name: 'wifi', label: 'Network' },
    { name: 'dns', label: 'Servers' },
    { name: 'terminal', label: 'Development' },
    { name: 'groups', label: 'People/HR' },
    { name: 'payments', label: 'Finance' },
    { name: 'event_available', label: 'Calendar/Leave' },
    { name: 'health_and_safety', label: 'Benefits/Health' },
    { name: 'school', label: 'Training' },
    { name: 'receipt_long', label: 'Expenses' },
    { name: 'shopping_cart', label: 'Procurement' },
    { name: 'business', label: 'Vendors' },
    { name: 'help', label: 'General Help' },
];

export const COLOR_THEMES = [
    { name: 'Blue', class: 'bg-blue-50 text-blue-600' },
    { name: 'Indigo', class: 'bg-indigo-50 text-indigo-600' },
    { name: 'Purple', class: 'bg-purple-50 text-purple-600' },
    { name: 'Emerald', class: 'bg-emerald-50 text-emerald-600' },
    { name: 'Amber', class: 'bg-amber-50 text-amber-600' },
    { name: 'Red', class: 'bg-red-50 text-red-600' },
    { name: 'Cyan', class: 'bg-cyan-50 text-cyan-600' },
    { name: 'Pink', class: 'bg-pink-50 text-pink-600' },
];

export const ADMIN_TABS = [
    { id: 'service-desks',    label: 'Service Desks',     icon: 'support_agent',  group: 'Configuration' },
    { id: 'users',            label: 'User Accounts',     icon: 'manage_accounts', group: 'Configuration' },
    { id: 'permissions',      label: 'Permissions',       icon: 'shield_lock',    group: 'Configuration' },
    { id: 'onboarding-tasks', label: 'Onboarding Tasks',  icon: 'checklist',      group: 'Workflows' },
    { id: 'offboarding-tasks',label: 'Offboarding Tasks', icon: 'checklist_rtl',  group: 'Workflows' },
    { id: 'workflow-config',  label: 'Workflow Config',   icon: 'account_tree',   group: 'Workflows' },
    { id: 'status-definitions',label:'Request Statuses',  icon: 'fact_check',     group: 'Workflows' },
    { id: 'banner-config',    label: 'Banner & Branding', icon: 'campaign',       group: 'Appearance' },
] as const;

export type AdminTabId = typeof ADMIN_TABS[number]['id'];
export type AdminTabGroup = 'Configuration' | 'Workflows' | 'Appearance';
```

#### Step 1.2: Create `useAdminState.ts`

Move all useState declarations and handler functions:

```typescript
// frontend/src/components/admin/useAdminState.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceDeskService } from '../../services/serviceDesk.service';
import { adminService, CategoryData } from '../../services/admin.service';
import apiClient from '../../services/api';
import { OnboardingTaskTemplate } from '../../../types';
import { AdminTabId } from './adminConstants';

export interface AdminState {
  // Service Desks
  serviceDesks: any[];
  selectedDesk: any;
  categories: any[];
  loading: boolean;
  selectedCategory: any;
  requestTypes: any[];
  formData: CategoryData;
  editingCategory: any;
  modalOpen: boolean;

  // Services
  serviceModalOpen: boolean;
  serviceFormData: { name: string; description: string; icon: string; requiresApproval: boolean; slaHours: string; requiredRole: string };
  selectedType: any;
  formBuilderOpen: boolean;
  editingTypeName: { id: string; name: string; description: string } | null;
  editTypeForm: { name: string; description: string };
  savingTypeName: boolean;

  // Users
  users: any[];
  userPagination: { page: number; limit: number; total: number; totalPages: number };
  userSearch: string;
  userRoleFilter: string;
  availableRoles: { id: string; name: string; description: string }[];
  usersLoading: boolean;
  roleModalUser: any;
  roleModalSelected: string[];
  showAgentTeamModal: boolean;
  selectedAgentTeam: string;
  showCreateUserModal: boolean;
  showEditUserModal: boolean;
  editingUser: any;

  // Onboarding
  templates: OnboardingTaskTemplate[];
  templatesLoading: boolean;
  templateError: string | null;
  editingTemplate: OnboardingTaskTemplate | null;
  showTemplateForm: boolean;
  templateForm: { ... };

  // Offboarding
  offboardingTemplates: OnboardingTaskTemplate[];
  offboardingTemplatesLoading: boolean;
  offboardingTemplateError: string | null;
  editingOffboardingTemplate: OnboardingTaskTemplate | null;
  showOffboardingTemplateForm: boolean;
  offboardingTemplateForm: { ... };

  // Workflow
  workflowServiceDesks: any[];
  workflowLoading: boolean;
  workflowSaving: string | null;

  // UI
  activeTab: AdminTabId;
  pendingAction: { message: string; onConfirm: () => Promise<void> } | null;
  toastMsg: { type: 'error' | 'success'; text: string } | null;

  // Handlers (all functions)
  fetchServiceDesks: () => Promise<void>;
  fetchCategories: (deskId: string) => Promise<void>;
  fetchUsers: (page: number, search?: string, roleFilter?: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchOffboardingTemplates: () => Promise<void>;
  fetchWorkflowConfig: () => Promise<void>;
  handleSave: (e: React.FormEvent) => Promise<void>;
  handleDelete: (catId: string) => void;
  handleReactivate: (catId: string) => void;
  handleCreateService: (e: React.FormEvent) => Promise<void>;
  handleDeleteService: (typeId: string) => void;
  handleManageTypes: (cat: any) => Promise<void>;
  handleMoveCategory: (cat: any, direction: 'up' | 'down') => Promise<void>;
  handleToggleUserStatus: (user: any) => Promise<void>;
  handleEditUser: (data: any) => Promise<void>;
  handleSaveRoles: () => Promise<void>;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: (id: string) => Promise<void>;
  handleEditTemplate: (template: OnboardingTaskTemplate) => void;
  handleSaveOffboardingTemplate: () => Promise<void>;
  handleDeleteOffboardingTemplate: (id: string) => Promise<void>;
  handleEditOffboardingTemplate: (template: OnboardingTaskTemplate) => void;
  handleWorkflowToggle: (typeId: string, currentValue: boolean) => Promise<void>;
  handleSaveFormConfig: (fields: any[]) => Promise<void>;
  handleSaveTypeName: () => Promise<void>;
  handleDeskChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  openAddModal: () => void;
  openEditModal: (cat: any) => void;
  openFormBuilder: (type: any) => void;
  openEditTypeName: (type: any) => void;
  showToast: (type: 'error' | 'success', text: string) => void;
  executePendingAction: () => Promise<void>;

  // Setters for modals
  setActiveTab: (tab: AdminTabId) => void;
  setModalOpen: (open: boolean) => void;
  setServiceModalOpen: (open: boolean) => void;
  setRoleModalUser: (user: any) => void;
  // ... etc
}

export function useAdminState(): AdminState {
  // All 45+ useState declarations moved here
  // All fetch/handler functions moved here
  // All useEffect hooks moved here
  // Return clean interface
}
```

#### Step 1.3: Verify Phase 1

- [ ] `adminConstants.ts` created and exports all constants
- [ ] `useAdminState.ts` created with all state + handlers
- [ ] AdminSettings.tsx refactored to use hook (should still render identically)
- [ ] `npm run build` passes
- [ ] Visual check — no changes to UI

---

### PHASE 2 — Extract Tab Components (DAY 1-2, 4-5 hours)

**Goal:** Move each tab's JSX into a dedicated component.

#### Step 2.1: ServiceDesksTab.tsx

```typescript
// Props interface
interface ServiceDesksTabProps {
  serviceDesks: any[];
  selectedDesk: any;
  categories: any[];
  selectedCategory: any;
  requestTypes: any[];
  availableRoles: any[];
  formData: CategoryData;
  modalOpen: boolean;
  serviceModalOpen: boolean;
  onDeskChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAddCategory: () => void;
  onEditCategory: (cat: any) => void;
  onDeleteCategory: (catId: string) => void;
  onReactivateCategory: (catId: string) => void;
  onMoveCategory: (cat: any, direction: 'up' | 'down') => void;
  onManageTypes: (cat: any) => void;
  onOpenServiceModal: () => void;
  onDeleteService: (typeId: string) => void;
  onEditTypeName: (type: any) => void;
  onOpenFormBuilder: (type: any) => void;
}
```

Source lines: 660-853

#### Step 2.2: UserAccountsTab.tsx

```typescript
interface UserAccountsTabProps {
  users: any[];
  usersLoading: boolean;
  userPagination: { page: number; limit: number; total: number; totalPages: number };
  userSearch: string;
  userRoleFilter: string;
  availableRoles: { id: string; name: string; description: string }[];
  onSearch: (value: string) => void;
  onRoleFilter: (value: string) => void;
  onFetchUsers: (page: number) => void;
  onCreateUser: () => void;
  onEditUser: (user: any) => void;
  onManageRoles: (user: any) => void;
  onToggleUserStatus: (user: any) => void;
}
```

Source lines: 855-1002

#### Step 2.3: OnboardingTasksTab.tsx

```typescript
interface OnboardingTasksTabProps {
  templates: OnboardingTaskTemplate[];
  templatesLoading: boolean;
  templateError: string | null;
  showTemplateForm: boolean;
  editingTemplate: OnboardingTaskTemplate | null;
  templateForm: { ... };
  onSaveTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (template: OnboardingTaskTemplate) => void;
  onShowTemplateForm: (show: boolean) => void;
  onTemplateFormChange: (form: { ... }) => void;
}
```

Source lines: 1004-1174

#### Step 2.4: OffboardingTasksTab.tsx

```typescript
interface OffboardingTasksTabProps {
  templates: OnboardingTaskTemplate[];
  templatesLoading: boolean;
  templateError: string | null;
  showTemplateForm: boolean;
  editingTemplate: OnboardingTaskTemplate | null;
  templateForm: { ... };
  onSaveTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (template: OnboardingTaskTemplate) => void;
  onShowTemplateForm: (show: boolean) => void;
  onTemplateFormChange: (form: { ... }) => void;
}
```

Source lines: 1176-1344

#### Step 2.5: Verify Phase 2

- [ ] All 4 tab components created
- [ ] AdminSettings.tsx renders each tab component
- [ ] `npm run build` passes
- [ ] Visual check — all tabs work identically

---

### PHASE 3 — Extract Modal Components (DAY 2, 2-3 hours)

**Goal:** Move each modal's internal JSX into a dedicated component.

#### Step 3.1: CategoryModal.tsx

Source lines: 1346-1460 (~115 lines)

```typescript
interface CategoryModalProps {
  isOpen: boolean;
  editingCategory: any;
  formData: CategoryData;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
  onFormDataChange: (data: CategoryData) => void;
}
```

#### Step 3.2: ServiceModal.tsx

Source lines: 1476-1552 (~75 lines)

```typescript
interface ServiceModalProps {
  isOpen: boolean;
  selectedCategory: any;
  availableRoles: { id: string; name: string; description: string }[];
  serviceFormData: { ... };
  onCreateService: (e: React.FormEvent) => void;
  onClose: () => void;
  onFormDataChange: (data: { ... }) => void;
}
```

#### Step 3.3: RoleAssignmentModal.tsx

Source lines: 1562-1610 (~50 lines)

```typescript
interface RoleAssignmentModalProps {
  isOpen: boolean;
  user: any;
  availableRoles: { id: string; name: string; description: string }[];
  selectedRoles: string[];
  onSave: () => void;
  onClose: () => void;
  onRoleToggle: (roleName: string, checked: boolean) => void;
}
```

#### Step 3.4: AgentTeamModal.tsx

Source lines: 1641-1708 (~70 lines)

```typescript
interface AgentTeamModalProps {
  isOpen: boolean;
  user: any;
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  onAssign: () => void;
  onClose: () => void;
}
```

#### Step 3.5: Verify Phase 3

- [ ] All 4 modal components created
- [ ] Modals still overlay correctly at proper z-index
- [ ] `npm run build` passes
- [ ] Visual check — all modals work identically

---

### PHASE 4 — Cleanup & Final Verification (DAY 2, 1-2 hours)

#### Step 4.1: Create barrel export

```typescript
// frontend/src/components/admin/index.ts
export { default as AdminSettings } from './AdminSettings';
// Only if needed by external consumers
```

#### Step 4.2: Clean up AdminSettings.tsx

The final AdminSettings.tsx should be ~150 lines containing only:

1. Import statements
2. `useAdminState()` hook call
3. Tab sidebar navigation
4. Content area with conditional tab components
5. Modal component renders
6. Toast + Confirm dialog
7. UserEditModal + CreateUserModal (existing)

#### Step 4.3: Final verification checklist

- [ ] `AdminSettings.tsx` is under 200 lines
- [ ] No duplicated code across components
- [ ] All imports resolved
- [ ] `npm run build` passes (frontend)
- [ ] `npm run build` passes (backend — unaffected but verify)
- [ ] Manual runtime test: every tab loads
- [ ] Manual runtime test: every modal opens/closes
- [ ] Manual runtime test: CRUD operations still work (create category, edit service, assign role, etc.)

---

## 5. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management pattern | Custom hook (`useAdminState`) | Simpler than Context Provider — no wrapper needed, AdminSettings is sole consumer |
| Modal ownership | Stay in AdminSettings shell | Modals overlay entire page, z-index management stays centralized |
| Shared constants | Separate `adminConstants.ts` file | Clean imports, no circular deps |
| Toast + Confirm Dialog | Stay in AdminSettings shell | App-wide UI concerns, not tab-specific |
| Existing extracted tabs | No changes | WorkflowTransitionTab, BannerConfigTab, StatusDefinitionsTab, PermissionsTab remain as-is |
| Prop drilling vs Context | Props for now | Only 1 level of nesting, Context would be over-engineering |

---

## 6. Before / After Metrics

| Metric | Before | After |
|--------|--------|-------|
| AdminSettings.tsx lines | 1,808 | ~150 |
| Largest single file | 1,808 LOC | ~300 LOC (useAdminState.ts) |
| Total new files created | 0 | 10 (8 components + hook + constants) |
| State declarations in one place | Yes (messy) | Yes (organized in hook) |
| Tab isolation | ❌ All mixed | ✅ Each tab is independent component |
| Modal isolation | ❌ Inline | ✅ Dedicated component |
| Testability | ❌ Cannot test tabs in isolation | ✅ Each tab testable independently |
| Code reviewability | ❌ 1800 line PRs | ✅ Small focused files |

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| State dependency across tabs | Medium | Hook returns only what each tab needs; each tab gets its own props slice |
| Modal z-index stacking breaks | Low | Modals remain in shell at same z-levels as today |
| Breaking external imports | None | Only `AdminSettings` is imported in `App.tsx` — zero external consumers |
| TypeScript type errors during extraction | Medium | Build after EVERY phase, not just at end |
| Event handler `this` / closure issues | Low | All handlers are arrow functions in hook — no `this` binding concerns |
| Performance regression from prop drilling | None | React reconciliation unchanged; same number of re-renders |

---

## 8. Execution Checklist

### Phase 1
- [ ] Create `adminConstants.ts` — move CATEGORY_ICONS, COLOR_THEMES, ADMIN_TABS
- [ ] Create `useAdminState.ts` — move all useState + handlers
- [ ] Refactor AdminSettings.tsx to use hook
- [ ] Build verification
- [ ] Runtime visual check

### Phase 2
- [ ] Extract `ServiceDesksTab.tsx`
- [ ] Extract `UserAccountsTab.tsx`
- [ ] Extract `OnboardingTasksTab.tsx`
- [ ] Extract `OffboardingTasksTab.tsx`
- [ ] Build verification
- [ ] Runtime visual check — all 4 tabs

### Phase 3
- [ ] Extract `CategoryModal.tsx`
- [ ] Extract `ServiceModal.tsx`
- [ ] Extract `RoleAssignmentModal.tsx`
- [ ] Extract `AgentTeamModal.tsx`
- [ ] Build verification
- [ ] Runtime visual check — all 4 modals

### Phase 4
- [ ] Create `index.ts` barrel exports
- [ ] Final cleanup of AdminSettings.tsx
- [ ] Full build verification (frontend + backend)
- [ ] Full runtime test — every tab + every modal + CRUD operations
- [ ] Update IMPLEMENTATION_CHECKLIST.md — mark CODE-001 as [x]