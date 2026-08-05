/**
 * P2-4: Application Comment Controller
 * HTTP handlers for comment CRUD and score-status endpoints.
 */

import { Request, Response } from 'express';
import prisma from '../../utils/prisma';
import * as commentService from '../services/comment.service';
import { scoringService } from '../services/scoring.service';

/** GET /applications/:id/comments?page=1&limit=50 */
export async function listComments(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const page = parseInt(String(req.query.page)) || 1;
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200);
    const user = (req as any).user;
    // Roles can be strings ['ADMIN', 'AGENT'] or objects [{name: 'credit:read'}]
    const hasPermission = (user.roles || []).some((r: any) =>
      typeof r === 'string'
        ? ['ADMIN', 'AGENT'].includes(r)
        : ['credit:read', 'credit:write', 'credit:approve', 'credit:admin'].includes(r.name || r)
    );
    const includeInternal = hasPermission !== false;

    const result = await commentService.listComments(id, page, limit, includeInternal);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list comments' });
  }
}

/** POST /applications/:id/comments */
export async function createComment(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { content, parentId, isInternal } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const comment = await commentService.createComment(id, user.id, {
      content: content.trim(),
      parentId,
      isInternal: isInternal ?? true,
    });
    res.status(201).json({ data: comment });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 :
                   err.message.includes('Cannot reply') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
}

/** PATCH /comments/:commentId */
export async function updateComment(req: Request, res: Response) {
  try {
    const commentId = String(req.params.commentId);
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { content, isInternal } = req.body;
    const comment = await commentService.updateComment(commentId, user.id, {
      content: content?.trim(),
      isInternal,
    });
    res.json({ data: comment });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 :
                   err.message.includes('Only the author') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
}

/** DELETE /comments/:commentId */
export async function deleteComment(req: Request, res: Response) {
  try {
    const commentId = String(req.params.commentId);
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const isAdmin = (user.roles || []).some((r: any) =>
      typeof r === 'string' ? r === 'ADMIN' : r.name === 'credit:admin'
    );
    await commentService.deleteComment(commentId, user.id, isAdmin);
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 :
                   err.message.includes('Not authorized') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
}

/** GET /applications/:id/score-status */
export async function getScoreStatus(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const status = await commentService.getScoreStatus(id);
    res.json({ data: status });
  } catch (err: any) {
    const httpStatus = err.message.includes('not found') ? 404 : 500;
    res.status(httpStatus).json({ error: err.message });
  }
}

/** POST /applications/:id/rescore — trigger rescore */
export async function rescoreApplication(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const app = await prisma.creditApplication.findUnique({ where: { id }, select: { id: true } });
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const result = await scoringService.executeScore(
      id,
      undefined,
      { actorId: (req as any).user?.id ?? null, source: 'RESCORE' },
    );
    res.json({
      data: {
        scoreRunId: result.scoreRun.id,
        riskRating: result.riskRating,
        totalScore: result.totalScore,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger rescore' });
  }
}