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