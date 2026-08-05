import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/sicr.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listByApplication(String(req.params.appId))); } catch (e) { next(e); }
}

export async function bulkUpsert(req: Request, res: Response, next: NextFunction) {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    res.json(await svc.bulkUpsert(String(req.params.appId), items));
  } catch (e) { next(e); }
}
