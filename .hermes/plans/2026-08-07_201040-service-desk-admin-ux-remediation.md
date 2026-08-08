# Service Desk Administration UX and Catalog Management Implementation Plan

> Status: DRAFT — review before implementation
>
> This plan is based on the read-only Service Desks UI/UX audit. It does not claim that any remediation has been implemented.
>
> **Trimmed 2026-08-07.** Form versioning (Phase 4) is deferred to a separate plan. Phase 6
> accessibility work runs as a parallel track rather than a terminal phase. Blocking decisions
> reduced from twelve to three.

## Start here — first implementation slice

Everything below is context for this slice. Implement only this, then review before continuing:

1. Tenant-scoped admin/public catalog read contracts (Task 1.1, 1.2).
2. Admin endpoint/query for inactive desks (Task 2.1).
3. Frontend admin refresh correction for DRAFT services (Task 1.3).
4. Visible lifecycle badges (Task 2.2).
5. Reachable workflow mapping action (Task 2.3).
6. Regression tests for the draft-disappearing and restore-unreachable bugs.

Verified against the code before planning:

- `backend/src/services/serviceDesk.service.ts` contains no `tenantId` reference — gap 1 is real.
- `getAllDesks` hardcodes `where: { isActive: true }` (`serviceDesk.service.ts:7`) — restore is
  unreachable from the admin list.
- `fetchRequestTypes` uses `getAllRequestTypesAdmin` (`useAdminState.ts:796`), but
  `handleCreateService` (`:820`) and `handleSaveFormConfig` (`:915`) refresh via the
  published-only `getRequestTypes` — this is the disappearing-draft bug.

## Goal

Make the Service Desk administration experience safe, understandable, tenant-isolated, lifecycle-aware, and complete for managing:

```text
Service Desk → Category → Service / Request Type → Request Form Fields
```

The result must let an administrator confidently create, edit, deactivate, restore, preview, publish, version, and audit service-catalog configuration without losing records, exposing another tenant's catalog, or presenting misleading status information.

## Current baseline

The existing screen provides:

- Service desk create/edit/deactivate controls.
- Category create/edit/deactivate/reactivate/reorder controls.
- Service/request type create/edit/deactivate/reactivate controls.
- Custom form-field builder with drag-and-drop, duplication, dropdown options, file/entity fields, and conditional visibility.
- Governance detail modal with lifecycle transitions and entitlement display.
- Backend soft-delete behavior and admin-only write routes.

Confirmed gaps to address:

1. Service-desk queries do not visibly apply tenant scoping.
2. Inactive service desks are excluded from the admin list, making restore unreachable.
3. Newly-created DRAFT services can disappear after frontend refresh because admin code calls published-only endpoints.
4. Lifecycle status is not clearly separated from technical active/inactive status.
5. Workflow assignment editing exists in state/modal code but has no visible action from the service card.
6. Backend-supported form field types are not all available in the Form Builder.
7. Form configuration lacks enterprise validation. It also lacks version history, publishing, and
   rollback — real gaps, but deferred to a separate plan; only the validation part is in scope here.
8. Deactivation confirmation does not show dependency impact.
9. Category reorder uses multiple non-atomic updates.
10. Error, accessibility, mobile, search, and action-density issues reduce confidence and discoverability.

## Scope

### In scope

- Tenant isolation and parent-child authorization for the service catalog.
- Admin read/write API contract corrections.
- Service desk, category, and service lifecycle management.
- Form Builder completeness, validation, and preview.
- Service Desk screen IA and action discoverability.
- Loading/error/empty states.
- Accessibility and responsive behavior for this module.
- Audit and regression coverage.

### Out of scope for the first release

- Immutable form version model, publish/rollback, and version history. Deferred to a separate
  plan: it needs schema migration and a per-request snapshot decision, and none of the bugs in
  this remediation depend on it.
- Redesigning the general Admin Console navigation.
- Replacing the existing workflow runtime engine.
- Rebuilding the entire notification or SLA subsystem.
- Migrating all unrelated admin tabs to the new design system.
- Bulk catalog import/export unless separately approved.
- Automatic migration of existing catalog records without an explicit data-migration review.

## Non-negotiable principles

