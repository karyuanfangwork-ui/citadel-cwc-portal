# Visual Workflow Designer — Design

**Date:** 2026-08-05
**Status:** Approved design, pending implementation plan
**Scope:** Admin-facing drag-and-drop editor for request-type workflows, with versioning, validation, and publish/rollback.

---

## 1. Problem

Admins configure a directed graph of statuses and transitions through a flat, row-per-edge table (`WorkflowTransitionTab.tsx`). They cannot see the shape of a workflow, so they cannot spot orphan statuses, dead ends, or missing return paths. Every edit applies immediately to in-flight requests with no validation, no draft state, and no rollback.

The production readiness audit records this as gap #11 (`No visual workflow designer`, P1, severity High) and scores the workflow engine 58/100, citing the absence of a visual designer, versioning, and rollback.

### What already exists

The engine itself is sound and DB-driven. This project is an editing experience and a safety layer on top of it, not a new engine.

| Layer | Existing implementation |
|---|---|
| Status catalog | `RequestStatusDefinition` — code (globally unique), label, category, displayOrder, isActive |
| Transition rules | `WorkflowTransition` — from/to status, label, requiresComment, autoAssign, `allowedRoles`/`allowedExecutiveRoles`, scoped by `(tenantId, workflowTypeId)` |
| Per-type stage list | `WorkflowType` → `WorkflowStep` (status, icon, displayOrder, isInitial, isFinal, slaPause) |
| Runtime authorization | `canActorTransition()` in `transitionPolicy.service.ts` — most-specific-scope-first resolution |
| Transition execution | `requestTransition.service.ts`, `transitionGuards.ts`, `workflowCommand.service.ts` |
| Audit | `WorkflowHistory` (immutable), `WorkflowCommandResult` (idempotency), transactional outbox |
| Admin UI | `WorkflowTransitionTab.tsx` (table CRUD), `StatusDefinitionsTab.tsx` |

### Known defects this design also closes

`frontend/src/utils/workflowTransitions.ts` contains a **hardcoded `VALID_TRANSITIONS` map that drives which action buttons users see**, independent of the database. A workflow configured in the admin UI today does not change what users can click. This is a live source-of-truth split and a button/permission drift bug, fixed in Phase 3 below.

---

## 2. Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Editor shape | Node-edge canvas | The data model is already a graph; a canvas is a faithful view of it. A stage-ladder would misrepresent branching approval paths. |
| 2 | Scope of one canvas | A `WorkflowType`, with explicit "affects N request types" warning | Transitions scope to `workflowTypeId` and multiple `RequestType`s share one. Editing per-request-type would silently rewire siblings. |
| 3 | Publish semantics | Replace active version; in-flight requests follow the new graph | One runtime lookup path. `WorkflowHistory` already provides evidence-based audit of what happened. Stranding is prevented at the publish gate. |
| 4 | Available actions | Backend returns `availableActions` on the request payload | Deletes a source of truth rather than relocating one. Makes "button shown but action rejected" structurally impossible. |
| 5 | Publish strictness | Block structural + live-data findings, warn on semantic | Structural faults have no legitimate use. Unrestricted edges are sometimes intended, and empty allow-lists already mean "unrestricted" in `transitionPolicy.service.ts`. |
| 6 | Creating statuses | Palette-driven, plus guarded create dialog with near-match detection | Puts duplicate-detection where the decision is made. `RequestStatusDefinition.code` is a global namespace feeding reports, SLA config, and notification templates. |

### Deferred: BPMN-lite node types

Approval, parallel gate, timer, notification, webhook, and script nodes (audit line 252) are **out of scope**, and are their own future spec. They require an execution engine that can park a request mid-flight at something that is not a status, plus a durable scheduler to resume it.

Two schema choices in this design keep that future additive rather than a rewrite:

1. `WorkflowNode.type` is an enum whose only current value is `STATUS`.
2. `WorkflowEdge` references **node IDs, not status strings** — a gate has no status code to point at.

---

## 3. Architecture

### 3.1 Publishing compiles to the existing tables

The new version tables are the **authoring** source of truth. Publishing projects a version into `WorkflowTransition` rows scoped to its `workflowTypeId`; `WorkflowTransition` becomes a compiled artifact.

Consequences:

- `transitionPolicy.service.ts`, `requestTransition.service.ts`, `transitionGuards.ts` and their tests require **no changes**. The enforcement path protecting live finance approvals stays exactly as tested.
- Scope precedence and the global `(tenantId: NULL, workflowTypeId: NULL)` fallback rows keep working unchanged.
- Rollback is "recompile from version N−1", not a second runtime lookup path.
- The project's risk profile is a new editor plus a projection step, not a new engine.

### 3.2 Schema

