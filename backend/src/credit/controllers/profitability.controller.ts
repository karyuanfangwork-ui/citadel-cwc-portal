import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/profitability.service';

export async function getByApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getByApplication(String(req.params.appId));
    res.json(data ?? null);
  } catch (e) { next(e); }
}

export async function upsert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.upsert(String(req.params.appId), req.body);
    res.json(data);
  } catch (e) { next(e); }
}
