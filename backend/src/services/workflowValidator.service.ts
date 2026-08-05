/**
 * Workflow graph validation. Structural rules are pure functions over an
 * in-memory graph; live-data rules (added in the next task) query current
 * request positions.
 *
 * Findings accumulate — validation never short-circuits, so an admin sees
 * every problem at once rather than fixing them one reload at a time.
 */

import { Finding, GraphNode, ValidationResult, WorkflowGraph } from './workflowGraph.types';
import { config } from '../config';
import { loadOccupancy } from './statusRemap.service';
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

  const nodesById = new Map<string, GraphNode>();
  const statusCodes = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    if (nodesById.has(node.id)) {
      blocking.push({
        code: 'DUPLICATE_NODE_ID',
        nodeId: node.id,
        message: `Node id ${node.id} appears more than once`,
      });
    } else {
      nodesById.set(node.id, node);
    }

    if (node.type !== 'STATUS' || !node.statusCode?.trim()) {
      blocking.push({
        code: 'INVALID_STATUS_NODE',
        nodeId: node.id,
        message: `Status node ${node.id} must have a non-empty status code`,
      });
    } else if (statusCodes.has(node.statusCode)) {
      blocking.push({
        code: 'DUPLICATE_STATUS_CODE',
        nodeId: node.id,
        message: `Status code ${node.statusCode} appears more than once`,
      });
    } else {
      statusCodes.set(node.statusCode, node);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.fromNodeId}->${edge.toNodeId}`;
    if (edgeKeys.has(edge.id) || edgeKeys.has(key)) {
      blocking.push({
        code: 'DUPLICATE_EDGE',
        edgeId: edge.id,
        message: `Transition ${edge.id} is duplicated`,
      });
    }
    edgeKeys.add(edge.id);
    edgeKeys.add(key);
  }

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
    if (nodesByStatus.has(from)) {
      findings.push({
        code: 'REMAP_SOURCE_NOT_REMOVED',
        nodeId: nodesByStatus.get(from)!.id,
        message: `Remap source ${from} still exists in this version and cannot be moved`,
      });
      continue;
    }
    if (!occupancy.has(from)) {
      findings.push({
        code: 'REMAP_SOURCE_NOT_OCCUPIED',
        message: `Remap source ${from} has no live requests and is not eligible for this publish`,
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

/** Structural + live-data validation. The publish gate and the API both use this. */
export async function validateGraph(input: ValidateGraphInput, client: any = prisma): Promise<ValidationResult> {
  const structural = validateStructure(input.graph);
  const live = await validateLiveData(input, client);
  return {
    blocking: [...structural.blocking, ...live],
    warnings: structural.warnings,
  };
}