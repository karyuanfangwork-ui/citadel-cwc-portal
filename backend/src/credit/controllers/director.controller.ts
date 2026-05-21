import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { directorService } from '../services/director.service';

class DirectorController {
  /**
   * GET /borrowers/:borrowerProfileId/directors
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const activeOnly = req.query.activeOnly === 'true';

    const result = await directorService.listDirectors({
      borrowerProfileId,
      activeOnly,
      page,
      limit,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /directors/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const director = await directorService.getDirector(id, req.user?.id);

    if (!director) {
      throw new AppError('Director not found', 404);
    }

    res.json({ status: 'success', data: { director } });
  });

  /**
   * POST /borrowers/:borrowerProfileId/directors
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const director = await directorService.createDirector({ ...req.body, borrowerProfileId });
    res.status(201).json({ status: 'success', data: { director } });
  });

  /**
   * PATCH /directors/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const director = await directorService.updateDirector(id, req.body);

    if (!director) {
      throw new AppError('Director not found', 404);
    }

    res.json({ status: 'success', data: { director } });
  });

  /**
   * GET /directors/:id/nric-reveal
   */
  revealNric = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const nric = await directorService.revealNric(id, req.user.id);
    if (nric === null) throw new AppError('Director not found or no NRIC on record', 404);
    res.json({ status: 'success', data: { nric } });
  });

  /**
   * DELETE /directors/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const director = await directorService.deleteDirector(id);

    if (!director) {
      throw new AppError('Director not found', 404);
    }

    res.json({ status: 'success', message: 'Director deleted successfully' });
  });
}

export const directorController = new DirectorController();