# Workflow Status Remap on Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When publishing a draft workflow version would remove a status that live requests occupy, let the admin map those requests onto a surviving status and apply the move atomically inside the publish transaction.

**Architecture:** A new `statusRemap.service.ts` owns two concerns — planning (compute stranded statuses and suggest targets by walking the active version's edges) and applying (move requests, write audit rows). The existing validator gains an optional `statusRemap` input so a mapped status stops producing a blocking finding, plus four new blocking codes that validate the mapping itself. `publishVersion()` threads the mapping through validation and application. The frontend turns the Publish dialog into a two-step flow when a remap plan exists.

**Tech Stack:** Node 22, Express, TypeScript, Prisma 5.22 + PostgreSQL, Jest (backend); React 19, Vite, React Flow, Vitest + Testing Library (frontend).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-workflow-status-remap-on-publish-design.md`. Read it before starting.
- **No Prisma migration.** The mapping is a transient publish input; the durable record is per-request audit rows.
- **SLA columns are never written by the remap:** `slaPausedAt`, `slaDueAt`, `slaPauseDurationMs` pass through untouched. Mismatches are surfaced as a non-blocking UI warning.
- `request.version` **is** incremented on a remap, because it is the optimistic-concurrency counter that every other status change bumps (see `workflowCommand.service.ts:283`). `requestVersion` on the history row is the post-increment value.
- Audit source string is exactly `workflow_version_publish_remap` in both `workflowHistory.source` and activity metadata.
- Volume cap env var is `WORKFLOW_REMAP_MAX_REQUESTS`, default `1000`.
- Backend indent is 2 spaces in `src/services/` and `src/controllers/`, 4 spaces in `src/config/index.ts`. Match the file you are editing.
- Backend tests mock Prisma — no test database. Follow the `mockPrisma` / `jest.mock('../../utils/prisma')` pattern already used in `src/services/__tests__/workflowVersion.test.ts`.
- Run backend tests from `backend/`: `npm test -- <path>`. Run frontend tests from `frontend/`: `npx vitest run <path>`.
- Do not add a remap path to `rollbackToVersion()`. Out of scope.

## File Structure

**Backend — create**
- `src/services/statusRemap.service.ts` — occupancy loading, remap planning, remap application.
- `src/services/__tests__/statusRemap.test.ts` — planning + application tests.

**Backend — modify**
- `src/config/index.ts` — add `workflow.remapMaxRequests`.
- `src/services/workflowGraph.types.ts` — four new finding codes, `RemapEntry` / `RemapPlan` types.
- `src/services/workflowValidator.service.ts` — optional `statusRemap` on `ValidateGraphInput`; use shared occupancy loader; emit new codes.
- `src/services/workflowVersion.service.ts` — `publishVersion` accepts and applies a mapping; `getVersionDetail` returns `remapPlan`.
- `src/controllers/workflowVersion.controller.ts` — validate the `statusRemap` body; `validate` endpoint returns `remapPlan`.
- `src/services/__tests__/workflowValidatorLiveData.test.ts`, `src/services/__tests__/workflowVersion.test.ts`, `src/controllers/__tests__/workflowVersion.controller.test.ts` — extend.

**Frontend — modify**
- `src/services/workflow-version.service.ts` — `RemapEntry` / `RemapPlan` types, `remapPlan` on detail and validate responses, `publishVersion(versionId, statusRemap?)`.
- `src/components/workflow/PublishDialog.tsx` — two-step flow.
- `src/components/workflow/ValidationPanel.tsx` — "Resolve on publish" hint.
- `src/hooks/useWorkflowGraph.ts` — hold and refresh `remapPlan`.
- `pages/WorkflowDesigner.tsx` — pass the plan down, pass the mapping up, relax the Publish button gate.

**Frontend — create**
- `src/components/workflow/__tests__/PublishDialog.test.tsx`

---

### Task 1: Types and config cap

**Files:**
- Modify: `backend/src/services/workflowGraph.types.ts`
- Modify: `backend/src/config/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FindingCode` members `REMAP_TARGET_MISSING`, `REMAP_TARGET_NO_EXIT`, `REMAP_SELF`, `REMAP_VOLUME_EXCEEDED`; interfaces `RemapEntry`, `RemapPlan`; `config.workflow.remapMaxRequests: number`.

- [ ] **Step 1: Add the four finding codes**

In `workflowGraph.types.ts`, extend the `FindingCode` union — add these after `'REJECT_WITHOUT_COMMENT'`:

```ts
  | 'REJECT_WITHOUT_COMMENT'
  | 'REMAP_TARGET_MISSING'
  | 'REMAP_TARGET_NO_EXIT'
  | 'REMAP_SELF'
  | 'REMAP_VOLUME_EXCEEDED';
```

- [ ] **Step 2: Add the remap plan types**

Append to the end of `workflowGraph.types.ts`:

```ts
/** One status that the draft removes while live requests still occupy it. */
export interface RemapEntry {
  statusCode: string;
  requestCount: number;
  /** Nearest surviving status reachable from this one in the ACTIVE version, or null. */
  suggestedTarget: string | null;
  /** Human-readable provenance for the suggestion, e.g. "v3 allows A → B". */
  suggestionReason: string;
  /** Every surviving status code in the draft. */
  allowedTargets: string[];
  /** Whether the removed status paused the SLA — drives the UI mismatch warning. */
  sourcePausesSla: boolean;
}

export interface RemapPlan {
  entries: RemapEntry[];
  totalRequests: number;
}
```

- [ ] **Step 3: Add the volume cap to config**

In `src/config/index.ts`, add this block inside the exported `config` object, after the `redis` block (note: this file uses 4-space indent):

```ts
    // Workflow designer
    workflow: {
        remapMaxRequests: parseInt(process.env.WORKFLOW_REMAP_MAX_REQUESTS || '1000', 10),
    },
```

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors from `workflowGraph.types.ts` or `config/index.ts`. (Pre-existing errors elsewhere in the repo are acceptable — compare against `git stash` baseline if unsure.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowGraph.types.ts backend/src/config/index.ts
git commit -m "feat(workflow): add remap finding codes, plan types, and volume cap"
```

---

### Task 2: Occupancy loader and remap planner

**Files:**
- Create: `backend/src/services/statusRemap.service.ts`
- Create: `backend/src/services/__tests__/statusRemap.test.ts`

**Interfaces:**
- Consumes: `RemapEntry`, `RemapPlan`, `WorkflowGraph`, `GraphNode` from `./workflowGraph.types`; `loadGraph` from `./workflowCompiler.service`.
- Produces:
  - `loadRequestTypeIds(workflowTypeId: string, client?: any): Promise<string[]>`
  - `loadOccupancy(workflowTypeId: string, client?: any): Promise<Map<string, number>>`
  - `planStatusRemap(input: { workflowTypeId: string; draftGraph: WorkflowGraph }, client?: any): Promise<RemapPlan>`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/__tests__/statusRemap.test.ts`:

```ts
const mockPrisma = {
  requestType: { findMany: jest.fn() },
  request: { groupBy: jest.fn() },
  workflowVersion: { findFirst: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockLoadGraph = jest.fn();
jest.mock('../workflowCompiler.service', () => ({
  loadGraph: (...args: unknown[]) => mockLoadGraph(...args),
}));

import { planStatusRemap } from '../statusRemap.service';
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
  allowedRoles: [],
  allowedExecutiveRoles: [],
  ...over,
});

/** ACTIVE version: NEW → REVIEW → ACTION → PROGRESS → DONE */
const activeGraph = (): WorkflowGraph => ({
  nodes: [
    node('NEW', { isInitial: true }),
    node('REVIEW'),
    node('ACTION', { slaPause: true }),
    node('PROGRESS'),
    node('DONE', { isFinal: true }),
  ],
  edges: [edge('NEW', 'REVIEW'), edge('REVIEW', 'ACTION'), edge('ACTION', 'PROGRESS'), edge('PROGRESS', 'DONE')],
});

const setup = (occupancy: Record<string, number>, active: WorkflowGraph = activeGraph()) => {
  mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
  mockPrisma.request.groupBy.mockResolvedValue(
    Object.entries(occupancy).map(([status, count]) => ({ status, _count: { _all: count } })),
  );
  mockPrisma.workflowVersion.findFirst.mockResolvedValue({ id: 'active-version' });
  mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: active });
};

