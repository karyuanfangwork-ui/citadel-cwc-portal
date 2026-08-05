# Visual Workflow Designer Frontend Implementation Plan

> **For Hermes:** Execute this plan task-by-task only after plan approval. Use the development-workflow and react-patterns skills. Do not modify the backend/runtime transition engine unless an API contract defect is discovered and separately approved.

**Goal:** Add the missing admin-facing workflow list and visual workflow designer UI so administrators can create, edit, validate, publish, rollback, and discard versioned workflow drafts through the existing workflow-version API.

**Current position:** The backend versioning, graph CRUD, compiler, lifecycle, migration, canonical reconstruction, and backfill shadow gates are implemented and verified. The current frontend screen at `/admin/settings?tab=workflow-config` is the legacy `WorkflowTransitionTab`; it edits flat global transition rows and has no draft/version UI.

**Architecture:** Add a dedicated full-viewport workflow area outside the AdminSettings tab shell, following the existing standalone page precedent. Use `@xyflow/react` for the node-edge canvas and `dagre` for deterministic auto-layout of reconstructed graphs whose coordinates are null. Keep API calls in a typed frontend service, graph mutation/state in a feature hook/reducer, and rendering split into canvas, palette, inspectors, and validation/publish panels.

**Backend API base:** The frontend Axios client already prefixes `VITE_API_URL`/`VITE_API_BASE_URL` with `/api/v1`. Workflow-version endpoints are mounted under `/admin/workflows`:

- `GET /admin/workflows` → `{ status: 'success', data: { workflows } }`
- `GET /admin/workflows/:workflowTypeId/versions` → `{ status: 'success', data: { versions } }`
- `POST /admin/workflows/:workflowTypeId/versions` → `{ status: 'success', data: { draft } }`
- `GET /admin/workflows/versions/:versionId` → `{ status: 'success', data: { version, graph, validation } }`
- `PATCH /admin/workflows/versions/:versionId/nodes` → `{ status: 'success', data: { upserted, removed } }`
- `PATCH /admin/workflows/versions/:versionId/edges` → `{ status: 'success', data: { upserted, removed } }`
- `POST /admin/workflows/versions/:versionId/validate` → `{ status: 'success', data: { validation } }`
- `POST /admin/workflows/versions/:versionId/publish` → `{ status: 'success', data: ... }`
- `POST /admin/workflows/versions/:versionId/rollback` → `{ status: 'success', data: ... }`
- `DELETE /admin/workflows/versions/:versionId` → `{ status: 'success', data: { discarded: true } }`

**Out of scope for this plan:** `availableActions` runtime resolver and removal of the hardcoded request-action map; editing global `workflowTypeId IS NULL` fallback transitions; BPMN-lite node types; workflow simulation; undo history; per-request-type overrides; production deployment.

---

## Task 1: Confirm frontend dependency and route strategy

