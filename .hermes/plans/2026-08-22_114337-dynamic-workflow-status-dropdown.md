# Dynamic Workflow Status Dropdown Implementation Plan

> **For Hermes:** Implement task-by-task only after plan approval. Use test-first changes, preserve unrelated work, and stop at genuine product/data blockers.

**Goal:** Replace free-text workflow status codes with governed administrator-managed dropdown selection and make newly created status codes usable safely by the workflow runtime.

**Architecture:** `RequestStatusDefinition` becomes the source of truth for status identity and lifecycle semantics. Workflow nodes reference status codes from that catalog; workflow-specific properties such as initial/final/SLA pause remain on the node. The request runtime migrates from the Prisma `RequestStatus` enum to a validated string status so new administrator-created codes can be persisted, transitioned, audited, reported, and displayed without code changes.

**Tech Stack:** React 19 + TypeScript + Vite, Express + TypeScript, Prisma 5/PostgreSQL, Jest, Vitest, React Flow.

---

## 1. Scope and non-goals

### In scope

- Dynamic status-code catalog managed by administrators.
- Active/retired status lifecycle.
- Workflow Designer status-code dropdown in the palette and node inspector.
- Status-definition validation at API, graph-save, validate, publish, and runtime-transition boundaries.
- Runtime request status migration from Prisma enum to string.
- Dynamic lifecycle behavior replacing hardcoded resolved/closed/completed status sets.
- Status usage protection and auditability.
- Workflow-scoped/category-scoped status filtering.
- Backward compatibility for existing enum-backed statuses and existing requests.
- Legacy workflow surface reconciliation.
- Frontend/backend automated coverage and authenticated browser verification.

### Explicitly out of scope

- New BPMN node types such as timers, gateways, webhooks, or scripts.
- Redesign of transition authorization policy.
- Redesign of SLA calculation itself; only status-driven pause/resume lookup is generalized.
- Bulk historical status renaming.
- Deleting or rewriting existing workflow versions.
- Production deployment, migration execution, or publishing a workflow without separate approval.

### Product assumptions used by this plan

1. Status codes are globally unique and immutable identifiers.
2. Status labels/descriptions/categories can be edited without changing the code.
3. A status may be reused by multiple workflow types.
4. Initial/final/SLA-pause behavior is workflow-node-specific, not globally forced by the catalog.
5. Retired statuses remain valid for existing requests, histories, and existing workflow versions, but cannot be added to new nodes.
6. Every request status must resolve to a status definition after migration and seed/backfill validation.
7. A status lifecycle classification is required for dynamic terminal behavior.

---

## 2. Current evidence and constraints

- `backend/prisma/schema.prisma:1083-1190` defines the current `RequestStatus` enum.
- `backend/prisma/schema.prisma:1213-1217` stores `Request.status` as that enum.
- `backend/prisma/schema.prisma:2261-2275` already provides `RequestStatusDefinition`, but it has no runtime relation or lifecycle metadata.
- `backend/prisma/schema.prisma:941-969` stores `WorkflowNode.statusCode` as an unconstrained string.
- `frontend/src/components/workflow/StatusPalette.tsx:6-18` accepts free-text status codes.
- `frontend/src/components/workflow/NodeInspector.tsx:30-32` displays status code read-only and does not offer a selector.
- `backend/src/services/workflowValidator.service.ts:33-64` validates presence/uniqueness only, not catalog membership.
- `backend/src/services/requestTransition.service.ts:170-196` contains hardcoded lifecycle sets.
- `backend/src/services/requestTransition.service.ts:368-385` sends the target status through the workflow command boundary.
- `backend/src/services/workflowCommand.service.ts:241-252` writes the target status to `requests.status`.
- `backend/src/controllers/workflow.controller.ts:162-260` exposes a legacy direct `WorkflowStep` editor in parallel with the versioned designer.
- Existing workflow tests passed before implementation: frontend 11 tests; backend 66 tests. These are baseline evidence, not proof of the new feature.

---

## 3. Target data model

### 3.1 Extend `RequestStatusDefinition`

Modify `backend/prisma/schema.prisma`:

- Keep `code String @unique` as the immutable identifier.
- Add `lifecycleType` enum/string with values:
  - `OPEN`
  - `RESOLVED`
  - `CLOSED`
  - `CANCELLED`
- Add `isTerminal Boolean @default(false)` only if needed for reporting/guards; derive terminal behavior from lifecycle type where possible to avoid duplicate truth.
- Add `retiredAt DateTime?`.
- Add `createdById String?` and `updatedById String?` only if the existing audit convention supports these relations without unnecessary schema expansion.
- Add indexes for `(isActive, category)`, `(retiredAt)`, and lifecycle filtering as justified by query plans.

Preferred final semantics:

- `isActive=true, retiredAt=null`: selectable for new workflow nodes.
- `isActive=false` or `retiredAt != null`: retained for existing data, not selectable for new nodes.
- `lifecycleType` controls runtime timestamp/report classification.
- `isFinal` remains on `WorkflowNode`, because the same catalog status may be final in one workflow and non-final in another.

### 3.2 Keep workflow node behavior local

Do not move these fields to the global status catalog:

- `isInitial`
- `isFinal`
- `slaPause`
- `displayOrder`
- workflow-specific label override
- workflow-specific icon override

Add a database foreign key from `WorkflowNode.statusCode` to the catalog only if PostgreSQL migration feasibility is confirmed for all existing rows. If a direct foreign key is impractical because of nullable legacy nodes or cross-version compatibility, enforce membership transactionally in the service and add a documented invariant test.

### 3.3 Migrate request status storage

Change `Request.status` from `RequestStatus` enum to `String` with the same default value (`SUBMITTED`).

Migration requirements:

- Add a PostgreSQL migration that converts the enum column to `varchar` without changing current values.
- Preserve the existing default.
- Verify every existing enum value has a `RequestStatusDefinition` row before enabling dynamic writes.
- Do not drop the PostgreSQL enum type until all generated client references and database dependencies are removed.
- Keep a compatibility TypeScript union only where a fixed set is required by legacy business logic; do not use it to constrain runtime status writes.

### 3.4 Audit and history

Existing `WorkflowHistory.fromStatus` and `toStatus` are already strings and should remain unchanged.

Add audit metadata for status definition changes:

- create
- label/category/lifecycle edit
- activate/deactivate
- retire
- attempted delete blocked by usage

Reuse the existing `AuditLog`/audit utility instead of adding a separate audit table.

---

## 4. API contract

### 4.1 Status catalog endpoints

Keep the existing route family under `/admin/status-definitions`, but harden the contract.

Existing endpoints:

- `GET /active`
- `GET /`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

Add or expose:

- `GET /active?workflowTypeId=<id>` or `GET /active?category=<category>` with explicit filtering semantics.
- `GET /:id/usage` returning counts by workflow node, workflow step, transition, request, history, and banner reference.
- `POST /:id/retire` or use `PUT /:id` with an explicit retirement field; do not hard-delete in the normal UI.

Response shape for active catalog entries:

```json
{
  "id": "uuid",
  "code": "FINANCE_ACKNOWLEDGED",
  "label": "Acknowledged",
  "description": "Finance has acknowledged the request",
  "category": "FINANCE",
  "lifecycleType": "OPEN",
  "isActive": true,
  "retiredAt": null,
  "displayOrder": 10
}
```

Boundary validation:

- trim code and label
- normalize code to uppercase
- allow only `[A-Z][A-Z0-9_]{1,99}`
- reject reserved/system-internal codes if a reserved list exists
- reject duplicate codes case-insensitively
- require valid lifecycle type
- require `isTerminal=true` only for closed/resolved/cancelled lifecycle types if the field is retained
- reject code changes after creation
- reject deactivation/retirement when it would make a newly-created workflow invalid unless the request explicitly supports a remediation path

### 4.2 Workflow graph endpoints

Update the graph API contract so status membership is validated server-side:

- `PATCH /admin/workflows/versions/:versionId/graph`
- `POST /admin/workflows/versions/:versionId/validate`
- `POST /admin/workflows/versions/:versionId/publish`

Required behavior:

- Save rejects a new node with an unknown status code.
- Save rejects a new node with an inactive/retired status code.
- Existing legacy nodes using a now-retired status may remain editable for non-code fields, but cannot be duplicated into a new node.
- Validate returns accumulated findings:
  - `STATUS_DEFINITION_NOT_FOUND`
  - `STATUS_DEFINITION_INACTIVE`
  - `STATUS_DEFINITION_CATEGORY_MISMATCH` when workflow scope is enforced
  - `STATUS_DEFINITION_LIFECYCLE_CONFLICT` when node configuration conflicts with policy
- Publish re-runs the same validation inside the transaction.

### 4.3 Runtime transition endpoint

Before executing a transition:

1. Load the target definition by code.
2. Reject if missing.
3. Reject if retired/inactive and the transition is not an approved historical/remap operation.
4. Resolve lifecycle type for timestamps and reporting.
5. Validate the transition policy for the current workflow.
6. Write request, history, activity, audit, and outbox event atomically.

System migrations/remaps may use retired targets only through an explicit internal service path with audit metadata; ordinary users must not use that bypass.

---

## 5. Backend implementation tasks

### Task B1: Add lifecycle schema and migration

**Files:**

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_dynamic_workflow_statuses/migration.sql`
- Review: all existing migrations affecting `requests.status` and `request_status_definitions`

**Steps:**

1. Add lifecycle enum/fields and retirement metadata.
2. Change `Request.status` to `String`.
3. Write a forward migration that preserves all existing values and the default.
4. Add indexes/constraints.
5. Run `npx prisma validate`.
6. Run `npx prisma generate`.
7. Verify migration SQL does not drop data or silently coerce values.

**Acceptance:** schema validates, generated client exposes string request status, and migration is reversible/documented.

### Task B2: Add status catalog domain service

**Files:**

- Create: `backend/src/services/requestStatusDefinition.service.ts`
- Modify: `backend/src/controllers/requestStatusDefinition.controller.ts`
- Modify: `backend/src/routes/requestStatusDefinition.routes.ts`
- Add tests: `backend/src/services/__tests__/requestStatusDefinition.service.test.ts`
- Add/controller tests: `backend/src/controllers/__tests__/requestStatusDefinition.controller.test.ts`

**Steps:**

1. Centralize code normalization and validation.
2. Implement `getSelectableDefinitions(workflowTypeId/category)`, `getDefinitionByCode`, `assertSelectableCode`, and `getUsage`.
3. Implement retire/deactivate behavior.
4. Block hard delete when any workflow/request/history/transition/banner reference exists.
5. Record audit events for all mutations.
6. Use a transaction for mutation plus audit.

**Acceptance:** no controller directly creates arbitrary unvalidated status codes; all mutations return structured errors.

### Task B3: Add catalog membership validation to graph saving

**Files:**

- Modify: `backend/src/services/workflowGraph.service.ts`
- Modify: `backend/src/services/workflowValidator.service.ts`
- Modify: `backend/src/controllers/workflowVersion.controller.ts`
- Modify: `backend/src/services/workflowGraph.types.ts`
- Add tests: `backend/src/services/__tests__/workflowStatusDefinitionValidation.test.ts`
- Extend: `backend/src/services/__tests__/workflowValidatorStructure.test.ts`
- Extend: `backend/src/services/__tests__/workflowGraphService.test.ts`

**Steps:**

1. Add a transaction-scoped catalog lookup for all graph node codes.
2. Validate unknown, inactive, retired, and category-mismatched codes.
3. Ensure graph replacement validates before deleting absent nodes/edges.
4. Ensure publish validates again inside the same transaction.
5. Preserve legacy unknown values only through an explicit read-only/repair path, never silently.

**Acceptance:** invalid status codes cannot be persisted or published; a failed replacement leaves the original graph unchanged.

### Task B4: Replace hardcoded lifecycle sets

**Files:**

- Modify: `backend/src/services/requestTransition.service.ts`
- Modify: `backend/src/constants/requestStatuses.ts`
- Modify: all services found by search for `RESOLVE_STATUSES`, `CLOSE_STATUSES`, `COMPLETE_STATUSES`, `RequestStatus`, and direct status comparisons
- Add tests: `backend/src/services/__tests__/dynamicStatusLifecycle.test.ts`
- Update existing transition tests: `backend/src/services/__tests__/transitionGuards.test.ts`, `backend/src/services/__tests__/creditApplication.transition.test.ts` where applicable

**Steps:**

1. Load the target `RequestStatusDefinition` inside the transition flow.
2. Derive resolved/closed/completed timestamps from lifecycle type.
3. Remove duplicated hardcoded sets from runtime behavior.
4. Retain fixed constants only for migrations, seed compatibility, or compile-time UI categories where justified.
5. Ensure missing definitions fail closed.
6. Ensure retired statuses remain readable but cannot be normal transition targets.

**Acceptance:** a newly seeded status with `lifecycleType=RESOLVED` sets `resolvedAt` without code changes; unknown lifecycle definitions block the transition.

### Task B5: Generalize request validators and queries

**Files:**

- Modify: `backend/src/validators/request.validator.ts`
- Modify: request controllers/services discovered through status searches
- Modify: reports, dashboards, SLA, notification, search, and filter services that import `RequestStatus`
- Add/update relevant tests

**Steps:**

1. Replace enum validation for request status inputs with catalog-code validation.
2. Keep status filters as validated strings.
3. Replace enum array typing where runtime dynamic values are returned.
4. Update serialization/types without unsafe casts.
5. Confirm status comparisons use definition lifecycle or centralized helpers.

**Acceptance:** request creation, filtering, transition, list, detail, reporting, and notification paths accept dynamic codes consistently.

### Task B6: Reconcile compiler and legacy workflow surfaces

**Files:**

- Modify: `backend/src/services/workflowCompiler.service.ts`
- Modify: `backend/src/controllers/workflow.controller.ts`
- Modify: legacy workflow routes and frontend consumers found by route inventory
- Add/update compiler tests: `backend/src/services/__tests__/workflowCompiler.test.ts`

**Steps:**

1. Validate compiled steps against catalog definitions.
2. Preserve status labels/icons and node-level behavior.
3. Make legacy workflow-scoped rows read-only or label them as compiled runtime artifacts.
4. Prevent direct legacy CRUD from creating uncatalogued statuses.
5. Ensure global fallback transitions remain unchanged unless explicitly in scope.

**Acceptance:** versioned designer is the authoritative authoring surface; legacy APIs cannot bypass status governance.

### Task B7: Update seed/backfill/bootstrap tooling

**Files:**

- Review/modify: `backend/prisma/seed.ts`
- Review/modify: workflow seed/bootstrap/backfill scripts under `backend/prisma/`
- Add: `backend/prisma/seed-dynamic-status-definitions.ts` only if existing seed organization cannot be safely extended
- Add tests or dry-run assertions for backfill

**Steps:**

1. Upsert definitions for every current `RequestStatus` enum value.
2. Assign lifecycle classifications from the existing resolved/closed/completed semantics.
3. Verify every existing `Request.status`, `WorkflowStep.status`, `WorkflowTransition.fromStatus`, and `toStatus` has a definition.
4. Make the seed idempotent.
5. Run the seed twice in a safe local environment and confirm zero unexpected changes on the second run.
6. Keep admin-managed configuration retention behavior intact.

**Acceptance:** no existing runtime status is orphaned; seed/backfill shadow mode reports zero missing definitions.

### Task B8: Add migration safety checks

**Files:**

- Create: `backend/src/scripts/verify-dynamic-status-migration.ts` or an equivalent existing script location
- Add npm script in `backend/package.json`
- Add tests if the script has pure validation helpers

**Checks:**

- all request statuses have catalog definitions
- all workflow step statuses have definitions
- all transition endpoints have definitions
- no duplicate case-insensitive codes
- lifecycle fields are valid
- no active workflow has unknown/inactive nodes
- no request is in an unknown status
- no status code was renamed

**Acceptance:** script is read-only by default, exits non-zero on violations, and prints exact counts/status codes.

---

## 6. Frontend implementation tasks

### Task F1: Add shared status catalog service/types

**Files:**

- Modify: `frontend/src/services/requestStatusService.ts`
- Create: `frontend/src/types/requestStatus.ts` only if shared types cannot remain in the service
- Add tests: `frontend/src/services/__tests__/requestStatusService.test.ts`

**Steps:**

1. Extend the type with lifecycle and retirement fields.
2. Add `getSelectableForWorkflow(workflowTypeId)` or the approved category-based method.
3. Normalize API errors into user-readable messages.
4. Test request URL, query parameters, and response unwrapping.

### Task F2: Add status catalog loading to the designer

**Files:**

- Modify: `frontend/pages/WorkflowDesigner.tsx`
- Modify/create: `frontend/src/hooks/useWorkflowStatusDefinitions.ts`
- Add tests: `frontend/src/hooks/__tests__/useWorkflowStatusDefinitions.test.ts`

**Steps:**

1. Load selectable definitions when workflow type/version changes.
2. Show loading, error, empty, and stale-legacy states.
3. Refresh the catalog after returning from admin status settings if a future inline link is added.
4. Keep the graph usable in read-only mode even if the catalog endpoint fails, but block mutation and show the reason.

### Task F3: Replace free-text palette entry with dropdown

**Files:**

- Modify: `frontend/src/components/workflow/StatusPalette.tsx`
- Modify: `frontend/src/components/workflow/__tests__/StatusPalette.test.tsx`

**Behavior:**

- Select an active catalog status.
- Display code, label, and category.
- Prevent duplicate status codes already in the graph.
- Prepopulate label from catalog label.
- Allow a workflow-specific label override only after the node is created.
- Do not permit arbitrary code entry.
- Show an explicit empty state when no active statuses are available.
- Preserve any unknown existing legacy statuses in a separate warning list, not in the new-status selector.

**Acceptance:** clicking Add status with a selected definition creates a node using the exact catalog code.

### Task F4: Add dropdown to Node Inspector

**Files:**

- Modify: `frontend/src/components/workflow/NodeInspector.tsx`
- Modify: `frontend/pages/WorkflowDesigner.tsx`
- Modify: `frontend/src/hooks/useWorkflowGraph.ts`
- Add/update: `frontend/src/components/workflow/__tests__/NodeInspector.test.tsx`
- Add/update: `frontend/src/hooks/__tests__/useWorkflowGraph.test.ts`

**Behavior:**

- New draft nodes: selectable status dropdown.
- Existing nodes: allow code change only when the replacement is safe and the graph update is intentional; otherwise keep code immutable and require delete/re-add with validation/remap. Preferred initial implementation: status code immutable after node creation to protect persisted request history.
- If a legacy code is retired/inactive, show it as `Current legacy status` with warning but do not offer it as a new option.
- When the code is changed in any future approved mode, update label only when it still equals the previous catalog label; preserve manual label overrides.
- Disable all controls in read-only versions.

### Task F5: Improve status definition admin UI

**Files:**

- Modify: `frontend/src/components/admin/StatusDefinitionsTab.tsx`
- Modify: `frontend/src/services/requestStatusService.ts`
- Add/update tests for create/edit/retire/delete behavior

**Behavior:**

- Add lifecycle type selector.
- Make code immutable after creation.
- Replace Delete with Retire where references exist.
- Show usage counts and impacted workflows before retirement.
- Show that retired statuses remain valid for historical requests.
- Show server validation errors inline.
- Remove the misleading claim that values merely need to match the Prisma enum after migration.

### Task F6: Govern transition labels

**Files:**

- Modify: `frontend/src/components/workflow/EdgeInspector.tsx`
- Modify: backend validation for transition labels
- Add/update: `frontend/src/components/workflow/__tests__/EdgeInspector.test.tsx`

**Behavior:**

- Use a dropdown for supported labels.
- Preserve unknown legacy labels as a temporary current option.
- Keep requires-comment behavior.
- Add clear warning when an open edge has no role restrictions.

### Task F7: Update frontend status consumers

**Files:**

- Search and modify all frontend consumers of `RequestStatus`, `RESOLVED_STATUSES`, `CLOSED_STATUSES`, hardcoded status labels, and status filters.
- Likely areas: `frontend/constants.tsx`, request list/detail components, dashboards, SLA components, reports, status badges, and workflow modal configuration.

**Steps:**

1. Resolve display labels from API-provided definitions or a shared status catalog cache.
2. Do not silently display raw codes when a definition is missing; show an “Unknown status” diagnostic treatment.
3. Replace static terminal-status checks with lifecycle metadata where applicable.
4. Preserve existing UI behavior for seeded statuses.

**Acceptance:** dynamically created status appears with correct label in workflow graph, request detail, request lists, activity history, notifications, and reports.

---

## 7. Backend/frontend contract and permissions

### Permission alignment

Review and align:

- `frontend/App.tsx:331-333` route permission `admin:access`
- `backend/src/routes/workflowVersion.routes.ts:8-20` mutation permission `workflow:manage`
- status catalog permissions under `admin:settings`

Required UX:

- Users with read-only workflow access can open ACTIVE/ARCHIVED versions.
- Users without `workflow:manage` cannot see mutation controls or receive confusing failed saves.
- Only status administrators can create/retire catalog entries.
- Publishing remains separately controlled if a publish permission exists.

Add permission regression tests at route/controller level.

---

## 8. Migration and rollout strategy

### Phase 0: Discovery and dry-run

- Capture database inventory of request statuses, workflow steps, transitions, graph nodes, histories, and definitions.
- Run the migration verification script in read-only mode.
- Produce exact unknown/duplicate/lifecycle counts.
- Stop if unknown or conflicting values exist; repair using a reviewed mapping file.

### Phase 1: Deploy compatibility code

- Deploy backend code that can read existing enum-backed statuses and catalog definitions.
- Add catalog rows for all existing statuses.
- Do not enable arbitrary status creation yet.
- Keep old runtime behavior as a compatibility fallback only during the migration window.

### Phase 2: Apply database migration

- Take a backup before migration.
- Apply the Prisma migration converting `Request.status` to string.
- Generate the Prisma client.
- Run the read-only verification script.
- Confirm all existing requests and workflow artifacts resolve to definitions.

### Phase 3: Enable dynamic status governance

- Enable create/retire lifecycle fields.
- Enable designer dropdown.
- Enable runtime transitions to new active definitions.
- Keep hard-delete disabled.

### Phase 4: Remove obsolete enum runtime assumptions

- Remove direct Prisma `RequestStatus` validation from runtime paths.
- Remove obsolete hardcoded lifecycle sets.
- Retain compatibility constants only for seed/backfill and known legacy integrations.
- Remove the old direct workflow editor or make compiled rows read-only.

### Rollback

- Application rollback alone is insufficient after the column type migration or new status creation.
- Retain a database restore procedure and an application compatibility release.
- Do not drop the old PostgreSQL enum until post-release observation confirms no runtime dependency.
- If a newly-created status causes a business issue, retire it and remap affected requests; do not delete it.

---

## 9. Test plan

### Backend unit tests

- status-code normalization
- code immutability
- lifecycle validation
- retirement behavior
- usage counts
- deletion protection
- catalog lookup failure-closed behavior
- unknown/inactive workflow node validation
- category/workflow scope validation
- dynamic lifecycle timestamp behavior
- dynamic transition target behavior
- unknown status runtime rejection
- retired target rejection
- audit event creation

### Backend integration tests

- create status → create draft → add status node → save → validate → publish
- create status → transition a request into it
- dynamic resolved status sets `resolvedAt`
- dynamic closed status sets `closedAt`
- dynamically created status survives request list/detail/history/report paths
- retire unused status and confirm it is not selectable
- attempt to retire/delete referenced status and confirm controlled response
- concurrent status retirement versus workflow publish
- publish failure leaves active version and compiled rows unchanged
- migration verifier reports zero unresolved status references

### Frontend unit/component tests

- status service active endpoint query
- palette loading/error/empty states
- palette filters duplicate codes
- palette creates node from selected definition
- node inspector renders selected definition
- retired legacy node shows warning
- read-only version disables dropdown and mutation controls
- label override behavior
- transition-label dropdown and legacy preservation
- status admin lifecycle and retire UI

### End-to-end browser flow

Use authenticated admin credentials only when available:

1. Open Admin Settings → Status Definitions.
2. Create a new status, e.g. `FINANCE_REVIEW_PENDING`.
3. Confirm it appears as active.
4. Open the target Workflow Designer draft.
5. Confirm the new status appears in the palette dropdown.
6. Add it to the graph.
7. Connect it to a valid predecessor/successor.
8. Configure label, initial/final, SLA pause, and display order.
9. Wait for `Saved`.
10. Refresh the draft and confirm the node persists.
11. Validate and confirm no catalog membership findings.
12. Publish.
13. Create or use a request for the workflow.
14. Execute a transition into the new status.
15. Confirm request detail, history, activity, notifications, and reports display the dynamic label.
16. Retire the status and confirm it is absent from new-node selection but still readable on existing requests.

Unauthenticated or credential-gated browser verification must be reported as incomplete, not passed.

---

## 10. Verification commands

Run from the repository root or the indicated package directory:

```bash
# Working tree and baseline
git status --short
git branch --show-current
git rev-parse --short HEAD

