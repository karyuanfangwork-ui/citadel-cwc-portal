import { Request, Response } from 'express';

import { AppError, asyncHandler } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import * as graphService from '../services/workflowGraph.service';
import * as versionService from '../services/workflowVersion.service';

/** Express augments Request with `user` in the auth middleware. */
interface AuthedRequest extends Request {
  user?: { id: string };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateBatch = (upsert: unknown, remove: unknown, required: string[]) => {
  if (!Array.isArray(upsert) || !Array.isArray(remove) || !remove.every((id) => typeof id === 'string')) {
    throw new AppError('upsert must be an array and remove must be an array of ids', 400);
  }
  for (const item of upsert) {
    if (!isObject(item) || required.some((key) => typeof item[key] !== 'string' || item[key] === '')) {
      throw new AppError(`Each upsert item requires string fields: ${required.join(', ')}`, 422);
    }
  }
};

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === 'number';
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const validateNodeBatch = (upsert: unknown[]) => {
  for (const item of upsert as Record<string, unknown>[]) {
    if (
      !isUuid(item.id) ||
      !isNullableString(item.statusCode) ||
      !isNullableNumber(item.positionX) ||
      !isNullableNumber(item.positionY) ||
      typeof item.isInitial !== 'boolean' ||
      typeof item.isFinal !== 'boolean' ||
      typeof item.slaPause !== 'boolean' ||
      typeof item.icon !== 'string' ||
      (item.label !== undefined && !isNullableString(item.label)) ||
      (item.displayOrder !== undefined && !Number.isInteger(item.displayOrder) && item.displayOrder !== null)
    ) throw new AppError('Invalid workflow node payload', 422);
  }
};

const validateEdgeBatch = (upsert: unknown[]) => {
  for (const item of upsert as Record<string, unknown>[]) {
    if (
      !isUuid(item.id) ||
      !isUuid(item.fromNodeId) ||
      !isUuid(item.toNodeId) ||
      !isNullableString(item.transitionLabel) ||
      typeof item.requiresComment !== 'boolean' ||
      !isNullableString(item.autoAssignRole) ||
      !isNullableString(item.autoAssignUserId) ||
      !Array.isArray(item.allowedRoles) ||
      !item.allowedRoles.every((role) => typeof role === 'string') ||
      !Array.isArray(item.allowedExecutiveRoles) ||
      !item.allowedExecutiveRoles.every((role) => typeof role === 'string')
    ) throw new AppError('Invalid workflow edge payload', 422);
  }
};

export class WorkflowVersionController {
  /** Workflow list with active version, bound request types, and draft flag. */
  list = asyncHandler(async (_req: Request, res: Response) => {
    const workflowTypes = await prisma.workflowType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        requestTypes: { select: { id: true, name: true } },
        versions: {
          where: { status: { in: ['ACTIVE', 'DRAFT'] } },
          select: { id: true, version: true, status: true, publishedAt: true },
        },
      },
    });

    const workflows = workflowTypes.map((wt) => ({
      id: wt.id,
      code: wt.code,
      name: wt.name,
      requestTypes: wt.requestTypes,
      activeVersion: wt.versions.find((v) => v.status === 'ACTIVE') ?? null,
      draftVersion: wt.versions.find((v) => v.status === 'DRAFT') ?? null,
    }));

    res.json({ status: 'success', data: { workflows } });
  });

  listVersions = asyncHandler(async (req: Request, res: Response) => {
    const workflowTypeId = req.params.workflowTypeId as string;
    const versions = await versionService.listVersions(workflowTypeId);
    res.json({ status: 'success', data: { versions } });
  });

  createDraft = asyncHandler(async (req: Request, res: Response) => {
    const workflowTypeId = req.params.workflowTypeId as string;
    const draft = await versionService.createDraft(workflowTypeId);
    res.status(201).json({ status: 'success', data: { draft } });
  });

  getVersion = asyncHandler(async (req: Request, res: Response) => {
    const versionId = req.params.versionId as string;
    const detail = await versionService.getVersionDetail(versionId);
    res.json({ status: 'success', data: detail });
  });

  updateNodes = asyncHandler(async (req: Request, res: Response) => {
    const { upsert = [], remove = [] } = req.body;
    validateBatch(upsert, remove, ['id']);
    validateNodeBatch(upsert);
    const versionId = req.params.versionId as string;
    await graphService.updateNodes(versionId, upsert, remove);
    res.json({ status: 'success', data: { upserted: upsert.length, removed: remove.length } });
  });

  updateEdges = asyncHandler(async (req: Request, res: Response) => {
    const { upsert = [], remove = [] } = req.body;
    validateBatch(upsert, remove, ['id', 'fromNodeId', 'toNodeId']);
    validateEdgeBatch(upsert);
    const versionId = req.params.versionId as string;
    await graphService.updateEdges(versionId, upsert, remove);
    res.json({ status: 'success', data: { upserted: upsert.length, removed: remove.length } });
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const versionId = req.params.versionId as string;
    const { validation } = await versionService.getVersionDetail(versionId);
    res.json({ status: 'success', data: { validation } });
  });

  publish = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const versionId = req.params.versionId as string;
    const result = await versionService.publishVersion(versionId, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  rollback = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const versionId = req.params.versionId as string;
    const result = await versionService.rollbackToVersion(versionId, req.user!.id);
    res.json({ status: 'success', data: result });
  });

  discard = asyncHandler(async (req: Request, res: Response) => {
    const versionId = req.params.versionId as string;
    await versionService.discardDraft(versionId);
    res.json({ status: 'success', data: { discarded: true } });
  });
}