**Objective:** Add the canvas dependencies and establish dedicated routes without changing the existing legacy Workflow Config behavior yet.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` or the repository’s active frontend lockfile
- Modify: `frontend/App.tsx`
- Modify: `frontend/src/components/admin/adminConstants.ts`
- Create: `frontend/pages/WorkflowList.tsx`
- Create: `frontend/pages/WorkflowDesigner.tsx`
- Test: `frontend/src/pages/__tests__/workflowRoutes.test.tsx` or the project’s existing route-test location

**Step 1: Add dependencies**

Install the pinned compatible versions of `@xyflow/react` and `dagre` using the frontend package manager. Confirm both appear in the manifest and lockfile. Do not hand-edit the lockfile.

**Step 2: Add routes**

Add imports and protected routes:

- `/admin/workflows` → `WorkflowList`
- `/admin/workflows/:workflowTypeId/versions/:versionId` → `WorkflowDesigner`

Follow the existing `ProtectedRoute` and admin-role/permission behavior. Preserve the current `/admin/settings?tab=workflow-config` route.

**Step 3: Add navigation entry**

Add a `Workflow Designer` link in the `Workflows` group of `adminConstants.ts`, navigating to `/admin/workflows`. Do not replace or silently redirect the existing `Workflow Config` item until the new page is verified.

**Step 4: Add route tests**

Cover:

- `/admin/workflows` renders the workflow list shell.
- `/admin/workflows/:workflowTypeId/versions/:versionId` renders the designer shell.
- Existing `/admin/settings?tab=workflow-config` still renders `WorkflowTransitionTab`.

**Verification:** `npm test -- --run <route-test>` and `npm run build` from `frontend/`.

---

## Task 2: Create typed workflow-version API service

**Objective:** Establish one frontend source of truth for all version and graph API contracts.

**Files:**
- Create: `frontend/src/services/workflow-version.service.ts`
- Test: `frontend/src/services/__tests__/workflow-version.service.test.ts`

**Types:**

Define frontend equivalents of the backend contracts:

- `WorkflowSummary`
- `WorkflowVersionSummary`
- `WorkflowVersionDetail`
- `GraphNode`
- `GraphEdge`
- `WorkflowGraph`
- `ValidationFinding`
- `ValidationResult`
- `PublishResult`

Use `status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'`, nullable node coordinates, nullable labels, display order, role arrays, and IDs exactly as returned by the backend. Do not use `any` for graph data.

**Service methods:**

- `listWorkflows()`
- `listVersions(workflowTypeId)`
- `createDraft(workflowTypeId)`
- `getVersion(versionId)`
- `updateNodes(versionId, { upsert, remove })`
- `updateEdges(versionId, { upsert, remove })`
- `validateVersion(versionId)`
- `publishVersion(versionId)`
- `rollbackVersion(versionId)`
- `discardDraft(versionId)`

Normalize only the Axios envelope (`response.data.data`); do not silently reshape or discard backend fields.

**Tests:** Mock `apiClient` and assert exact HTTP method, URL, request body, and envelope extraction for every method. Add 400/409 error propagation tests preserving the server message.

**Verification:** `npx vitest run src/services/__tests__/workflow-version.service.test.ts` and `npm run build`.

---

## Task 3: Implement workflow list and draft entry flow

**Objective:** Give administrators the exact screen from which a draft is created.

**Files:**
- Create/modify: `frontend/pages/WorkflowList.tsx`
- Create: `frontend/src/components/workflow/WorkflowListCard.tsx`
- Create: `frontend/src/components/workflow/CreateDraftDialog.tsx`
- Create: `frontend/src/hooks/useWorkflowVersions.ts`
- Test: `frontend/src/pages/__tests__/WorkflowList.test.tsx`

**UI contract:**

At `/admin/workflows`, render:

- Page title: `Workflow Designer`
- Workflow cards ordered by backend order.
- Workflow name and code.
- Bound request types and explicit `affects N request types` text.
- Active version badge.
- Draft badge when a draft exists.
- `Open active` / `Open draft` action.
- `Create draft` action when no draft exists.
- Disabled or explanatory state when draft creation returns 409.
- Loading, empty, permission, and server-error states.

**Create-draft behavior:**

1. User clicks `Create draft` on a workflow card.
2. Dialog confirms the workflow name, active version, and affected request types.
3. Confirm calls `POST /admin/workflows/:workflowTypeId/versions`.
4. On success navigate to `/admin/workflows/:workflowTypeId/versions/:versionId`.
5. On 409 keep the list visible and show the server conflict message.

**Tests:**

- Renders active/draft badges and request-type blast radius.
- Calls the correct endpoint after confirmation.
- Navigates to the new draft.
- Handles duplicate/open-draft conflict.
- Does not allow accidental double-submit.

**Verification:** `npx vitest run src/pages/__tests__/WorkflowList.test.tsx` and manual navigation from the Admin Console sidebar.

---

## Task 4: Add graph state and persistence hook

**Objective:** Keep canvas components presentational while providing debounced, version-scoped graph persistence.