1. Tenant scope is enforced server-side; frontend filtering is never the security boundary.
2. Admin endpoints return active and inactive records when restoration is required; public endpoints remain user-visible only.
3. `isActive` and `lifecycleStatus` are different concepts and must be rendered separately.
4. Deactivation is soft-delete unless a separate approved purge process exists.
5. Every destructive or visibility-changing action explains impact before confirmation.
6. Existing requests retain their historical form configuration and remain readable after catalog changes.
7. Backend validation and authorization remain authoritative; client validation improves usability only.
8. Admin refreshes use admin APIs and must preserve the selected desk/category context.
9. Every async action has loading, success, failure, retry, and refresh behavior.

## Priority and release gates

| Priority | Meaning | Release treatment |
|---|---|---|
| P0 | Security or data-integrity blocker | Must close before shared-tenant or production rollout |
| P1 | Broken admin lifecycle or material operational risk | Must close before declaring catalog management production-ready |
| P2 | Significant usability/accessibility gap | Close before broad administrator rollout; may be staged behind P1 |
| P3 | Polish and efficiency improvement | Can follow the first stable release |

## Recommended implementation sequence

```text
Phase 0: Contract and decisions
    ↓
Phase 1: Tenant isolation and API correctness
    ↓
Phase 2: Lifecycle and CRUD reliability            Phase 6 (parallel track):
    ↓                                              modal accessibility, focus
Phase 3: Form Builder contract and validation      management, target sizes,
    ↓                                              responsive layout
Phase 5: Admin UI information architecture
    ↓                                              (no dependency on the data
Phase 7: End-to-end verification and rollout        contract — start anytime)
```

Phase 4 (form versioning) is deferred to a separate plan. Phase numbering is unchanged so that
existing task references stay valid.

**Gate:** do not start status-model or IA work — lifecycle badges, inactive filters, the service
card redesign — before Phase 1 and the draft-refresh fix land. Those surfaces render fields the
current data contract does not supply correctly, so building them first bakes in the bug.

**Not gated:** Phase 6.1 and 6.2 (modal dialog roles, label/control wiring, focus return, 44px
targets, responsive overflow) depend only on existing markup. Run them alongside Phase 1–2 for
early wins.

---

# Phase 0 — Contract, decisions, and test fixtures

## Task 0.1 — Confirm catalog lifecycle policy

**Objective:** Establish the product rules that the UI and API will implement.

**Decision required (blocking — see Open decisions):**

- Does deactivating a desk also hide all child categories/services, and does it mutate their own
  `isActive` values?

**Decision required (non-blocking — safe default applies unless overridden):**

- Does creating a service always create `DRAFT`?
- Can an admin publish immediately, or is review required?
- Should a RETIRED service ever be reactivated, or only cloned?

**Safe default:**

- Create as DRAFT.
- Draft is editable.
- Publish is explicit.
- Deactivation hides the selected record but does not mutate child records.
- Retired services cannot be reactivated; clone is the recovery path.

Immutability of published forms is out of scope here — it belongs to the deferred versioning plan.

**Deliverable:** Approved lifecycle decision table added to this plan or a linked ADR before
Phase 2.

## Task 0.2 — Create representative catalog fixtures

**Files:**
- Create or extend backend test fixtures under `backend/src/**/__tests__` or the existing service-desk test location.
- Inspect existing test conventions before creating files.

**Fixtures must cover:**

- Two tenants.
- Active and inactive desks.
- Active and inactive categories.
- DRAFT, PUBLISHED, DEPRECATED, and RETIRED request types.
- Request types with each supported form-field type.
- Existing requests created against an older form version.
- Entitlements belonging to different tenants.

**Acceptance criteria:** Tests can create an isolated catalog state without relying on seed-account names or live data.

---

# Phase 1 — P0 security and API/data-flow correctness

## Task 1.1 — Trace and define catalog tenant scope

**Objective:** Establish one reusable tenant-scoping policy for all catalog reads and writes.

**Inspect and likely modify:**

- `backend/src/services/serviceDesk.service.ts`
- `backend/src/controllers/serviceDesk.controller.ts`
- `backend/src/routes/serviceDesk.routes.ts`
- `backend/src/middleware/auth.middleware.ts`
- Existing tenant-scope utilities/middleware.
- `backend/src/generated/tenant-models.ts` if schema/model scope changes are made.
- `backend/prisma/schema.prisma`

**Implementation requirements:**

- Resolve tenant ID from the authenticated request context for admin operations.
- Keep public catalog reads scoped to the request's tenant/context, or explicitly document the tenant-selection mechanism for unauthenticated reads.
- Apply tenant scope to ServiceDesk, ServiceCategory, RequestType, entitlement, and agent queries.
- Reject records where parent and child tenant/desk/category relationships do not match.
- Do not accept a tenant ID from an untrusted request body as the authority.

