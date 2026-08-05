/**
 * Workflow version lifecycle. One ACTIVE version per WorkflowType — enforced in
 * the database by a partial unique index, and here by archiving before
 * activating inside a single transaction.
 */

import { randomUUID } from 'crypto';

import prisma from '../utils/prisma';
import { compileVersionInTransaction, loadGraph } from './workflowCompiler.service';
import { validateGraph } from './workflowValidator.service';
import { ValidationResult, WorkflowGraph } from './workflowGraph.types';
import { AppError } from '../middleware/error.middleware';

export async function listVersions(workflowTypeId: string) {
  return prisma.workflowVersion.findMany({
    where: { workflowTypeId },
    orderBy: { version: 'desc' },
    include: { publishedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function createDraft(workflowTypeId: string): Promise<{ id: string; version: number }> {
  try {
    return await prisma.$transaction(async (tx: any) => {
    const openDraft = await tx.workflowVersion.findFirst({
      where: { workflowTypeId, status: 'DRAFT' },
    });
    if (openDraft) {
      throw new AppError('This workflow already has an open draft — edit or discard it first', 409);
    }

    const highest = await tx.workflowVersion.aggregate({
      where: { workflowTypeId },
      _max: { version: true },
    });
    const nextVersion = (highest._max.version ?? 0) + 1;
    const active = await tx.workflowVersion.findFirst({
      where: { workflowTypeId, status: 'ACTIVE' },
    });
    const graph: WorkflowGraph = active
      ? (await loadGraph(active.id, tx)).graph
      : { nodes: [], edges: [] };

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
            label: n.label ?? n.statusCode,
            displayOrder: n.displayOrder ?? null,
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
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError('This workflow already has an open draft — edit or discard it first', 409);
    }
    throw error;
  }
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
  return prisma.$transaction(async (tx: any) => {
    const version = await tx.workflowVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new AppError(`Workflow version ${versionId} not found`, 404);
    if (version.status === 'ACTIVE') throw new AppError('This version is already active', 409);
    if (version.status !== 'DRAFT') throw new AppError('Only a draft version can be published', 409);

    const loaded = await loadGraph(versionId, tx);
    const validation = await validateGraph(loaded, tx);
    if (validation.blocking.length > 0) throw new AppError(`Cannot publish: ${describeBlocking(validation)}`, 422);

    await tx.workflowVersion.updateMany({
      where: { workflowTypeId: version.workflowTypeId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    await tx.workflowVersion.update({
      where: { id: versionId },
      data: { status: 'ACTIVE', publishedAt: new Date(), publishedById: userId },
    });
    const compiled = await compileVersionInTransaction(tx, versionId);
    return { version: version.version, ...compiled };
  });
}

export async function rollbackToVersion(
  versionId: string,
  userId: string,
): Promise<{ version: number }> {
  return prisma.$transaction(async (tx: any) => {
    const version = await tx.workflowVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new AppError(`Workflow version ${versionId} not found`, 404);
    if (version.status !== 'ARCHIVED') throw new AppError('Only an archived version can be rolled back to', 409);

    const loaded = await loadGraph(versionId, tx);
    const validation = await validateGraph(loaded, tx);
    if (validation.blocking.length > 0) throw new AppError(`Cannot roll back: ${describeBlocking(validation)}`, 422);

    await tx.workflowVersion.updateMany({
      where: { workflowTypeId: version.workflowTypeId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });
    await tx.workflowVersion.update({
      where: { id: versionId },
      data: { status: 'ACTIVE', publishedAt: new Date(), publishedById: userId },
    });
    await compileVersionInTransaction(tx, versionId);
    return { version: version.version };
  });
}

export async function discardDraft(versionId: string): Promise<void> {
  const version = await prisma.workflowVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new AppError(`Workflow version ${versionId} not found`, 404);
  if (version.status !== 'DRAFT') throw new AppError('Only a draft can be discarded', 409);

  // Nodes and edges cascade.
  await prisma.workflowVersion.delete({ where: { id: versionId } });
}