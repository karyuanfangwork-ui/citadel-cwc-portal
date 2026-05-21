import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/keyCounterparty.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listByProfile(String(req.params.profileId));
    res.json(data);
  } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(String(req.params.profileId), req.body);
    res.status(201).json(data);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.update(String(req.params.id), req.body);
    res.json(data);
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.remove(String(req.params.id));
    res.status(204).end();
  } catch (e) { next(e); }
}
