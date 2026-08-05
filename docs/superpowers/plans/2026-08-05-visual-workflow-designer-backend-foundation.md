# Visual Workflow Designer — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the versioned workflow-graph authoring layer — schema, validator, compiler, backfill, lifecycle service, and admin API — so that a workflow can be drafted, validated, published, and rolled back, with publishing projecting down onto the existing `WorkflowTransition` rows that the runtime already enforces.

**Architecture:** Three new tables (`WorkflowVersion`, `WorkflowNode`, `WorkflowEdge`) become the authoring source of truth. Publishing *compiles* a version into `WorkflowTransition` and `WorkflowStep` rows scoped to one `workflowTypeId`, so `transitionPolicy.service.ts`, `requestTransition.service.ts`, and `transitionGuards.ts` need no changes at all and their tests keep passing untouched. A pure validator gates publishing. A backfill script reverse-compiles today's rows into an `ACTIVE` version 1 and proves the compiler faithful by diffing its output against live rows before ever writing.

**Tech Stack:** Node.js, Express, TypeScript, Prisma + PostgreSQL, Jest (`ts-jest`), `tsx` for one-off scripts.

**Spec:** `docs/superpowers/specs/2026-08-05-visual-workflow-designer-design.md` — this plan covers **Phases 1 and 2 only**. Phase 3 (`availableActions` resolver) and Phases 4–5 (designer UI) are separate plans.

## Global Constraints

- **Never run the full test suite.** `npm test` hangs silently with zero output in this repo (a known pre-existing defect, observed Jul 7 and Jul 22 2026). Always run individual files: `npx jest src/path/to/file.test.ts`. Verified working: a single file runs in ~1.7s.
- **All work happens from `backend/`** unless a path says otherwise.
- **Do not modify** `src/services/transitionPolicy.service.ts`, `src/services/requestTransition.service.ts`, `src/services/transitionGuards.ts`, or `src/utils/workflowTransitions.ts`. The whole point of the compile strategy is that the enforcement path stays untouched in this plan.
- **Do not modify** `WorkflowTransition` rows where `workflowTypeId IS NULL`. Those are hand-managed platform defaults and must survive every compile untouched.
- **Test style:** unit tests mock Prisma at the module boundary, matching `src/services/__tests__/transitionPolicy.test.ts`:
  ```ts
  const mockPrisma = { workflowTransition: { findFirst: jest.fn() } };
  jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
  ```
- **Controllers** use `asyncHandler` from `../middleware/error.middleware` and respond `{ status: 'success', data: {...} }` / `{ status: 'error', message: '...' }`.
- **Routes** use `authenticate` plus `requirePermission('workflow:manage')` for mutations, matching `src/routes/workflowTransition.routes.ts`.
- **Prisma access** is `import prisma from '../utils/prisma'`. Some existing code casts (`(prisma as any).workflowTransition`) when the client is stale — after Task 1 runs `prisma generate`, no cast is needed for the new models.
- **New services live flat** in `src/services/`, matching the existing convention. `src/types/` holds only ambient `.d.ts` files, so shared graph types go in `src/services/workflowGraph.types.ts`.
- **Commit after every task.** Conventional commit prefixes: `feat(workflow):`, `test(workflow):`, `chore(workflow):`.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/services/workflowGraph.types.ts` | Shared types: `GraphNode`, `GraphEdge`, `WorkflowGraph`, `Finding`, `ValidationResult`. No logic. |
| `src/services/workflowValidator.service.ts` | Structural rules (pure) + live-data stranding queries. Returns findings, never writes. |
| `src/services/workflowCompiler.service.ts` | `projectGraph()` (pure) and `compileVersion()` (transactional), plus `reverseCompile()`. |
| `src/services/workflowVersion.service.ts` | Version lifecycle: draft, list, get graph, publish, rollback, discard. Owns the one-`ACTIVE` invariant. |
| `src/services/workflowGraph.service.ts` | Node/edge batch CRUD inside a draft. Rejects writes to non-`DRAFT` versions. |
| `src/controllers/workflowVersion.controller.ts` | HTTP layer for all of the above. |
| `src/routes/workflowVersion.routes.ts` | Route table under `/admin/workflows`. |
| `prisma/backfill-workflow-versions.ts` | One-off `tsx` script: shadow-diff mode and write mode. |
| `src/services/__tests__/workflowValidatorStructure.test.ts` | Task 2 tests. |
| `src/services/__tests__/workflowValidatorLiveData.test.ts` | Task 3 tests. |
| `src/services/__tests__/workflowCompiler.test.ts` | Task 4 tests. |
| `src/services/__tests__/workflowReverseCompile.test.ts` | Task 5 tests. |
| `src/services/__tests__/workflowVersion.test.ts` | Task 6 tests. |
| `src/services/__tests__/workflowGraphService.test.ts` | Task 7 tests. |

**Modified:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 2 enums + 3 models; add relations to `WorkflowType` and `User`. |
| `src/routes/index.ts` | Mount `/admin/workflows`. |
| `package.json` | Add `workflow:backfill` and `workflow:backfill:shadow` scripts. |

---

## Task 1: Schema and migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (add near `WorkflowStep`, around line 895)
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Consumes: existing `WorkflowType` (line 856), `User`
- Produces: Prisma models `workflowVersion`, `workflowNode`, `workflowEdge`; enums `WorkflowVersionStatus`, `WorkflowNodeType`

- [ ] **Step 1: Add the enums and models to `prisma/schema.prisma`**

Insert immediately after the `WorkflowStep` model:

```prisma
enum WorkflowVersionStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

// Only STATUS today. Future BPMN-lite node types (APPROVAL, TIMER,
// PARALLEL_GATE, NOTIFICATION, WEBHOOK, SCRIPT) extend this enum without
// changing the table shape — see the spec's deferred-scope section.
enum WorkflowNodeType {
  STATUS
}

// Authoring source of truth for a WorkflowType's status graph. Publishing a
// version compiles it into WorkflowTransition + WorkflowStep rows, which is
// what the runtime actually enforces.
model WorkflowVersion {
  id             String                @id @default(uuid()) @db.Uuid
  workflowTypeId String                @map("workflow_type_id") @db.Uuid
  version        Int
  status         WorkflowVersionStatus @default(DRAFT)
  notes          String?               @db.Text
  publishedAt    DateTime?             @map("published_at") @db.Timestamp(6)
  publishedById  String?               @map("published_by_id") @db.Uuid
  createdAt      DateTime              @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt      DateTime              @updatedAt @map("updated_at") @db.Timestamp(6)

  workflowType WorkflowType    @relation(fields: [workflowTypeId], references: [id], onDelete: Cascade)
  publishedBy  User?           @relation("WorkflowVersionPublisher", fields: [publishedById], references: [id])
  nodes        WorkflowNode[]
  edges        WorkflowEdge[]

  @@unique([workflowTypeId, version])
  @@index([workflowTypeId, status])
  @@map("workflow_versions")
}

model WorkflowNode {
  id                String           @id @default(uuid()) @db.Uuid
  workflowVersionId String           @map("workflow_version_id") @db.Uuid
  type              WorkflowNodeType @default(STATUS)
  // → RequestStatusDefinition.code. Required when type = STATUS.
  statusCode        String?          @map("status_code") @db.VarChar(100)
  // NULL means "never laid out" — the designer auto-layouts on open and
  // persists coordinates on first save. Distinct from a node deliberately
  // placed at the origin.
  positionX         Float?           @map("position_x")
  positionY         Float?           @map("position_y")
  isInitial         Boolean          @default(false) @map("is_initial")
  isFinal           Boolean          @default(false) @map("is_final")
  slaPause          Boolean          @default(false) @map("sla_pause")
  icon              String           @default("radio_button_checked") @db.VarChar(50)
  config            Json?            @db.JsonB
  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime         @updatedAt @map("updated_at") @db.Timestamp(6)

  version       WorkflowVersion @relation(fields: [workflowVersionId], references: [id], onDelete: Cascade)
  outgoingEdges WorkflowEdge[]  @relation("EdgeFromNode")
  incomingEdges WorkflowEdge[]  @relation("EdgeToNode")

  @@unique([workflowVersionId, statusCode])
  @@index([workflowVersionId])
  @@map("workflow_nodes")
}