**Files:**
- Create: `frontend/src/hooks/useWorkflowGraph.ts`
- Create: `frontend/src/hooks/__tests__/useWorkflowGraph.test.ts`
- Create: `frontend/src/utils/workflowLayout.ts`
- Test: `frontend/src/utils/__tests__/workflowLayout.test.ts`

**State requirements:**

- Convert backend nodes/edges to `@xyflow/react` nodes/edges and back without losing backend IDs or graph metadata.
- Auto-layout only when one or more coordinates are `null`; never overwrite deliberate `(0, 0)` coordinates.
- Preserve labels, display order, status code, initial/final flags, SLA pause, icons, role arrays, comment requirements, and assignment fields.
- Track `dirty`, `saving`, `lastSavedAt`, `saveError`, `selectedNodeId`, `selectedEdgeId`, `blockingFindings`, and `warnings`.
- Debounce position updates by 500ms and coalesce node/edge mutations into the corresponding batch API calls.
- Never persist changes to ACTIVE or ARCHIVED versions; the hook must expose read-only state for those versions.
- Refresh validation after successful mutations and discard stale responses when a newer mutation has started.

**Layout:**

Use `dagre` with a deterministic direction and spacing. Provide a stable fallback for a graph with no edges. Layout tests must assert:

- Null coordinates receive positions.
- Explicit coordinates are preserved.
- `(0, 0)` is preserved.
- Layout is deterministic for the same graph.

**Tests:** reducer/state tests for add, update, delete, connect, stale save response, failed save retry, read-only mode, and debounce behavior.

**Verification:** `npx vitest run src/hooks/__tests__/useWorkflowGraph.test.ts src/utils/__tests__/workflowLayout.test.ts`.

---

## Task 5: Implement canvas and custom status node

**Objective:** Provide a usable visual graph surface with safe node/edge gestures.

**Files:**
- Create: `frontend/src/components/workflow/WorkflowCanvas.tsx`
- Create: `frontend/src/components/workflow/StatusNode.tsx`
- Create: `frontend/src/components/workflow/WorkflowEdge.tsx` if custom edge styling is required
- Test: `frontend/src/components/workflow/__tests__/StatusNode.test.tsx`

**Canvas behavior:**

- Render nodes and edges from `useWorkflowGraph`.
- Drag nodes and persist on drag stop.
- Connect nodes to create an edge with default transition metadata.
- Select nodes/edges and expose selection to inspectors.
- Delete selected nodes/edges only in DRAFT mode.
- Prevent self-loop and invalid endpoint actions before calling the API.
- Show selected state, validation error outline, initial/final badges, SLA-pause indicator, and unsaved state.
- Use accessible labels and keyboard-focusable controls around the canvas.

**StatusNode behavior:**

Display label, status code, icon, initial marker, final marker, and SLA pause marker. Do not derive visual labels from a hardcoded transition map.

**Tests:**

Component tests for labels/markers/error state/read-only state. Leave low-value internal React Flow gesture simulation to manual verification, but test the callbacks passed to the canvas.

**Verification:** frontend unit tests and manual drag/connect/delete testing in a local browser.

---

## Task 6: Implement palette and inspectors

**Objective:** Expose graph authoring controls without leaking persistence logic into presentational components.

**Files:**
- Create: `frontend/src/components/workflow/StatusPalette.tsx`
- Create: `frontend/src/components/workflow/NodeInspector.tsx`
- Create: `frontend/src/components/workflow/EdgeInspector.tsx`
- Create: `frontend/src/components/workflow/WorkflowStatusDialog.tsx` only if status creation is included in the available status catalog contract
- Tests: corresponding component test files

**StatusPalette:**

- Load available status definitions through the existing status-definition service or a typed workflow service extension after verifying the endpoint shape.
- Greys out statuses already present in the graph.
- Adds a node with a unique client ID and complete backend-compatible defaults.
- Shows a clear warning before adding a globally scoped status that affects shared workflow behavior.

**NodeInspector:**

- Edit label, icon, initial/final, SLA pause, and display order.
- Enforce exactly one initial node in local state before save where possible.
- Never allow changing a status code in a way that silently breaks live occupied requests; server validation remains authoritative.

