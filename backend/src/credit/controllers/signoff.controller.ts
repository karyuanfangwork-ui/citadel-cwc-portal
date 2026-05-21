import { Request, Response, NextFunction } from 'express';
import * as svc from '../services/signoff.service';
import { SignoffRole } from '@prisma/client';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.listByApplication(String(req.params.appId))); } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const data = {
      role: req.body.role as SignoffRole,
      signedById: user.id,
      designationSnapshot: req.body.designationSnapshot,
      ipAddress: req.ip ?? null,
    };
    const signoff = await svc.create(String(req.params.appId), data);
    res.status(201).json(signoff);
  } catch (e) {
    const err = e as any;
    if (err.status) res.status(err.status).json({ error: err.message });
    else next(e);
  }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    await svc.revoke(String(req.params.appId), req.params.role as SignoffRole, user.id);
    res.status(204).end();
  } catch (e) {
    const err = e as any;
    if (err.status) res.status(err.status).json({ error: err.message });
    else next(e);
  }
}
