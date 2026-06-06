import { Request, Response, NextFunction } from 'express';
import {
  getBureauChecklist,
  upsertBureauChecklist,
  verifyChecklist,
} from '../services/bureauCheck.service';
import prisma from '../../utils/prisma';

export async function getChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const checklist = await getBureauChecklist(String(req.params.appId));
    res.json({ data: checklist });
  } catch (err) {
    next(err);
  }
}

export async function upsertChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const checklist = await upsertBureauChecklist(String(req.params.appId), userId, req.body);
    res.json({ data: checklist });
  } catch (err) {
    next(err);
  }
}

export async function verifyBureauChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const checklist = await verifyChecklist(String(req.params.appId), userId);
    res.json({ data: checklist });
  } catch (err) {
    next(err);
  }
}

export async function updateBureauCheckStructured(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await prisma.creditBureauCheck.update({
      where: { id: String(req.params.checkId) },
      data: req.body,
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}