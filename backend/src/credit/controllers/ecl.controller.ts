import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { eclService } from '../services/ecl.service';

class EclController {
  listSnapshots = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const snapshots = await eclService.listSnapshots(applicationId);
    res.json({ status: 'success', data: { eclSnapshots: snapshots } });
  });

  createSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const snapshot = await eclService.createSnapshot({ ...req.body, applicationId });
    res.status(201).json({ status: 'success', data: { eclSnapshot: snapshot } });
  });

  updateSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.snapshotId);
    const snapshot = await eclService.updateSnapshot(id, req.body);
    if (!snapshot) throw new AppError('ECL snapshot not found', 404);
    res.json({ status: 'success', data: { eclSnapshot: snapshot } });
  });

  deleteSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.snapshotId);
    const snapshot = await eclService.deleteSnapshot(id);
    if (!snapshot) throw new AppError('ECL snapshot not found', 404);
    res.json({ status: 'success', message: 'ECL snapshot deleted' });
  });

  listForecasts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const forecasts = await eclService.listForecasts(applicationId);
    res.json({ status: 'success', data: { eclForecasts: forecasts } });
  });

  upsertForecast = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const forecastYear = parseInt(String(req.params.year), 10);
    if (isNaN(forecastYear) || forecastYear < 1 || forecastYear > 3) {
      throw new AppError('forecastYear must be 1, 2, or 3', 400);
    }
    const forecast = await eclService.upsertForecast(applicationId, { ...req.body, forecastYear });
    res.json({ status: 'success', data: { eclForecast: forecast } });
  });
}

export const eclController = new EclController();
