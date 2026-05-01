# Service Desks Tab — Admin Console UX Refinement Plan

**Date:** 2026-05-01  
**Module:** Admin Console > Service Desks Tab  
**Audit Score:** 5.0/10  
**Status:** PENDING REVIEW  

---

## Audit Summary

The Service Desks tab provides a functional 3-tier CRUD interface (Desk → Category → Request Type) but has significant gaps: no Service Desk CRUD UI, no request type reactivation, no loading states, no empty states, no accessibility, duplicate API service layers, no audit trail, no Zod validation, and several UX anti-patterns (blind icon selector, fragmented edit flows, inline modals in AdminSettings).

---

## Component Map

```
AdminSettings.tsx (page shell)
  ├── useAdminState.ts (all state + handlers for all admin tabs)
  ├── <ServiceDesksTab> (desk dropdown + category table + service cards)
  │     ├── <select> desk dropdown
  │     ├── <table> categories (reorder, edit, delete/restore, manage)
  │     └── <div> services panel (card grid, empty state)
  ├── <CategoryModal> (z-60, create/edit category)
  ├── <ServiceModal> (z-70, create-only service)
  ├── [INLINE] Edit Request Type modal (z-50, 90+ lines in AdminSettings)
  ├── [INLINE] Form Builder modal (z-50, 15+ lines wrapper in AdminSettings)
  ├── [INLINE] Confirm Dialog (z-80)
  └── [INLINE] Toast (z-90)

Backend:
  serviceDesk.controller.ts (338 lines, all 3 tiers CRUD, no service layer)
  serviceDesk.routes.ts (111 lines, no Zod validation)
```

---

## Phase 1: Critical Gaps (8 tasks)

### T1 — Service Desk CRUD UI
**Problem:** Backend has POST/PUT/DELETE for desks but admin UI only has a `<select>` dropdown. Admins cannot create, edit, or deactivate desks from the UI.  
**Scope:**  
- Create `ServiceDeskModal.tsx` — modal for creating/editing a service desk (name, code, description, active toggle)  
- Add "Add Service Desk" button next to the desk dropdown in ServiceDesksTab  
- Add edit/deactivate/reactivate actions on the selected desk (gear icon or dropdown)  
- Wire to existing backend: `POST /service-desks`, `PUT /service-desks/:id`, `DELETE /service-desks/:id`  
- Add `serviceDeskModalOpen`, `editingDesk`, `deskFormData` state to useAdminState  
- Add `handleSaveDesk`, `handleDeleteDesk`, `handleReactivateDesk` handlers to useAdminState  
- Add `createServiceDesk`, `updateServiceDesk` to `serviceDesk.service.ts` (they already exist in the backend, just need frontend wrappers)  
- After saving/deleting, call `fetchServiceDesks()` to refresh dropdown  

**Files changed:**  
- `frontend/src/components/admin/ServiceDeskModal.tsx` (NEW)  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — add desk actions header)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — add desk modal state + handlers)  
- `frontend/src/components/admin/index.ts` (MODIFY — export ServiceDeskModal)  
- `frontend/src/services/serviceDesk.service.ts` (MODIFY — add create/update desk methods)  
- `frontend/pages/AdminSettings.tsx` (MODIFY — render ServiceDeskModal)  

---

### T2 — Request Type Reactivation
**Problem:** Deactivated request types are invisible in the UI (backend `getRequestTypes` filters `isActive: true`). Unlike categories, there is no restore path for soft-deleted services.  
**Scope:**  
- Add `GET /service-desks/:id/request-types/all` admin endpoint in backend controller (mirrors the existing `getAllCategoriesAdmin` pattern — returns all types including inactive)  
- Add route in `serviceDesk.routes.ts` under admin middleware  
- Add `getAllRequestTypesAdmin(deskId, categoryId)` to `serviceDesk.service.ts`  
- Modify `useAdminState`: when `handleManageTypes` fetches types, use the admin endpoint to include inactive ones  
- In ServiceDesksTab service card grid: show inactive service cards with `opacity-50` + "Inactive" badge + "Restore" button (mirrors category table pattern)  
- Add `handleReactivateService(typeId)` handler in useAdminState — calls `serviceDeskService.updateRequestType(typeId, { isActive: true })` then refreshes  

