import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { uboService } from '../services/ubo.service';

class UboController {
  /**
   * GET /borrowers/:borrowerProfileId/ubos
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const result = await uboService.listUbos({
      borrowerProfileId,
      page,
      limit,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /ubos/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const ubo = await uboService.getUbo(id);

    if (!ubo) {
      throw new AppError('UBO not found', 404);
    }

    res.json({ status: 'success', data: { ubo } });
  });

  /**
   * POST /borrowers/:borrowerProfileId/ubos
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const ubo = await uboService.createUbo({ ...req.body, borrowerProfileId });
    res.status(201).json({ status: 'success', data: { ubo } });
  });

  /**
   * PATCH /ubos/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const ubo = await uboService.updateUbo(id, req.body);

    if (!ubo) {
      throw new AppError('UBO not found', 404);
    }

    res.json({ status: 'success', data: { ubo } });
  });

  /**
   * DELETE /ubos/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const ubo = await uboService.deleteUbo(id);

    if (!ubo) {
      throw new AppError('UBO not found', 404);
    }

    res.json({ status: 'success', message: 'UBO deleted successfully' });
  });
}

export const uboController = new UboController();