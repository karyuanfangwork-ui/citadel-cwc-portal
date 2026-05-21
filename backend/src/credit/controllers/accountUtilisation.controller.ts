import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/accountUtilisation.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listByApplication(String(req.params.appId));
    res.json(data);
  } catch (e) { next(e); }
}

export async function upsertOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.upsert(String(req.params.appId), req.body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.remove(String(req.params.id));
    res.status(204).end();
  } catch (e) { next(e); }
}
