import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/industryAssessment.service';

export async function get(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getByApplication(String(req.params.appId)) ?? null); } catch (e) { next(e); }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.upsert(String(req.params.appId), req.body)); } catch (e) { next(e); }
}
