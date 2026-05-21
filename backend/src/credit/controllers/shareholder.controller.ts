import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { shareholderService } from '../services/shareholder.service';

class ShareholderController {
  /**
   * GET /borrowers/:borrowerProfileId/shareholders
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await shareholderService.listShareholders({
      borrowerProfileId,
      page,
      limit,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /shareholders/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const shareholder = await shareholderService.getShareholder(id, req.user?.id);

    if (!shareholder) {
      throw new AppError('Shareholder not found', 404);
    }

    res.json({ status: 'success', data: { shareholder } });
  });

  /**
   * POST /borrowers/:borrowerProfileId/shareholders
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const shareholder = await shareholderService.createShareholder({ ...req.body, borrowerProfileId });
    res.status(201).json({ status: 'success', data: { shareholder } });
  });

  /**
   * PATCH /shareholders/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const shareholder = await shareholderService.updateShareholder(id, req.body);

    if (!shareholder) {
      throw new AppError('Shareholder not found', 404);
    }

    res.json({ status: 'success', data: { shareholder } });
  });

  /**
   * GET /shareholders/:id/nric-reveal
   */
  revealNric = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const nric = await shareholderService.revealNric(id, req.user.id);
    if (nric === null) throw new AppError('Shareholder not found or no NRIC on record', 404);
    res.json({ status: 'success', data: { nric } });
  });

  /**
   * DELETE /shareholders/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const shareholder = await shareholderService.deleteShareholder(id);

    if (!shareholder) {
      throw new AppError('Shareholder not found', 404);
    }

    res.json({ status: 'success', message: 'Shareholder deleted successfully' });
  });
}

export const shareholderController = new ShareholderController();