**Files changed:**  
- `backend/src/controllers/serviceDesk.controller.ts` (MODIFY — add `getAllRequestTypesAdmin`)  
- `backend/src/routes/serviceDesk.routes.ts` (MODIFY — add admin route)  
- `frontend/src/services/serviceDesk.service.ts` (MODIFY — add `getAllRequestTypesAdmin`)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — reactivation handler + use admin endpoint)  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — show inactive cards + restore button)  

---

### T3 — Loading States
**Problem:** No loading indicators anywhere. `fetchServiceDesks`, `fetchCategories`, `handleManageTypes` all run without any visual feedback. UI appears frozen or broken during API calls.  
**Scope:**  
- Add `desksLoading`, `categoriesLoading`, `requestTypesLoading` state vars to useAdminState  
- Set loading=true before each fetch, loading=false in finally block  
- In ServiceDesksTab:  
  - Desk dropdown: disable + show "Loading..." option while `desksLoading`  
  - Category table: show skeleton rows (3 rows of animated pulse rectangles) while `categoriesLoading`  
  - Service cards: show 3 skeleton cards (pulse animation) while `requestTypesLoading`  
- Reuse the skeleton pattern from UserAccountsTab (already implemented in prior audit)  

**Files changed:**  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — add loading states)  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — skeleton rendering)  

---

### T4 — Empty States
**Problem:** 0 desks = empty dropdown with no guidance. 0 categories = empty table body. Only services already have an empty state.  
**Scope:**  
- ServiceDesksTab: if `serviceDesks.length === 0`, show full-panel empty state (icon + "No service desks configured" + "Add Service Desk" button)  
- ServiceDesksTab: if `categories.length === 0` and not loading, show empty table message (icon + "No categories yet. Add one to organize services.")  
- Keep existing services empty state (already exists at line 232-237)  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — empty state rendering)  

---

### T5 — Extract Inline Modals
**Problem:** Edit Request Type modal and Form Builder modal are defined as inline JSX in AdminSettings.tsx (lines 352-457). This bloats the page component and mixes concerns.  
**Scope:**  
- Create `RequestTypeEditModal.tsx` — extract the entire "Edit Request Type" modal (lines 353-443 of AdminSettings.tsx) into its own component  
  - Props: `isOpen`, `editingTypeName`, `editTypeForm`, `savingTypeName`, `workflowTypes`, `workflowTypesLoading`, `onSave`, `onClose`, `onFormChange`  
  - Include `role="dialog"`, `aria-modal="true"`, `aria-label="Edit Request Type"`  
- Create `FormBuilderModal.tsx` — thin wrapper that renders the backdrop + white container + `<FormBuilder>` inside  
  - Props: `isOpen`, `selectedType`, `onSave`, `onClose`  
  - Include `role="dialog"`, `aria-modal="true"`  
- Remove inline JSX from AdminSettings.tsx, render the new components instead  
- Add both to `index.ts` exports  

**Files changed:**  
- `frontend/src/components/admin/RequestTypeEditModal.tsx` (NEW)  
- `frontend/src/components/admin/FormBuilderModal.tsx` (NEW)  
- `frontend/pages/AdminSettings.tsx` (MODIFY — replace inline JSX with component refs)  
- `frontend/src/components/admin/index.ts` (MODIFY — add exports)  

---

### T6 — ServiceModal Edit Mode
**Problem:** ServiceModal is create-only. Admin cannot edit a service's SLA, approval flag, or role restriction from this modal. Must use a separate "Edit Name" modal + Form Builder for different fields. Fragmented UX.  
**Scope:**  
- Add `editingService` state to useAdminState (like `editingCategory`)  
- Add `openEditServiceModal(type)` handler — pre-fills `serviceFormData` from existing type data, sets `editingService`  
- Modify ServiceModal:  
  - If `editingService`, title becomes "Edit Service"  
  - Pre-fill all fields (name, description, SLA, requiresApproval, requiredRole)  
  - Submit button text: "Save Changes" vs "Create Service"  
  - Submit handler: calls `serviceDeskService.updateRequestType` instead of `adminService.createService`  