**EdgeInspector:**

- Edit transition label, requires comment, auto-assign role/user, allowed roles, and executive roles.
- Make rejection/return comment guidance visible.
- Preserve empty role arrays as intentional unrestricted access; do not replace them with defaults.

**Tests:** field updates, read-only behavior, empty arrays, rejection-comment warning, and accessibility labels.

**Verification:** component tests and manual editing of one node and one edge.

---

## Task 7: Implement validation panel and publish/rollback controls

**Objective:** Make validation continuous and publishing explicit, safe, and auditable.

**Files:**
- Create: `frontend/src/components/workflow/ValidationPanel.tsx`
- Create: `frontend/src/components/workflow/PublishDialog.tsx`
- Create: `frontend/src/components/workflow/VersionHistoryPanel.tsx`
- Test: component/page tests for these flows

**ValidationPanel:**

- Separate blocking findings and warnings.
- Clicking a finding focuses the referenced node or edge.
- Disable Publish while blocking findings exist.
- Display warning count and allow the publish dialog to show accepted warnings.
- Refresh from the backend validation response; do not recreate validation rules independently in the frontend.

**PublishDialog:**

Show:

- Workflow name and new version number.
- Affected request types and count.
- In-flight request count if included by the backend response; otherwise display the server-provided validation context without inventing a count.
- Blocking findings and accepted warnings.
- Explicit confirmation action.

On publish success, reload the workflow list/detail and navigate to the newly active read-only version. On failure, retain the draft and show the server error.

**VersionHistoryPanel:**

- Load version history.
- Open ACTIVE/ARCHIVED versions read-only.
- Offer rollback only where authorized and appropriate.
- Confirm rollback and re-fetch detail after success.
- Offer discard only for DRAFT versions.

**Tests:** publish disabled by blocking findings, warning confirmation, publish success/failure, rollback confirmation, discard confirmation, and stale version refresh.

**Verification:** targeted Vitest tests plus browser smoke flow.

---

## Task 8: Compose the designer page

**Objective:** Assemble the full workflow designer route with responsive three-pane layout and explicit read-only/draft modes.

**Files:**
- Modify: `frontend/pages/WorkflowDesigner.tsx`
- Create: `frontend/src/components/workflow/WorkflowDesignerLayout.tsx` if composition keeps the page manageable
- Test: `frontend/pages/__tests__/WorkflowDesigner.test.tsx`

**Layout:**

- Header: breadcrumb, workflow name/code, version/status badge, affected request-type summary, dirty/saving state.
- Left pane: status palette.
- Center: canvas.
- Right pane: node/edge inspector or version history.
- Bottom drawer: validation panel.
- Header actions: `Back`, `Validate`, `Publish`, `Rollback`, `Discard draft` as mode/permission permits.

**Modes:**

- DRAFT: editable, autosave enabled, Publish/Discard available.
- ACTIVE: read-only, Rollback/history actions as authorized, `Edit as new draft` action creates a draft through the list/version flow.
- ARCHIVED: read-only, rollback available as authorized, no direct edits.

**Loading/error handling:**

- Route-param validation.
- 404/403/409 server messages.
- Retry action for graph load/save failure.
- Navigation guard or clear warning for unsaved local state only when a save is in flight; drafts autosave by design.

**Tests:** page composition for all three statuses, route loading, permission/read-only behavior, and server error states.

**Verification:** frontend build and browser smoke test at both desktop and narrow viewport widths.

---

## Task 9: Integrate legacy Workflow Config safely

**Objective:** Prevent two competing authoring surfaces from silently editing the same workflow-scoped data.

**Files:**
- Modify: `frontend/src/components/admin/WorkflowTransitionTab.tsx`
- Modify: related admin service types/components if needed
- Test: `frontend/src/components/admin/__tests__/WorkflowTransitionTab.test.tsx`

**Behavior:**

