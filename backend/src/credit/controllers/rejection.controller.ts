import { Request, Response, NextFunction } from 'express';
import { rejectionService, getRejectionReasonLabels } from '../services/rejection.service';

export async function cloneFromRejected(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const userId = (req as any).user?.id;
    const newAppId = await rejectionService.copyToNewApplication(applicationId, userId);
    res.status(201).json({ status: 'success', data: { id: newAppId } });
  } catch (err) {
    next(err);
  }
}

export async function listRejectionReasons(_req: Request, res: Response, next: NextFunction) {
  try {
    const labels = getRejectionReasonLabels();
    res.json({ status: 'success', data: labels });
  } catch (err) {
    next(err);
  }
}