```
WorkflowVersion
  id                 uuid pk
  workflowTypeId     uuid → WorkflowType (cascade)
  version            Int
  status             WorkflowVersionStatus  -- DRAFT | ACTIVE | ARCHIVED
  notes              Text?
  publishedAt        Timestamp?
  publishedById      uuid? → User
  createdAt, updatedAt
  @@unique([workflowTypeId, version])
  partial unique index on (workflowTypeId) WHERE status = 'ACTIVE'

WorkflowNode
  id                 uuid pk
  workflowVersionId  uuid → WorkflowVersion (cascade)
  type               WorkflowNodeType       -- enum; only STATUS today
  statusCode         VarChar(100)?          -- → RequestStatusDefinition.code; required when type = STATUS
  positionX          Float?                 -- NULL = never laid out; designer auto-layouts on open
  positionY          Float?
  isInitial          Boolean @default(false)
  isFinal            Boolean @default(false)
  slaPause           Boolean @default(false)
  icon               VarChar(50) @default("radio_button_checked")
  config             Json?                  -- empty for STATUS; timer/gate params later
  createdAt, updatedAt
  @@unique([workflowVersionId, statusCode])
  @@index([workflowVersionId])

WorkflowEdge
  id                     uuid pk
  workflowVersionId      uuid → WorkflowVersion (cascade)
  fromNodeId             uuid → WorkflowNode (cascade)
  toNodeId               uuid → WorkflowNode (cascade)
  transitionLabel        VarChar(50)?
  requiresComment        Boolean @default(false)
  autoAssignRole         VarChar(50)?
  autoAssignUserId       uuid?
  allowedRoles           String[] @default([])
  allowedExecutiveRoles  String[] @default([])
  config                 Json?
  createdAt, updatedAt
  @@unique([workflowVersionId, fromNodeId, toNodeId])
  @@index([workflowVersionId])
```

`WorkflowNodeType` enum: `STATUS` (only value in this scope).
`WorkflowVersionStatus` enum: `DRAFT`, `ACTIVE`, `ARCHIVED`.

### 3.3 Backfill of existing workflows

A one-time migration reverse-compiles each `WorkflowType` into an `ACTIVE` version 1:

- Nodes from its `WorkflowStep` rows, carrying `isInitial`, `isFinal`, `slaPause`, `icon`.
- Additional nodes for any status referenced by a `WorkflowTransition` but lacking a `WorkflowStep`, so nothing is dropped.
- Edges from its `WorkflowTransition` rows with `workflowTypeId` set, mapping status codes to node IDs.
- Coordinates are left `NULL` (`positionX`/`positionY` are nullable). The designer treats a version with any null-coordinate node as un-laid-out, runs dagre auto-layout on open, and persists the resulting positions on first save. A null coordinate is therefore the explicit "never been arranged" signal, distinct from a node an admin has deliberately placed at the origin.

Global `(workflowTypeId: NULL)` rows are **not** backfilled into any version. They remain platform defaults, hand-managed.

### 3.4 Consequences for existing UI

- **`WorkflowTransitionTab.tsx` becomes read-only** for any workflow that has a version, repurposed as a "compiled rules" inspector for debugging what the canvas produced. Direct row edits would otherwise desync from the authoring graph and be clobbered on the next publish.
- **Global fallback transition rows** stay editable there, behind a narrower permission, since they are not workflow-scoped and should not be casually draggable.

---

## 4. Backend modules

Four modules, each with one responsibility. The compiler is separated from the validator and from CRUD because it is the only piece touching live enforcement, and must stay small enough to read in one sitting.

| Module | Responsibility |
|---|---|
| `workflowVersion.service.ts` | Version lifecycle: create draft (clone from active), list, get graph, discard draft, activate, rollback. Owns the one-`ACTIVE`-per-workflow invariant. |
| `workflowGraph.service.ts` | Node and edge CRUD within a **draft**; rejects any write targeting an `ACTIVE` or `ARCHIVED` version. Batch position updates for drag operations. |
| `workflowValidator.service.ts` | Pure structural checks plus live-data stranding queries. Returns `{ blocking, warnings }`. No writes — callable both for live editor feedback and from the publish gate. |
| `workflowCompiler.service.ts` | Projects a version's nodes and edges into `WorkflowTransition` rows for its `workflowTypeId`, and syncs `WorkflowStep` rows so the existing progress stepper keeps working. Delete-then-insert scoped to the workflow, in one transaction. |

### 4.1 Publish transaction

1. Run validation; refuse on any blocking finding.
2. Archive the current `ACTIVE` version.
3. Mark the draft `ACTIVE`.
4. Compile to `WorkflowTransition` and `WorkflowStep`.
5. Invalidate the `availableActions` cache for this workflow.

