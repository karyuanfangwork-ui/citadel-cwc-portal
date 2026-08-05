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