- Add edit button on service cards that opens ServiceModal in edit mode (in addition to existing edit name button)  
- Decide: keep the quick "edit name" button for inline name changes, but the full edit modal captures all fields  

**Files changed:**  
- `frontend/src/components/admin/ServiceModal.tsx` (MODIFY — add editingService prop + edit mode)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — editingService state + openEditServiceModal handler)  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — add onEditService handler prop, wire edit button)  

---

### T7 — Category Table: Request Type Count Column
**Problem:** Backend `getAllCategoriesAdmin` returns `_count.requestTypes` but the table doesn't display it. Admin can't see at a glance how many services each category has.  
**Scope:**  
- Add a "Services" column to the category table (already exists as `<th>Services</th>` in the header!)  
- Replace the current "Manage" button in the Services column with: count badge + Manage button  
  - Show `_count.requestTypes` as a small badge next to the Manage button  
  - e.g. `<span className="badge">5</span>` next to the Manage toggle  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — render count badge)  

---

### T8 — Consolidate Duplicate Service Layers
**Problem:** Both `admin.service.ts` and `serviceDesk.service.ts` expose `createCategory`, `updateCategory`, `deleteCategory`. The hook calls `adminService` for category ops and `serviceDeskService` for type ops. Confusing, error-prone.  
**Scope:**  
- Remove `createCategory`, `updateCategory`, `deleteCategory`, `getAllCategoriesAdmin`, `createService` from `admin.service.ts`  
- Ensure `serviceDesk.service.ts` has all needed methods (it already has category CRUD + `createRequestType`)  
- Add `getAllCategoriesAdmin` to `serviceDesk.service.ts` (currently only in admin.service.ts)  
- Update all imports in `useAdminState.ts` — replace `adminService.createCategory(...)` with `serviceDeskService.createCategory(...)`, etc.  
- Verify no other files import the removed admin.service methods  

**Files changed:**  
- `frontend/src/services/admin.service.ts` (MODIFY — remove category/service methods)  
- `frontend/src/services/serviceDesk.service.ts` (MODIFY — add getAllCategoriesAdmin)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — update all method calls)  

---

## Phase 2: UX Polish (5 tasks)

### T9 — Visual Icon Picker
**Problem:** CategoryModal uses a blind `<select>` dropdown for icons. Admin sees "Laptop/Hardware" text but cannot preview what the Material Symbol looks like.  
**Scope:**  
- Create `IconPicker.tsx` — reusable component that renders a grid of icons (using CATEGORY_ICONS constant)  
- Each grid cell shows the actual `<span className="material-symbols-outlined">{icon.name}</span>` + label below  
- Selected icon gets ring/border highlight  
- Search/filter input above the grid for quick find  
- Replace CategoryModal's `<select>` with `<IconPicker>`  
- Store result in `formData.icon` as before  

**Files changed:**  
- `frontend/src/components/admin/IconPicker.tsx` (NEW)  
- `frontend/src/components/admin/CategoryModal.tsx` (MODIFY — replace select with IconPicker)  
- `frontend/src/components/admin/index.ts` (MODIFY — export)  

---

### T10 — ServiceModal Icon Selector
**Problem:** ServiceModal has no icon field. Services default to `bolt` icon but admin cannot choose a different one. Backend accepts `icon` on create/update.  
**Scope:**  
- Add icon field to ServiceModal using `IconPicker` from T9 (compact variant or same component)  
- Add `icon` to the `serviceFormData` initial state and interface  
- Pass icon value on create/update API calls  

**Files changed:**  
- `frontend/src/components/admin/ServiceModal.tsx` (MODIFY — add icon picker)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — add icon to serviceFormData default/init)  

---

### T11 — "Manage" Button UX Improvement
**Problem:** The "Manage" button toggles the service panel but looks like a navigation action. No visual cue that it's a toggle or whether the panel is currently open.  
**Scope:**  
- Add chevron icon: `expand_more` when panel closed, `expand_less` when panel open  
- Keep the existing blue highlight when active (already works via `selectedCategory?.id === cat.id`)  
- This is a ~5 line change in ServiceDesksTab.tsx  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — add chevron)  

