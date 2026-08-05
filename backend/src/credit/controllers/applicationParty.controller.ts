import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { applicationPartyService } from '../services/applicationParty.service';
import { requireUser } from '../utils/requireUser';

class ApplicationPartyController {
  /**
   * GET /applications/:applicationId/parties
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await applicationPartyService.listParties({
      applicationId,
      page,
      limit,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /parties/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const party = await applicationPartyService.getParty(id);

    if (!party) {
      throw new AppError('Application party not found', 404);
    }

    res.json({ status: 'success', data: { party } });
  });

  /**
   * POST /applications/:applicationId/parties
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const applicationId = String(req.params.applicationId);
    const party = await applicationPartyService.createParty({ ...req.body, applicationId }, user.id);
    res.status(201).json({ status: 'success', data: { party } });
  });

  /**
   * PATCH /parties/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const party = await applicationPartyService.updateParty(id, req.body, user.id);

    if (!party) {
      throw new AppError('Application party not found', 404);
    }

    res.json({ status: 'success', data: { party } });
  });

  /**
   * DELETE /parties/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = requireUser(req);
    const id = String(req.params.id);
    const party = await applicationPartyService.deleteParty(id, user.id);

    if (!party) {
      throw new AppError('Application party not found', 404);
    }

    res.json({ status: 'success', message: 'Application party deleted successfully' });
  });
}

export const applicationPartyController = new ApplicationPartyController();