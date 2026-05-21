import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/walletShare.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listByApplication(String(req.params.appId));
    res.json(data);
  } catch (e) { next(e); }
}

export async function bulkUpsert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.bulkUpsert(String(req.params.appId), req.body.shares ?? req.body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.remove(String(req.params.shareId));
    res.status(204).end();
  } catch (e) { next(e); }
}