model WorkflowEdge {
  id                String   @id @default(uuid()) @db.Uuid
  workflowVersionId String   @map("workflow_version_id") @db.Uuid
  fromNodeId        String   @map("from_node_id") @db.Uuid
  toNodeId          String   @map("to_node_id") @db.Uuid
  transitionLabel   String?  @map("transition_label") @db.VarChar(50)
  requiresComment   Boolean  @default(false) @map("requires_comment")
  autoAssignRole    String?  @map("auto_assign_role") @db.VarChar(50)
  autoAssignUserId  String?  @map("auto_assign_user_id") @db.Uuid
  allowedRoles          String[] @default([]) @map("allowed_roles")
  allowedExecutiveRoles String[] @default([]) @map("allowed_executive_roles")
  config            Json?    @db.JsonB
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  version  WorkflowVersion @relation(fields: [workflowVersionId], references: [id], onDelete: Cascade)
  fromNode WorkflowNode    @relation("EdgeFromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode   WorkflowNode    @relation("EdgeToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  @@unique([workflowVersionId, fromNodeId, toNodeId])
  @@index([workflowVersionId])
  @@map("workflow_edges")
}
```

- [ ] **Step 2: Add the back-relations**

In `model WorkflowType` (line ~856), inside its `// Relations` block, add:

```prisma
  versions     WorkflowVersion[]
```

In `model User`, alongside its other named relations, add:

```prisma
  publishedWorkflowVersions WorkflowVersion[] @relation("WorkflowVersionPublisher")
```

- [ ] **Step 3: Create the migration**

Run: `npx prisma migrate dev --name add_workflow_versioning`
Expected: migration created and applied; three tables and two enum types exist.

- [ ] **Step 4: Add the one-ACTIVE-per-workflow partial unique index**

Prisma cannot express a partial unique index, so append it by hand to the generated migration SQL file (`prisma/migrations/<timestamp>_add_workflow_versioning/migration.sql`):

```sql
CREATE UNIQUE INDEX "workflow_versions_one_active_per_type"
  ON "workflow_versions" ("workflow_type_id")
  WHERE "status" = 'ACTIVE';
```

Then re-apply: `npx prisma migrate reset --force && npx prisma migrate deploy`

This index is the database-level guarantee behind the invariant Task 6 tests. Without it, two concurrent publishes can both produce an `ACTIVE` version.

- [ ] **Step 5: Regenerate the client and typecheck**

Run: `npx prisma generate && npm run build`
Expected: build succeeds, `prisma.workflowVersion` / `prisma.workflowNode` / `prisma.workflowEdge` are typed.

- [ ] **Step 6: Confirm existing workflow tests still pass**

Run: `npx jest src/services/__tests__/transitionPolicy.test.ts`
Expected: 6 passed. Nothing in this task touches enforcement, so a failure here means the schema edit broke something unrelated.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(workflow): add workflow version, node, and edge tables"
```

---

## Task 2: Validator — structural rules

Pure functions over an in-memory graph. No database, no mocks needed — this is the densest and cheapest test surface in the plan.

**Files:**
- Create: `backend/src/services/workflowGraph.types.ts`
- Create: `backend/src/services/workflowValidator.service.ts`
- Test: `backend/src/services/__tests__/workflowValidatorStructure.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `GraphNode`, `GraphEdge`, `WorkflowGraph`, `Finding`, `ValidationResult` types
  - `validateStructure(graph: WorkflowGraph): ValidationResult`

- [ ] **Step 1: Create the shared types**

`src/services/workflowGraph.types.ts`:

```ts
/**
 * Shared shapes for the workflow authoring graph. Deliberately decoupled from
 * Prisma row types so the validator and compiler stay pure and testable
 * without a database.
 */

export interface GraphNode {
  id: string;
  type: 'STATUS';
  statusCode: string | null;
  positionX: number | null;
  positionY: number | null;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
  icon: string;
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type FindingCode =
  | 'MISSING_INITIAL'
  | 'MULTIPLE_INITIAL'
  | 'MISSING_FINAL'
  | 'UNREACHABLE'
  | 'NO_PATH_TO_FINAL'
  | 'FINAL_HAS_OUTGOING'
  | 'ORPHAN_NODE'
  | 'DANGLING_EDGE'
  | 'STATUS_IN_USE_REMOVED'
  | 'OCCUPIED_STATUS_NO_EXIT'
  | 'OPEN_EDGE'
  | 'UNPLACED_STATUS'
  | 'REJECT_WITHOUT_COMMENT';

export interface Finding {
  code: FindingCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  blocking: Finding[];
  warnings: Finding[];
}
```

- [ ] **Step 2: Write the failing tests**

`src/services/__tests__/workflowValidatorStructure.test.ts`:

```ts
import { validateStructure } from '../workflowValidator.service';
import { GraphEdge, GraphNode, WorkflowGraph } from '../workflowGraph.types';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: 'STATUS',
  statusCode: id,
  positionX: 0,
  positionY: 0,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  icon: 'radio_button_checked',
  ...over,
});

const edge = (from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  id: `${from}->${to}`,
  fromNodeId: from,
  toNodeId: to,
  transitionLabel: null,
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: ['AGENT'],
  allowedExecutiveRoles: [],
  ...over,
});

// NEW → IN_PROGRESS → CLOSED
const validGraph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('IN_PROGRESS'),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [edge('NEW', 'IN_PROGRESS'), edge('IN_PROGRESS', 'CLOSED')],
});

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe('validateStructure', () => {
  it('reports nothing for a valid linear graph', () => {
    const result = validateStructure(validGraph());
    expect(result.blocking).toEqual([]);
  });

  it('blocks when no node is marked initial', () => {
    const graph = validGraph();
    graph.nodes[0].isInitial = false;
    expect(codes(validateStructure(graph).blocking)).toContain('MISSING_INITIAL');
  });

  it('blocks when more than one node is marked initial', () => {
    const graph = validGraph();
    graph.nodes[1].isInitial = true;
    const blocking = validateStructure(graph).blocking;
    expect(codes(blocking)).toContain('MULTIPLE_INITIAL');
    expect(blocking.find((f) => f.code === 'MULTIPLE_INITIAL')!.message).toContain('found 2');
  });

  it('blocks when no node is marked final', () => {
    const graph = validGraph();
    graph.nodes[2].isFinal = false;
    expect(codes(validateStructure(graph).blocking)).toContain('MISSING_FINAL');
  });

  it('blocks a node unreachable from the initial node', () => {
    const graph = validGraph();
    graph.nodes.push(node('ON_HOLD'));
    graph.edges.push(edge('ON_HOLD', 'CLOSED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'UNREACHABLE');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('ON_HOLD');
    expect(finding!.message).toContain('ON_HOLD');
  });

  it('blocks a node with no path to any final node', () => {
    const graph = validGraph();
    graph.nodes.push(node('ESCALATED'));
    graph.edges.push(edge('IN_PROGRESS', 'ESCALATED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'NO_PATH_TO_FINAL');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('ESCALATED');
  });

  it('blocks outgoing edges from a final node', () => {
    const graph = validGraph();
    graph.nodes.push(node('REOPENED'));
    graph.edges.push(edge('CLOSED', 'REOPENED'), edge('REOPENED', 'CLOSED'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'FINAL_HAS_OUTGOING');
    expect(finding).toBeDefined();
    expect(finding!.nodeId).toBe('CLOSED');
  });

  it('blocks an orphan node with no connections', () => {
    const graph = validGraph();
    graph.nodes.push(node('CANCELLED'));
    expect(codes(validateStructure(graph).blocking)).toContain('ORPHAN_NODE');
  });

  it('blocks an edge whose endpoint is missing from the graph', () => {
    const graph = validGraph();
    graph.edges.push(edge('IN_PROGRESS', 'GHOST'));
    const finding = validateStructure(graph).blocking.find((f) => f.code === 'DANGLING_EDGE');
    expect(finding).toBeDefined();
    expect(finding!.edgeId).toBe('IN_PROGRESS->GHOST');
  });

  it('accumulates every fault rather than stopping at the first', () => {
    const graph: WorkflowGraph = {
      nodes: [node('A'), node('B')],
      edges: [],
    };
    const found = codes(validateStructure(graph).blocking);
    expect(found).toContain('MISSING_INITIAL');
    expect(found).toContain('MISSING_FINAL');
    expect(found).toContain('ORPHAN_NODE');
  });

  it('warns about an edge open to any authenticated user', () => {
    const graph = validGraph();
    graph.edges[0].allowedRoles = [];
    graph.edges[0].allowedExecutiveRoles = [];
    const finding = validateStructure(graph).warnings.find((f) => f.code === 'OPEN_EDGE');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('any authenticated user');
  });

  it('warns when a REJECT edge does not require a comment', () => {
    const graph = validGraph();
    graph.edges[1].transitionLabel = 'REJECT';
    graph.edges[1].requiresComment = false;
    expect(codes(validateStructure(graph).warnings)).toContain('REJECT_WITHOUT_COMMENT');
  });

  it('does not warn when a REJECT edge requires a comment', () => {
    const graph = validGraph();
    graph.edges[1].transitionLabel = 'REJECT';
    graph.edges[1].requiresComment = true;
    expect(codes(validateStructure(graph).warnings)).not.toContain('REJECT_WITHOUT_COMMENT');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowValidatorStructure.test.ts`
Expected: FAIL — `Cannot find module '../workflowValidator.service'`

- [ ] **Step 4: Implement the validator**

`src/services/workflowValidator.service.ts`:

```ts
/**
 * Workflow graph validation. Structural rules are pure functions over an
 * in-memory graph; live-data rules (added in the next task) query current
 * request positions.
 *
 * Findings accumulate — validation never short-circuits, so an admin sees
 * every problem at once rather than fixing them one reload at a time.
 */

import { Finding, GraphNode, ValidationResult, WorkflowGraph } from './workflowGraph.types';

const label = (node: GraphNode): string => node.statusCode ?? node.id;

/** Node IDs reachable from `startIds` following `adjacency`. */
function reachable(startIds: string[], adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

export function validateStructure(graph: WorkflowGraph): ValidationResult {
  const blocking: Finding[] = [];
  const warnings: Finding[] = [];

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  // Dangling edges first: every later rule assumes endpoints resolve.
  const validEdges = [];
  for (const edge of graph.edges) {
    const fromMissing = !nodesById.has(edge.fromNodeId);
    const toMissing = !nodesById.has(edge.toNodeId);
    if (fromMissing || toMissing) {
      blocking.push({
        code: 'DANGLING_EDGE',
        edgeId: edge.id,
        message: `Transition references a status that is not on this workflow (${
          fromMissing ? edge.fromNodeId : edge.toNodeId
        })`,
      });
      continue;
    }
    validEdges.push(edge);
  }

  const initialNodes = graph.nodes.filter((n) => n.isInitial);
  const finalNodes = graph.nodes.filter((n) => n.isFinal);

  if (initialNodes.length === 0) {
    blocking.push({
      code: 'MISSING_INITIAL',
      message: 'Workflow needs exactly one starting status (found 0)',
    });
  } else if (initialNodes.length > 1) {
    blocking.push({
      code: 'MULTIPLE_INITIAL',
      message: `Workflow needs exactly one starting status (found ${initialNodes.length}: ${initialNodes
        .map(label)
        .join(', ')})`,
    });
  }

  if (finalNodes.length === 0) {
    blocking.push({
      code: 'MISSING_FINAL',
      message: 'Workflow needs at least one ending status',
    });
  }

  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  const degree = new Map<string, number>();
  for (const node of graph.nodes) degree.set(node.id, 0);
  for (const edge of validEdges) {
    forward.set(edge.fromNodeId, [...(forward.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    backward.set(edge.toNodeId, [...(backward.get(edge.toNodeId) ?? []), edge.fromNodeId]);
    degree.set(edge.fromNodeId, (degree.get(edge.fromNodeId) ?? 0) + 1);
    degree.set(edge.toNodeId, (degree.get(edge.toNodeId) ?? 0) + 1);
  }

  // Orphans are reported on their own; skip them in reachability so a single
  // disconnected node does not also produce UNREACHABLE and NO_PATH_TO_FINAL.
  const orphanIds = new Set<string>();
  for (const node of graph.nodes) {
    if ((degree.get(node.id) ?? 0) === 0) {
      orphanIds.add(node.id);
      blocking.push({
        code: 'ORPHAN_NODE',
        nodeId: node.id,
        message: `${label(node)} has no connections`,
      });
    }
  }

  if (initialNodes.length > 0) {
    const fromInitial = reachable(
      initialNodes.map((n) => n.id),
      forward,
    );
    for (const node of graph.nodes) {
      if (orphanIds.has(node.id) || fromInitial.has(node.id)) continue;
      blocking.push({
        code: 'UNREACHABLE',
        nodeId: node.id,
        message: `${label(node)} cannot be reached from ${label(initialNodes[0])}`,
      });
    }
  }

  if (finalNodes.length > 0) {
    const canReachFinal = reachable(
      finalNodes.map((n) => n.id),
      backward,
    );
    for (const node of graph.nodes) {
      if (orphanIds.has(node.id) || canReachFinal.has(node.id)) continue;
      blocking.push({
        code: 'NO_PATH_TO_FINAL',
        nodeId: node.id,
        message: `${label(node)} has no path to an ending status`,
      });
    }
  }

  for (const node of finalNodes) {
    const outgoing = validEdges.filter((e) => e.fromNodeId === node.id);
    for (const edge of outgoing) {
      blocking.push({
        code: 'FINAL_HAS_OUTGOING',
        nodeId: node.id,
        edgeId: edge.id,
        message: `${label(node)} is an ending status but has a transition to ${label(
          nodesById.get(edge.toNodeId)!,
        )}`,
      });
    }
  }

  for (const edge of validEdges) {
    const from = label(nodesById.get(edge.fromNodeId)!);
    const to = label(nodesById.get(edge.toNodeId)!);

    if (edge.allowedRoles.length === 0 && edge.allowedExecutiveRoles.length === 0) {
      warnings.push({
        code: 'OPEN_EDGE',
        edgeId: edge.id,
        message: `${from} → ${to} is open to any authenticated user`,
      });
    }

    const isRejection = edge.transitionLabel === 'REJECT' || edge.transitionLabel === 'RETURN';
    if (isRejection && !edge.requiresComment) {
      warnings.push({
        code: 'REJECT_WITHOUT_COMMENT',
        edgeId: edge.id,
        message: `${from} → ${to} is a ${edge.transitionLabel!.toLowerCase()} but does not require a comment — rejections usually capture a reason`,
      });
    }
  }

  return { blocking, warnings };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/workflowValidatorStructure.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/workflowGraph.types.ts src/services/workflowValidator.service.ts src/services/__tests__/workflowValidatorStructure.test.ts
git commit -m "feat(workflow): add structural graph validation"
```

---

## Task 3: Validator — live-data stranding checks

These are the checks that make replace-in-place publishing safe. They ask: would publishing this graph leave a real, in-flight request with nowhere to go?

**Files:**
- Modify: `backend/src/services/workflowValidator.service.ts`
- Test: `backend/src/services/__tests__/workflowValidatorLiveData.test.ts`

**Interfaces:**
- Consumes: `WorkflowGraph`, `Finding`, `ValidationResult`, `validateStructure` from Task 2
- Produces:
  - `validateLiveData(input: { workflowTypeId: string; graph: WorkflowGraph }): Promise<Finding[]>`
  - `validateGraph(input: { workflowTypeId: string; graph: WorkflowGraph }): Promise<ValidationResult>` — structural + live-data combined; this is what the publish gate and the API call

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/workflowValidatorLiveData.test.ts`:

```ts
const mockPrisma = {
  requestType: { findMany: jest.fn() },
  request: { groupBy: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { validateGraph, validateLiveData } from '../workflowValidator.service';
import { GraphNode, WorkflowGraph } from '../workflowGraph.types';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: 'STATUS',
  statusCode: id,
  positionX: 0,
  positionY: 0,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  icon: 'radio_button_checked',
  ...over,
});

const graph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('IN_PROGRESS'),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [
    {
      id: 'e1',
      fromNodeId: 'NEW',
      toNodeId: 'IN_PROGRESS',
      transitionLabel: null,
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
    },
    {
      id: 'e2',
      fromNodeId: 'IN_PROGRESS',
      toNodeId: 'CLOSED',
      transitionLabel: null,
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
    },
  ],
});