**Tests:**

- Tenant A cannot list Tenant B desks.
- Tenant A cannot read Tenant B categories/request types.
- Tenant A cannot update/delete/restore Tenant B records by ID.
- A category ID from another desk cannot be mutated through the selected desk route.
- A fixed agent from another tenant is rejected.
- Entitlement operations cannot cross tenant/request-type scope.

**Gate:** No shared-tenant rollout until these tests pass.

## Task 1.2 — Split public and admin catalog read contracts

**Objective:** Make active/inactive and lifecycle visibility explicit in the API.

**Likely files:**

- `backend/src/routes/serviceDesk.routes.ts`
- `backend/src/controllers/serviceDesk.controller.ts`
- `backend/src/services/serviceDesk.service.ts`
- `frontend/src/services/serviceDesk.service.ts`
- `frontend/src/components/admin/useAdminState.ts`

**Recommended endpoints:**

```text
GET  /service-desks                         public/user-visible active catalog
GET  /admin/service-desks                   admin active + inactive desks
GET  /admin/service-desks/:id/categories   admin active + inactive categories
GET  /admin/service-desks/:id/request-types admin active + inactive types
```

A compatible alternative is to preserve current routes and add an explicit query such as `includeInactive=true`, but the admin contract must not be ambiguous.

**Acceptance criteria:**

- Public portal endpoints never expose inactive or unpublished catalog items.
- Admin screen can retrieve inactive desks for restoration.
- Response types include `isActive`, `lifecycleStatus`, version metadata, and counts where needed.
- Frontend admin refreshes never call the published-only endpoint when managing drafts.

## Task 1.3 — Fix draft service disappearing after save

**Files:**

- Modify `frontend/src/components/admin/useAdminState.ts:805-827`.
- Modify `frontend/src/components/admin/useAdminState.ts:907-923`.
- Modify `frontend/src/services/serviceDesk.service.ts` if a typed admin refresh method is needed.

**Change:**

- Use the admin request-type query after create, update, form save, and lifecycle changes.
- Preserve the currently selected desk and category after refresh.
- Refresh from the backend response rather than assuming the new item is published.

**Tests:**

- Create DRAFT service → service remains visible in admin list.
- Save DRAFT form configuration → service remains visible and form version updates.
- Publish service → it appears in the public request catalog.
- Deactivate service → it remains visible in admin list with inactive status.

**Acceptance criteria:**

- No success toast is followed by the newly-created service disappearing.
- The card clearly shows DRAFT versus PUBLISHED.

## Task 1.4 — Add explicit error-state contracts

**Files:**

- `frontend/src/components/admin/useAdminState.ts`
- `frontend/src/components/admin/ServiceDesksTab.tsx`
- `frontend/src/components/admin/CatalogItemDetail.tsx`
- `frontend/src/services/serviceDesk.service.ts`

**Requirements:**

- Distinguish loading, empty, forbidden, failed, and stale states.
- Add Retry actions for desk/category/service/catalog detail reads.
- Do not silently swallow entitlement or lifecycle failures.
- Normalize Axios errors through the shared API client.

**Tests:**

- 403 displays a permission state.
- 500 displays an error with Retry.
- Empty result displays an accurate empty state.
- Failed entitlement delete does not remove the row optimistically.

---

# Phase 2 — Reliable CRUD and lifecycle management

## Task 2.1 — Make service desk restoration reachable

**Files:**

- `backend/src/services/serviceDesk.service.ts`
- `backend/src/controllers/serviceDesk.controller.ts`
- `backend/src/routes/serviceDesk.routes.ts`
- `frontend/src/services/serviceDesk.service.ts`
- `frontend/src/components/admin/useAdminState.ts`
- `frontend/src/components/admin/ServiceDesksTab.tsx`

**UI:**

- Add Active/All status filter, or a “Show inactive desks” toggle.
- Show inactive desks with a visible status badge.
- Replace the restore icon-only control with a labelled action in the desk Actions menu.

**Acceptance criteria:**

- Deactivate desk.
- Switch to All/Inactive.
- Select desk.
- Reactivate desk.
- Confirm it becomes available to users only after the intended lifecycle rules are satisfied.

## Task 2.2 — Separate technical availability from catalog lifecycle

**Files:**

- `frontend/src/components/admin/ServiceDesksTab.tsx`
- `frontend/src/components/admin/CatalogItemDetail.tsx`
- `frontend/src/components/admin/ServiceModal.tsx`
- `frontend/src/components/admin/RequestTypeEditModal.tsx`
- `backend/src/validators/serviceDesk.validator.ts`
- Shared request-type types if present.

