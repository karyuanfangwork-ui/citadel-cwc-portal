import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { exposureSummaryService } from '../services/exposureSummary.service';

class ExposureSummaryController {
  get = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const summary = await exposureSummaryService.getByApplication(applicationId);
    res.json({ status: 'success', data: { exposureSummary: summary } });
  });

  upsert = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const summary = await exposureSummaryService.upsert(applicationId, req.body);
    res.json({ status: 'success', data: { exposureSummary: summary } });
  });
}

export const exposureSummaryController = new ExposureSummaryController();