- When workflow-version data exists for a workflow, display the legacy tab as a read-only compiled-rules inspector or add a clear link to the new designer.
- Keep global fallback transitions (`workflowTypeId === null`) editable only if the existing backend permission and scope make that safe.
- Do not leave an edit control that appears to modify the active graph but is overwritten on the next publish.
- Add explanatory copy: compiled runtime rules are generated from the workflow version designer.

**Verification:** existing transition-tab tests, targeted frontend tests, and manual confirmation that the screenshot’s legacy screen no longer offers misleading workflow-scoped edits.

---

## Task 10: End-to-end frontend verification and handoff

**Objective:** Verify the actual user-visible draft flow against the running local application.

**Files:**
- Modify/create: `frontend/tests/e2e/workflow-designer.spec.ts` following existing Playwright layout
- Modify: documentation only if the repository has an admin-user guide location

**Automated checks:**

- Frontend TypeScript/build: `npm run build` from `frontend/`.
- Frontend unit tests: `npm test -- --run` or the project’s Vitest command with the focused workflow test files.
- E2E smoke: authenticated admin opens `/admin/workflows`, creates a draft, opens the designer, edits a node, validates, and verifies the draft badge.
- Backend regression command already established for this feature:
  `npx jest src/services/__tests__/workflowValidatorStructure.test.ts src/services/__tests__/workflowValidatorLiveData.test.ts src/services/__tests__/workflowCompiler.test.ts src/services/__tests__/workflowReverseCompile.test.ts src/services/__tests__/workflowGraphService.test.ts src/services/__tests__/workflowVersion.test.ts src/controllers/__tests__/workflowVersion.controller.test.ts --runInBand --forceExit`
- Backend backfill shadow: `npm run workflow:backfill:shadow`.

**Manual acceptance flow:**

1. Admin opens Admin Console → Workflow Designer.
2. Admin sees `IT_SIMPLE` with active version and request-type impact.
3. Admin clicks `Create draft`.
4. Designer opens at `/admin/workflows/:workflowTypeId/versions/:versionId`.
5. Admin edits a node label and moves it; autosave indicator changes to saved.
6. Admin adds/edits an edge and sees the edge inspector.
7. Validation panel shows no blocking findings for the unchanged canonical graph.
8. Admin publishes and sees the new active version.
9. Admin creates another draft and discards it.
10. Admin opens an archived version and confirms read-only mode.
11. Admin rolls back only in the controlled local environment and confirms the version/history state refreshes.

**Final gate:** Do not claim the frontend feature is complete until the actual browser flow succeeds. Do not deploy production or run a production write-mode reconstruction from this plan.

---

## Risks and decisions

- `@xyflow/react` and `dagre` are not currently in `frontend/package.json`; dependency versions must be selected and lockfile changes reviewed.
- Backend node/edge payload validation requires complete fields. The frontend service must send full objects for upserts, not sparse patches.
- Workflow statuses are globally meaningful and can be shared by multiple request types. The UI must show blast radius before publish.
- Existing legacy Workflow Config edits global and possibly scoped transition rows. The UI must make the new designer the only authoring surface for version-scoped workflows.
- No frontend `workflow-version.service.ts` currently exists; do not extend the older `workflow.service.ts` with incompatible response assumptions.
- The backend list response does not currently expose an in-flight request count. The publish dialog must not fabricate one; either omit it or add a separately reviewed backend response extension.
- The current backend `POST /versions/:versionId/rollback` contract and response should be inspected during Task 7 before displaying assumptions about the resulting version number.
- The plan deliberately leaves `availableActions` and the hardcoded user-action map for a separate plan because changing that source of truth affects request detail and runtime authorization behavior.

## Completion criteria

- A user can reach a dedicated Workflow Designer screen from the admin UI.
- A user can create a draft without using the legacy transition table.
- A draft graph can be loaded, auto-laid out, edited, autosaved, validated, published, discarded, and viewed read-only by version.
- Blocking validation findings disable publish and focus the affected graph element.
- Backend API errors remain visible and actionable.
- Legacy global/scoped transition editing no longer creates a competing source of truth.
- Frontend unit/build/e2e checks and backend workflow regression/backfill shadow checks pass.
