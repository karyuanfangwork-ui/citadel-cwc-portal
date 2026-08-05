/**
 * Workflow graph validation. Structural rules are pure functions over an
 * in-memory graph; live-data rules (added in the next task) query current
 * request positions.
 *
 * Findings accumulate — validation never short-circuits, so an admin sees
 * every problem at once rather than fixing them one reload at a time.
 */

import { Finding, GraphNode, ValidationResult, WorkflowGraph } from './workflowGraph.types';
import prisma from '../utils/prisma';

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