const input = { workflowTypeId: 'wf1', graph: graph() };

describe('validateLiveData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }, { id: 'rt2' }]);
  });

  it('reports nothing when every occupied status survives with an exit', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 4 } },
      { status: 'IN_PROGRESS', _count: { _all: 2 } },
    ]);
    await expect(validateLiveData({ workflowTypeId: 'wf1', graph: graph() })).resolves.toEqual([]);
  });

  it('blocks removing a status that requests currently occupy', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'PENDING_CFO', _count: { _all: 12 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    const finding = findings.find((f) => f.code === 'STATUS_IN_USE_REMOVED');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('12 requests');
    expect(finding!.message).toContain('PENDING_CFO');
  });

  it('blocks leaving an occupied status with no outgoing transitions', async () => {
    const stranded = graph();
    stranded.edges = stranded.edges.filter((e) => e.fromNodeId !== 'IN_PROGRESS');
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'IN_PROGRESS', _count: { _all: 8 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: stranded });
    const finding = findings.find((f) => f.code === 'OCCUPIED_STATUS_NO_EXIT');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('8 requests');
    expect(finding!.nodeId).toBe('IN_PROGRESS');
  });

  it('allows an occupied final status to have no outgoing transitions', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'CLOSED', _count: { _all: 99 } }]);
    const findings = await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    expect(findings).toEqual([]);
  });

  it('scopes the request query to the request types bound to this workflow', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([]);
    await validateLiveData({ workflowTypeId: 'wf1', graph: graph() });
    expect(mockPrisma.requestType.findMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1' },
      select: { id: true },
    });
    expect(mockPrisma.request.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: { requestTypeId: { in: ['rt1', 'rt2'] } },
      }),
    );
  });

  it('skips the request query entirely when no request type is bound', async () => {
    mockPrisma.requestType.findMany.mockResolvedValue([]);
    await expect(validateLiveData(input)).resolves.toEqual([]);
    expect(mockPrisma.request.groupBy).not.toHaveBeenCalled();
  });
});

describe('validateGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
    mockPrisma.request.groupBy.mockResolvedValue([]);
  });

  it('merges structural and live-data findings into one blocking list', async () => {
    const broken = graph();
    broken.nodes[0].isInitial = false;
    mockPrisma.request.groupBy.mockResolvedValue([{ status: 'GONE', _count: { _all: 3 } }]);

    const result = await validateGraph({ workflowTypeId: 'wf1', graph: broken });
    const codes = result.blocking.map((f) => f.code);
    expect(codes).toContain('MISSING_INITIAL');
    expect(codes).toContain('STATUS_IN_USE_REMOVED');
  });

  it('preserves structural warnings alongside blocking findings', async () => {
    const open = graph();
    open.edges[0].allowedRoles = [];
    const result = await validateGraph({ workflowTypeId: 'wf1', graph: open });
    expect(result.warnings.map((f) => f.code)).toContain('OPEN_EDGE');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowValidatorLiveData.test.ts`
Expected: FAIL — `validateLiveData is not a function`

- [ ] **Step 3: Implement the live-data checks**

Append to `src/services/workflowValidator.service.ts`:

```ts
import prisma from '../utils/prisma';

export interface ValidateGraphInput {
  workflowTypeId: string;
  graph: WorkflowGraph;
}

/**
 * Checks that publishing this graph would not strand a request that is already
 * in flight. Re-run inside the publish transaction, because occupancy counts
 * move between an admin looking at the canvas and clicking Publish.
 */
export async function validateLiveData(input: ValidateGraphInput): Promise<Finding[]> {
  const { workflowTypeId, graph } = input;

  const requestTypes = await prisma.requestType.findMany({
    where: { workflowTypeId },
    select: { id: true },
  });
  if (requestTypes.length === 0) return [];

  const occupancy = await prisma.request.groupBy({
    by: ['status'],
    where: { requestTypeId: { in: requestTypes.map((rt) => rt.id) } },
    _count: { _all: true },
  });

  const findings: Finding[] = [];
  const nodesByStatus = new Map(
    graph.nodes.filter((n) => n.statusCode !== null).map((n) => [n.statusCode as string, n]),
  );
  const hasOutgoing = new Set(graph.edges.map((e) => e.fromNodeId));

  for (const row of occupancy) {
    const count = row._count._all;
    if (count === 0) continue;

    const node = nodesByStatus.get(row.status);
    if (!node) {
      findings.push({
        code: 'STATUS_IN_USE_REMOVED',
        message: `${count} request${count === 1 ? ' is' : 's are'} currently in ${row.status} — it cannot be removed from this workflow`,
      });
      continue;
    }

    if (!node.isFinal && !hasOutgoing.has(node.id)) {
      findings.push({
        code: 'OCCUPIED_STATUS_NO_EXIT',
        nodeId: node.id,
        message: `${count} request${count === 1 ? ' is' : 's are'} in ${row.status}, which would have no available transitions`,
      });
    }
  }

  return findings;
}

/** Structural + live-data validation. The publish gate and the API both use this. */
export async function validateGraph(input: ValidateGraphInput): Promise<ValidationResult> {
  const structural = validateStructure(input.graph);
  const live = await validateLiveData(input);
  return {
    blocking: [...structural.blocking, ...live],
    warnings: structural.warnings,
  };
}
```

- [ ] **Step 4: Run both validator test files to verify they pass**

Run: `npx jest src/services/__tests__/workflowValidatorStructure.test.ts src/services/__tests__/workflowValidatorLiveData.test.ts`
Expected: PASS, 21 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/services/workflowValidator.service.ts src/services/__tests__/workflowValidatorLiveData.test.ts
git commit -m "feat(workflow): add live-data stranding validation"
```

---

## Task 4: Compiler

The piece that touches live enforcement. `projectGraph()` is pure so the mapping can be tested exhaustively without a database; `compileVersion()` wraps it in a transaction.

**Files:**
- Create: `backend/src/services/workflowCompiler.service.ts`
- Test: `backend/src/services/__tests__/workflowCompiler.test.ts`

**Interfaces:**
- Consumes: `WorkflowGraph`, `GraphNode`, `GraphEdge` from Task 2
- Produces:
  - `ProjectedTransition`, `ProjectedStep` types
  - `projectGraph(graph: WorkflowGraph, workflowTypeId: string): { transitions: ProjectedTransition[]; steps: ProjectedStep[] }`
  - `compileVersion(versionId: string): Promise<{ transitionCount: number; stepCount: number }>`

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/workflowCompiler.test.ts`:

```ts
const mockTx = {
  workflowTransition: { deleteMany: jest.fn(), createMany: jest.fn() },
  workflowStep: { deleteMany: jest.fn(), createMany: jest.fn() },
};
const mockPrisma = {
  workflowVersion: { findUnique: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { compileVersion, projectGraph } from '../workflowCompiler.service';
import { GraphEdge, GraphNode, WorkflowGraph } from '../workflowGraph.types';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: 'STATUS',
  statusCode: id,
  positionX: 10,
  positionY: 20,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  icon: 'radio_button_checked',
  ...over,
});

const edge = (from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge => ({
  id: `${from}->${to}`,
  fromNodeId: from,
  toNodeId: to,
  transitionLabel: null,
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
  ...over,
});

const graph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true, icon: 'add' }),
    node('IN_PROGRESS', { slaPause: false }),
    node('CLOSED', { isFinal: true }),
  ],
  edges: [
    edge('NEW', 'IN_PROGRESS', { transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
    edge('IN_PROGRESS', 'CLOSED', {
      transitionLabel: 'CLOSE',
      requiresComment: true,
      allowedExecutiveRoles: ['CEO'],
      autoAssignRole: 'IT',
    }),
  ],
});

