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
  if (nodes.length > 0 && nodes.every((node) => node.displayOrder != null)) {
    return [...nodes].sort((a, b) => (a.displayOrder! - b.displayOrder!));
  }
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
  const hasCompleteDisplayOrder = graph.nodes.length > 0
    && graph.nodes.every((node) => node.displayOrder != null);
  const orderedStatusNodes = orderNodes(graph.nodes, graph.edges)
    .filter((node) => node.statusCode !== null);
  for (const [index, node] of orderedStatusNodes.entries()) {
    const nodeDisplayOrder = hasCompleteDisplayOrder ? node.displayOrder! : index;
    steps.push({
      workflowTypeId,
      status: node.statusCode as string,
      label: node.label ?? node.statusCode as string,
      icon: node.icon,
      displayOrder: nodeDisplayOrder,
      isInitial: node.isInitial,
      isFinal: node.isFinal,
      slaPause: node.slaPause,
    });
  }

  return { transitions, steps };
}

/** Load a version's graph in the shared in-memory shape. */
export async function loadGraph(
  versionId: string,
  client: any = prisma,
): Promise<{ workflowTypeId: string; graph: WorkflowGraph }> {
  const version = await client.workflowVersion.findUnique({
    where: { id: versionId },
    include: { nodes: true, edges: true },
  });
  if (!version) throw new Error(`Workflow version ${versionId} not found`);

  return {
    workflowTypeId: version.workflowTypeId,
    graph: {
      nodes: version.nodes.map((n: any) => ({
        id: n.id,
        type: 'STATUS',
        statusCode: n.statusCode,
        label: n.label ?? n.statusCode,
        displayOrder: n.displayOrder,
        positionX: n.positionX,
        positionY: n.positionY,
        isInitial: n.isInitial,
        isFinal: n.isFinal,
        slaPause: n.slaPause,
        icon: n.icon,
      })),
      edges: version.edges.map((e: any) => ({
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
export async function compileVersionInTransaction(
  tx: any,
  versionId: string,
): Promise<{ transitionCount: number; stepCount: number }> {
  const { workflowTypeId, graph } = await loadGraph(versionId, tx);
  const { transitions, steps } = projectGraph(graph, workflowTypeId);

  await tx.workflowTransition.deleteMany({ where: { workflowTypeId, tenantId: null } });
  await tx.workflowStep.deleteMany({ where: { workflowTypeId } });
  if (transitions.length > 0) await tx.workflowTransition.createMany({ data: transitions });
  if (steps.length > 0) await tx.workflowStep.createMany({ data: steps });

  return { transitionCount: transitions.length, stepCount: steps.length };
}

export async function compileVersion(
  versionId: string,
): Promise<{ transitionCount: number; stepCount: number }> {
  return prisma.$transaction((tx: any) => compileVersionInTransaction(tx, versionId));
}

import { randomUUID } from 'crypto';

/**
 * Builds an authoring graph from the rows that exist today, so existing
 * workflows get a version 1 without anyone re-drawing them. Node ids are
 * generated here and become the real primary keys when the backfill persists.
 */
export async function reverseCompile(workflowTypeId: string, client: any = prisma): Promise<WorkflowGraph> {
  const steps: Array<{
    status: string;
    label: string;
    displayOrder: number;
    icon: string;
    isInitial: boolean;
    isFinal: boolean;
    slaPause: boolean;
  }> = await client.workflowStep.findMany({
    where: { workflowTypeId },
    orderBy: { displayOrder: 'asc' },
  });
  const transitions: Array<{
    fromStatus: string;
    toStatus: string;
    transitionLabel: string | null;
    requiresComment: boolean;
    autoAssignRole: string | null;
    autoAssignUserId: string | null;
    allowedRoles: string[];
    allowedExecutiveRoles: string[];
  }> = await client.workflowTransition.findMany({
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
      label: over.label ?? steps.find((step) => step.status === status)?.label ?? status,
      displayOrder: over.displayOrder ?? steps.find((step) => step.status === status)?.displayOrder ?? null,
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
      label: step.label,
      displayOrder: step.displayOrder,
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