describe('planStatusRemap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty plan when every occupied status survives', async () => {
    setup({ NEW: 3, PROGRESS: 1 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries).toEqual([]);
    expect(plan.totalRequests).toBe(0);
  });

  it('suggests the depth-1 successor that survives in the draft', async () => {
    setup({ ACTION: 2 });
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS'), node('DONE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({
      statusCode: 'ACTION',
      requestCount: 2,
      suggestedTarget: 'PROGRESS',
      sourcePausesSla: true,
    });
    expect(plan.entries[0].allowedTargets).toEqual(['DONE', 'NEW', 'PROGRESS']);
    expect(plan.totalRequests).toBe(2);
  });

  it('walks past a removed successor to the next surviving status', async () => {
    setup({ REVIEW: 1 });
    // ACTION is also removed, so REVIEW must reach PROGRESS at depth 2.
    const draftGraph: WorkflowGraph = { nodes: [node('NEW'), node('PROGRESS'), node('DONE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBe('PROGRESS');
  });

  it('suggests nothing when no surviving status is reachable', async () => {
    setup({ PROGRESS: 1 });
    // Only NEW survives, and PROGRESS cannot reach it.
    const draftGraph: WorkflowGraph = { nodes: [node('NEW')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
    expect(plan.entries[0].suggestionReason).toBe('No surviving status is reachable — choose a target manually');
  });

  it('terminates on a cycle in the active graph', async () => {
    const cyclic: WorkflowGraph = {
      nodes: [node('A'), node('B'), node('SAFE')],
      edges: [edge('A', 'B'), edge('B', 'A')],
    };
    setup({ A: 1 }, cyclic);
    const draftGraph: WorkflowGraph = { nodes: [node('SAFE')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
  });

  it('breaks ties at the same depth by edge order', async () => {
    const fanOut: WorkflowGraph = {
      nodes: [node('A'), node('X'), node('Y')],
      edges: [edge('A', 'Y'), edge('A', 'X')],
    };
    setup({ A: 1 }, fanOut);
    const draftGraph: WorkflowGraph = { nodes: [node('X'), node('Y')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBe('Y');
  });

  it('returns an empty plan when the workflow type has no request types', async () => {
    mockPrisma.requestType.findMany.mockResolvedValue([]);
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph: { nodes: [], edges: [] } });
    expect(plan.entries).toEqual([]);
  });

  it('returns an empty plan when there is no active version to walk', async () => {
    setup({ ACTION: 1 });
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(null);
    const draftGraph: WorkflowGraph = { nodes: [node('PROGRESS')], edges: [] };
    const plan = await planStatusRemap({ workflowTypeId: 'wf1', draftGraph });
    expect(plan.entries[0].suggestedTarget).toBeNull();
    expect(plan.entries[0].allowedTargets).toEqual(['PROGRESS']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- src/services/__tests__/statusRemap.test.ts`
Expected: FAIL — `Cannot find module '../statusRemap.service'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/statusRemap.service.ts`:

```ts
/**
 * Status remap on publish. When a draft removes a status that live requests
 * still occupy, publishing must either be blocked or those requests moved.
 * This service plans the move (what is stranded, where should it go) and
 * applies it inside the publish transaction.
 *
 * The suggestion walks the currently-ACTIVE version's edges, so the proposed
 * target is a hop the workflow already sanctions rather than a guess.
 */

import prisma from '../utils/prisma';
import { loadGraph } from './workflowCompiler.service';
import { GraphNode, RemapEntry, RemapPlan, WorkflowGraph } from './workflowGraph.types';

export async function loadRequestTypeIds(workflowTypeId: string, client: any = prisma): Promise<string[]> {
  const requestTypes = await client.requestType.findMany({
    where: { workflowTypeId },
    select: { id: true },
  });
  return requestTypes.map((rt: { id: string }) => rt.id);
}

/** Live request counts by status across every request type bound to this workflow. */
export async function loadOccupancy(workflowTypeId: string, client: any = prisma): Promise<Map<string, number>> {
  const requestTypeIds = await loadRequestTypeIds(workflowTypeId, client);
  if (requestTypeIds.length === 0) return new Map();

  const rows = await client.request.groupBy({
    by: ['status'],
    where: { requestTypeId: { in: requestTypeIds } },
    _count: { _all: true },
  });

  const occupancy = new Map<string, number>();
  for (const row of rows) {
    if (row._count._all > 0) occupancy.set(row.status, row._count._all);
  }
  return occupancy;
}

/**
 * Breadth-first over the active graph from `startNode`, returning the status
 * code of the first node that survives in the draft. Depth 1 beats depth 2;
 * ties at the same depth are broken by edge declaration order, so the result
 * is deterministic. Returns null when nothing surviving is reachable.
 */
function nearestSurvivor(
  startNode: GraphNode,
  activeGraph: WorkflowGraph,
  surviving: Set<string>,
): string | null {
  const nodesById = new Map(activeGraph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const edge of activeGraph.edges) {
    if (!nodesById.has(edge.fromNodeId) || !nodesById.has(edge.toNodeId)) continue;
    const list = outgoing.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, list);
  }

  const visited = new Set<string>([startNode.id]);
  let frontier = outgoing.get(startNode.id) ?? [];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      const candidate = nodesById.get(id);
      if (candidate?.statusCode && surviving.has(candidate.statusCode)) return candidate.statusCode;
      next.push(...(outgoing.get(id) ?? []));
    }
    frontier = next;
  }
  return null;
}

export interface PlanStatusRemapInput {
  workflowTypeId: string;
  /** The graph being published. */
  draftGraph: WorkflowGraph;
}

export async function planStatusRemap(
  input: PlanStatusRemapInput,
  client: any = prisma,
): Promise<RemapPlan> {
  const { workflowTypeId, draftGraph } = input;

  const occupancy = await loadOccupancy(workflowTypeId, client);
  if (occupancy.size === 0) return { entries: [], totalRequests: 0 };

  const surviving = new Set(
    draftGraph.nodes.map((n) => n.statusCode).filter((code): code is string => Boolean(code)),
  );
  const stranded = [...occupancy.entries()].filter(([status]) => !surviving.has(status));
  if (stranded.length === 0) return { entries: [], totalRequests: 0 };

  const active = await client.workflowVersion.findFirst({
    where: { workflowTypeId, status: 'ACTIVE' },
    select: { id: true, version: true },
  });
  const activeGraph: WorkflowGraph = active
    ? (await loadGraph(active.id, client)).graph
    : { nodes: [], edges: [] };
  const activeByStatus = new Map(
    activeGraph.nodes
      .filter((n) => n.statusCode !== null)
      .map((n) => [n.statusCode as string, n]),
  );

  const allowedTargets = [...surviving].sort();
  const entries: RemapEntry[] = stranded
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([statusCode, requestCount]) => {
      const activeNode = activeByStatus.get(statusCode);
      const suggestedTarget = activeNode ? nearestSurvivor(activeNode, activeGraph, surviving) : null;
      return {
        statusCode,
        requestCount,
        suggestedTarget,
        suggestionReason: suggestedTarget
          ? `v${active.version} allows ${statusCode} → ${suggestedTarget}`
          : 'No surviving status is reachable — choose a target manually',
        allowedTargets,
        sourcePausesSla: activeNode?.slaPause ?? false,
      };
    });

  return {
    entries,
    totalRequests: entries.reduce((sum, entry) => sum + entry.requestCount, 0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- src/services/__tests__/statusRemap.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/statusRemap.service.ts backend/src/services/__tests__/statusRemap.test.ts
git commit -m "feat(workflow): plan status remap by walking active version edges"
```

---

### Task 3: Validator honours the mapping

**Files:**
- Modify: `backend/src/services/workflowValidator.service.ts:215-273`
- Modify: `backend/src/services/__tests__/workflowValidatorLiveData.test.ts`

**Interfaces:**
- Consumes: `loadOccupancy` from `./statusRemap.service`; `config` from `../config`.
- Produces: `ValidateGraphInput` gains `statusRemap?: Record<string, string>`; `validateLiveData` and `validateGraph` honour it.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/services/__tests__/workflowValidatorLiveData.test.ts` (inside the existing top-level scope; the file's `graph()` helper builds `NEW → IN_PROGRESS → CLOSED`):

```ts
describe('validateLiveData with a status remap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
  });

  const occupy = (status: string, count: number) =>
    mockPrisma.request.groupBy.mockResolvedValue([{ status, _count: { _all: count } }]);

  it('clears STATUS_IN_USE_REMOVED when the status is mapped to a survivor', async () => {
    occupy('LEGACY', 2);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    expect(findings.map((f) => f.code)).not.toContain('STATUS_IN_USE_REMOVED');
  });

  it('still blocks a stranded status that has no mapping', async () => {
    mockPrisma.request.groupBy.mockResolvedValue([
      { status: 'LEGACY', _count: { _all: 1 } },
      { status: 'ANCIENT', _count: { _all: 1 } },
    ]);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    const stranded = findings.filter((f) => f.code === 'STATUS_IN_USE_REMOVED');
    expect(stranded).toHaveLength(1);
    expect(stranded[0].message).toContain('ANCIENT');
  });

  it('blocks a mapping whose target is not in the draft', async () => {
    occupy('LEGACY', 1);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'NOT_A_STATUS' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_TARGET_MISSING');
  });

  it('blocks a mapping onto a non-final target with no outgoing edges', async () => {
    occupy('LEGACY', 1);
    const withDeadEnd = graph();
    withDeadEnd.nodes.push({
      id: 'PARKED',
      type: 'STATUS',
      statusCode: 'PARKED',
      positionX: 0,
      positionY: 0,
      isInitial: false,
      isFinal: false,
      slaPause: false,
      icon: 'radio_button_checked',
    });
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: withDeadEnd,
      statusRemap: { LEGACY: 'PARKED' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_TARGET_NO_EXIT');
  });

  it('blocks a mapping of a status onto itself', async () => {
    occupy('IN_PROGRESS', 1);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { IN_PROGRESS: 'IN_PROGRESS' },
    });
    expect(findings.map((f) => f.code)).toContain('REMAP_SELF');
  });

  it('blocks when the remap would move more requests than the cap allows', async () => {
    occupy('LEGACY', 5000);
    const findings = await validateLiveData({
      workflowTypeId: 'wf1',
      graph: graph(),
      statusRemap: { LEGACY: 'IN_PROGRESS' },
    });
    const capped = findings.find((f) => f.code === 'REMAP_VOLUME_EXCEEDED');
    expect(capped).toBeDefined();
    expect(capped!.message).toContain('5000');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- src/services/__tests__/workflowValidatorLiveData.test.ts`
Expected: FAIL — the remap tests fail because `statusRemap` is ignored and the new codes are never emitted.

- [ ] **Step 3: Rewrite `validateLiveData`**

In `workflowValidator.service.ts`, add these imports at the top alongside the existing ones:

```ts
import { config } from '../config';
import { loadOccupancy } from './statusRemap.service';
```

Replace the `ValidateGraphInput` interface and the whole `validateLiveData` function with:

```ts
export interface ValidateGraphInput {
  workflowTypeId: string;
  graph: WorkflowGraph;
  /** removed status code → surviving status code. Applied at publish. */
  statusRemap?: Record<string, string>;
}

/**
 * Checks that publishing this graph would not strand a request that is already
 * in flight. Re-run inside the publish transaction, because occupancy counts
 * move between an admin looking at the canvas and clicking Publish.
 *
 * A stranded status with a valid entry in `statusRemap` is not blocking — the
 * publish will move those requests. The mapping itself is validated here too.
 */
export async function validateLiveData(input: ValidateGraphInput, client: any = prisma): Promise<Finding[]> {
  const { workflowTypeId, graph } = input;
  const remap = input.statusRemap ?? {};

  const occupancy = await loadOccupancy(workflowTypeId, client);
  if (occupancy.size === 0) return [];

  const findings: Finding[] = [];
  const nodesByStatus = new Map(
    graph.nodes.filter((n) => n.statusCode !== null).map((n) => [n.statusCode as string, n]),
  );
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const hasOutgoing = new Set(
    graph.edges
      .filter((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
      .map((edge) => edge.fromNodeId),
  );

  // Validate the mapping itself before trusting it to clear occupancy findings.
  const usableTargets = new Set<string>();
  for (const [from, to] of Object.entries(remap)) {
    if (from === to) {
      findings.push({ code: 'REMAP_SELF', message: `Cannot map ${from} onto itself` });
      continue;
    }
    const target = nodesByStatus.get(to);
    if (!target) {
      findings.push({
        code: 'REMAP_TARGET_MISSING',
        message: `Remap target ${to} is not a status in this version`,
      });
      continue;
    }
    if (!target.isFinal && !hasOutgoing.has(target.id)) {
      findings.push({
        code: 'REMAP_TARGET_NO_EXIT',
        nodeId: target.id,
        message: `Remap target ${to} has no outgoing transitions — requests moved there would be stranded again`,
      });
      continue;
    }
    usableTargets.add(from);
  }

  let remappedTotal = 0;
  for (const [status, count] of occupancy) {
    const node = nodesByStatus.get(status);
    if (!node) {
      if (usableTargets.has(status)) {
        remappedTotal += count;
        continue;
      }
      findings.push({
        code: 'STATUS_IN_USE_REMOVED',
        message: `${count} request${count === 1 ? ' is' : 's are'} currently in ${status} — it cannot be removed from this workflow`,
      });
      continue;
    }

    if (!node.isFinal && !hasOutgoing.has(node.id)) {
      findings.push({
        code: 'OCCUPIED_STATUS_NO_EXIT',
        nodeId: node.id,
        message: `${count} request${count === 1 ? ' is' : 's are'} in ${status}, which would have no available transitions`,
      });
    }
  }

  const cap = config.workflow.remapMaxRequests;
  if (remappedTotal > cap) {
    findings.push({
      code: 'REMAP_VOLUME_EXCEEDED',
      message: `This remap would move ${remappedTotal} requests, above the limit of ${cap} — move some out of these statuses manually first`,
    });
  }

  return findings;
}
```

Then update `validateGraph` to forward the mapping — it already spreads `input`, so change only its call into `validateLiveData` if it destructures. The current body is:

```ts
export async function validateGraph(input: ValidateGraphInput, client: any = prisma): Promise<ValidationResult> {
  const structural = validateStructure(input.graph);
  const live = await validateLiveData(input, client);
  return {
    blocking: [...structural.blocking, ...live],
    warnings: structural.warnings,
  };
}
```

This already forwards `input` whole, so no change is needed. Confirm by reading it.

- [ ] **Step 4: Run the full validator suite**

Run: `cd backend && npm test -- src/services/__tests__/workflowValidatorLiveData.test.ts`
Expected: PASS — the six new tests plus every pre-existing test in the file. The pre-existing tests still pass because `loadOccupancy` issues the same two Prisma calls the old inline code did.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowValidator.service.ts backend/src/services/__tests__/workflowValidatorLiveData.test.ts
git commit -m "feat(workflow): honour status remap in live-data validation"
```

---

### Task 4: Apply the remap

**Files:**
- Modify: `backend/src/services/statusRemap.service.ts`
- Modify: `backend/src/services/__tests__/statusRemap.test.ts`

**Interfaces:**
- Consumes: `loadRequestTypeIds` from Task 2.
- Produces: `applyStatusRemap(tx: any, input: { workflowTypeId: string; remap: Record<string, string>; actorId: string }): Promise<{ movedCount: number }>`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/services/__tests__/statusRemap.test.ts`:

```ts
import { applyStatusRemap } from '../statusRemap.service';

describe('applyStatusRemap', () => {
  const mockTx = {
    requestType: { findMany: jest.fn() },
    request: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    workflowHistory: { createMany: jest.fn() },
    requestActivity: { createMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.requestType.findMany.mockResolvedValue([{ id: 'rt1' }]);
    mockTx.user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace' });
    mockTx.request.findMany.mockResolvedValue([
      { id: 'req1', tenantId: 'ten1', departmentId: 'dep1', version: 4 },
    ]);
  });

  it('does nothing when the mapping is empty', async () => {
    const result = await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: {}, actorId: 'u1' });
    expect(result).toEqual({ movedCount: 0 });
    expect(mockTx.request.updateMany).not.toHaveBeenCalled();
  });

  it('moves requests and bumps the optimistic-concurrency version', async () => {
    const result = await applyStatusRemap(mockTx, {
      workflowTypeId: 'wf1',
      remap: { LEGACY: 'IN_PROGRESS' },
      actorId: 'u1',
    });
    expect(result).toEqual({ movedCount: 1 });
    expect(mockTx.request.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['req1'] } },
      data: { status: 'IN_PROGRESS', version: { increment: 1 } },
    });
  });

  it('never writes SLA columns', async () => {
    await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: { LEGACY: 'IN_PROGRESS' }, actorId: 'u1' });
    const written = mockTx.request.updateMany.mock.calls[0][0].data;
    expect(written).not.toHaveProperty('slaPausedAt');
    expect(written).not.toHaveProperty('slaDueAt');
    expect(written).not.toHaveProperty('slaPauseDurationMs');
  });

  it('writes a workflow history row with the post-increment version and the actor name', async () => {
    await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: { LEGACY: 'IN_PROGRESS' }, actorId: 'u1' });
    expect(mockTx.workflowHistory.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: 'ten1',
          departmentId: 'dep1',
          requestId: 'req1',
          fromStatus: 'LEGACY',
          toStatus: 'IN_PROGRESS',
          actorId: 'u1',
          actorName: 'Ada Lovelace',
          source: 'workflow_version_publish_remap',
          comment: null,
          metadata: {},
          requestVersion: 5,
          idempotencyKey: null,
        },
      ],
    });
  });

  it('writes a status-change activity so the move shows on the request timeline', async () => {
    await applyStatusRemap(mockTx, { workflowTypeId: 'wf1', remap: { LEGACY: 'IN_PROGRESS' }, actorId: 'u1' });
    const [{ data }] = mockTx.requestActivity.createMany.mock.calls[0];
    expect(data[0]).toMatchObject({
      requestId: 'req1',
      authorId: 'u1',
      authorName: 'Ada Lovelace',
      activityType: 'STATUS_CHANGE',
      isSystemGenerated: false,
    });
    expect(data[0].message).toContain('LEGACY');
    expect(data[0].message).toContain('IN_PROGRESS');
  });

  it('skips a mapped status that turns out to hold nothing', async () => {
    mockTx.request.findMany.mockResolvedValue([]);
    const result = await applyStatusRemap(mockTx, {
      workflowTypeId: 'wf1',
      remap: { LEGACY: 'IN_PROGRESS' },
      actorId: 'u1',
    });
    expect(result).toEqual({ movedCount: 0 });
    expect(mockTx.workflowHistory.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- src/services/__tests__/statusRemap.test.ts`
Expected: FAIL — `applyStatusRemap is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `backend/src/services/statusRemap.service.ts`:

```ts
const REMAP_SOURCE = 'workflow_version_publish_remap';

export interface ApplyStatusRemapInput {
  workflowTypeId: string;
  /** removed status code → surviving status code. */
  remap: Record<string, string>;
  actorId: string;
}

/**
 * Moves every request sitting in a removed status onto its mapped target.
 * Must be called with a transaction client from inside publishVersion, so the
 * move and the version swap succeed or fail together.
 *
 * SLA columns are deliberately untouched: a remap is an administrative
 * relabelling, not a transition, and silently resuming or rewriting a clock
 * would distort breach reporting.
 */
export async function applyStatusRemap(
  tx: any,
  input: ApplyStatusRemapInput,
): Promise<{ movedCount: number }> {
  const { workflowTypeId, remap, actorId } = input;
  const pairs = Object.entries(remap);
  if (pairs.length === 0) return { movedCount: 0 };

  const requestTypeIds = await loadRequestTypeIds(workflowTypeId, tx);
  if (requestTypeIds.length === 0) return { movedCount: 0 };

  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { firstName: true, lastName: true },
  });
  const actorName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || 'System' : 'System';

  let movedCount = 0;
  for (const [fromStatus, toStatus] of pairs) {
    const affected = await tx.request.findMany({
      where: { requestTypeId: { in: requestTypeIds }, status: fromStatus },
      select: { id: true, tenantId: true, departmentId: true, version: true },
    });
    if (affected.length === 0) continue;

    await tx.request.updateMany({
      where: { id: { in: affected.map((r: { id: string }) => r.id) } },
      data: { status: toStatus, version: { increment: 1 } },
    });

    await tx.workflowHistory.createMany({
      data: affected.map((r: { id: string; tenantId: string; departmentId: string | null; version: number }) => ({
        tenantId: r.tenantId,
        departmentId: r.departmentId,
        requestId: r.id,
        fromStatus,
        toStatus,
        actorId,
        actorName,
        source: REMAP_SOURCE,
        comment: null,
        metadata: {},
        requestVersion: r.version + 1,
        idempotencyKey: null,
      })),
    });

    await tx.requestActivity.createMany({
      data: affected.map((r: { id: string; version: number }) => ({
        requestId: r.id,
        authorId: actorId,
        authorName: actorName,
        authorRole: null,
        activityType: 'STATUS_CHANGE',
        message: `Status changed from ${fromStatus} to ${toStatus} — ${fromStatus} was removed when a new workflow version was published`,
        isSystemGenerated: false,
        metadata: { fromStatus, toStatus, source: REMAP_SOURCE, version: r.version + 1 },
      })),
    });

    movedCount += affected.length;
  }

  return { movedCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- src/services/__tests__/statusRemap.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/statusRemap.service.ts backend/src/services/__tests__/statusRemap.test.ts
git commit -m "feat(workflow): apply status remap with history and activity audit rows"
```

---

### Task 5: Thread the mapping through publish and detail

**Files:**
- Modify: `backend/src/services/workflowVersion.service.ts:96-138`
- Modify: `backend/src/services/__tests__/workflowVersion.test.ts`

**Interfaces:**
- Consumes: `planStatusRemap`, `applyStatusRemap` from `./statusRemap.service`.
- Produces:
  - `getVersionDetail(versionId)` → `{ version, graph, validation, remapPlan: RemapPlan }`
  - `publishVersion(versionId, userId, statusRemap?: Record<string, string>)` → `{ version, transitionCount, stepCount, movedCount }`

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/services/__tests__/workflowVersion.test.ts`. First extend the existing mock objects at the top of the file — add these keys to `mockTx`:

```ts
  requestType: { findMany: jest.fn() },
  request: { findMany: jest.fn(), updateMany: jest.fn() },
  user: { findUnique: jest.fn() },
  workflowHistory: { createMany: jest.fn() },
  requestActivity: { createMany: jest.fn() },
```

Add this mock next to the existing `jest.mock` calls:

```ts
const mockPlanStatusRemap = jest.fn();
const mockApplyStatusRemap = jest.fn();
jest.mock('../statusRemap.service', () => ({
  planStatusRemap: (...args: unknown[]) => mockPlanStatusRemap(...args),
  applyStatusRemap: (...args: unknown[]) => mockApplyStatusRemap(...args),
}));
```

Add `getVersionDetail` to the import from `../workflowVersion.service`. Then append:

```ts
describe('publishVersion with a status remap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.workflowVersion.findUnique.mockResolvedValue({ id: 'v4', version: 4, status: 'DRAFT', workflowTypeId: 'wf1' });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
    mockCompileVersionInTransaction.mockResolvedValue({ transitionCount: 2, stepCount: 3 });
    mockApplyStatusRemap.mockResolvedValue({ movedCount: 2 });
  });

  it('passes the mapping to the validator so mapped statuses stop blocking', async () => {
    await publishVersion('v4', 'u1', { LEGACY: 'IN_PROGRESS' });
    expect(mockValidateGraph).toHaveBeenCalledWith(
      expect.objectContaining({ statusRemap: { LEGACY: 'IN_PROGRESS' } }),
      mockTx,
    );
  });

  it('applies the remap and reports how many requests moved', async () => {
    const result = await publishVersion('v4', 'u1', { LEGACY: 'IN_PROGRESS' });
    expect(mockApplyStatusRemap).toHaveBeenCalledWith(mockTx, {
      workflowTypeId: 'wf1',
      remap: { LEGACY: 'IN_PROGRESS' },
      actorId: 'u1',
    });
    expect(result).toEqual({ version: 4, transitionCount: 2, stepCount: 3, movedCount: 2 });
  });

  it('applies the remap before archiving the outgoing active version', async () => {
    const order: string[] = [];
    mockApplyStatusRemap.mockImplementation(async () => { order.push('remap'); return { movedCount: 1 }; });
    mockTx.workflowVersion.updateMany.mockImplementation(async () => { order.push('archive'); return { count: 1 }; });
    await publishVersion('v4', 'u1', { LEGACY: 'IN_PROGRESS' });
    expect(order).toEqual(['remap', 'archive']);
  });

  it('does not touch the remap service when no mapping is supplied', async () => {
    await publishVersion('v4', 'u1');
    expect(mockApplyStatusRemap).not.toHaveBeenCalled();
  });

  it('refuses to publish and skips the remap when validation still blocks', async () => {
    mockValidateGraph.mockResolvedValue({ blocking: [{ code: 'REMAP_TARGET_MISSING', message: 'bad target' }], warnings: [] });
    await expect(publishVersion('v4', 'u1', { LEGACY: 'NOPE' })).rejects.toThrow('bad target');
    expect(mockApplyStatusRemap).not.toHaveBeenCalled();
  });
});

describe('getVersionDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.workflowVersion.findUnique.mockResolvedValue({ id: 'v4', version: 4, status: 'DRAFT' });
    mockLoadGraph.mockResolvedValue({ workflowTypeId: 'wf1', graph: emptyGraph });
    mockValidateGraph.mockResolvedValue({ blocking: [], warnings: [] });
  });

  it('includes the remap plan so the UI can offer targets before publishing', async () => {
    const plan = { entries: [{ statusCode: 'LEGACY', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows LEGACY → IN_PROGRESS', allowedTargets: ['IN_PROGRESS'], sourcePausesSla: false }], totalRequests: 1 };
    mockPlanStatusRemap.mockResolvedValue(plan);
    const detail = await getVersionDetail('v4');
    expect(detail.remapPlan).toEqual(plan);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- src/services/__tests__/workflowVersion.test.ts`
Expected: FAIL — `publishVersion` ignores its third argument and `detail.remapPlan` is `undefined`.

- [ ] **Step 3: Update the service**

In `workflowVersion.service.ts`, add to the imports:

```ts
import { applyStatusRemap, planStatusRemap } from './statusRemap.service';
import { RemapPlan } from './workflowGraph.types';
```

(`RemapPlan` joins the existing `ValidationResult, WorkflowGraph` import from `./workflowGraph.types` — merge rather than duplicating the import line.)

Replace `getVersionDetail`'s body and signature:

```ts
export async function getVersionDetail(
  versionId: string,
): Promise<{ version: unknown; graph: WorkflowGraph; validation: ValidationResult; remapPlan: RemapPlan }> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);

  const { workflowTypeId, graph } = await loadGraph(versionId);
  const validation = await validateGraph({ workflowTypeId, graph });
  const remapPlan = await planStatusRemap({ workflowTypeId, draftGraph: graph });
  return { version, graph, validation, remapPlan };
}
```

Replace `publishVersion`:

```ts
export async function publishVersion(
  versionId: string,
  userId: string,
  statusRemap: Record<string, string> = {},
): Promise<{ version: number; transitionCount: number; stepCount: number; movedCount: number }> {
  return prisma.$transaction(async (tx: any) => {
    const version = await tx.workflowVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new AppError(`Workflow version ${versionId} not found`, 404);
    if (version.status === 'ACTIVE') throw new AppError('This version is already active', 409);
    if (version.status !== 'DRAFT') throw new AppError('Only a draft version can be published', 409);

    const loaded = await loadGraph(versionId, tx);
    const validation = await validateGraph({ ...loaded, statusRemap }, tx);
    if (validation.blocking.length > 0) throw new AppError(`Cannot publish: ${describeBlocking(validation)}`, 422);

    // Move stranded requests before the swap, so no request is ever observed
    // sitting in a status the newly-active version does not define.
    const { movedCount } = Object.keys(statusRemap).length
      ? await applyStatusRemap(tx, {
          workflowTypeId: version.workflowTypeId,
          remap: statusRemap,
          actorId: userId,
        })
      : { movedCount: 0 };

    await tx.workflowVersion.updateMany({
      where: { workflowTypeId: version.workflowTypeId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    await tx.workflowVersion.update({
      where: { id: versionId },
      data: { status: 'ACTIVE', publishedAt: new Date(), publishedById: userId },
    });
    const compiled = await compileVersionInTransaction(tx, versionId);
    return { version: version.version, ...compiled, movedCount };
  });
}
```

- [ ] **Step 4: Run the service suite**

Run: `cd backend && npm test -- src/services/__tests__/workflowVersion.test.ts`
Expected: PASS — the six new tests plus every pre-existing test. Pre-existing publish tests still pass because `statusRemap` defaults to `{}` and `movedCount: 0` is additive.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowVersion.service.ts backend/src/services/__tests__/workflowVersion.test.ts
git commit -m "feat(workflow): apply status remap inside the publish transaction"
```

---

### Task 6: API surface

**Files:**
- Modify: `backend/src/controllers/workflowVersion.controller.ts`
- Modify: `backend/src/controllers/__tests__/workflowVersion.controller.test.ts`

**Interfaces:**
- Consumes: `versionService.publishVersion(versionId, userId, statusRemap)`, `versionService.getVersionDetail(versionId)` from Task 5.
- Produces: `POST /admin/workflows/versions/:versionId/publish` accepts `{ statusRemap?: Record<string, string> }`; `POST .../validate` returns `{ validation, remapPlan }`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/controllers/__tests__/workflowVersion.controller.test.ts` — first add `getVersionDetail` and `publishVersion` are already on `mockVersion`, so only append tests:

```ts
describe('publish endpoint status remap contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVersion.publishVersion.mockResolvedValue({ version: 4, transitionCount: 1, stepCount: 2, movedCount: 2 });
  });

  const controller = new WorkflowVersionController();

  it('forwards a well-formed mapping to the service', async () => {
    const { response } = await invoke(controller.publish, { statusRemap: { LEGACY: 'IN_PROGRESS' } }, { versionId: 'v4' }, { id: 'u1' });
    expect(mockVersion.publishVersion).toHaveBeenCalledWith('v4', 'u1', { LEGACY: 'IN_PROGRESS' });
    expect(response!.statusCode).toBe(200);
  });

  it('defaults to an empty mapping when the body omits it', async () => {
    await invoke(controller.publish, {}, { versionId: 'v4' }, { id: 'u1' });
    expect(mockVersion.publishVersion).toHaveBeenCalledWith('v4', 'u1', {});
  });

  it('rejects a mapping that is not an object of strings', async () => {
    const { error } = await invoke(controller.publish, { statusRemap: { LEGACY: 42 } }, { versionId: 'v4' }, { id: 'u1' });
    expect(error).toBeDefined();
    expect((error as { statusCode?: number }).statusCode).toBe(422);
    expect(mockVersion.publishVersion).not.toHaveBeenCalled();
  });

  it('rejects a mapping sent as an array', async () => {
    const { error } = await invoke(controller.publish, { statusRemap: ['LEGACY'] }, { versionId: 'v4' }, { id: 'u1' });
    expect((error as { statusCode?: number }).statusCode).toBe(422);
  });
});

describe('validate endpoint', () => {
  const controller = new WorkflowVersionController();

  it('returns the remap plan alongside validation so the dialog can be prefilled', async () => {
    const remapPlan = { entries: [], totalRequests: 0 };
    mockVersion.getVersionDetail.mockResolvedValue({ version: {}, graph: { nodes: [], edges: [] }, validation: { blocking: [], warnings: [] }, remapPlan });
    const { response } = await invoke(controller.validate, {}, { versionId: 'v4' });
    expect((response!.body as any).data).toEqual({ validation: { blocking: [], warnings: [] }, remapPlan });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- src/controllers/__tests__/workflowVersion.controller.test.ts`
Expected: FAIL — `publishVersion` is called with two arguments and `validate` returns only `validation`.

- [ ] **Step 3: Update the controller**

Add this validator next to the other module-level helpers in `workflowVersion.controller.ts`:

```ts
const parseStatusRemap = (value: unknown): Record<string, string> => {
  if (value === undefined || value === null) return {};
  if (!isObject(value)) throw new AppError('statusRemap must be an object of status code pairs', 422);
  for (const [from, to] of Object.entries(value)) {
    if (typeof from !== 'string' || from === '' || typeof to !== 'string' || to === '') {
      throw new AppError('statusRemap must map non-empty status codes to non-empty status codes', 422);
    }
  }
  return value as Record<string, string>;
};
```

Replace the `publish` and `validate` handlers:

```ts
  validate = asyncHandler(async (req: Request, res: Response) => {
    const versionId = req.params.versionId as string;
    const { validation, remapPlan } = await versionService.getVersionDetail(versionId);
    res.json({ status: 'success', data: { validation, remapPlan } });
  });

  publish = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const versionId = req.params.versionId as string;
    const statusRemap = parseStatusRemap(req.body?.statusRemap);
    const result = await versionService.publishVersion(versionId, req.user!.id, statusRemap);
    res.json({ status: 'success', data: result });
  });
```

- [ ] **Step 4: Run the controller suite and the whole workflow backend surface**

Run: `cd backend && npm test -- src/controllers/__tests__/workflowVersion.controller.test.ts src/services/__tests__/statusRemap.test.ts src/services/__tests__/workflowVersion.test.ts src/services/__tests__/workflowValidatorLiveData.test.ts`
Expected: PASS, all four files.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/workflowVersion.controller.ts backend/src/controllers/__tests__/workflowVersion.controller.test.ts
git commit -m "feat(workflow): accept statusRemap on publish and expose remapPlan"
```

---

### Task 7: Frontend service types

**Files:**
- Modify: `frontend/src/services/workflow-version.service.ts`
- Modify: `frontend/src/services/__tests__/workflow-version.service.test.ts`

**Interfaces:**
- Consumes: the API shapes from Task 6.
- Produces: exported `RemapEntry`, `RemapPlan`; `WorkflowVersionDetail.remapPlan: RemapPlan`; `validateVersion` returns `{ validation, remapPlan }`; `publishVersion(versionId: string, statusRemap?: Record<string, string>)`; `PublishResult.movedCount: number`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/services/__tests__/workflow-version.service.test.ts` (follow the mocking style already in that file for `./api`):

```ts
describe('publishVersion remap payload', () => {
  it('posts the mapping when one is supplied', async () => {
    mockPost.mockResolvedValue({ data: { status: 'success', data: { version: 4, transitionCount: 1, stepCount: 2, movedCount: 2 } } });
    const result = await workflowVersionService.publishVersion('v4', { LEGACY: 'IN_PROGRESS' });
    expect(mockPost).toHaveBeenCalledWith('/admin/workflows/versions/v4/publish', { statusRemap: { LEGACY: 'IN_PROGRESS' } });
    expect(result.movedCount).toBe(2);
  });

  it('posts an empty mapping when none is supplied', async () => {
    mockPost.mockResolvedValue({ data: { status: 'success', data: { version: 4, transitionCount: 1, stepCount: 2, movedCount: 0 } } });
    await workflowVersionService.publishVersion('v4');
    expect(mockPost).toHaveBeenCalledWith('/admin/workflows/versions/v4/publish', { statusRemap: {} });
  });
});
```

If the existing file names its axios mock differently, use that name instead of `mockPost` — read the file first.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/services/__tests__/workflow-version.service.test.ts`
Expected: FAIL — `publishVersion` posts with no body.

- [ ] **Step 3: Update the service**

In `frontend/src/services/workflow-version.service.ts`, add after the `ValidationResult` interface:

```ts
export interface RemapEntry {
  statusCode: string;
  requestCount: number;
  suggestedTarget: string | null;
  suggestionReason: string;
  allowedTargets: string[];
  sourcePausesSla: boolean;
}

export interface RemapPlan {
  entries: RemapEntry[];
  totalRequests: number;
}
```

Add `remapPlan: RemapPlan;` to `WorkflowVersionDetail`, and `movedCount: number;` to `PublishResult`. Replace the two service methods:

```ts
  async validateVersion(versionId: string): Promise<{ validation: ValidationResult; remapPlan: RemapPlan }> {
    return unwrap(await apiClient.post<ApiEnvelope<{ validation: ValidationResult; remapPlan: RemapPlan }>>(`/admin/workflows/versions/${versionId}/validate`));
  },

  async publishVersion(versionId: string, statusRemap: Record<string, string> = {}): Promise<PublishResult> {
    return unwrap(await apiClient.post<ApiEnvelope<PublishResult>>(`/admin/workflows/versions/${versionId}/publish`, { statusRemap }));
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/services/__tests__/workflow-version.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/workflow-version.service.ts frontend/src/services/__tests__/workflow-version.service.test.ts
git commit -m "feat(workflow): add remap plan types to the frontend workflow service"
```

---

### Task 8: Two-step Publish dialog

**Files:**
- Modify: `frontend/src/components/workflow/PublishDialog.tsx`
- Create: `frontend/src/components/workflow/__tests__/PublishDialog.test.tsx`

**Interfaces:**
- Consumes: `RemapPlan`, `RemapEntry`, `ValidationFinding`, `WorkflowSummary`, `WorkflowVersionSummary` from `../../services/workflow-version.service`; `GraphNode` for the target's `slaPause` flag.
- Produces: `PublishDialogProps` gains `remapPlan: RemapPlan | null` and `nodes: GraphNode[]`; `onConfirm` becomes `(statusRemap: Record<string, string>) => void`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/workflow/__tests__/PublishDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublishDialog from '../PublishDialog';
import type { GraphNode, RemapPlan, WorkflowSummary, WorkflowVersionSummary } from '../../../services/workflow-version.service';

const workflow: WorkflowSummary = {
  id: 'wf1', code: 'IT', name: 'IT Support',
  requestTypes: [{ id: 'rt1', name: 'Get IT Help' }],
  activeVersion: null, draftVersion: null,
};
const version: WorkflowVersionSummary = { id: 'v4', version: 4, status: 'DRAFT', publishedAt: null };

const node = (statusCode: string, slaPause = false): GraphNode => ({
  id: statusCode, type: 'STATUS', statusCode, positionX: 0, positionY: 0,
  isInitial: false, isFinal: false, slaPause, icon: 'radio_button_checked',
});

const plan: RemapPlan = {
  totalRequests: 2,
  entries: [
    { statusCode: 'ACTION_REQUIRED', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows ACTION_REQUIRED → IN_PROGRESS', allowedTargets: ['IN_PROGRESS', 'WAITING'], sourcePausesSla: true },
    { statusCode: 'IN_REVIEW', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows IN_REVIEW → IN_PROGRESS', allowedTargets: ['IN_PROGRESS', 'WAITING'], sourcePausesSla: false },
  ],
};

const renderDialog = (over: Partial<React.ComponentProps<typeof PublishDialog>> = {}) => {
  const onConfirm = vi.fn();
  render(
    <PublishDialog
      workflow={workflow}
      version={version}
      blocking={[]}
      warnings={[]}
      remapPlan={null}
      nodes={[node('IN_PROGRESS'), node('WAITING', true)]}
      busy={false}
      onConfirm={onConfirm}
      onClose={vi.fn()}
      {...over}
    />,
  );
  return { onConfirm };
};

describe('PublishDialog', () => {
  it('skips the remap step when nothing is stranded', async () => {
    const { onConfirm } = renderDialog();
    expect(screen.queryByText(/Step 1 of 2/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Publish version/ }));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it('shows one row per stranded status with its request count', () => {
    renderDialog({ remapPlan: plan });
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('ACTION_REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('IN_REVIEW')).toBeInTheDocument();
    expect(screen.getAllByText(/1 request/)).toHaveLength(2);
  });

  it('prefills each dropdown with the suggested target and explains why', () => {
    renderDialog({ remapPlan: plan });
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('IN_PROGRESS');
    expect(screen.getByText(/v3 allows ACTION_REQUIRED → IN_PROGRESS/)).toBeInTheDocument();
  });

  it('warns when the source pauses SLA but the target does not', () => {
    renderDialog({ remapPlan: plan });
    expect(screen.getByText(/ACTION_REQUIRED pauses SLA, IN_PROGRESS does not/)).toBeInTheDocument();
  });

  it('confirms with the chosen mapping after both steps', async () => {
    const { onConfirm } = renderDialog({ remapPlan: plan });
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'WAITING');
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(screen.getByLabelText(/2 requests will be moved/));
    await userEvent.click(screen.getByRole('button', { name: /Publish version/ }));
    expect(onConfirm).toHaveBeenCalledWith({ ACTION_REQUIRED: 'IN_PROGRESS', IN_REVIEW: 'WAITING' });
  });

  it('disables Continue until every stranded status has a target', async () => {
    const unsuggested: RemapPlan = {
      totalRequests: 1,
      entries: [{ statusCode: 'ORPHAN', requestCount: 1, suggestedTarget: null, suggestionReason: 'No surviving status is reachable — choose a target manually', allowedTargets: ['IN_PROGRESS'], sourcePausesSla: false }],
    };
    renderDialog({ remapPlan: unsuggested });
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'IN_PROGRESS');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  it('keeps Publish disabled while unresolved blocking findings remain', () => {
    renderDialog({ blocking: [{ code: 'MISSING_FINAL', message: 'no final node' }] });
    expect(screen.getByRole('button', { name: /Publish version/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/PublishDialog.test.tsx`
Expected: FAIL — the component does not accept `remapPlan` or `nodes`, and `onConfirm` takes no argument.

- [ ] **Step 3: Rewrite the dialog**

Replace `frontend/src/components/workflow/PublishDialog.tsx` entirely. The existing file is written as dense single-line JSX; this rewrite uses normal formatting because the component now carries real logic.

```tsx
import { useMemo, useState } from 'react';
import type {
  GraphNode,
  RemapPlan,
  ValidationFinding,
  WorkflowSummary,
  WorkflowVersionSummary,
} from '../../services/workflow-version.service';

interface PublishDialogProps {
  workflow: WorkflowSummary;
  version: WorkflowVersionSummary;
  blocking: ValidationFinding[];
  warnings: ValidationFinding[];
  /** Stranded statuses needing a target, or null when nothing is stranded. */
  remapPlan: RemapPlan | null;
  /** Draft nodes — used to read the target's SLA pause flag. */
  nodes: GraphNode[];
  busy: boolean;
  onConfirm: (statusRemap: Record<string, string>) => void;
  onClose: () => void;
}

export default function PublishDialog({
  workflow, version, blocking, warnings, remapPlan, nodes, busy, onConfirm, onClose,
}: PublishDialogProps) {
  const entries = remapPlan?.entries ?? [];
  const needsRemap = entries.length > 0;

  const [step, setStep] = useState<1 | 2>(needsRemap ? 1 : 2);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.filter((e) => e.suggestedTarget).map((e) => [e.statusCode, e.suggestedTarget as string])),
  );
  const [accepted, setAccepted] = useState(warnings.length === 0);
  const [remapAccepted, setRemapAccepted] = useState(!needsRemap);

  const pausesSla = useMemo(
    () => new Map(nodes.filter((n) => n.statusCode).map((n) => [n.statusCode as string, n.slaPause])),
    [nodes],
  );

  // A stranded-status blocker is resolved by the mapping on step 1, so it must
  // not also disable the Publish button on step 2.
  const unresolvedBlocking = blocking.filter((f) => f.code !== 'STATUS_IN_USE_REMOVED');
  const allTargetsChosen = entries.every((entry) => Boolean(selections[entry.statusCode]));
  const movedCount = remapPlan?.totalRequests ?? 0;

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101418]/40 p-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  if (step === 1) {
    return shell(
      <>
        <div className="flex items-baseline justify-between">
          <h2 id="publish-title" className="text-xl font-black text-[#101418]">Publish workflow v{version.version}</h2>
          <span className="text-xs font-bold text-[#44546f]">Step 1 of 2</span>
        </div>
        <p className="mt-2 text-sm text-[#44546f]">
          {entries.length} status{entries.length === 1 ? ' is' : 'es are'} being removed but still hold live requests.
          Choose where those requests should go.
        </p>
        <div className="mt-4 grid gap-4">
          {entries.map((entry) => {
            const chosen = selections[entry.statusCode] ?? '';
            const targetPauses = pausesSla.get(chosen) ?? false;
            const slaMismatch = Boolean(chosen) && entry.sourcePausesSla !== targetPauses;
            const selectId = `remap-${entry.statusCode}`;
            return (
              <div key={entry.statusCode} className="rounded-lg border border-[#dbe3ef] p-3">
                <div className="flex items-baseline justify-between">
                  <strong className="text-sm font-black text-[#101418]">{entry.statusCode}</strong>
                  <span className="text-xs text-[#44546f]">{entry.requestCount} request{entry.requestCount === 1 ? '' : 's'}</span>
                </div>
                <label className="mt-2 block text-xs font-semibold text-[#334a70]" htmlFor={selectId}>Move to</label>
                <select
                  id={selectId}
                  className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm"
                  value={chosen}
                  onChange={(event) => setSelections((current) => ({ ...current, [entry.statusCode]: event.target.value }))}
                >
                  <option value="">Choose a status…</option>
                  <optgroup label="Keeps the request open">
                    {entry.allowedTargets.filter((t) => !nodes.find((n) => n.statusCode === t)?.isFinal).map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Closes the request">
                    {entry.allowedTargets.filter((t) => nodes.find((n) => n.statusCode === t)?.isFinal).map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-[#44546f]">{entry.suggestionReason}</p>
                {slaMismatch && (
                  <p className="mt-1 text-xs text-[#8a5a00]">
                    ⚠ {entry.statusCode} {entry.sourcePausesSla ? 'pauses' : 'does not pause'} SLA, {chosen} {targetPauses ? 'does' : 'does not'}.
                    Clocks are left untouched — this request&apos;s SLA state will not change.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={onClose}>Cancel</button>
          <button
            className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!allTargetsChosen}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <div className="flex items-baseline justify-between">
        <h2 id="publish-title" className="text-xl font-black text-[#101418]">Publish workflow v{version.version}</h2>
        {needsRemap && <span className="text-xs font-bold text-[#44546f]">Step 2 of 2</span>}
      </div>
      <p className="mt-2 text-sm text-[#44546f]">
        This will activate the new version of <strong>{workflow.name}</strong> for {workflow.requestTypes.length} request type{workflow.requestTypes.length === 1 ? '' : 's'}.
      </p>
      {unresolvedBlocking.length > 0 && (
        <div className="mt-4 rounded-lg bg-[#fff0f0] p-3 text-sm text-[#b42318]">
          <strong>Publishing is blocked.</strong> Resolve {unresolvedBlocking.length} blocking finding{unresolvedBlocking.length === 1 ? '' : 's'} first.
        </div>
      )}
      {warnings.length > 0 && (
        <label className="mt-4 flex gap-2 rounded-lg bg-[#fff4d6] p-3 text-sm text-[#8a5a00]">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          I accept the {warnings.length} validation warning{warnings.length === 1 ? '' : 's'}.
        </label>
      )}
      {needsRemap && (
        <label className="mt-4 flex gap-2 rounded-lg bg-[#eef4ff] p-3 text-sm text-[#334a70]">
          <input type="checkbox" checked={remapAccepted} onChange={(event) => setRemapAccepted(event.target.checked)} />
          {movedCount} request{movedCount === 1 ? '' : 's'} will be moved when you publish.
        </label>
      )}
      <div className="mt-6 flex justify-end gap-3">
        {needsRemap && (
          <button className="mr-auto rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={() => setStep(1)}>Back</button>
        )}
        <button className="rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={onClose}>Cancel</button>
        <button
          className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || unresolvedBlocking.length > 0 || !accepted || !remapAccepted}
          onClick={() => onConfirm(needsRemap ? selections : {})}
        >
          {busy ? 'Publishing…' : 'Publish version'}
        </button>
      </div>
    </>,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/workflow/__tests__/PublishDialog.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workflow/PublishDialog.tsx frontend/src/components/workflow/__tests__/PublishDialog.test.tsx
git commit -m "feat(workflow): two-step publish dialog with status remap targets"
```

---

### Task 9: Wire the designer

**Files:**
- Modify: `frontend/src/hooks/useWorkflowGraph.ts`
- Modify: `frontend/pages/WorkflowDesigner.tsx`
- Modify: `frontend/src/components/workflow/ValidationPanel.tsx`
- Modify: `frontend/src/hooks/__tests__/useWorkflowGraph.test.ts`

**Interfaces:**
- Consumes: `PublishDialog` props from Task 8; `workflowVersionService.validateVersion` / `publishVersion` from Task 7.
- Produces: `useWorkflowGraph(versionId, graph, readOnly, initialRemapPlan)` returns `remapPlan: RemapPlan | null`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/hooks/__tests__/useWorkflowGraph.test.ts` (match the existing `renderHook` and service-mock style in that file):

```ts
it('seeds the remap plan from the initial detail and refreshes it on validate', async () => {
  const seeded = { entries: [{ statusCode: 'LEGACY', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows LEGACY → IN_PROGRESS', allowedTargets: ['IN_PROGRESS'], sourcePausesSla: false }], totalRequests: 1 };
  const refreshed = { entries: [], totalRequests: 0 };
  mockValidateVersion.mockResolvedValue({ validation: { blocking: [], warnings: [] }, remapPlan: refreshed });

  const { result } = renderHook(() => useWorkflowGraph('v4', { nodes: [], edges: [] }, false, seeded));
  expect(result.current.remapPlan).toEqual(seeded);

  await act(async () => { await result.current.validate(); });
  expect(result.current.remapPlan).toEqual(refreshed);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useWorkflowGraph.test.ts`
Expected: FAIL — `result.current.remapPlan` is `undefined`.

- [ ] **Step 3: Add remap state to the hook**

In `useWorkflowGraph.ts`, import `RemapPlan` from the service, add the fourth parameter, add state, reset it when the version changes, refresh it in both `save` and `validate`, and return it.

Signature:

```ts
export function useWorkflowGraph(
  versionId: string,
  graph: WorkflowGraph,
  readOnly: boolean,
  initialRemapPlan: RemapPlan | null = null,
): WorkflowGraphState {
```

Add next to the `validation` state:

```ts
  const [remapPlan, setRemapPlan] = useState<RemapPlan | null>(initialRemapPlan);
```

In the `useEffect` keyed on `[versionId, graph]`, alongside `setValidation({ blocking: [], warnings: [] });`:

```ts
    setRemapPlan(initialRemapPlan);
```

In `save`, replace the validate call's result handling:

```ts
      const result = await workflowVersionService.validateVersion(versionId);
      if (mutation === mutationRef.current) {
        setValidation(result.validation);
        setRemapPlan(result.remapPlan);
      }
```

In `validate`, replace the success branch:

```ts
      const result = await workflowVersionService.validateVersion(versionId);
      setValidation(result.validation);
      setRemapPlan(result.remapPlan);
      return result.validation;
```

Add `remapPlan,` to the returned object, and add `remapPlan: RemapPlan | null;` to the `WorkflowGraphState` interface. Add `initialRemapPlan` to the `useEffect` dependency array.

- [ ] **Step 4: Run the hook test**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useWorkflowGraph.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the designer page**

In `frontend/pages/WorkflowDesigner.tsx`:

Pass the seeded plan into the hook where it is constructed — find the `useWorkflowGraph(` call and add `detail?.remapPlan ?? null` as the fourth argument.

Replace the `publish` function (currently line 48):

```tsx
  const publish = async (statusRemap: Record<string, string>) => {
    if (!versionId) return;
    setLifecycleBusy(true);
    try {
      await workflowVersionService.publishVersion(versionId, statusRemap);
      setPublishOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to publish workflow');
    } finally {
      setLifecycleBusy(false);
    }
  };
```

In the header, the Publish button's `disabled` currently reads `graph.blockingFindings.length > 0 || graph.dirty || lifecycleBusy`. A stranded-status blocker is resolvable in the dialog, so it must no longer disable the button. Add above the returned JSX:

```tsx
  const unresolvedBlocking = graph.blockingFindings.filter((f) => f.code !== 'STATUS_IN_USE_REMOVED');
```

and change the button's `disabled` to:

```tsx
disabled={unresolvedBlocking.length > 0 || graph.dirty || lifecycleBusy}
```

Update the dialog render (currently line 61):

```tsx
{publishOpen && (
  <PublishDialog
    workflow={workflow}
    version={detail.version}
    blocking={graph.blockingFindings}
    warnings={graph.warnings}
    remapPlan={graph.remapPlan}
    nodes={detail.graph.nodes}
    busy={lifecycleBusy}
    onClose={() => setPublishOpen(false)}
    onConfirm={(statusRemap) => void publish(statusRemap)}
  />
)}
```

- [ ] **Step 6: Add the panel hint**

In `ValidationPanel.tsx`, inside the finding `<button>`, after `<span className="ml-2">{finding.message}</span>`, add:

```tsx
{finding.code === 'STATUS_IN_USE_REMOVED' && <span className="ml-2 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Resolve on publish</span>}
```

- [ ] **Step 7: Verify the whole frontend workflow surface**

Run: `cd frontend && npx vitest run src/components/workflow src/hooks/__tests__/useWorkflowGraph.test.ts src/services/__tests__/workflow-version.service.test.ts && npm run build`
Expected: all tests PASS and the production build succeeds with no TypeScript errors.

- [ ] **Step 8: Manual verification against the real blocked publish**

Start both dev servers (`cd backend && npm run dev`, `cd frontend && npm run dev`), sign in as `admin@test.local` / `abc@123`, and open
`http://localhost:5173/admin/workflows/a1fe4977-3da2-43b6-92c9-7402ba14d50c/versions/f940bd31-8db4-4384-9900-0353f5eab10e`.

Expected:
- The Validation panel still lists two `STATUS_IN_USE_REMOVED` findings, now tagged "Resolve on publish".
- The Publish button is enabled (the nine `OPEN_EDGE` findings are warnings, not blockers).
- Publish opens step 1 listing `ACTION_REQUIRED` (1 request) and `IN_REVIEW` (1 request), both prefilled with `IN_PROGRESS`.
- `ACTION_REQUIRED` shows the SLA mismatch warning; `IN_REVIEW` does not.
- Completing both steps activates v4 and reports 2 requests moved.

Confirm the audit trail afterwards:

```bash
cd backend && cat > q-tmp.ts <<'EOF'
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const ids = ['3792d103-d4c0-4da2-bc32-cd7aeb1c8108', 'c577cb9c-3234-479c-b88a-19da6dda4fba'];
  console.log(await p.request.findMany({ where: { id: { in: ids } }, select: { referenceNumber: true, status: true, version: true, slaPausedAt: true, slaDueAt: true } }));
  console.log(await p.workflowHistory.findMany({ where: { requestId: { in: ids }, source: 'workflow_version_publish_remap' }, select: { fromStatus: true, toStatus: true, actorName: true, requestVersion: true } }));
  await p.$disconnect();
})();
EOF
npx tsx q-tmp.ts; rm -f q-tmp.ts
```

Expected: both requests now `IN_PROGRESS` with `version` incremented by 1, `slaPausedAt` / `slaDueAt` unchanged from their pre-publish values, and two history rows sourced `workflow_version_publish_remap`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/useWorkflowGraph.ts frontend/src/hooks/__tests__/useWorkflowGraph.test.ts frontend/pages/WorkflowDesigner.tsx frontend/src/components/workflow/ValidationPanel.tsx
git commit -m "feat(workflow): wire status remap through the designer publish flow"
```

---

## Post-implementation

Run the full suites before opening a PR:

```bash
cd backend && npm test && npm run lint
cd ../frontend && npx vitest run && npm run build
```

The backend suite has been observed to hang when run bare (see the note in the workflow engine remediation plan). If it stalls, run the workflow-related files explicitly:

```bash
cd backend && npm test -- src/services/__tests__/statusRemap.test.ts src/services/__tests__/workflowVersion.test.ts src/services/__tests__/workflowValidatorLiveData.test.ts src/services/__tests__/workflowCompiler.test.ts src/controllers/__tests__/workflowVersion.controller.test.ts
```

There is no `backend/.env.example` in this repo, so no env documentation file needs updating. `WORKFLOW_REMAP_MAX_REQUESTS` is optional and defaults to 1000.