describe('projectGraph', () => {
  it('maps each edge to a workflow-scoped transition row', () => {
    const { transitions } = projectGraph(graph(), 'wf1');
    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toEqual({
      tenantId: null,
      workflowTypeId: 'wf1',
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
      transitionLabel: 'SUBMIT',
      requiresComment: false,
      autoAssignRole: null,
      autoAssignUserId: null,
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: [],
      isActive: true,
    });
  });

  it('carries comment, auto-assign, and executive-role rules onto the transition', () => {
    const { transitions } = projectGraph(graph(), 'wf1');
    const close = transitions.find((t) => t.toStatus === 'CLOSED')!;
    expect(close.requiresComment).toBe(true);
    expect(close.autoAssignRole).toBe('IT');
    expect(close.allowedExecutiveRoles).toEqual(['CEO']);
  });

  it('maps each node to a workflow step, ordered from the initial node outward', () => {
    const { steps } = projectGraph(graph(), 'wf1');
    expect(steps.map((s) => s.status)).toEqual(['NEW', 'IN_PROGRESS', 'CLOSED']);
    expect(steps.map((s) => s.displayOrder)).toEqual([0, 1, 2]);
    expect(steps[0]).toEqual({
      workflowTypeId: 'wf1',
      status: 'NEW',
      label: 'NEW',
      icon: 'add',
      displayOrder: 0,
      isInitial: true,
      isFinal: false,
      slaPause: false,
    });
  });

  it('orders steps by graph distance so a branching graph still reads sensibly', () => {
    const branching: WorkflowGraph = {
      nodes: [
        node('NEW', { isInitial: true }),
        node('APPROVED'),
        node('REJECTED', { isFinal: true }),
        node('CLOSED', { isFinal: true }),
      ],
      edges: [
        edge('NEW', 'APPROVED'),
        edge('NEW', 'REJECTED'),
        edge('APPROVED', 'CLOSED'),
      ],
    };
    const { steps } = projectGraph(branching, 'wf1');
    expect(steps[0].status).toBe('NEW');
    expect(steps.map((s) => s.status).slice(1, 3).sort()).toEqual(['APPROVED', 'REJECTED']);
    expect(steps[3].status).toBe('CLOSED');
  });

  it('skips non-status nodes, which have no status code to compile', () => {
    const withGate: WorkflowGraph = graph();
    withGate.nodes.push({ ...node('gate-1'), statusCode: null });
    const { transitions, steps } = projectGraph(withGate, 'wf1');
    expect(steps.map((s) => s.status)).not.toContain(null);
    expect(steps).toHaveLength(3);
    expect(transitions).toHaveLength(2);
  });
});

describe('compileVersion', () => {
  beforeEach(() => jest.clearAllMocks());

  const dbVersion = {
    id: 'v1',
    workflowTypeId: 'wf1',
    nodes: [
      { id: 'NEW', type: 'STATUS', statusCode: 'NEW', positionX: 0, positionY: 0, isInitial: true, isFinal: false, slaPause: false, icon: 'add' },
      { id: 'CLOSED', type: 'STATUS', statusCode: 'CLOSED', positionX: 0, positionY: 0, isInitial: false, isFinal: true, slaPause: false, icon: 'done' },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'NEW', toNodeId: 'CLOSED', transitionLabel: 'CLOSE', requiresComment: false, autoAssignRole: null, autoAssignUserId: null, allowedRoles: ['AGENT'], allowedExecutiveRoles: [] },
    ],
  };

  it('replaces only this workflow\'s transitions, leaving global rows untouched', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    await compileVersion('v1');
    expect(mockTx.workflowTransition.deleteMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1' },
    });
  });

  it('writes the projected transitions and steps', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    const result = await compileVersion('v1');
    expect(mockTx.workflowTransition.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ fromStatus: 'NEW', toStatus: 'CLOSED', workflowTypeId: 'wf1' }),
      ],
    });
    expect(mockTx.workflowStep.createMany).toHaveBeenCalled();
    expect(result).toEqual({ transitionCount: 1, stepCount: 2 });
  });

  it('runs delete and create inside a single transaction', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(dbVersion);
    await compileVersion('v1');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('throws when the version does not exist', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(null);
    await expect(compileVersion('missing')).rejects.toThrow('Workflow version missing not found');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowCompiler.test.ts`
Expected: FAIL — `Cannot find module '../workflowCompiler.service'`

- [ ] **Step 3: Implement the compiler**

`src/services/workflowCompiler.service.ts`:

```ts
/**
 * Projects an authoring graph onto the tables the runtime already enforces.
 *
 * WorkflowVersion/Node/Edge are the authoring source of truth; WorkflowTransition
 * and WorkflowStep are compiled artifacts. This keeps transitionPolicy.service.ts
 * and requestTransition.service.ts unchanged — scope precedence and the global
 * (tenantId: NULL, workflowTypeId: NULL) fallback rows keep working exactly as
 * they do today.
 */

import prisma from '../utils/prisma';
import { GraphEdge, GraphNode, WorkflowGraph } from './workflowGraph.types';

export interface ProjectedTransition {
  tenantId: null;
  workflowTypeId: string;
  fromStatus: string;
  toStatus: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
  isActive: true;
}

export interface ProjectedStep {
  workflowTypeId: string;
  status: string;
  label: string;
  icon: string;
  displayOrder: number;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
}

/**
 * Breadth-first order from the initial node, so the compiled WorkflowStep
 * displayOrder still reads as a sensible progression for the existing stepper
 * UI even when the graph branches. Nodes not reached (already blocked by
 * validation) are appended so nothing is silently dropped.
 */
function orderNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const forward = new Map<string, string[]>();
  for (const edge of edges) {
    forward.set(edge.fromNodeId, [...(forward.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }

  const ordered: GraphNode[] = [];
  const seen = new Set<string>();
  const start = nodes.find((n) => n.isInitial);
  const queue = start ? [start.id] : [];
  if (start) seen.add(start.id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const next of forward.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) ordered.push(node);
  }

  return ordered;
}

export function projectGraph(
  graph: WorkflowGraph,
  workflowTypeId: string,
): { transitions: ProjectedTransition[]; steps: ProjectedStep[] } {
  const statusById = new Map(
    graph.nodes.filter((n) => n.statusCode !== null).map((n) => [n.id, n.statusCode as string]),
  );

  const transitions: ProjectedTransition[] = [];
  for (const edge of graph.edges) {
    const fromStatus = statusById.get(edge.fromNodeId);
    const toStatus = statusById.get(edge.toNodeId);
    // Edges touching a non-status node have no equivalent in the status
    // machine. Only reachable once BPMN-lite node types land.
    if (!fromStatus || !toStatus) continue;

    transitions.push({
      tenantId: null,
      workflowTypeId,
      fromStatus,
      toStatus,
      transitionLabel: edge.transitionLabel,
      requiresComment: edge.requiresComment,
      autoAssignRole: edge.autoAssignRole,
      autoAssignUserId: edge.autoAssignUserId,
      allowedRoles: edge.allowedRoles,
      allowedExecutiveRoles: edge.allowedExecutiveRoles,
      isActive: true,
    });
  }

  const steps: ProjectedStep[] = [];
  let displayOrder = 0;
  for (const node of orderNodes(graph.nodes, graph.edges)) {
    if (node.statusCode === null) continue;
    steps.push({
      workflowTypeId,
      status: node.statusCode,
      label: node.statusCode,
      icon: node.icon,
      displayOrder: displayOrder++,
      isInitial: node.isInitial,
      isFinal: node.isFinal,
      slaPause: node.slaPause,
    });
  }

  return { transitions, steps };
}

/** Load a version's graph in the shared in-memory shape. */
export async function loadGraph(versionId: string): Promise<{ workflowTypeId: string; graph: WorkflowGraph }> {
  const version = await prisma.workflowVersion.findUnique({
    where: { id: versionId },
    include: { nodes: true, edges: true },
  });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);

  return {
    workflowTypeId: version.workflowTypeId,
    graph: {
      nodes: version.nodes.map((n) => ({
        id: n.id,
        type: 'STATUS',
        statusCode: n.statusCode,
        positionX: n.positionX,
        positionY: n.positionY,
        isInitial: n.isInitial,
        isFinal: n.isFinal,
        slaPause: n.slaPause,
        icon: n.icon,
      })),
      edges: version.edges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        transitionLabel: e.transitionLabel,
        requiresComment: e.requiresComment,
        autoAssignRole: e.autoAssignRole,
        autoAssignUserId: e.autoAssignUserId,
        allowedRoles: e.allowedRoles,
        allowedExecutiveRoles: e.allowedExecutiveRoles,
      })),
    },
  };
}

/**
 * Delete-then-insert scoped to one workflowTypeId, in a single transaction.
 * Rows with workflowTypeId NULL are platform defaults and are never touched.
 */
export async function compileVersion(
  versionId: string,
): Promise<{ transitionCount: number; stepCount: number }> {
  const { workflowTypeId, graph } = await loadGraph(versionId);
  const { transitions, steps } = projectGraph(graph, workflowTypeId);

  await prisma.$transaction(async (tx: any) => {
    await tx.workflowTransition.deleteMany({ where: { workflowTypeId } });
    await tx.workflowStep.deleteMany({ where: { workflowTypeId } });
    if (transitions.length > 0) await tx.workflowTransition.createMany({ data: transitions });
    if (steps.length > 0) await tx.workflowStep.createMany({ data: steps });
  });

  return { transitionCount: transitions.length, stepCount: steps.length };
}
```

Note: `loadGraph` is exported here because Task 6 needs it too, and it belongs next to the projection it feeds.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/workflowCompiler.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/workflowCompiler.service.ts src/services/__tests__/workflowCompiler.test.ts
git commit -m "feat(workflow): compile version graphs to transitions and steps"
```

---

## Task 5: Reverse-compile and backfill script

The Phase 1 gate. Reverse-compiling turns today's rows into a version; shadow mode then proves the round trip is lossless before any write happens.

**Files:**
- Modify: `backend/src/services/workflowCompiler.service.ts` (add `reverseCompile`, `diffProjection`)
- Create: `backend/prisma/backfill-workflow-versions.ts`
- Modify: `backend/package.json` (two scripts)
- Test: `backend/src/services/__tests__/workflowReverseCompile.test.ts`

