import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/rmdIssue.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listByApplication(String(req.params.appId))); } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await svc.create(String(req.params.appId), req.body)); } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.update(String(req.params.id), req.body)); } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try { await svc.remove(String(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
}
