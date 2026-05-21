import { Response } from 'express';
import * as svc from '../services/riskAssessment.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { requireUser } from '../utils/requireUser';
import { asyncHandler } from '../../middleware/error.middleware';

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await svc.listByApplication(String(req.params.appId)));
});

export const bulkUpsert = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const items = Array.isArray(req.body) ? req.body : req.body.items;
  res.json(await svc.bulkUpsert(String(req.params.appId), items, user.id));
});