**Interfaces:**
- Consumes: `projectGraph`, `ProjectedTransition` from Task 4
- Produces:
  - `reverseCompile(workflowTypeId: string): Promise<WorkflowGraph>`
  - `diffProjection(projected: ProjectedTransition[], live: ProjectedTransition[]): { missing: string[]; extra: string[]; changed: string[] }`

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/workflowReverseCompile.test.ts`:

```ts
const mockPrisma = {
  workflowStep: { findMany: jest.fn() },
  workflowTransition: { findMany: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { diffProjection, projectGraph, reverseCompile } from '../workflowCompiler.service';
import { ProjectedTransition } from '../workflowCompiler.service';

const step = (status: string, over: Record<string, unknown> = {}) => ({
  status,
  icon: 'radio_button_checked',
  displayOrder: 0,
  isInitial: false,
  isFinal: false,
  slaPause: false,
  ...over,
});

const transition = (fromStatus: string, toStatus: string, over: Record<string, unknown> = {}) => ({
  fromStatus,
  toStatus,
  transitionLabel: null,
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
  ...over,
});

describe('reverseCompile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds a node per workflow step, preserving its flags', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true, icon: 'add' }),
      step('CLOSED', { isFinal: true, slaPause: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes.map((n) => n.statusCode)).toEqual(['NEW', 'CLOSED']);
    expect(graph.nodes[0].isInitial).toBe(true);
    expect(graph.nodes[0].icon).toBe('add');
    expect(graph.nodes[1].slaPause).toBe(true);
  });

  it('leaves coordinates null so the designer knows to auto-layout', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([step('NEW', { isInitial: true })]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes[0].positionX).toBeNull();
    expect(graph.nodes[0].positionY).toBeNull();
  });

  it('adds nodes for statuses referenced by transitions but missing a step', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([step('NEW', { isInitial: true })]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([transition('NEW', 'ON_HOLD')]);

    const graph = await reverseCompile('wf1');
    expect(graph.nodes.map((n) => n.statusCode).sort()).toEqual(['NEW', 'ON_HOLD']);
  });

  it('builds an edge per transition, wired to node ids', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true }),
      step('CLOSED', { isFinal: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([
      transition('NEW', 'CLOSED', { transitionLabel: 'CLOSE', requiresComment: true, allowedRoles: ['AGENT'] }),
    ]);

    const graph = await reverseCompile('wf1');
    const newNode = graph.nodes.find((n) => n.statusCode === 'NEW')!;
    const closedNode = graph.nodes.find((n) => n.statusCode === 'CLOSED')!;
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].fromNodeId).toBe(newNode.id);
    expect(graph.edges[0].toNodeId).toBe(closedNode.id);
    expect(graph.edges[0].requiresComment).toBe(true);
    expect(graph.edges[0].allowedRoles).toEqual(['AGENT']);
  });

  it('reads only workflow-scoped transitions, never the global fallback rows', async () => {
    mockPrisma.workflowStep.findMany.mockResolvedValue([]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue([]);

    await reverseCompile('wf1');
    expect(mockPrisma.workflowTransition.findMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1', isActive: true },
    });
  });

  it('round-trips: reverse-compiling then projecting reproduces the same transitions', async () => {
    const live = [
      transition('NEW', 'IN_PROGRESS', { transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
      transition('IN_PROGRESS', 'CLOSED', { transitionLabel: 'CLOSE', requiresComment: true }),
    ];
    mockPrisma.workflowStep.findMany.mockResolvedValue([
      step('NEW', { isInitial: true }),
      step('IN_PROGRESS'),
      step('CLOSED', { isFinal: true }),
    ]);
    mockPrisma.workflowTransition.findMany.mockResolvedValue(live);

    const graph = await reverseCompile('wf1');
    const { transitions } = projectGraph(graph, 'wf1');

    const key = (t: { fromStatus: string; toStatus: string }) => `${t.fromStatus}->${t.toStatus}`;
    expect(transitions.map(key).sort()).toEqual(live.map(key).sort());
    const submitted = transitions.find((t) => t.toStatus === 'IN_PROGRESS')!;
    expect(submitted.transitionLabel).toBe('SUBMIT');
    expect(submitted.allowedRoles).toEqual(['AGENT']);
  });
});

describe('diffProjection', () => {
  const projected = (over: Partial<ProjectedTransition> = {}): ProjectedTransition => ({
    tenantId: null,
    workflowTypeId: 'wf1',
    fromStatus: 'NEW',
    toStatus: 'CLOSED',
    transitionLabel: 'CLOSE',
    requiresComment: false,
    autoAssignRole: null,
    autoAssignUserId: null,
    allowedRoles: ['AGENT'],
    allowedExecutiveRoles: [],
    isActive: true,
    ...over,
  });

  it('reports no differences for identical sets', () => {
    expect(diffProjection([projected()], [projected()])).toEqual({
      missing: [],
      extra: [],
      changed: [],
    });
  });

  it('reports a transition present live but absent from the projection', () => {
    const result = diffProjection([], [projected()]);
    expect(result.missing).toEqual(['NEW->CLOSED']);
  });

  it('reports a transition the projection invents', () => {
    const result = diffProjection([projected()], []);
    expect(result.extra).toEqual(['NEW->CLOSED']);
  });

  it('reports a transition whose rules differ', () => {
    const result = diffProjection(
      [projected({ requiresComment: true })],
      [projected({ requiresComment: false })],
    );
    expect(result.changed).toEqual(['NEW->CLOSED']);
  });

  it('ignores allowedRoles ordering, which is not semantically meaningful', () => {
    const result = diffProjection(
      [projected({ allowedRoles: ['ADMIN', 'AGENT'] })],
      [projected({ allowedRoles: ['AGENT', 'ADMIN'] })],
    );
    expect(result.changed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowReverseCompile.test.ts`
Expected: FAIL — `reverseCompile is not a function`

- [ ] **Step 3: Implement `reverseCompile` and `diffProjection`**

Append to `src/services/workflowCompiler.service.ts`:

```ts
import { randomUUID } from 'crypto';

/**
 * Builds an authoring graph from the rows that exist today, so existing
 * workflows get a version 1 without anyone re-drawing them. Node ids are
 * generated here and become the real primary keys when the backfill persists.
 */
export async function reverseCompile(workflowTypeId: string): Promise<WorkflowGraph> {
  const steps = await prisma.workflowStep.findMany({
    where: { workflowTypeId },
    orderBy: { displayOrder: 'asc' },
  });
  const transitions = await prisma.workflowTransition.findMany({
    where: { workflowTypeId, isActive: true },
  });

  const nodeByStatus = new Map<string, GraphNode>();
  const addNode = (status: string, over: Partial<GraphNode> = {}): GraphNode => {
    const existing = nodeByStatus.get(status);
    if (existing) return existing;
    const node: GraphNode = {
      id: randomUUID(),
      type: 'STATUS',
      statusCode: status,
      positionX: null,
      positionY: null,
      isInitial: false,
      isFinal: false,
      slaPause: false,
      icon: 'radio_button_checked',
      ...over,
    };
    nodeByStatus.set(status, node);
    return node;
  };

  for (const step of steps) {
    addNode(step.status, {
      icon: step.icon,
      isInitial: step.isInitial,
      isFinal: step.isFinal,
      slaPause: step.slaPause,
    });
  }

  // Statuses referenced by a transition but with no step row would otherwise
  // be silently dropped.
  for (const t of transitions) {
    addNode(t.fromStatus);
    addNode(t.toStatus);
  }

  const edges: GraphEdge[] = transitions.map((t) => ({
    id: randomUUID(),
    fromNodeId: nodeByStatus.get(t.fromStatus)!.id,
    toNodeId: nodeByStatus.get(t.toStatus)!.id,
    transitionLabel: t.transitionLabel,
    requiresComment: t.requiresComment,
    autoAssignRole: t.autoAssignRole,
    autoAssignUserId: t.autoAssignUserId,
    allowedRoles: t.allowedRoles,
    allowedExecutiveRoles: t.allowedExecutiveRoles,
  }));

  return { nodes: [...nodeByStatus.values()], edges };
}

const transitionKey = (t: { fromStatus: string; toStatus: string }) => `${t.fromStatus}->${t.toStatus}`;

const rulesFingerprint = (t: ProjectedTransition) =>
  JSON.stringify({
    transitionLabel: t.transitionLabel,
    requiresComment: t.requiresComment,
    autoAssignRole: t.autoAssignRole,
    autoAssignUserId: t.autoAssignUserId,
    allowedRoles: [...t.allowedRoles].sort(),
    allowedExecutiveRoles: [...t.allowedExecutiveRoles].sort(),
  });

/**
 * Shadow-mode comparison: does compiling a version reproduce exactly the rows
 * that are live today? Zero differences across all workflows is the gate to
 * exposing the compiler for real writes.
 */
export function diffProjection(
  projected: ProjectedTransition[],
  live: ProjectedTransition[],
): { missing: string[]; extra: string[]; changed: string[] } {
  const projectedByKey = new Map(projected.map((t) => [transitionKey(t), t]));
  const liveByKey = new Map(live.map((t) => [transitionKey(t), t]));

  const missing: string[] = [];
  const extra: string[] = [];
  const changed: string[] = [];

  for (const [key, liveRow] of liveByKey) {
    const projectedRow = projectedByKey.get(key);
    if (!projectedRow) {
      missing.push(key);
    } else if (rulesFingerprint(projectedRow) !== rulesFingerprint(liveRow)) {
      changed.push(key);
    }
  }
  for (const key of projectedByKey.keys()) {
    if (!liveByKey.has(key)) extra.push(key);
  }

  return { missing, extra, changed };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/workflowReverseCompile.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write the backfill script**

`prisma/backfill-workflow-versions.ts`:

```ts
/**
 * Backfills an ACTIVE version 1 for every WorkflowType by reverse-compiling
 * the rows that exist today.
 *
 *   npm run workflow:backfill:shadow   -> compare only, write nothing
 *   npm run workflow:backfill          -> persist version 1 rows
 *
 * Shadow mode is the Phase 1 gate: it reverse-compiles each workflow, projects
 * the result straight back, and diffs against the live transition rows. Zero
 * differences everywhere means the compiler is faithful and safe to let write.
 */
import 'dotenv/config';
import prisma from '../src/utils/prisma';
import {
  diffProjection,
  projectGraph,
  reverseCompile,
  ProjectedTransition,
} from '../src/services/workflowCompiler.service';
import { validateStructure } from '../src/services/workflowValidator.service';

const SHADOW = process.argv.includes('--shadow');

async function liveTransitions(workflowTypeId: string): Promise<ProjectedTransition[]> {
  const rows = await prisma.workflowTransition.findMany({
    where: { workflowTypeId, isActive: true },
  });
  return rows.map((t) => ({
    tenantId: null,
    workflowTypeId,
    fromStatus: t.fromStatus,
    toStatus: t.toStatus,
    transitionLabel: t.transitionLabel,
    requiresComment: t.requiresComment,
    autoAssignRole: t.autoAssignRole,
    autoAssignUserId: t.autoAssignUserId,
    allowedRoles: t.allowedRoles,
    allowedExecutiveRoles: t.allowedExecutiveRoles,
    isActive: true,
  }));
}

async function main() {
  const workflowTypes = await prisma.workflowType.findMany({ orderBy: { code: 'asc' } });
  console.log(`${SHADOW ? 'SHADOW' : 'WRITE'} mode — ${workflowTypes.length} workflow types\n`);

  let discrepancies = 0;
  let invalid = 0;

  for (const wt of workflowTypes) {
    const graph = await reverseCompile(wt.id);
    const { transitions } = projectGraph(graph, wt.id);
    const live = await liveTransitions(wt.id);
    const diff = diffProjection(transitions, live);
    const faults = diff.missing.length + diff.extra.length + diff.changed.length;

    const validation = validateStructure(graph);
    if (validation.blocking.length > 0) invalid++;

    console.log(
      `${wt.code.padEnd(32)} nodes=${String(graph.nodes.length).padStart(3)} edges=${String(
        graph.edges.length,
      ).padStart(3)} diff=${faults} validation=${validation.blocking.length}`,
    );
    if (faults > 0) {
      discrepancies += faults;
      if (diff.missing.length) console.log(`   missing from projection: ${diff.missing.join(', ')}`);
      if (diff.extra.length) console.log(`   invented by projection:  ${diff.extra.join(', ')}`);
      if (diff.changed.length) console.log(`   rules differ:            ${diff.changed.join(', ')}`);
    }
    for (const finding of validation.blocking) {
      console.log(`   validation: ${finding.code} — ${finding.message}`);
    }

    if (SHADOW) continue;
    if (faults > 0) {
      console.log(`   SKIPPED write — resolve discrepancies first`);
      continue;
    }

    const existing = await prisma.workflowVersion.findFirst({
      where: { workflowTypeId: wt.id, version: 1 },
    });
    if (existing) {
      console.log(`   version 1 already exists — skipped`);
      continue;
    }

    await prisma.$transaction(async (tx: any) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowTypeId: wt.id,
          version: 1,
          status: 'ACTIVE',
          notes: 'Backfilled from existing workflow steps and transitions',
          publishedAt: new Date(),
        },
      });
      await tx.workflowNode.createMany({
        data: graph.nodes.map((n) => ({
          id: n.id,
          workflowVersionId: version.id,
          type: 'STATUS',
          statusCode: n.statusCode,
          positionX: null,
          positionY: null,
          isInitial: n.isInitial,
          isFinal: n.isFinal,
          slaPause: n.slaPause,
          icon: n.icon,
        })),
      });
      await tx.workflowEdge.createMany({
        data: graph.edges.map((e) => ({
          id: e.id,
          workflowVersionId: version.id,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          transitionLabel: e.transitionLabel,
          requiresComment: e.requiresComment,
          autoAssignRole: e.autoAssignRole,
          autoAssignUserId: e.autoAssignUserId,
          allowedRoles: e.allowedRoles,
          allowedExecutiveRoles: e.allowedExecutiveRoles,
        })),
      });
    });
    console.log(`   wrote version 1`);
  }

  console.log(`\ntotal discrepancies: ${discrepancies}`);
  console.log(`workflows failing validation: ${invalid}`);
  if (SHADOW && discrepancies === 0) {
    console.log('\nGATE PASSED — compiler reproduces live rows exactly.');
  }
  if (SHADOW && discrepancies > 0) {
    console.log('\nGATE FAILED — do not proceed to Phase 2 until this is zero.');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Add the npm scripts**

In `backend/package.json`, alongside the other `prisma:*` scripts:

```json
"workflow:backfill": "tsx prisma/backfill-workflow-versions.ts",
"workflow:backfill:shadow": "tsx prisma/backfill-workflow-versions.ts --shadow",
```

- [ ] **Step 7: Run shadow mode — this is the Phase 1 gate**

Run: `npm run workflow:backfill:shadow`
Expected: a line per workflow type, `total discrepancies: 0`, and `GATE PASSED`.

If discrepancies are non-zero, **stop and fix the compiler** — do not continue to Task 6. A discrepancy means compiling would change what the runtime enforces.

If `workflows failing validation` is non-zero, that is a real pre-existing defect in an existing workflow (spec Phase 2). Record which workflow and which finding, and raise it — it must be resolved before that workflow can ever be published from the designer.

- [ ] **Step 8: Run the write mode**

Run: `npm run workflow:backfill`
Expected: `wrote version 1` for each workflow type.

- [ ] **Step 9: Verify enforcement is unchanged**

Run: `npx jest src/services/__tests__/transitionPolicy.test.ts`
Expected: 6 passed. The backfill only writes new tables, so this must still pass.

- [ ] **Step 10: Commit**

```bash
git add src/services/workflowCompiler.service.ts src/services/__tests__/workflowReverseCompile.test.ts prisma/backfill-workflow-versions.ts package.json
git commit -m "feat(workflow): backfill version 1 from existing rows with shadow verification"
```

---

## Task 6: Version lifecycle service

**Files:**
- Create: `backend/src/services/workflowVersion.service.ts`
- Test: `backend/src/services/__tests__/workflowVersion.test.ts`

**Interfaces:**
- Consumes: `loadGraph`, `compileVersion` (Task 4); `validateGraph` (Task 3)
- Produces:
  - `listVersions(workflowTypeId: string)`
  - `createDraft(workflowTypeId: string): Promise<{ id: string; version: number }>`
  - `getVersionDetail(versionId: string): Promise<{ version: unknown; graph: WorkflowGraph; validation: ValidationResult }>`
  - `publishVersion(versionId: string, userId: string): Promise<{ version: number; transitionCount: number; stepCount: number }>`
  - `rollbackToVersion(versionId: string, userId: string): Promise<{ version: number }>`
  - `discardDraft(versionId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/workflowVersion.test.ts`:

```ts
const mockTx = {
  workflowVersion: { updateMany: jest.fn(), update: jest.fn(), create: jest.fn() },
  workflowNode: { createMany: jest.fn() },
  workflowEdge: { createMany: jest.fn() },
};
const mockPrisma = {
  workflowVersion: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockValidateGraph = jest.fn();
jest.mock('../workflowValidator.service', () => ({
  validateGraph: (...args: unknown[]) => mockValidateGraph(...args),
}));

const mockCompileVersion = jest.fn();
const mockLoadGraph = jest.fn();
jest.mock('../workflowCompiler.service', () => ({
  compileVersion: (...args: unknown[]) => mockCompileVersion(...args),
  loadGraph: (...args: unknown[]) => mockLoadGraph(...args),
}));

import {
  createDraft,
  discardDraft,
  publishVersion,
  rollbackToVersion,
} from '../workflowVersion.service';

const emptyGraph = { nodes: [], edges: [] };

describe('createDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.aggregate.mockResolvedValue({ _max: { version: 3 } });
    mockTx.workflowVersion.create.mockResolvedValue({ id: 'v4', version: 4 });
  });

  it('rejects a second draft for the same workflow', async () => {
    mockPrisma.workflowVersion.findFirst.mockResolvedValue({ id: 'existing-draft' });
    await expect(createDraft('wf1')).rejects.toThrow('already has an open draft');
  });

  it('numbers the new draft one above the highest existing version', async () => {
    mockPrisma.workflowVersion.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    await createDraft('wf1');
    expect(mockTx.workflowVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4, status: 'DRAFT' }) }),
    );
  });

  it('clones the active version\'s nodes and edges into the draft', async () => {
    mockPrisma.workflowVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'v3' });
    mockLoadGraph.mockResolvedValue({
      workflowTypeId: 'wf1',
      graph: {
        nodes: [
          {
            id: 'n1',
            type: 'STATUS',
            statusCode: 'NEW',
            positionX: 5,
            positionY: 6,
            isInitial: true,
            isFinal: false,
            slaPause: false,
            icon: 'add',
          },
        ],
        edges: [],
      },
    });

    await createDraft('wf1');
    expect(mockTx.workflowNode.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ statusCode: 'NEW', positionX: 5, isInitial: true })],
    });
  });
});

