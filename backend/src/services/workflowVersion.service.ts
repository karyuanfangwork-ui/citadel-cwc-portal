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
    include: { publishedBy: { select: { id: true, firstName: true, lastName: true } } },
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