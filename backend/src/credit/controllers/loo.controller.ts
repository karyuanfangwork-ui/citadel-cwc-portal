import { Request, Response, NextFunction } from 'express';
import { looService } from '../services/loo.service';
import { asyncHandler } from '../../middleware/error.middleware';

export async function generateLoo(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const userId = (req as any).user?.id;
    const result = await looService.generate(applicationId, userId);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function regenerateLoo(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const userId = (req as any).user?.id;
    const result = await looService.regenerate(applicationId, userId);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getLooStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const status = await looService.getStatus(applicationId);
    res.json({ status: 'success', data: status });
  } catch (err) {
    next(err);
  }
}

export async function getLooDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = String(req.params.appId);
    const documentId = await looService.getLooDocument(applicationId);
    if (!documentId) {
      res.status(404).json({ status: 'error', message: 'No LOO document found' });
      return;
    }
    // Redirect to document download endpoint
    res.json({ status: 'success', data: { documentId } });
  } catch (err) {
    next(err);
  }
}

// §6.3 — LOO Expiry Check (manual trigger / scheduler)
export const checkLooExpiry = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const result = await looService.checkAndNotifyExpiring();
  res.json({ status: 'success', data: result });
});