describe('publishVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v4',
      version: 4,
      status: 'DRAFT',
      workflowTypeId: 'wf1',
    });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
    mockCompileVersion.mockResolvedValue({ transitionCount: 2, stepCount: 3 });
  });

  it('refuses to publish when validation reports a blocking finding', async () => {
    mockValidateGraph.mockResolvedValue({
      blocking: [{ code: 'MISSING_INITIAL', message: 'Workflow needs exactly one starting status (found 0)' }],
      warnings: [],
    });
    await expect(publishVersion('v4', 'u1')).rejects.toThrow('starting status');
    expect(mockCompileVersion).not.toHaveBeenCalled();
  });

  it('archives the previously active version', async () => {
    await publishVersion('v4', 'u1');
    expect(mockTx.workflowVersion.updateMany).toHaveBeenCalledWith({
      where: { workflowTypeId: 'wf1', status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
  });

  it('marks the target version active and records the publisher', async () => {
    await publishVersion('v4', 'u1');
    expect(mockTx.workflowVersion.update).toHaveBeenCalledWith({
      where: { id: 'v4' },
      data: expect.objectContaining({ status: 'ACTIVE', publishedById: 'u1' }),
    });
  });

  it('compiles after activating, and returns the compile counts', async () => {
    const result = await publishVersion('v4', 'u1');
    expect(mockCompileVersion).toHaveBeenCalledWith('v4');
    expect(result).toEqual({ version: 4, transitionCount: 2, stepCount: 3 });
  });

  it('refuses to publish a version that is already active', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v3',
      version: 3,
      status: 'ACTIVE',
      workflowTypeId: 'wf1',
    });
    await expect(publishVersion('v3', 'u1')).rejects.toThrow('already active');
  });
});

describe('rollbackToVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v2',
      version: 2,
      status: 'ARCHIVED',
      workflowTypeId: 'wf1',
    });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
    mockCompileVersion.mockResolvedValue({ transitionCount: 1, stepCount: 2 });
  });

  it('re-validates before re-activating, because live requests have moved since', async () => {
    await rollbackToVersion('v2', 'u1');
    expect(mockValidateGraph).toHaveBeenCalledWith({ workflowTypeId: 'wf1', graph: emptyGraph });
  });

  it('refuses a rollback that would strand in-flight requests', async () => {
    mockValidateGraph.mockResolvedValue({
      blocking: [{ code: 'OCCUPIED_STATUS_NO_EXIT', message: '8 requests are in UNDER_REVIEW, which would have no available transitions' }],
      warnings: [],
    });
    await expect(rollbackToVersion('v2', 'u1')).rejects.toThrow('UNDER_REVIEW');
    expect(mockCompileVersion).not.toHaveBeenCalled();
  });

  it('rejects rolling back to a draft', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({
      id: 'v5',
      version: 5,
      status: 'DRAFT',
      workflowTypeId: 'wf1',
    });
    await expect(rollbackToVersion('v5', 'u1')).rejects.toThrow('archived');
  });
});