All in one transaction. If compilation throws, everything rolls back and the previously active version stays live.

Rollback to version N follows the same path with an archived version as input, **re-running validation**, because live request positions may have changed since it was last active.

### 4.2 API

All routes under `/api/v1/admin/workflows`, behind `requirePermission()`.

```
GET    /                              list WorkflowTypes + active version + bound request types + draft flag
GET    /:workflowTypeId/versions      version history
POST   /:workflowTypeId/versions      create draft (clones ACTIVE)
GET    /versions/:versionId           full graph: nodes, edges, validation findings
PATCH  /versions/:versionId/nodes     batch upsert / move / delete (draft only)
PATCH  /versions/:versionId/edges     batch upsert / delete (draft only)
POST   /versions/:versionId/validate  findings without publishing
POST   /versions/:versionId/publish   validate → activate → compile
POST   /versions/:versionId/rollback  re-activate an archived version
DELETE /versions/:versionId           discard draft
```

The list endpoint returns bound request types per workflow, feeding the "affects N request types" warning.

### 4.3 `availableActions` resolver

`resolveAvailableActions({ request, actor })` in `requestTransition.service.ts`:

1. Reads compiled `WorkflowTransition` rows for the request's current status and scope.
2. Filters each through the **existing** `canActorTransition()` — delegating rather than reimplementing, so a rendered button and an accepted transition cannot disagree.
3. Returns `[{ toStatus, label, requiresComment }]`, attached to the request-detail payload.

Cached in Redis keyed by `(workflowTypeId, status, role-set)`, 5-minute TTL matching the permissions cache, invalidated on publish.

`frontend/src/utils/workflowTransitions.ts` and `frontend/src/utils/__tests__/workflowTransitions.test.ts` are **deleted**; all call sites switch to the server-supplied list.

---

## 5. Frontend

### 5.1 Routing

The canvas needs the full viewport and does not fit the `AdminSettings` tab shell. It follows the existing `CrmWorkflowBuilder.tsx` precedent as its own pages under `frontend/pages/`:

- `/admin/workflows` → `WorkflowList.tsx` — workflows, active version, bound request types, draft badges
- `/admin/workflows/:workflowTypeId/versions/:versionId` → `WorkflowDesigner.tsx` — the editor

The `Workflows` group in `adminConstants.ts` gains a link out to it.

### 5.2 Components

| Component | Responsibility |
|---|---|
| `WorkflowDesigner.tsx` | Route shell: loads graph, orchestrates save and publish, renders the three panes |
| `WorkflowCanvas.tsx` | The `@xyflow/react` surface — nodes, edges, connect/drag/delete gestures only |
| `StatusNode.tsx` | One node: label, icon, initial/final markers, SLA-pause indicator, error outline |
| `StatusPalette.tsx` | Left rail — catalog statuses to drag on, greying those already placed; hosts the create-status dialog |
| `NodeInspector.tsx` | Right rail on node selection — icon, isInitial, isFinal, slaPause |
| `EdgeInspector.tsx` | Right rail on edge selection — label, requiresComment, auto-assign, both role allow-lists |
| `ValidationPanel.tsx` | Bottom drawer — blocking findings and warnings, each focusing its node or edge on click |
| `useWorkflowGraph.ts` | Graph state and debounced persistence; components stay presentational |

### 5.3 Interaction

- Drag a status from the palette onto the canvas to add a node.
- Drag from a node handle to another node to create an edge; `EdgeInspector` opens immediately so roles are set at creation rather than forgotten.
- Select and delete removes nodes or edges.
- Positions persist on drag-end, debounced 500ms into the batch endpoint.

**All edits autosave into the draft.** There is no save button: a draft is inert by construction. The two actions are **Publish** and **Discard draft**.

**Discard draft is the undo story.** No undo stack in this scope — an admin who has made a mess reverts to the active version in one click. If admins later report losing good work, an undo stack is additive.

**Validation is continuous.** Findings refresh on each mutation. Blocking findings outline the offending node or edge and disable Publish with reasons listed inline, so problems surface during authoring rather than at the end.

**Publish dialog** states blast radius explicitly: new version number, count and names of affected request types, count of in-flight requests in this workflow, and any warnings being accepted.

**Read-only mode.** Opening an `ACTIVE` or `ARCHIVED` version renders the same components with interaction disabled and an "Edit as new draft" action — which also yields a workflow viewer for support staff without edit permission.

### 5.4 New dependencies

- `@xyflow/react` — canvas surface.
- `dagre` — auto-layout for backfilled workflows with no stored coordinates. Hand-rolling a layered layout produces visibly crossed edges on branching approval graphs, which admins would then hand-fix, defeating the purpose.

---

## 6. Validation rules

