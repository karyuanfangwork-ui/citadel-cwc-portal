import { Request, Response } from 'express';

import { asyncHandler } from '../middleware/error.middleware';
import prisma from '../utils/prisma';
import * as graphService from '../services/workflowGraph.service';
import * as versionService from '../services/workflowVersion.service';

/** Express augments Request with `user` in the auth middleware. */
interface AuthedRequest extends Request {
  user?: { id: string };
}

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
    if (!Array.isArray(upsert) || !Array.isArray(remove)) {
      res.status(400).json({ status: 'error', message: 'upsert and remove must be arrays' });
      return;
    }
    const versionId = req.params.versionId as string;
    await graphService.upsertNodes(versionId, upsert);
    await graphService.deleteNodes(versionId, remove);
    res.json({ status: 'success', data: { upserted: upsert.length, removed: remove.length } });
  });

  updateEdges = asyncHandler(async (req: Request, res: Response) => {
    const { upsert = [], remove = [] } = req.body;
    if (!Array.isArray(upsert) || !Array.isArray(remove)) {
      res.status(400).json({ status: 'error', message: 'upsert and remove must be arrays' });
      return;
    }
    const versionId = req.params.versionId as string;
    await graphService.upsertEdges(versionId, upsert);
    await graphService.deleteEdges(versionId, remove);
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