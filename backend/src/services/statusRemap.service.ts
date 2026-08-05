/**
 * Status remap on publish. When a draft removes a status that live requests
 * still occupy, publishing must either be blocked or those requests moved.
 * This service plans the move (what is stranded, where should it go) and
 * applies it inside the publish transaction.
 *
 * The suggestion walks the currently-ACTIVE version's edges, so the proposed
 * target is a hop the workflow already sanctions rather than a guess.
 */

import { RequestStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { executeWorkflowCommandInTransaction } from './workflowCommand.service';
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
  for (const e of activeGraph.edges) {
    if (!nodesById.has(e.fromNodeId) || !nodesById.has(e.toNodeId)) continue;
    const list = outgoing.get(e.fromNodeId) ?? [];
    list.push(e.toNodeId);
    outgoing.set(e.fromNodeId, list);
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
      select: { id: true, tenantId: true, status: true, version: true },
    });

    for (const request of affected) {
      await executeWorkflowCommandInTransaction({
        requestId: request.id,
        tenantId: request.tenantId,
        fromStatus: request.status as RequestStatus,
        toStatus: toStatus as RequestStatus,
        expectedVersion: request.version,
        actorId,
        actorName,
        source: REMAP_SOURCE,
        metadata: { fromStatus, toStatus, source: REMAP_SOURCE },
        skipNotifications: true,
      }, tx);
      movedCount += 1;
    }
  }

  return { movedCount };
}