# Backend schema and generated client
cd backend
npx prisma validate
npx prisma generate
npm run build

# Focused backend tests
npm test -- --runInBand --testTimeout=30000 \
  src/services/__tests__/requestStatusDefinition.service.test.ts \
  src/services/__tests__/workflowStatusDefinitionValidation.test.ts \
  src/services/__tests__/dynamicStatusLifecycle.test.ts \
  src/services/__tests__/workflowGraphService.test.ts \
  src/services/__tests__/workflowValidatorStructure.test.ts \
  src/services/__tests__/workflowCompiler.test.ts \
  src/services/__tests__/workflowVersion.test.ts

# Backend lint and full workflow regression
npm run lint
npm test -- --runInBand --testTimeout=30000

# Frontend focused tests
cd ../frontend
npm test -- --run \
  src/components/workflow/__tests__/StatusPalette.test.tsx \
  src/components/workflow/__tests__/NodeInspector.test.tsx \
  src/components/workflow/__tests__/EdgeInspector.test.tsx \
  src/components/workflow/__tests__/PublishDialog.test.tsx \
  src/services/__tests__/requestStatusService.test.ts

# Frontend build
npm run build
```

Additional checks:

- `git diff --check`
- migration status verification
- migration verifier dry-run twice
- status catalog count and unresolved-reference count
- authenticated browser flow
- post-change `git status --short` to confirm only intended files changed

---

## 11. Acceptance criteria

### Functional

- Admin can create a new status code without a code deployment.
- New active status appears in the Workflow Designer dropdown.
- Admin cannot enter arbitrary free-text status codes in the palette.
- Admin can add the status to a draft and save it.
- Unknown/inactive/retired statuses cannot be newly added or published.
- The status can be used in a real request transition.
- Dynamic status labels appear consistently in graph, request detail, history, activity, notification, list, and report surfaces.
- Retired statuses remain readable for historical/current requests but are unavailable for new nodes.

### Data integrity

- No request has a status without a catalog definition.
- No published workflow has an unknown status node.
- Status codes cannot be renamed after creation.
- Referenced statuses cannot be hard-deleted.
- Publish and runtime transitions fail closed on missing definitions.
- Status definition mutations are audited.
- Existing workflows and requests retain their current behavior after migration.

### Workflow safety

- Published and archived graphs remain read-only.
- Graph replacement remains atomic.
- Publish revalidates catalog membership inside the transaction.
- Existing status-remap behavior continues to work.
- Compiler output preserves labels, icons, display order, initial/final flags, and SLA pause settings.
- Legacy workflow configuration cannot bypass catalog governance.

### Verification

- Focused backend tests pass.
- Focused frontend tests pass.
- Backend build passes.
- Frontend build passes.
- Prisma validation/generation passes.
- Migration verifier reports zero unresolved references.
- Authenticated browser flow passes or is explicitly marked blocked by missing credentials/environment.

---

## 12. Implementation sequencing and stop gates

1. Complete B1 and B7 dry-run inventory before applying the schema migration.
2. Stop if existing statuses cannot be classified or mapped without a product decision.
3. Complete B2/B3 before enabling the frontend dropdown.
4. Complete B4/B5 before claiming true dynamic runtime support.
5. Complete F1-F4 after the backend contract is stable.
6. Complete F5-F7 before browser verification.
7. Do not run production migrations, seed destructive commands, or publish workflows as part of local implementation without explicit deployment approval.
8. Do not commit or push unless separately requested.

**Implementation status:** Planning only. No code changes have been made by this plan.