describe('discardDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a draft', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v4', status: 'DRAFT' });
    await discardDraft('v4');
    expect(mockPrisma.workflowVersion.delete).toHaveBeenCalledWith({ where: { id: 'v4' } });
  });

  it('refuses to delete a version that is not a draft', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v3', status: 'ACTIVE' });
    await expect(discardDraft('v3')).rejects.toThrow('Only a draft');
    expect(mockPrisma.workflowVersion.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowVersion.test.ts`
Expected: FAIL — `Cannot find module '../workflowVersion.service'`

- [ ] **Step 3: Implement the service**

`src/services/workflowVersion.service.ts`:

```ts
/**
 * Workflow version lifecycle. One ACTIVE version per WorkflowType — enforced in
 * the database by a partial unique index, and here by archiving before
 * activating inside a single transaction.
 */

import { randomUUID } from 'crypto';

import prisma from '../utils/prisma';
import { compileVersion, loadGraph } from './workflowCompiler.service';
import { validateGraph } from './workflowValidator.service';
import { ValidationResult, WorkflowGraph } from './workflowGraph.types';

export async function listVersions(workflowTypeId: string) {
  return prisma.workflowVersion.findMany({
    where: { workflowTypeId },
    orderBy: { version: 'desc' },
    include: { publishedBy: { select: { id: true, name: true } } },
  });
}

export async function createDraft(workflowTypeId: string): Promise<{ id: string; version: number }> {
  const openDraft = await prisma.workflowVersion.findFirst({
    where: { workflowTypeId, status: 'DRAFT' },
  });
  if (openDraft) {
    throw new Error('This workflow already has an open draft — edit or discard it first');
  }

  const highest = await prisma.workflowVersion.aggregate({
    where: { workflowTypeId },
    _max: { version: true },
  });
  const nextVersion = (highest._max.version ?? 0) + 1;

  const active = await prisma.workflowVersion.findFirst({
    where: { workflowTypeId, status: 'ACTIVE' },
  });

  let graph: WorkflowGraph = { nodes: [], edges: [] };
  if (active) {
    graph = (await loadGraph(active.id)).graph;
  }

  return prisma.$transaction(async (tx: any) => {
    const draft = await tx.workflowVersion.create({
      data: { workflowTypeId, version: nextVersion, status: 'DRAFT' },
    });

    // Clone with fresh ids, remapping edge endpoints onto them.
    const idMap = new Map<string, string>();
    if (graph.nodes.length > 0) {
      await tx.workflowNode.createMany({
        data: graph.nodes.map((n) => {
          const newId = randomUUID();
          idMap.set(n.id, newId);
          return {
            id: newId,
            workflowVersionId: draft.id,
            type: 'STATUS',
            statusCode: n.statusCode,
            positionX: n.positionX,
            positionY: n.positionY,
            isInitial: n.isInitial,
            isFinal: n.isFinal,
            slaPause: n.slaPause,
            icon: n.icon,
          };
        }),
      });
    }
    if (graph.edges.length > 0) {
      await tx.workflowEdge.createMany({
        data: graph.edges.map((e) => ({
          workflowVersionId: draft.id,
          fromNodeId: idMap.get(e.fromNodeId)!,
          toNodeId: idMap.get(e.toNodeId)!,
          transitionLabel: e.transitionLabel,
          requiresComment: e.requiresComment,
          autoAssignRole: e.autoAssignRole,
          autoAssignUserId: e.autoAssignUserId,
          allowedRoles: e.allowedRoles,
          allowedExecutiveRoles: e.allowedExecutiveRoles,
        })),
      });
    }

    return { id: draft.id, version: draft.version };
  });
}

export async function getVersionDetail(
  versionId: string,
): Promise<{ version: unknown; graph: WorkflowGraph; validation: ValidationResult }> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);

  const { workflowTypeId, graph } = await loadGraph(versionId);
  const validation = await validateGraph({ workflowTypeId, graph });
  return { version, graph, validation };
}

function describeBlocking(validation: ValidationResult): string {
  return validation.blocking.map((f) => f.message).join('; ');
}

export async function publishVersion(
  versionId: string,
  userId: string,
): Promise<{ version: number; transitionCount: number; stepCount: number }> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);
  if (version.status === 'ACTIVE') throw new Error('This version is already active');

  const { workflowTypeId, graph } = await loadGraph(versionId);
  const validation = await validateGraph({ workflowTypeId, graph });
  if (validation.blocking.length > 0) {
    throw new Error(`Cannot publish: ${describeBlocking(validation)}`);
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.workflowVersion.updateMany({
      where: { workflowTypeId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    await tx.workflowVersion.update({
      where: { id: versionId },
      data: { status: 'ACTIVE', publishedAt: new Date(), publishedById: userId },
    });
  });

  const compiled = await compileVersion(versionId);
  return { version: version.version, ...compiled };
}

export async function rollbackToVersion(
  versionId: string,
  userId: string,
): Promise<{ version: number }> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);
  if (version.status !== 'ARCHIVED') {
    throw new Error('Only an archived version can be rolled back to');
  }

  // Re-validate: live request positions have moved since this version was last
  // active, so a graph that was safe then may strand requests now.
  const { workflowTypeId, graph } = await loadGraph(versionId);
  const validation = await validateGraph({ workflowTypeId, graph });
  if (validation.blocking.length > 0) {
    throw new Error(`Cannot roll back: ${describeBlocking(validation)}`);
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.workflowVersion.updateMany({
      where: { workflowTypeId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    await tx.workflowVersion.update({
      where: { id: versionId },
      data: { status: 'ACTIVE', publishedAt: new Date(), publishedById: userId },
    });
  });

  await compileVersion(versionId);
  return { version: version.version };
}

export async function discardDraft(versionId: string): Promise<void> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);
  if (version.status !== 'DRAFT') throw new Error('Only a draft can be discarded');

  // Nodes and edges cascade.
  await prisma.workflowVersion.delete({ where: { id: versionId } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/workflowVersion.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/workflowVersion.service.ts src/services/__tests__/workflowVersion.test.ts
git commit -m "feat(workflow): add version lifecycle with publish and rollback"
```

---

## Task 7: Graph editing service

**Files:**
- Create: `backend/src/services/workflowGraph.service.ts`
- Test: `backend/src/services/__tests__/workflowGraphService.test.ts`

**Interfaces:**
- Consumes: `GraphNode`, `GraphEdge` from Task 2
- Produces:
  - `NodeInput`, `EdgeInput` types
  - `upsertNodes(versionId: string, nodes: NodeInput[]): Promise<void>`
  - `deleteNodes(versionId: string, nodeIds: string[]): Promise<void>`
  - `upsertEdges(versionId: string, edges: EdgeInput[]): Promise<void>`
  - `deleteEdges(versionId: string, edgeIds: string[]): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/workflowGraphService.test.ts`:

```ts
const mockPrisma = {
  workflowVersion: { findUnique: jest.fn() },
  workflowNode: { upsert: jest.fn(), deleteMany: jest.fn() },
  workflowEdge: { upsert: jest.fn(), deleteMany: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { deleteEdges, deleteNodes, upsertEdges, upsertNodes } from '../workflowGraph.service';

const nodeInput = {
  id: 'n1',
  statusCode: 'NEW',
  positionX: 12,
  positionY: 34,
  isInitial: true,
  isFinal: false,
  slaPause: false,
  icon: 'add',
};

const edgeInput = {
  id: 'e1',
  fromNodeId: 'n1',
  toNodeId: 'n2',
  transitionLabel: 'SUBMIT',
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: ['AGENT'],
  allowedExecutiveRoles: [],
};

describe('draft-only enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['ACTIVE'],
    ['ARCHIVED'],
  ])('rejects node writes to a %s version', async (status) => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status });
    await expect(upsertNodes('v1', [nodeInput])).rejects.toThrow('Only a draft version can be edited');
    expect(mockPrisma.workflowNode.upsert).not.toHaveBeenCalled();
  });

  it('rejects edge writes to an ACTIVE version', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    await expect(upsertEdges('v1', [edgeInput])).rejects.toThrow('Only a draft version can be edited');
  });

  it('rejects node deletion on an ACTIVE version', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    await expect(deleteNodes('v1', ['n1'])).rejects.toThrow('Only a draft version can be edited');
  });

  it('throws when the version does not exist', async () => {
    mockPrisma.workflowVersion.findUnique.mockResolvedValue(null);
    await expect(upsertNodes('missing', [nodeInput])).rejects.toThrow('not found');
  });
});

describe('upsertNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
  });

  it('upserts each node scoped to the version', async () => {
    await upsertNodes('v1', [nodeInput]);
    expect(mockPrisma.workflowNode.upsert).toHaveBeenCalledWith({
      where: { id: 'n1' },
      create: expect.objectContaining({
        id: 'n1',
        workflowVersionId: 'v1',
        statusCode: 'NEW',
        positionX: 12,
      }),
      update: expect.objectContaining({ positionX: 12, positionY: 34, isInitial: true }),
    });
  });

  it('does not let an update reassign a node to another version', async () => {
    await upsertNodes('v1', [nodeInput]);
    const call = mockPrisma.workflowNode.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('workflowVersionId');
  });

  it('handles a batch of position-only moves', async () => {
    await upsertNodes('v1', [nodeInput, { ...nodeInput, id: 'n2', statusCode: 'CLOSED' }]);
    expect(mockPrisma.workflowNode.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('upsertEdges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
  });

  it('upserts each edge scoped to the version', async () => {
    await upsertEdges('v1', [edgeInput]);
    expect(mockPrisma.workflowEdge.upsert).toHaveBeenCalledWith({
      where: { id: 'e1' },
      create: expect.objectContaining({ id: 'e1', workflowVersionId: 'v1', fromNodeId: 'n1' }),
      update: expect.objectContaining({ transitionLabel: 'SUBMIT', allowedRoles: ['AGENT'] }),
    });
  });

  it('rejects a self-loop, which the status machine cannot express', async () => {
    await expect(
      upsertEdges('v1', [{ ...edgeInput, toNodeId: 'n1' }]),
    ).rejects.toThrow('cannot transition to itself');
  });
});

