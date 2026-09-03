/**
 * Node and edge editing inside a DRAFT version. Every entry point asserts the
 * target version is a draft, so a published graph can never be mutated in
 * place — the only way to change an active workflow is to draft, validate, and
 * publish.
 */

import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';
import { assertSelectableStatusCode, normalizeStatusCode } from './requestStatusDefinition.service';

export interface NodeInput {
  id: string;
  statusCode: string | null;
  positionX: number | null;
  positionY: number | null;
  isInitial: boolean;
  isFinal: boolean;
  slaPause: boolean;
  icon: string;
  label?: string | null;
  displayOrder?: number | null;
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

async function assertDraft(versionId: string, client: any = prisma): Promise<void> {
  const version = await client.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new AppError(`Workflow version ${versionId} not found`, 404);
  if (version.status !== 'DRAFT') throw new AppError('Only a draft version can be edited — create a new draft to make changes', 409);
}

async function assertNodeStatusDefinitions(nodes: NodeInput[], client: any): Promise<void> {
  if (!client.requestStatusDefinition?.findUnique) return;
  for (const node of nodes) {
    if (node.statusCode) {
      const normalized = normalizeStatusCode(node.statusCode);
      if (node.statusCode !== normalized) throw new AppError(`Status code must be uppercase: ${normalized}`, 422);
      await assertSelectableStatusCode(normalized, client);
    }
  }
}

export async function upsertNodes(versionId: string, nodes: NodeInput[], client: any = prisma): Promise<void> {
  await assertDraft(versionId, client);
  await assertNodeStatusDefinitions(nodes, client);

  const ids = nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) throw new AppError('Duplicate node ids in graph update', 422);
  const existing = await client.workflowNode.findMany({
    where: { id: { in: ids } },
    select: { id: true, workflowVersionId: true },
  });
  const foreign = existing.find((node: { id: string; workflowVersionId: string }) => node.workflowVersionId !== versionId);
  if (foreign) throw new AppError(`Node ${foreign.id} belongs to another workflow version`, 409);

  for (const node of nodes) {
    const shared = {
      statusCode: node.statusCode,
      positionX: node.positionX,
      positionY: node.positionY,
      isInitial: node.isInitial,
      isFinal: node.isFinal,
      slaPause: node.slaPause,
      icon: node.icon,
      label: node.label ?? node.statusCode,
      displayOrder: node.displayOrder ?? null,
    };
    await client.workflowNode.upsert({
      where: { id_workflowVersionId: { id: node.id, workflowVersionId: versionId } },
      create: { id: node.id, workflowVersionId: versionId, type: 'STATUS', ...shared },
      // workflowVersionId is deliberately absent: an update must never move a
      // node between versions.
      update: shared,
    });
  }
}

export async function deleteNodes(versionId: string, nodeIds: string[], client: any = prisma): Promise<void> {
  await assertDraft(versionId, client);
  if (nodeIds.length === 0) return;

  // Edges cascade from the node foreign keys.
  await client.workflowNode.deleteMany({
    where: { id: { in: nodeIds }, workflowVersionId: versionId },
  });
}

export async function upsertEdges(versionId: string, edges: EdgeInput[], client: any = prisma): Promise<void> {
  await assertDraft(versionId, client);

  const ids = edges.map((edge) => edge.id);
  if (new Set(ids).size !== ids.length) throw new AppError('Duplicate edge ids in graph update', 422);
  const existing = await client.workflowEdge.findMany({
    where: { id: { in: ids } },
    select: { id: true, workflowVersionId: true },
  });
  const foreign = existing.find((edge: { id: string; workflowVersionId: string }) => edge.workflowVersionId !== versionId);
  if (foreign) throw new AppError(`Edge ${foreign.id} belongs to another workflow version`, 409);
  const endpointIds = [...new Set(edges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]))];
  const nodes = await client.workflowNode.findMany({
    where: { id: { in: endpointIds } },
    select: { id: true, workflowVersionId: true },
  });
  const nodeById = new Map<string, { id: string; workflowVersionId: string }>(
    nodes.map((node: { id: string; workflowVersionId: string }) => [node.id, node]),
  );
  for (const edge of edges) {
    if (edge.fromNodeId === edge.toNodeId) throw new AppError('A status cannot transition to itself', 422);
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      const node = nodeById.get(nodeId);
      if (!node) throw new AppError(`Edge ${edge.id} references missing node ${nodeId}`, 422);
      if (node.workflowVersionId !== versionId) throw new AppError(`Edge ${edge.id} references a node from another workflow version`, 409);
    }
  }

  for (const edge of edges) {
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
    await client.workflowEdge.upsert({
      where: { id_workflowVersionId: { id: edge.id, workflowVersionId: versionId } },
      create: { id: edge.id, workflowVersionId: versionId, ...shared },
      update: shared,
    });
  }
}

export async function deleteEdges(versionId: string, edgeIds: string[], client: any = prisma): Promise<void> {
  await assertDraft(versionId, client);
  if (edgeIds.length === 0) return;

  await client.workflowEdge.deleteMany({
    where: { id: { in: edgeIds }, workflowVersionId: versionId },
  });
}

export async function updateNodes(versionId: string, nodes: NodeInput[], remove: string[]): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await upsertNodes(versionId, nodes, tx);
    await deleteNodes(versionId, remove, tx);
  });
}

export async function updateEdges(versionId: string, edges: EdgeInput[], remove: string[]): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await upsertEdges(versionId, edges, tx);
    await deleteEdges(versionId, remove, tx);
  });
}

/** Replace the complete draft graph atomically; absent rows are deleted. */
export async function replaceGraph(versionId: string, nodes: NodeInput[], edges: EdgeInput[]): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    await assertDraft(versionId, tx);
    await assertNodeStatusDefinitions(nodes, tx);
    const nodeIds = nodes.map((node) => node.id);
    const edgeIds = edges.map((edge) => edge.id);
    if (new Set(nodeIds).size !== nodeIds.length) throw new AppError('Duplicate node ids in graph update', 422);
    if (new Set(edgeIds).size !== edgeIds.length) throw new AppError('Duplicate edge ids in graph update', 422);

    // The submitted snapshot is authoritative. Remove the old graph first
    // inside this transaction so newly-added statuses cannot collide with the
    // version/status uniqueness constraint during upsert.
    await tx.workflowEdge.deleteMany({ where: { workflowVersionId: versionId } });
    await tx.workflowNode.deleteMany({ where: { workflowVersionId: versionId } });
    await upsertNodes(versionId, nodes, tx);
    await upsertEdges(versionId, edges, tx);
  });
}