---

### T12 — Service Card Active/Inactive Status
**Problem:** Service cards show no status badge. Inactive services aren't visible because backend filters them out. After T2 fixes the data, cards need visual status indicators.  
**Scope:**  
- On each service card, add status badge (like category table): Active (green) / Inactive (gray)  
- Inactive cards: apply `opacity-60` styling like inactive category rows  
- Inactive cards: replace "delete" button with "Restore" button (calls `onReactivateService`)  
- Already depends on T2 for backend changes  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — status badge + restore button on cards)  

---

### T13 — Category Search/Filter
**Problem:** With many categories, admin must scroll the full table. No way to quickly find a specific category.  
**Scope:**  
- Add a search input above the category table (below desk selector)  
- Filter categories by name (client-side, case-insensitive)  
- Debounce input (300ms)  
- Show match count: "Showing 3 of 12 categories"  
- Add `categorySearch` state to useAdminState  
- Pass filtered list to ServiceDesksTab  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — add search input)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — add categorySearch state + filtered list)  

---

## Phase 3: Accessibility & Compliance (4 tasks)

### T14 — ARIA Labels
**Problem:** Zero ARIA attributes in ServiceDesksTab, CategoryModal, ServiceModal. Screen readers get zero semantic information.  
**Scope:**  
- ServiceDesksTab:  
  - `<table>` → `role="table"`, `aria-label="Service categories for {desk.name}"`  
  - Desk `<select>` → `aria-label="Select service desk"`  
  - Reorder buttons → `aria-label="Move category up/down"`  
  - Edit/Delete/Restore buttons → already have `title` attr, add `aria-label` matching  
- CategoryModal: `role="dialog"`, `aria-modal="true"`, `aria-label="Create/Edit Category"`  
- ServiceModal: `role="dialog"`, `aria-modal="true"`, `aria-label="Create/Edit Service"`  
- RequestTypeEditModal (from T5): already included in extraction  
- FormBuilderModal (from T5): already included in extraction  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY)  
- `frontend/src/components/admin/CategoryModal.tsx` (MODIFY)  
- `frontend/src/components/admin/ServiceModal.tsx` (MODIFY)  

---

### T15 — Focus Trap + Escape Key on Modals
**Problem:** CategoryModal (z-60) and ServiceModal (z-70) have no focus trap or Escape key handler. Tab key escapes the modal into the page beneath.  
**Scope:**  
- Apply existing `useFocusTrap` hook (already created in prior audit at `frontend/src/hooks/useFocusTrap.ts`)  
- Apply existing `useEscapeKey` hook (already at `frontend/src/hooks/useEscapeKey.ts`)  
- Wire into all 4 service-desk modals:  
  - CategoryModal  
  - ServiceModal  
  - RequestTypeEditModal (new, from T5)  
  - FormBuilderModal (new, from T5)  
  - ServiceDeskModal (new, from T1)  

**Files changed:**  
- `frontend/src/components/admin/CategoryModal.tsx` (MODIFY)  
- `frontend/src/components/admin/ServiceModal.tsx` (MODIFY)  
- `frontend/src/components/admin/RequestTypeEditModal.tsx` (MODIFY — new file, add hooks)  
- `frontend/src/components/admin/FormBuilderModal.tsx` (MODIFY — new file, add hooks)  
- `frontend/src/components/admin/ServiceDeskModal.tsx` (MODIFY — new file, add hooks)  

---

### T16 — Keyboard Focus Indicators on Service Card Actions
**Problem:** Service card action buttons (edit, form builder, delete) have no visible keyboard focus indicator.  
**Scope:**  
- Add `focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2` to all icon action buttons on service cards  
- Same for category table action buttons  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY)  

---

### T17 — Status Badge Accessibility Icons
**Problem:** Category Active/Inactive status is conveyed only by color (green badge / gray badge). Color-blind users cannot distinguish them.  
**Scope:**  
- Active badge: add `check` icon before text  
- Inactive badge: add `pause` icon before text  
- Same pattern for service card status badges (T12)  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY)  