**UI status model:**

```text
Availability: Active / Inactive
Lifecycle: Draft / Published / Deprecated / Retired
Visibility: Visible to users / Hidden from users
```

**Acceptance criteria:**

- A DRAFT service is not labelled merely “Active”.
- A PUBLISHED service can be distinguished from an active-but-unpublished record.
- Deprecated and retired records have clear allowed actions.

## Task 2.3 — Expose workflow mapping from the service card

**Files:**

- `frontend/src/components/admin/ServiceDesksTab.tsx`
- `frontend/pages/AdminSettings.tsx`
- `frontend/src/components/admin/RequestTypeEditModal.tsx`
- `frontend/src/components/admin/useAdminState.ts`
- `frontend/src/services/serviceDesk.service.ts`

**Requirements:**

- Add a labelled “Workflow” action to each service.
- Open the existing request-type edit modal or consolidate it into the service editor.
- Show current workflow mapping, SLA, approval requirement, and required role in one place.
- Remove or document orphaned state/action code after wiring.

**Tests:**

- Workflow action is rendered for each service.
- Opening it loads the correct service.
- Saving workflow mapping refreshes the card/detail view.
- Clearing a workflow mapping persists `null` correctly.

## Task 2.4 — Add dependency-aware deactivation previews

**Files:**

- Backend service/controller/routes for catalog impact summary.
- `frontend/src/components/admin/ServiceDesksTab.tsx`
- `frontend/src/components/admin/CatalogItemDetail.tsx`
- New reusable confirmation dialog if one does not already exist.

**Recommended endpoint:**

```text
GET /admin/service-desks/:id/deactivation-impact
GET /admin/service-categories/:id/deactivation-impact
GET /admin/request-types/:id/deactivation-impact
```

**Impact should include:**

- Child category/service counts.
- Published versus draft counts.
- Existing request count.
- Workflow references.
- SLA/escalation references.
- Entitlement count.

**Acceptance criteria:**

- Confirmation identifies what will be hidden.
- Existing requests are explicitly described as retained.
- No destructive deletion occurs from the soft-delete action.

## Task 2.5 — Make category reorder atomic

**Files:**

- `backend/src/routes/serviceDesk.routes.ts`
- `backend/src/controllers/serviceDesk.controller.ts`
- `backend/src/services/serviceDesk.service.ts`
- `frontend/src/services/serviceDesk.service.ts`
- `frontend/src/components/admin/useAdminState.ts`
- Tests for the service.

**Recommended API:**

```text
PUT /admin/service-desks/:deskId/categories/reorder
body: { categoryIds: string[] }
```

**Requirements:**

- Validate all IDs belong to the desk.
- Update all display orders in one transaction.
- Return the ordered categories.
- Disable reorder controls while saving.
- Refresh only after the operation completes.

**Tests:**

- Successful reorder persists exact order.
- Invalid/mixed-desk IDs roll back all changes.
- Concurrent reorder does not leave duplicate or missing order values.

## Task 2.6 — Improve CRUD input validation

**Files:**

- `backend/src/validators/serviceDesk.validator.ts`
- `frontend/src/components/admin/ServiceDeskModal.tsx`
- `frontend/src/components/admin/CategoryModal.tsx`
- `frontend/src/components/admin/ServiceModal.tsx`
- Corresponding unit/integration tests.

**Validation requirements:**

- Trim names before save.
- Reject whitespace-only names.
- Enforce positive SLA hours in the UI before submission.
- Validate display order as a non-negative integer.
- Validate required role against an authoritative role list.
- Normalize desk/team codes at the boundary.
- Return field-specific backend errors to the modal.

---

# Phase 3 — Form Builder contract and validation

## Task 3.1 — Create a shared form-field type registry

**Objective:** Remove frontend/backend field-type drift.

**Likely files:**

- Create `frontend/src/config/requestFormFieldTypes.ts` or the repository's existing constants location.
- Modify `frontend/src/components/FormBuilder.tsx`.
- Modify `frontend/src/components/admin/FormBuilderModal.tsx`.
- Modify `backend/src/validators/serviceDesk.validator.ts` or introduce a shared contract strategy.
- Inspect request-rendering components, especially `CustomFieldsPanel.tsx` and create-request form components.

**Registry must define:**

- Type identifier.
- Display label.
- Supported operators.
- Editor configuration.
- Preview renderer.
- Runtime renderer.
- Validation rules.
- Whether options are required.
- Whether the field can contain sensitive data.

