import { Response } from 'express';
import * as svc from '../services/industryAssessment.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { requireUser } from '../utils/requireUser';
import { asyncHandler } from '../../middleware/error.middleware';

export const get = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await svc.getByApplication(String(req.params.appId)) ?? null);
});

export const upsert = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  res.json(await svc.upsert(String(req.params.appId), req.body, user.id));
});