---

## Phase 4: Backend Hardening (3 tasks)

### T18 — Audit Logging
**Problem:** `serviceDesk.controller.ts` has zero audit log calls. No record of who created/updated/deleted desks, categories, or request types. Non-compliant for enterprise audit requirements.  
**Scope:**  
- Import the existing `auditLog` utility (used in request.controller.ts, user.controller.ts)  
- Add audit log calls to all write operations:  
  - `createServiceDesk` — `ADMIN_CREATE_SERVICE_DESK`  
  - `updateServiceDesk` — `ADMIN_UPDATE_SERVICE_DESK`  
  - `deleteServiceDesk` — `ADMIN_DELETE_SERVICE_DESK`  
  - `createCategory` — `ADMIN_CREATE_CATEGORY`  
  - `updateCategory` — `ADMIN_UPDATE_CATEGORY`  
  - `deleteCategory` — `ADMIN_DELETE_CATEGORY`  
  - `createRequestType` — `ADMIN_CREATE_REQUEST_TYPE`  
  - `updateRequestType` — `ADMIN_UPDATE_REQUEST_TYPE`  
  - `deleteRequestType` — `ADMIN_DELETE_REQUEST_TYPE`  
- Each log: `{ userId, action, entityType, entityId, details }`  

**Files changed:**  
- `backend/src/controllers/serviceDesk.controller.ts` (MODIFY)  

---

### T19 — Zod Validation
**Problem:** All service desk endpoints accept raw `req.body` with no schema validation. Missing required fields or malformed data reach Prisma directly.  
**Scope:**  
- Create `backend/src/validators/serviceDesk.validator.ts` with Zod schemas:  
  - `createServiceDeskSchema`: name (string, min 1, max 100), code (string, min 1, max 20, alphanumeric), description (string, optional)  
  - `updateServiceDeskSchema`: all fields optional  
  - `createCategorySchema`: name (string, min 1, max 100), description (string, optional), icon (string, optional), colorClass (string, optional), displayOrder (number, default 0)  
  - `updateCategorySchema`: all fields optional  
  - `createRequestTypeSchema`: categoryId (UUID), name (string, min 1, max 150), description (string, optional), icon (string, optional), requiresApproval (boolean, default false), slaHours (number, optional), requiredRole (string, optional), formConfig (array, optional)  
  - `updateRequestTypeSchema`: all fields optional  
- Apply `validate(schema)` middleware to all admin write routes in `serviceDesk.routes.ts`  
- Reuse existing `validate.middleware.ts` (already exists)  

**Files changed:**  
- `backend/src/validators/serviceDesk.validator.ts` (NEW)  
- `backend/src/routes/serviceDesk.routes.ts` (MODIFY — add validate middleware)  

---

### T20 — Service Layer Extraction
**Problem:** Controller directly uses `new PrismaClient()` and contains all business logic. No separate service class. This violates the layering pattern used elsewhere (entity, SLA, notification services).  
**Scope:**  
- Create `backend/src/services/serviceDesk.service.ts`  
- Move all Prisma operations from controller into the service:  
  - `getAllServiceDesks()`  
  - `getServiceDeskById(id)`  
  - `getCategories(deskId)`  
  - `getAllCategoriesAdmin(deskId)`  
  - `getRequestTypes(deskId, categoryId?)`  
  - `getAllRequestTypesAdmin(deskId, categoryId?)` (from T2)  
  - `createServiceDesk(data)`  
  - `updateServiceDesk(id, data)`  
  - `deleteServiceDesk(id)`  
  - `createCategory(deskId, data)`  
  - `updateCategory(categoryId, data)` — including displayOrder conflict resolution  
  - `deleteCategory(categoryId)`  
  - `createRequestType(data)`  
  - `updateRequestType(typeId, data)`  
  - `deleteRequestType(typeId)`  
- Controller stays thin: validate input, call service, format response  
- Move `new PrismaClient()` to the service, remove from controller  

