import { Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { projectionService } from '../services/projection.service';

class ProjectionController {
  get = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const projection = await projectionService.getByApplication(applicationId);
    res.json({ status: 'success', data: { cashflowProjection: projection } });
  });

  upsertHeader = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const projection = await projectionService.upsertHeader(applicationId, req.body.assumptions);
    res.json({ status: 'success', data: { cashflowProjection: projection } });
  });

  upsertLines = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const { lines } = req.body as { lines: any[] };
    const projection = await projectionService.upsertLines(applicationId, lines);
    res.json({ status: 'success', data: { cashflowProjection: projection } });
  });
}

export const projectionController = new ProjectionController();