**Minimum supported parity:**

- text
- textarea
- select
- date
- number
- currency
- file
- entity
- ceo-select
- candidateDocuments

**Acceptance criteria:**

- Every backend-supported field type is selectable and editable in the UI.
- Every selectable field type has a preview and runtime renderer.
- Unsupported persisted types are shown with a safe “unsupported configuration” warning instead of silently rendering as text.

## Task 3.2 — Extend field configuration schema

**Product decision required:** Which attributes are needed in the first release for IT, HR, and Finance?

**Safe first-release field attributes:**

- Stable key.
- Label.
- Type.
- Required.
- Help text.
- Placeholder.
- Default value.
- Options for select fields.
- Min/max for number/currency.
- Min/max length for text.
- File MIME allowlist.
- Maximum file size.
- Maximum number of files.
- Sensitive/PII flag.
- Conditional visibility.

**Likely files:**

- `backend/src/validators/serviceDesk.validator.ts`
- `backend/src/services/serviceDesk.service.ts`
- `frontend/src/components/FormBuilder.tsx`
- `frontend/src/utils/formConfig.ts`
- Runtime custom-field renderer components.
- Tests for validator and renderer.

**Compatibility requirements:**

- Existing form configurations remain readable.
- New optional properties must have safe defaults.
- Existing field IDs remain stable.
- Field labels may change without changing the stored key.

## Task 3.3 — Add Form Builder validation

**Validation rules:**

- Non-empty labels.
- Unique stable keys.
- Unique labels within a form, or an explicit product decision if duplicate labels are allowed.
- Dropdown must contain at least one valid option.
- No duplicate options.
- Conditional field references must point to an existing field.
- No self-reference.
- No dependency cycles.
- Operators must be compatible with source field type.
- Required fields cannot depend on an impossible condition.
- File fields must have bounded upload constraints.

**Files:**

- `frontend/src/components/FormBuilder.tsx`
- Create or extend `frontend/src/utils/formConfig.ts`.
- `backend/src/validators/serviceDesk.validator.ts`.
- Backend form configuration validation service if Zod schema becomes too complex.

**Tests:**

- Frontend unit tests for each invalid configuration.
- Backend validator tests for malformed payloads.
- Cross-layer parity test for supported field types and operators.

## Task 3.4 — Improve conditional rule editor

**UI requirements:**

- Render a natural-language summary.
- Filter operators by source field type.
- Use the correct input for the comparison value.
- Support select option selection rather than raw comma-separated text where applicable.
- Block save for incomplete conditions instead of silently stripping them.
- Clearly show the dependency graph.

**Acceptance criteria:**

- Admin can understand a rule without reading JSON.
- Invalid rules are blocked before save.
- Backend rejects invalid rules even if the client is bypassed.

## Task 3.5 — Add functional form test preview

**Files:**

- `frontend/src/components/FormBuilder.tsx`
- New preview/test components under `frontend/src/components/admin/` if needed.
- Existing custom-field renderer components.

**Preview must demonstrate:**

- Required-field validation.
- Conditional visibility.
- Dropdown/entity values.
- File constraints.
- Currency/number formatting.
- Date validation.
- Error states.

**Acceptance criteria:**

- Preview uses the same rendering contract as the end-user request form where practical.
- Admin can test a rule before publishing.
- Preview data is clearly marked as test data and is never persisted as a request.

---

# Phase 4 — Form versioning, draft, publish, and rollback (DEFERRED)

Moved out of this plan. Immutable version model, version APIs, and version-history UI require a
Prisma migration and a decision on whether requests store a full form-config snapshot or a
version reference — neither of which any bug in this remediation depends on.

Until that plan lands, this remediation must not regress the existing behavior: editing
`RequestType.formConfig` continues to mutate in place, and Task 3.3 validation is the only guard
against publishing a broken form. Task 6.4 still surfaces created/updated metadata, so admins are
not left blind in the interim.

**Carried forward to the versioning plan:** the immutable version model, the six
`/admin/request-types/:id/versions*` endpoints, compare/restore UI, and manual Journey B.

---

# Phase 5 — Admin UI information architecture and action clarity

## Task 5.1 — Choose the target information architecture

**Decision required:**

Option A — Dedicated detail workspace:

```text
Service Desk list → Service Desk detail
Category list → Category detail
Service list → Service detail
```

Option B — Keep the current single-page expandable layout but introduce labelled action menus and structured drawers.