**Files changed:**  
- `backend/src/services/serviceDesk.service.ts` (NEW)  
- `backend/src/controllers/serviceDesk.controller.ts` (MODIFY — thin wrapper calling service)  

---

## Phase 5: Nice-to-Have (4 tasks)

### T21 — FormBuilder Field Duplication
**Problem:** Cannot duplicate an existing form field. Must recreate from scratch.  
**Scope:**  
- Add "Duplicate" button (copy icon) on each sortable field row in FormBuilder  
- Duplicates field with same label, type, required, options but new `id: field_${Date.now()}`  
- Inserts duplicate right after the original  

**Files changed:**  
- `frontend/src/components/FormBuilder.tsx` (MODIFY)  

---

### T22 — FormBuilder Live Preview
**Problem:** Admin defines fields but cannot see how they render for end users. Must create a test request to verify.  
**Scope:**  
- Add a "Preview" tab/button in FormBuilderModal  
- Renders a read-only form using the defined field config  
- Shows field labels, input types, required indicators  
- Toggle between "Edit" and "Preview" modes  

**Files changed:**  
- `frontend/src/components/FormBuilder.tsx` (MODIFY — preview mode)  
- `frontend/src/components/admin/FormBuilderModal.tsx` (MODIFY — tab toggle)  

---

### T23 — Category Drag-and-Drop Reorder
**Problem:** Category reorder uses up/down arrow buttons (2 API calls per move). For many categories, this is tedious. FormBuilder already uses dnd-kit.  
**Scope:**  
- Replace up/down arrows with drag-and-drop rows (dnd-kit `SortableContext`)  
- On drag end, recalculate all displayOrder values and send batch update  
- Add a `batchUpdateCategoryOrder` endpoint to backend or use existing updateCategory per item  
- Keep arrow buttons as fallback for touch/mobile  

**Files changed:**  
- `frontend/src/components/admin/ServiceDesksTab.tsx` (MODIFY — dnd-kit sortable table rows)  
- `frontend/src/components/admin/useAdminState.ts` (MODIFY — batch reorder handler)  

---

### T24 — Remove Dead Code (getRequestTypeById)
**Problem:** `serviceDesk.controller.ts` has `getRequestTypeById` method (lines 254-272) but no corresponding route. It's dead code.  
**Scope:**  
- Option A: Delete the method (no current use case)  
- Option B: Add a route `GET /service-desks/request-types/:typeId` and expose it  
- Recommendation: Option A — no frontend code needs it, and `getRequestTypes` with `?categoryId=` already serves the use case  

**Files changed:**  
- `backend/src/controllers/serviceDesk.controller.ts` (MODIFY — remove method)  
- `frontend/src/services/serviceDesk.service.ts` (MODIFY — remove stub `getRequestTypeById`)  

---

## Dependency Graph

```
Phase 1 (critical, do first):
  T1 — independent
  T2 — independent
  T3 — independent
  T4 — independent (but T1 changes the desk empty state area)
  T5 — independent
  T6 — independent
  T7 — independent
  T8 — independent

Phase 2 (UX polish, depends on Phase 1 completion):
  T9  — independent
  T10 — depends on T9 (reuses IconPicker)
  T11 — independent
  T12 — depends on T2 (needs inactive service data)
  T13 — independent

Phase 3 (accessibility, can start after Phase 1):
  T14 — independent
  T15 — depends on T1, T5 (hooks applied to new modals)
  T16 — independent
  T17 — depends on T12 (status badge icons for service cards)

Phase 4 (backend hardening, can run in parallel with Phase 2-3):
  T18 — independent
  T19 — independent
  T20 — independent (but T2 adds a new endpoint that should go into the service)

Phase 5 (nice-to-have):
  T21 — independent
  T22 — depends on T5 (FormBuilderModal wrapper)
  T23 — independent
  T24 — independent
```

---

## Execution Batching