`workflowValidator.service.ts` returns `{ blocking: Finding[], warnings: Finding[] }`, each finding carrying a `nodeId` or `edgeId` so `ValidationPanel` can focus it. Findings **accumulate**; validation does not short-circuit on the first fault.

### Blocking — structural

Computed on the in-memory graph; no queries.

| Rule | Example message |
|---|---|
| Exactly one node with `isInitial` | "Workflow needs exactly one starting status (found 3)" |
| At least one node with `isFinal` | "Workflow needs at least one ending status" |
| All nodes reachable from initial (forward BFS) | "`ON_HOLD` cannot be reached from `NEW`" |
| All nodes can reach a final node (reverse BFS from finals) | "`ESCALATED` has no path to an ending status" |
| No outgoing edges from an `isFinal` node | "`CLOSED` is an ending status but has a transition to `REOPENED`" |
| No orphan nodes | "`CANCELLED` has no connections" |
| Both endpoints of every edge exist in this version | integrity guard against stale client payloads |

### Blocking — live data

Queries `Request` grouped by status, scoped to request types bound to this workflow. Evaluated live during editing **and re-run inside the publish transaction**, because counts move between the admin looking and the admin clicking.

| Rule | Example message |
|---|---|
| No status removed while requests occupy it | "12 requests are currently in `PENDING_CFO` — it cannot be removed" |
| No occupied status left with zero outgoing edges unless `isFinal` | "8 requests are in `UNDER_REVIEW`, which would have no available transitions" |

### Warnings

| Rule | Example message |
|---|---|
| Edge with both allow-lists empty | "`NEW → CANCELLED` is open to any authenticated user" |
| Catalog status not placed on this canvas | informational |
| `requiresComment` false on a `REJECT` or `RETURN` edge | "rejections usually capture a reason" |

---

## 7. Testing

Jest, per the existing backend setup; TDD during implementation.

- **`workflowValidator`** — densest coverage, since it is pure. One passing and one failing fixture per rule, plus multi-fault graphs confirming findings accumulate.
- **`workflowCompiler`** — round-trip property test: reverse-compile existing `WorkflowTransition` rows into a version, compile back out, assert row-for-row equality. Also scope isolation (compiling workflow A never touches workflow B's rows or the global `NULL` rows) and transactional rollback on failure. This is the test protecting live enforcement.
- **`workflowVersion`** — one-`ACTIVE`-per-workflow invariant under concurrent publish; draft-immutability rejection; rollback re-running validation.
- **`resolveAvailableActions`** — parity tests asserting that for a given status and actor, returned actions match exactly what `canActorTransition` permits. This pins the guarantee decision 4 rests on.
- **Frontend** — `useWorkflowGraph` reducer logic and `ValidationPanel` rendering. Canvas drag gestures are left to manual verification; testing them through `@xyflow/react` costs more than it catches.

---

## 8. Rollout

Five phases, each independently shippable, each leaving the system working.

**Phase 1 — Schema, compiler, backfill.**
New tables; reverse-compile every existing `WorkflowType` into an `ACTIVE` v1. Nothing user-visible.
Verified in **shadow mode**, following the purchase-requisition precedent: compile each version to a temporary result and diff against live `WorkflowTransition` rows, logging discrepancies without writing. **Zero discrepancies across all workflows is the gate to Phase 2.** This proves the compiler faithful before it ever holds the pen.

**Phase 2 — Version API and validator.**
Endpoints and validation, no UI. Assert every backfilled v1 validates clean. Any workflow that does not is a pre-existing defect surfaced, to be fixed before proceeding.

**Phase 3 — `availableActions` resolver.**
Ship server-side, have the frontend consume it, delete the hardcoded map. Independently valuable: fixes today's button/permission drift with no designer involved.

**Phase 4 — Designer UI, read-only.**
Canvas rendering active versions, no editing. Admins can see their workflows; layout and rendering feedback arrives while the blast radius is still zero.

**Phase 5 — Editing and publish.**
Drafts, inspectors, publish gate, rollback. `WorkflowTransitionTab` becomes the read-only compiled-rules inspector.

Phase 3 delivers value even if the project stalls. Phase 1's shadow diff is the safety mechanism making the rest defensible. Phases 4 and 5 should not be compressed.

---

## 9. Out of scope

- BPMN-lite node types: approval, parallel gate, timer, notification, webhook, script (own future spec — requires a mid-flight execution engine).
- Workflow simulation / dry-run of a hypothetical request.
- Undo stack in the designer (discard-draft covers it).
- Editing global `(workflowTypeId: NULL)` fallback transition rows via the canvas.
- Per-request-type workflow overrides layered on a shared workflow.
- Cross-workflow reusable subflows or templates.