describe('deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v1', status: 'DRAFT' });
  });

  it('deletes nodes only within the given version', async () => {
    await deleteNodes('v1', ['n1', 'n2']);
    expect(mockPrisma.workflowNode.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] }, workflowVersionId: 'v1' },
    });
  });

  it('deletes edges only within the given version', async () => {
    await deleteEdges('v1', ['e1']);
    expect(mockPrisma.workflowEdge.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] }, workflowVersionId: 'v1' },
    });
  });

  it('is a no-op for an empty id list', async () => {
    await deleteNodes('v1', []);
    expect(mockPrisma.workflowNode.deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/workflowGraphService.test.ts`
Expected: FAIL — `Cannot find module '../workflowGraph.service'`

- [ ] **Step 3: Implement the service**

`src/services/workflowGraph.service.ts`:

```ts
/**
 * Node and edge editing inside a DRAFT version. Every entry point asserts the
 * target version is a draft, so a published graph can never be mutated in
 * place — the only way to change an active workflow is to draft, validate, and
 * publish.
 */

import prisma from '../utils/prisma';

export interface NodeInput {
  id: string;
  statusCode: string | null;
  positionX: number | null;
  positionY: number | null;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
  icon: string;
}

export interface EdgeInput {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionLabel: string | null;
  requiresComment: boolean;
  autoAssignRole: string | null;
  autoAssignUserId: string | null;
  allowedRoles: string[];
  allowedExecutiveRoles: string[];
}

async function assertDraft(versionId: string): Promise<void> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);
  if (version.status !== 'DRAFT') {
    throw new Error('Only a draft version can be edited — create a new draft to make changes');
  }
}

export async function upsertNodes(versionId: string, nodes: NodeInput[]): Promise<void> {
  await assertDraft(versionId);

  for (const node of nodes) {
    const shared = {
      statusCode: node.statusCode,
      positionX: node.positionX,
      positionY: node.positionY,
      isInitial: node.isInitial,
      isFinal: node.isFinal,
      slaPause: node.slaPause,
      icon: node.icon,
    };
    await prisma.workflowNode.upsert({
      where: { id: node.id },
      create: { id: node.id, workflowVersionId: versionId, type: 'STATUS', ...shared },
      // workflowVersionId is deliberately absent: an update must never move a
      // node between versions.
      update: shared,
    });
  }
}

export async function deleteNodes(versionId: string, nodeIds: string[]): Promise<void> {
  await assertDraft(versionId);
  if (nodeIds.length === 0) return;

  // Edges cascade from the node foreign keys.
  await prisma.workflowNode.deleteMany({
    where: { id: { in: nodeIds }, workflowVersionId: versionId },
  });
}

export async function upsertEdges(versionId: string, edges: EdgeInput[]): Promise<void> {
  await assertDraft(versionId);

  for (const edge of edges) {
    if (edge.fromNodeId === edge.toNodeId) {
      throw new Error('A status cannot transition to itself');
    }

    const shared = {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      transitionLabel: edge.transitionLabel,
      requiresComment: edge.requiresComment,
      autoAssignRole: edge.autoAssignRole,
      autoAssignUserId: edge.autoAssignUserId,
      allowedRoles: edge.allowedRoles,
      allowedExecutiveRoles: edge.allowedExecutiveRoles,
    };
    await prisma.workflowEdge.upsert({
      where: { id: edge.id },
      create: { id: edge.id, workflowVersionId: versionId, ...shared },
      update: shared,
    });
  }
}

export async function deleteEdges(versionId: string, edgeIds: string[]): Promise<void> {
  await assertDraft(versionId);
  if (edgeIds.length === 0) return;

  await prisma.workflowEdge.deleteMany({
    where: { id: { in: edgeIds }, workflowVersionId: versionId },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/workflowGraphService.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/workflowGraph.service.ts src/services/__tests__/workflowGraphService.test.ts
git commit -m "feat(workflow): add draft-only graph editing service"
```

---

## Task 8: Controller, routes, wiring

**Files:**
- Create: `backend/src/controllers/workflowVersion.controller.ts`
- Create: `backend/src/routes/workflowVersion.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 3, 4, 6, 7
- Produces: the HTTP surface listed in the spec §4.2

- [ ] **Step 1: Write the controller**

`src/controllers/workflowVersion.controller.ts`:

```ts
import { Request, Response } from 'express';

import { asyncHandler } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import * as graphService from '../services/workflowGraph.service';
import * as versionService from '../services/workflowVersion.service';

/** Express augments Request with `user` in the auth middleware. */
interface AuthedRequest extends Request {
  user?: { id: string };
}

export class WorkflowVersionController {
  /** Workflow list with active version, bound request types, and draft flag. */
  list = asyncHandler(async (_req: Request, res: Response) => {
    const workflowTypes = await prisma.workflowType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        requestTypes: { select: { id: true, name: true } },
        versions: {
          where: { status: { in: ['ACTIVE', 'DRAFT'] } },
          select: { id: true, version: true, status: true, publishedAt: true },
        },
      },
    });

    const workflows = workflowTypes.map((wt) => ({
      id: wt.id,
      code: wt.code,
      name: wt.name,
      requestTypes: wt.requestTypes,
      activeVersion: wt.versions.find((v) => v.status === 'ACTIVE') ?? null,
      draftVersion: wt.versions.find((v) => v.status === 'DRAFT') ?? null,
    }));

    res.json({ status: 'success', data: { workflows } });
  });

  listVersions = asyncHandler(async (req: Request, res: Response) => {
    const versions = await versionService.listVersions(req.params.workflowTypeId);
    res.json({ status: 'success', data: { versions } });
  });

  createDraft = asyncHandler(async (req: Request, res: Response) => {
    const draft = await versionService.createDraft(req.params.workflowTypeId);
    res.status(201).json({ status: 'success', data: { draft } });
  });

  getVersion = asyncHandler(async (req: Request, res: Response) => {
    const detail = await versionService.getVersionDetail(req.params.versionId);
    res.json({ status: 'success', data: detail });
  });

  updateNodes = asyncHandler(async (req: Request, res: Response) => {
    const { upsert = [], remove = [] } = req.body;
    if (!Array.isArray(upsert) || !Array.isArray(remove)) {
      res.status(400).json({ status: 'error', message: 'upsert and remove must be arrays' });
      return;
    }
    await graphService.upsertNodes(req.params.versionId, upsert);
    await graphService.deleteNodes(req.params.versionId, remove);
    res.json({ status: 'success', data: { upserted: upsert.length, removed: remove.length } });
  });

  updateEdges = asyncHandler(async (req: Request, res: Response) => {
    const { upsert = [], remove = [] } = req.body;
    if (!Array.isArray(upsert) || !Array.isArray(remove)) {
      res.status(400).json({ status: 'error', message: 'upsert and remove must be arrays' });
      return;
    }
    await graphService.upsertEdges(req.params.versionId, upsert);
    await graphService.deleteEdges(req.params.versionId, remove);
    res.json({ status: 'success', data: { upserted: upsert.length, removed: remove.length } });
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const { validation } = await versionService.getVersionDetail(req.params.versionId);
    res.json({ status: 'success', data: { validation } });
  });

  publish = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await versionService.publishVersion(req.params.versionId, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  rollback = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await versionService.rollbackToVersion(req.params.versionId, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  discard = asyncHandler(async (req: Request, res: Response) => {
    await versionService.discardDraft(req.params.versionId);
    res.json({ status: 'success', data: { discarded: true } });
  });
}
```

- [ ] **Step 2: Write the routes**

`src/routes/workflowVersion.routes.ts`:

```ts
import { Router } from 'express';

import { WorkflowVersionController } from '../controllers/workflowVersion.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();
const controller = new WorkflowVersionController();
const manage = requirePermission('workflow:manage');

router.get('/', authenticate, controller.list);
router.get('/:workflowTypeId/versions', authenticate, controller.listVersions);
router.post('/:workflowTypeId/versions', authenticate, manage, controller.createDraft);

router.get('/versions/:versionId', authenticate, controller.getVersion);
router.patch('/versions/:versionId/nodes', authenticate, manage, controller.updateNodes);
router.patch('/versions/:versionId/edges', authenticate, manage, controller.updateEdges);
router.post('/versions/:versionId/validate', authenticate, controller.validate);
router.post('/versions/:versionId/publish', authenticate, manage, controller.publish);
router.post('/versions/:versionId/rollback', authenticate, manage, controller.rollback);
router.delete('/versions/:versionId', authenticate, manage, controller.discard);

export default router;
```

Read routes require only `authenticate`, matching how `workflowTransition.routes.ts` leaves `GET /` open to any authenticated user — this is what gives Phase 4's read-only viewer a surface without a second permission.

- [ ] **Step 3: Mount the router**

In `src/routes/index.ts`, alongside the existing workflow imports (~line 26):

```ts
import workflowVersionRoutes from './workflowVersion.routes';
```

And alongside the existing admin mounts (~line 83):

```ts
router.use('/admin/workflows', workflowVersionRoutes);
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Lint the new files**

Run: `npx eslint src/services/workflow*.ts src/controllers/workflowVersion.controller.ts src/routes/workflowVersion.routes.ts`
Expected: no errors. Warnings are acceptable — this repo carries ~1,500 pre-existing warnings and zero errors.

- [ ] **Step 6: Re-run every test written in this plan**

Run:
```bash
npx jest src/services/__tests__/workflowValidatorStructure.test.ts \
         src/services/__tests__/workflowValidatorLiveData.test.ts \
         src/services/__tests__/workflowCompiler.test.ts \
         src/services/__tests__/workflowReverseCompile.test.ts \
         src/services/__tests__/workflowVersion.test.ts \
         src/services/__tests__/workflowGraphService.test.ts \
         src/services/__tests__/transitionPolicy.test.ts
```
Expected: 7 suites pass, 73 tests (13 + 8 + 9 + 11 + 13 + 13 + 6).

- [ ] **Step 7: Smoke-test the API against the dev server**

Start the server (`npm run dev`), then with an admin token from `admin@test.local` / `abc@123`:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.local","password":"abc@123"}' | jq -r '.data.token')

# Workflows, with backfilled active versions
curl -s localhost:3000/api/v1/admin/workflows -H "Authorization: Bearer $TOKEN" | jq '.data.workflows[0]'

# Full graph + validation for that active version
VERSION=$(curl -s localhost:3000/api/v1/admin/workflows -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data.workflows[0].activeVersion.id')
curl -s localhost:3000/api/v1/admin/workflows/versions/$VERSION \
  -H "Authorization: Bearer $TOKEN" | jq '{nodes: (.data.graph.nodes | length), edges: (.data.graph.edges | length), blocking: .data.validation.blocking}'
```

Expected: the first call lists workflows with a non-null `activeVersion` and its bound request types; the second returns nodes and edges matching the backfill output, with an empty `blocking` array.

- [ ] **Step 8: Confirm a published graph cannot be edited in place**

```bash
curl -s -X PATCH localhost:3000/api/v1/admin/workflows/versions/$VERSION/nodes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"upsert":[],"remove":[]}' | jq
```
Expected: an error mentioning "Only a draft version can be edited". This is the safety property the whole draft/publish boundary exists for, so verify it by hand rather than trusting the unit test alone.

- [ ] **Step 9: Commit**

```bash
git add src/controllers/workflowVersion.controller.ts src/routes/workflowVersion.routes.ts src/routes/index.ts
git commit -m "feat(workflow): expose workflow version authoring API"
```

---

## Done criteria

- [ ] Three new tables exist, with the partial unique index enforcing one `ACTIVE` version per workflow.
- [ ] `npm run workflow:backfill:shadow` reports **zero discrepancies** — the compiler reproduces live rows exactly.
- [ ] Every `WorkflowType` has an `ACTIVE` version 1.
- [ ] Any existing workflow that fails validation has been recorded and raised as a pre-existing defect.
- [ ] `src/services/transitionPolicy.service.ts`, `requestTransition.service.ts`, `transitionGuards.ts`, and `src/utils/workflowTransitions.ts` are **unmodified** — confirm with `git diff --stat main -- src/services/transitionPolicy.service.ts src/services/requestTransition.service.ts src/services/transitionGuards.ts src/utils/workflowTransitions.ts` returning empty.
- [ ] `WorkflowTransition` rows with `workflowTypeId IS NULL` are untouched by any compile.
- [ ] 73 tests pass across the 7 suites listed in Task 8 Step 6.
- [ ] `npm run build` succeeds.
- [ ] A draft can be created, edited, validated, published, and rolled back through the API.

## Follow-on plans

- **Plan 2 — Phase 3:** `resolveAvailableActions` resolver, Redis caching keyed by `(workflowTypeId, status, role-set)` invalidated on publish, and deletion of `frontend/src/utils/workflowTransitions.ts` with all call sites migrated.
- **Plan 3 — Phases 4–5:** `@xyflow/react` + `dagre` designer UI, read-only first, then drafts, inspectors, and the publish dialog.