**Recommended default: Option B.** Option A is a rewrite, and it contradicts Task 5.2's
"preserve current behavior while extracting components" — the two cannot both be done in one
release. The discoverability problems in Task 5.3 (icon-only density, hidden workflow action,
missing labels) are what actually hurt admins, and Option B fixes all of them without destabilizing
a data layer that is only just being corrected in Phases 1–2.

Revisit Option A once the catalog contract is stable and Task 5.4 has established real catalog
size. If catalogs stay small, Option B may simply be sufficient.

## Task 5.2 — Extract service-desk feature components

**Likely files:**

- `frontend/pages/AdminSettings.tsx`
- `frontend/src/components/admin/ServiceDesksTab.tsx`
- `frontend/src/components/admin/useAdminState.ts`
- New components under `frontend/src/components/admin/service-desk/`.

**Suggested components:**

```text
ServiceDeskAdminPage
ServiceDeskList
ServiceDeskOverview
CategoryList
CategoryRow
ServiceList
ServiceCard
ServiceActionsMenu
CatalogStatusBadge
CatalogImpactDialog
CatalogErrorState
```

**Requirements:**

- Preserve current behavior while extracting components.
- Keep data fetching and mutation orchestration in hooks/services.
- Use typed props rather than `any` for catalog entities.
- Do not mix form-builder state with global AdminSettings state unnecessarily.

## Task 5.3 — Replace icon-only action density

**UI requirements:**

Primary visible actions:

```text
Edit
Manage Services
Configure Form
Workflow
Deactivate / Restore
```

Secondary actions can be inside a labelled menu.

Every destructive action must use the shared confirmation dialog with impact details.

**Acceptance criteria:**

- All actions are discoverable without relying on hover tooltips.
- Keyboard users can reach every action.
- Mobile action layout does not overflow horizontally.

## Task 5.4 — Add search, filtering, and pagination strategy

**Minimum filters:**

- Active/inactive.
- Draft/published/deprecated/retired.
- Requires approval.
- Has custom fields.
- Has workflow.
- Has SLA.

**Search scope:**

- Desk name/code.
- Category name/description.
- Service name/description.
- Workflow code/name.

**Decision:** Determine expected catalog size. If catalogs can exceed approximately 100 rows per level, use server-side pagination and filtering instead of loading the entire tree.

## Task 5.5 — Preserve context after mutations

**Files:**

- `frontend/src/components/admin/useAdminState.ts`
- `frontend/src/services/serviceDesk.service.ts`

**Requirements:**

- Preserve selected desk after save/deactivate/reactivate.
- Preserve selected category after service/form mutation.
- Do not reset to the first desk after every refresh.
- Prevent stale async responses from overwriting a newly selected desk/category.
- Disable controls during mutation.

**Tests:**

- Edit second desk → second desk remains selected.
- Create service under category B → category B remains expanded.
- Switch desks quickly while requests are in flight → final selection wins.

---

# Phase 6 — Accessibility, responsive behavior, and operational polish

## Task 6.1 — Accessibility pass

**Files:**

- `frontend/src/components/admin/CategoryModal.tsx`
- `frontend/src/components/admin/ServiceModal.tsx`
- `frontend/src/components/admin/ServiceDeskModal.tsx`
- `frontend/src/components/admin/FormBuilderModal.tsx`
- `frontend/src/components/FormBuilder.tsx`
- `frontend/src/components/admin/ServiceDesksTab.tsx`

**Requirements:**

- One dialog role per modal with a labelled heading.
- `htmlFor`/`id` connections for labels and controls.
- Accessible labels for color choices and all icon buttons.
- Keyboard alternatives to drag-and-drop.
- Focus returns to the triggering control after modal close.
- Escape behavior respects dirty state.
- Table headers and row actions are announced correctly.
- Minimum 44–48px interactive targets.
- Visible focus states.

**Verification:**

```bash
cd frontend
npm run test:e2e:a11y
```

Also perform manual keyboard navigation through:

- Desk selection.
- Category edit.
- Service edit.
- Form Builder.
- Confirmation dialog.
- Version publish dialog.

## Task 6.2 — Responsive layout pass

**Requirements:**

- No horizontal page overflow at 320px, 375px, 768px, and desktop widths.
- Replace the wide category table with stacked cards or responsive columns on narrow screens.
- Service actions remain reachable without hover.
- Auto-assignment summary wraps without obscuring controls.
- Modal controls remain usable at 200% browser zoom.

**Verification:**

- Playwright viewport matrix.
- Manual browser checks at desktop/tablet/mobile widths.
- Test long desk names, long service names, and long agent names.