### Batch 1 (Phase 1 core — parallel subagents)
| Subagent | Tasks | Rationale |
|----------|-------|-----------|
| A | T1 (Service Desk CRUD UI) | Largest task, self-contained |
| B | T2 (Request Type Reactivation) + T7 (Count Column) | Backend + frontend pair |
| C | T3 (Loading States) + T4 (Empty States) + T11 (Manage Button) | Small, pure-frontend tasks |
| D | T5 (Extract Modals) + T8 (Consolidate Services) | Refactoring tasks |
| E | T6 (ServiceModal Edit Mode) | Needs its own context |

### Batch 2 (Phase 1 completion + Phase 2 start — parallel)
| Subagent | Tasks |
|----------|-------|
| F | T9 (Icon Picker) + T10 (Service Icon) |
| G | T12 (Service Card Status) — depends on T2 |
| H | T13 (Category Search) |

### Batch 3 (Phase 3 — parallel)
| Subagent | Tasks |
|----------|-------|
| I | T14 (ARIA) + T17 (Badge Icons) |
| J | T15 (Focus Trap + Escape) + T16 (Keyboard Focus) |

### Batch 4 (Phase 4 — parallel, backend only)
| Subagent | Tasks |
|----------|-------|
| K | T18 (Audit Logging) + T19 (Zod Validation) |
| L | T20 (Service Layer) |

### Batch 5 (Phase 5 — serial or parallel)
| Subagent | Tasks |
|----------|-------|
| M | T21 + T22 + T23 + T24 |

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| T1 new ServiceDeskModal conflicts with existing desk select | Desk select stays; modal is create/edit only |
| T2 new backend endpoint needs route ordering | Place `/request-types/all` before `/:typeId` param route |
| T5 extracting modals may break state wiring | Verify AdminSettings passes same props; test open/close cycle |
| T6 edit mode changes ServiceModal submit handler | Clear distinction: `editingService ? updateService : createService` |
| T8 removing admin.service methods may break other imports | grep for all imports before removing |
| T20 service layer extraction is large refactor | Can be deferred to Phase 4; controller works without it |

---

## Verification Checklist (after each batch)

- [ ] `npx tsc --noEmit` in frontend/ — zero new errors  
- [ ] `npx tsc --noEmit` in backend/ — zero new errors  
- [ ] Visual test: each modal opens and closes correctly  
- [ ] Visual test: loading states appear and disappear  
- [ ] Visual test: empty states render when no data  
- [ ] Visual test: desk CRUD creates/edits/deactivates/reactivates  
- [ ] Visual test: service reactivation shows inactive cards + restore  
- [ ] Visual test: ARIA labels present in DevTools accessibility tree  
- [ ] Keyboard test: Tab stays within open modals  
- [ ] Keyboard test: Escape closes modals  

---

## Files Summary

### NEW Files
| File | Task |
|------|------|
| `frontend/src/components/admin/ServiceDeskModal.tsx` | T1 |
| `frontend/src/components/admin/RequestTypeEditModal.tsx` | T5 |
| `frontend/src/components/admin/FormBuilderModal.tsx` | T5 |
| `frontend/src/components/admin/IconPicker.tsx` | T9 |
| `backend/src/validators/serviceDesk.validator.ts` | T19 |
| `backend/src/services/serviceDesk.service.ts` | T20 |

### MODIFIED Files
| File | Tasks |
|------|-------|
| `frontend/src/components/admin/ServiceDesksTab.tsx` | T1, T2, T3, T4, T6, T7, T11, T12, T13, T14, T16, T17 |
| `frontend/src/components/admin/CategoryModal.tsx` | T9, T14, T15 |
| `frontend/src/components/admin/ServiceModal.tsx` | T6, T10, T14, T15 |
| `frontend/src/components/admin/useAdminState.ts` | T1, T2, T3, T6, T8, T13 |
| `frontend/src/components/admin/index.ts` | T1, T5, T9 |
| `frontend/src/services/serviceDesk.service.ts` | T1, T2, T8, T24 |
| `frontend/src/services/admin.service.ts` | T8 |
| `frontend/pages/AdminSettings.tsx` | T1, T5 |
| `frontend/src/components/FormBuilder.tsx` | T21, T22 |
| `backend/src/controllers/serviceDesk.controller.ts` | T2, T18, T20, T24 |
| `backend/src/routes/serviceDesk.routes.ts` | T2, T19 |