## Task 6.3 — Replace raw color classes with semantic tokens

**Files:**

- `backend/prisma/schema.prisma` only if a data migration is required.
- `backend/src/validators/serviceDesk.validator.ts`.
- `frontend/src/components/admin/adminConstants.ts`.
- `frontend/src/components/admin/CategoryModal.tsx`.
- `frontend/src/components/admin/ServiceDesksTab.tsx`.

**Requirements:**

- Store a semantic token such as `blue`, `green`, or `purple`.
- Map tokens to classes in one frontend registry.
- Preserve a compatibility mapping for existing stored class strings.
- Do not allow arbitrary class strings from user input.

## Task 6.4 — Add catalog metadata and audit visibility

**UI metadata:**

- Created date/by.
- Last updated date/by.
- Published date/by.
- Current form version.
- Review date.
- Owner.
- Audit history link.

**Backend:**

- Reuse the existing `AuditLog` model and `auditLog()` utility.
- Ensure all catalog mutations are logged with actor, tenant, parent IDs, old/new status, and version.

---

# Phase 7 — Verification and rollout

## Automated verification gates

### Frontend

```bash
cd frontend
npm test
npm run build
npm run test:e2e:smoke
npm run test:e2e:a11y
```

Relevant targeted tests should include:

- Service desk admin state/refresh tests.
- Category CRUD tests.
- Request type lifecycle tests.
- Form Builder validation tests.
- Form field registry parity tests.
- Form preview/conditional-rule tests.
- Accessibility tests.

### Backend

```bash
cd backend
npm test
npm run build
npm run lint
npx prisma validate
```

Relevant targeted tests should include:

- Tenant isolation.
- Parent-child scope checks.
- Admin/public catalog visibility.
- Desk/category/service soft-delete and restore.
- Lifecycle transitions.
- Form configuration validation.
- Atomic category reorder.
- Fixed-agent tenant/team validation.

## Manual acceptance journey

### Journey A — Create and publish a service

1. Sign in as an authorized administrator.
2. Create a service desk.
3. Create a category.
4. Create a service.
5. Confirm the service is visible as DRAFT in admin UI.
6. Configure form fields.
7. Preview/test the form.
8. Publish the form/service.
9. Open the user request creation flow.
10. Confirm the service appears only after publishing.
11. Submit a request.
12. Confirm the request stores the expected form values.

### Journey B — Edit without breaking existing requests

Reduced scope: the full version-history walkthrough moves to the deferred versioning plan. What
must still hold here is that in-place form edits do not corrupt already-submitted requests.

1. Publish a service and submit a request against its form.
2. Edit the form: add a field, rename a field's label, remove a field.
3. Confirm the existing request still renders its original submitted values, including the value
   for the removed field.
4. Confirm a new request uses the edited form.
5. Confirm renaming a label did not change the stored field key.

### Journey C — Deactivate and restore

1. Deactivate a service.
2. Confirm impact preview.
3. Confirm it disappears from the public catalog.
4. Confirm it remains visible in admin All/Inactive view.
5. Restore it or clone it according to lifecycle policy.
6. Confirm public visibility follows the intended publish/active rules.

### Journey D — Tenant isolation

1. Sign in as Tenant A administrator.
2. Confirm only Tenant A desks/categories/services are visible.
3. Attempt direct access to a Tenant B record ID.
4. Confirm a safe 403/404 response.
5. Repeat for update, delete, restore, entitlement, and fixed-agent actions.

## Rollout plan

### Stage 1 — Internal development/staging

- Enable admin-only APIs and UI.
- Run fixture-based tests.
- Run manual journeys A–D.
- Verify no cross-tenant records in API responses.
- Verify existing public request creation remains functional.

### Stage 2 — Controlled administrator cohort

- Enable for selected admins.
- Keep the existing admin surface available as a fallback if the new workspace is behind a feature flag.
- Monitor API errors, failed saves, and catalog visibility mismatches.
- Do not automatically migrate existing form configurations until readback checks pass.

### Stage 3 — General rollout

- Enable after all P0/P1 gates pass.
- Retain rollback to the prior admin UI for one release cycle.
- Keep old read compatibility for form configurations and lifecycle values.

## Rollback strategy

- Feature-flag the new admin surface separately from backend contract changes.
- Do not hard-delete catalog records during rollout.
- Preserve old `formConfig` read compatibility.
- If tenant-scope regressions are detected, disable the admin surface and investigate before re-enabling.
- Database migrations must be additive first; destructive cleanup requires a separate approved migration.

## Definition of done

### P0

- [ ] Tenant isolation is enforced and tested for all catalog resources.
- [ ] No cross-tenant record can be read or mutated by ID.
- [ ] Draft service creation/form saves remain visible in admin UI.
- [ ] Public catalog visibility remains active-and-published only.
- [ ] Errors are not silently rendered as empty data.

### P1

- [ ] Inactive desks can be found and restored.
- [ ] Active/inactive and lifecycle status are separately displayed.
- [ ] Workflow mapping is reachable from the visible service UI.
- [ ] All backend-supported field types are supported by the builder/runtime.
- [ ] Form validation blocks invalid configurations at both client and server.
- [ ] Editing a form in place does not corrupt already-submitted requests (Journey B).
- [ ] Deactivation impact is shown before confirmation.
- [ ] Category reorder is atomic and tested.
- [ ] Parent-child ownership checks are enforced.

### P2

- [ ] Service-desk hierarchy is understandable without hidden icon semantics.
- [ ] Search and filters cover desk/category/service/lifecycle needs.
- [ ] Dirty-state protection exists for modals and Form Builder.
- [ ] Preview is functionally testable.
- [ ] Keyboard and screen-reader checks pass.
- [ ] Mobile/tablet layouts do not overflow.
- [ ] Last-updated/owner metadata is visible.

### P3

- [ ] Semantic color tokens replace raw stored Tailwind classes.
- [ ] Clone service/category/form actions are available if approved.
- [ ] Bulk catalog operations are available if catalog scale requires them.

## Open decisions

### Blocking — must be answered before Phase 1 coding starts

1. **Tenant model:** Are service desks globally shared in any environment, or must every desk
   belong to a tenant/department? Determines whether Task 1.1 adds a scope filter or a schema
   relation.
2. **Parent deactivation:** Should deactivating a desk hide children without changing their own
   `isActive` values? Determines the Task 2.1 restore semantics and the Task 2.4 impact copy.
3. **Form identity:** Should field keys be editable after a request type has been used, or
   immutable after first use? Determines the Task 3.2 compatibility rules, and Journey B step 5
   cannot be written without it.

### Non-blocking — safe default applies; revisit before the phase that needs it

4. Approvals: is catalog publishing one-person, or maker-checker? *Default: one-person.* (Phase 2)
5. Retirement: can RETIRED services be restored, or must they be cloned? *Default: clone only.* (Phase 2)
6. Catalog scale: expected max desks/categories/services per tenant? *Default: assume under 100 per
   level and load the full tree; revisit in Task 5.4.* (Phase 5)
7. Ownership: which roles can edit metadata, configure forms, retire, and restore? *Default: existing
   admin permission.* (Phase 2)
8. Entitlements: part of this release or a separate workstream? *Default: display only, no redesign.*
9. Color tokens: is compatibility with stored Tailwind strings required for one release? *Default:
   yes, one cycle.* (Phase 6)
10. UI approach: dedicated workspace vs expandable layout? *Resolved — Option B, see Task 5.1.*

### Moved to the deferred versioning plan

- Should editing a published service always create a new draft version?
- Should each request store a complete form-config snapshot, or only a form-version reference?

## Source evidence map

- Main page composition: `frontend/pages/AdminSettings.tsx:140-176`
- Service desk UI: `frontend/src/components/admin/ServiceDesksTab.tsx:106-453`
- Desk modal: `frontend/src/components/admin/ServiceDeskModal.tsx:70-274`
- Category modal: `frontend/src/components/admin/CategoryModal.tsx:31-140`
- Service modal: `frontend/src/components/admin/ServiceModal.tsx:46-126`
- Form builder: `frontend/src/components/FormBuilder.tsx:30-508`
- Admin state/fetch/mutations: `frontend/src/components/admin/useAdminState.ts:427-950`
- Frontend catalog API client: `frontend/src/services/serviceDesk.service.ts:3-101`
- Backend routes: `backend/src/routes/serviceDesk.routes.ts:17-140`
- Backend controllers: `backend/src/controllers/serviceDesk.controller.ts:70-343`
- Backend validation: `backend/src/validators/serviceDesk.validator.ts:15-111`
- Backend catalog service: `backend/src/services/serviceDesk.service.ts:5-337`
- Prisma catalog models: `backend/prisma/schema.prisma:420-500`

## Review checkpoint

Answer the three blocking decisions above, then confirm the first implementation slice at the top
of this plan. Everything else has a stated default and does not need to be settled now.
